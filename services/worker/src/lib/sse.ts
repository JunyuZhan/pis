/**
 * @fileoverview SSE (Server-Sent Events) 实时推送模块
 *
 * 实现照片上传/处理后的实时推送通知
 * 使用 Redis Pub/Sub 作为消息中间件
 *
 * @module lib/sse
 */

import { Redis } from 'ioredis';

/**
 * Redis 客户端（用于 Pub/Sub）
 */
let redisClient: Redis | null = null;

/**
 * SSE 客户端连接集合
 */
const clients: Map<string, Set<(data: string) => void>> = new Map();

/**
 * 获取 Redis 客户端（用于 Pub/Sub）
 */
export async function getRedisClient(): Promise<Redis> {
  if (redisClient && redisClient.status === 'ready') {
    return redisClient;
  }

  redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
    lazyConnect: true,
  });

  redisClient.on('error', (err: Error) => {
    console.error('[SSE] Redis client error:', err);
  });

  await redisClient.connect();

  // 订阅照片事件
  await redisClient.subscribe('pis:photo-events');

  redisClient.on('message', (_channel: string, message: string) => {
    broadcastToAlbum(message);
  });

  console.log('[SSE] Redis client connected and subscribed');
  return redisClient;
}

/**
 * 向指定相册的所有客户端广播消息
 */
function broadcastToAlbum(message: string) {
  try {
    const data = JSON.parse(message);
    const albumId = data.albumId;

    if (albumId && clients.has(albumId)) {
      const albumClients = clients.get(albumId);
      const eventData = `event: ${data.type}\ndata: ${JSON.stringify(data)}\n\n`;

      albumClients?.forEach((send) => {
        try {
          send(eventData);
        } catch (err) {
          console.error('[SSE] Error sending to client:', err);
        }
      });
    }
  } catch (err) {
    console.error('[SSE] Error parsing message:', err);
  }
}

/**
 * 注册客户端到指定相册
 */
export function subscribeToAlbum(albumId: string, send: (data: string) => void): () => void {
  if (!clients.has(albumId)) {
    clients.set(albumId, new Set());
  }

  const albumClients = clients.get(albumId)!;
  albumClients.add(send);

  // 返回取消订阅函数
  return () => {
    albumClients.delete(send);
    if (albumClients.size === 0) {
      clients.delete(albumId);
    }
  };
}

/**
 * 发布照片事件
 */
export async function publishPhotoEvent(
  albumId: string,
  eventType: 'insert' | 'update' | 'delete',
  photoData: Record<string, unknown>
): Promise<void> {
  const client = await getRedisClient();

  const message = JSON.stringify({
    albumId,
    type: eventType,
    photo: photoData,
    timestamp: Date.now(),
  });

  await client.publish('pis:photo-events', message);
}

/**
 * 创建 SSE 连接处理函数
 */
export function createSSEHandler(albumId: string) {
  return function handleSSE(req: any, res: any) {
    // 设置 SSE 响应头
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    // 发送初始连接消息
    res.write('event: connected\ndata: {"status":"connected"}\n\n');

    // 心跳：每 30 秒发送一次
    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 30000);

    // 订阅相册事件
    const unsubscribe = subscribeToAlbum(albumId, (data) => {
      try {
        res.write(data);
      } catch {
        unsubscribe();
      }
    });

    // 清理：客户端断开连接时
    req.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
      console.log(`[SSE] Client disconnected from album: ${albumId}`);
    });

    console.log(`[SSE] New client connected from album: ${albumId}`);
  };
}

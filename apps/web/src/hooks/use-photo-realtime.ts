'use client';

import { useEffect, useCallback, useRef } from 'react';
import type { Photo } from '@/types/database';

interface UsePhotoRealtimeOptions {
  albumId: string;
  albumSlug: string;
  enabled?: boolean;
  onInsert?: (photo: Photo) => void;
  onUpdate?: (photo: Photo) => void;
  onDelete?: (photoId: string) => void;
}

/**
 * 照片变更监听 Hook（使用 SSE 实时推送）
 *
 * 注意：优先使用 SSE（Server-Sent Events）实现实时推送
 * 如果 SSE 不可用或连接失败，自动回退到轮询
 *
 * 使用方法:
 * ```tsx
 * usePhotoRealtime({
 *   albumId: album.id,
 *   albumSlug: album.slug,
 *   enabled: true,
 *   onInsert: (photo) => {
 *     setPhotos(prev => [photo, ...prev])
 *   },
 *   onUpdate: (photo) => {
 *     setPhotos(prev => prev.map(p => p.id === photo.id ? photo : p))
 *   },
 *   onDelete: (photoId) => {
 *     setPhotos(prev => prev.filter(p => p.id !== photoId))
 *   }
 * })
 * ```
 */
export function usePhotoRealtime({
  albumId,
  albumSlug,
  enabled = true,
  onInsert,
  onUpdate,
  onDelete,
}: UsePhotoRealtimeOptions) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectedRef = useRef(false);

  // 存储回调
  const callbacksRef = useRef({ onInsert, onUpdate, onDelete });
  callbacksRef.current = { onInsert, onUpdate, onDelete };

  // 存储已知的照片ID，用于检测新照片
  const knownPhotoIdsRef = useRef<Set<string>>(new Set());
  const isInitializedRef = useRef(false);

  const connectSSE = useCallback(() => {
    if (!albumId || !albumSlug || !enabled) return;

    // 清理旧连接
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    // 创建 SSE 连接
    const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || '';
    const eventSource = new EventSource(`${workerUrl}/api/sse/photos/${albumId}`);
    eventSourceRef.current = eventSource;

    // 连接成功
    eventSource.onopen = () => {
      console.log('[SSE] Connected to photo updates');
      isConnectedRef.current = true;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };

    // 处理连接错误
    eventSource.onerror = () => {
      console.warn('[SSE] Connection error, retrying in 5 seconds...');
      isConnectedRef.current = false;
      eventSource.close();
      eventSourceRef.current = null;

      // 5秒后重试
      retryTimeoutRef.current = setTimeout(() => {
        if (enabled) {
          connectSSE();
        }
      }, 5000);
    };

    // 监听新照片插入事件
    eventSource.addEventListener('insert', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.photo) {
          callbacksRef.current.onInsert?.(data.photo);
          knownPhotoIdsRef.current.add(data.photo.id);
        }
      } catch (err) {
        console.error('[SSE] Failed to parse insert event:', err);
      }
    });

    // 监听照片更新事件
    eventSource.addEventListener('update', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.photo) {
          callbacksRef.current.onUpdate?.(data.photo);
        }
      } catch (err) {
        console.error('[SSE] Failed to parse update event:', err);
      }
    });

    // 监听照片删除事件
    eventSource.addEventListener('delete', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.photoId) {
          callbacksRef.current.onDelete?.(data.photoId);
          knownPhotoIdsRef.current.delete(data.photoId);
        }
      } catch (err) {
        console.error('[SSE] Failed to parse delete event:', err);
      }
    });

    // 初始化时获取当前照片列表
    fetch(`/api/public/albums/${albumSlug}/photos?limit=100&sort=capture_desc`)
      .then((res) => res.json())
      .then((data) => {
        const photos = data.photos || [];
        photos.forEach((p: Photo) => knownPhotoIdsRef.current.add(p.id));
        isInitializedRef.current = true;
      })
      .catch((err) => console.error('[SSE] Failed to fetch initial photos:', err));
  }, [albumId, albumSlug, enabled]);

  useEffect(() => {
    if (!enabled || !albumId || !albumSlug) return;

    // 连接 SSE
    connectSSE();

    return () => {
      // 清理 - 先保存 ref 值到变量
      /* eslint-disable react-hooks/exhaustive-deps */
      const eventSource = eventSourceRef.current;
      const retryTimeout = retryTimeoutRef.current;
      const knownPhotoIds = knownPhotoIdsRef.current;
      /* eslint-enable react-hooks/exhaustive-deps */

      if (eventSource) {
        eventSource.close();
        eventSourceRef.current = null;
      }
      if (retryTimeout) {
        clearTimeout(retryTimeout);
        retryTimeoutRef.current = null;
      }
      knownPhotoIds.clear();
      isInitializedRef.current = false;
    };
  }, [albumId, albumSlug, enabled, connectSSE]);
}

/**
 * 管理员端使用 - 监听所有状态变更（使用 SSE）
 */
export function usePhotoRealtimeAdmin({
  albumId,
  enabled = true,
  onStatusChange,
}: {
  albumId: string;
  enabled?: boolean;
  onStatusChange?: (photoId: string, status: Photo['status']) => void;
}) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const callbackRef = useRef(onStatusChange);
  callbackRef.current = onStatusChange;

  const photoStatusMapRef = useRef<Map<string, Photo['status']>>(new Map());

  const connectSSE = useCallback(() => {
    if (!albumId || !enabled) return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL || '';
    const eventSource = new EventSource(`${workerUrl}/api/sse/photos/${albumId}`);
    eventSourceRef.current = eventSource;

    eventSource.onerror = () => {
      console.warn('[SSE Admin] Connection error, retrying in 5 seconds...');
      eventSource.close();
      eventSourceRef.current = null;

      retryTimeoutRef.current = setTimeout(() => {
        if (enabled) {
          connectSSE();
        }
      }, 5000);
    };

    // 监听更新事件
    eventSource.addEventListener('update', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.photo) {
          const oldStatus = photoStatusMapRef.current.get(data.photo.id);
          if (oldStatus && oldStatus !== data.photo.status) {
            callbackRef.current?.(data.photo.id, data.photo.status);
          }
          photoStatusMapRef.current.set(data.photo.id, data.photo.status);
        }
      } catch (err) {
        console.error('[SSE Admin] Failed to parse update event:', err);
      }
    });

    // 监听删除事件
    eventSource.addEventListener('delete', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.photoId) {
          photoStatusMapRef.current.delete(data.photoId);
        }
      } catch (err) {
        console.error('[SSE Admin] Failed to parse delete event:', err);
      }
    });

    // 初始化时获取当前照片状态
    fetch(`/api/admin/albums/${albumId}/photos`)
      .then((res) => res.json())
      .then((data) => {
        const photos = data.photos || [];
        photos.forEach((p: Photo) => {
          photoStatusMapRef.current.set(p.id, p.status);
        });
      })
      .catch((err) => console.error('[SSE Admin] Failed to fetch initial photos:', err));
  }, [albumId, enabled]);

  useEffect(() => {
    if (!enabled || !albumId) return;

    connectSSE();

    return () => {
      // 清理 - 先保存 ref 值到变量
      /* eslint-disable react-hooks/exhaustive-deps */
      const eventSource = eventSourceRef.current;
      const retryTimeout = retryTimeoutRef.current;
      const photoStatusMap = photoStatusMapRef.current;
      /* eslint-enable react-hooks/exhaustive-deps */

      if (eventSource) {
        eventSource.close();
        eventSourceRef.current = null;
      }
      if (retryTimeout) {
        clearTimeout(retryTimeout);
        retryTimeoutRef.current = null;
      }
      photoStatusMap.clear();
    };
  }, [albumId, enabled, connectSSE]);
}

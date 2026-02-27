/**
 * @fileoverview FTP 服务器模块
 *
 * @description
 * 提供 FTP 文件上传服务，支持：
 * - 基于 Album ID 或 Slug 的认证
 * - 自动上传到存储
 * - 自动触发照片处理任务
 * - 被动模式支持
 *
 * @module worker/ftp-server
 *
 * @example
 * ```typescript
 * import { ftpServerService } from './ftp-server'
 *
 * await ftpServerService.start()
 * ```
 */

import { FtpSrv, FileSystem } from "ftp-srv";
import { networkInterfaces } from "os";
import { join, parse } from "path";
import { createReadStream, promises as fs } from "fs";
import { uploadBuffer } from "./lib/storage/index.js";
import { photoQueue } from "./lib/redis.js";
import logger from "./lib/logger.js";
import { v4 as uuidv4, validate as validateUuid } from "uuid";
// 延迟导入数据库客户端，确保环境变量已加载
// import { db } from "./lib/database/client.js";
let db: any = null;

// FTP 上传安全配置
const FTP_MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
const FTP_ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.tiff', '.bmp'];
const FTP_ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/tiff',
  'image/bmp'
];

// 延迟获取数据库客户端
async function getDb() {
  if (!db) {
    const dbModule = await import("./lib/database/client.js");
    db = dbModule.db;
  }
  return db;
}

/**
 * 获取外网 IP 地址（用于被动模式）
 *
 * @returns {string} 外网 IP 地址
 *
 * @internal
 */
function getExternalIp(): string {
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      // Skip internal and non-IPv4 addresses
      if (net.family === "IPv4" && !net.internal) {
        return net.address;
      }
    }
  }
  return "127.0.0.1";
}

/**
 * PIS 文件系统（自定义 FTP 文件系统）
 *
 * @description
 * 继承 ftp-srv 的 FileSystem，重写 write 方法以实现：
 * - 自动上传到存储
 * - 自动创建数据库记录
 * - 自动触发照片处理任务
 *
 * @class
 * @extends {FileSystem}
 */
class PISFileSystem extends FileSystem {
  /** 关联的相册 ID */
  private albumId: string;

  /**
   * 创建文件系统实例
   *
   * @param {any} connection - FTP 连接对象
   * @param {Object} options - 文件系统选项
   * @param {string} options.root - 根目录路径
   * @param {string} options.cwd - 当前工作目录
   * @param {string} albumId - 相册 ID
   */
  constructor(
    connection: any,
    { root, cwd }: { root: string; cwd: string },
    albumId: string,
  ) {
    super(connection, { root, cwd });
    this.albumId = albumId;
  }

  /**
   * 重写 write 方法，实现上传完成后的自动处理
   *
   * @description
   * 1. 写入本地临时文件
   * 2. 上传完成时自动上传到存储
   * 3. 创建数据库记录
   * 4. 触发照片处理任务
   * 5. 清理本地临时文件
   *
   * @param {string} fileName - 文件名
   * @param {Object} options - 写入选项
   * @param {boolean} [options.append] - 是否追加
   * @param {any} [options.start] - 起始位置
   * @returns {any} 文件写入流
   */
  write(
    fileName: string,
    {
      append = false,
      start = undefined,
    }: { append?: boolean; start?: any } = {},
  ) {
    // Call super to handle the actual file writing to local temp dir
    // super.write 返回 { stream, clientPath }
    const result = super.write(fileName, { append, start });
    const { stream, clientPath } = result as {
      stream: any;
      clientPath: string;
    };

    // Get absolute path - 直接使用 root + fileName 构建路径
    const cleanFileName = fileName.startsWith("/")
      ? fileName.slice(1)
      : fileName;
    const fsPath = join(this.root, cleanFileName);

    const cleanupFile = async (reason: string) => {
      try {
        await fs.unlink(fsPath);
        logger.info({ fileName, fsPath, reason }, "🧹 Temp file cleaned up");
      } catch (cleanupErr) {
        if ((cleanupErr as NodeJS.ErrnoException).code !== "ENOENT") {
          logger.error(
            { cleanupErr, fileName, fsPath },
            "❌ Failed to cleanup temp file",
          );
        }
      }
    };

    let processingFailed = false;

    // 超时保护：防止客户端连接后不传输数据（2分钟超时）
    const timeoutId = setTimeout(() => {
      if (!processingFailed) {
        logger.warn({ fileName, fsPath }, "⏱️ Upload timeout, cleaning up");
        processingFailed = true;
        cleanupFile("timeout").catch((err) => {
          logger.error({ err, fileName }, "❌ Timeout cleanup failed");
        });
      }
    }, 120000);

    // 处理上传的包装函数，用于清理超时计时器
    const wrappedProcessUpload = async () => {
      clearTimeout(timeoutId);
      try {
        // 上传处理逻辑
        logger.info(
          { fileName, fsPath, albumId: this.albumId },
          "📸 FTP Upload completed, starting processing...",
        );

        const cleanPath = fileName.startsWith("/")
          ? fileName.slice(1)
          : fileName;
        const originalName = cleanPath.split("/").pop() || "unknown.jpg";

        const fileBuffer = await fs.readFile(fsPath);

        // ========== 安全检查：文件大小限制 ==========
        if (fileBuffer.length > FTP_MAX_FILE_SIZE) {
          logger.error(
            { fileName, fileSize: fileBuffer.length, maxSize: FTP_MAX_FILE_SIZE },
            "❌ File too large for FTP upload"
          );
          throw new Error(`File too large. Maximum size is ${FTP_MAX_FILE_SIZE / 1024 / 1024}MB`);
        }

        // ========== 安全检查：文件类型验证 ==========
        const extension = parse(originalName).ext.toLowerCase();
        
        // 检查扩展名
        if (!FTP_ALLOWED_EXTENSIONS.includes(extension)) {
          logger.error(
            { fileName, extension },
            "❌ Invalid file extension for FTP upload"
          );
          throw new Error(`Invalid file type. Allowed extensions: ${FTP_ALLOWED_EXTENSIONS.join(', ')}`);
        }

        // 根据扩展名设置正确的 MIME 类型
        let mimeType = 'image/jpeg';
        if (extension === '.png') mimeType = 'image/png';
        else if (extension === '.gif') mimeType = 'image/gif';
        else if (extension === '.webp') mimeType = 'image/webp';
        else if (extension === '.heic' || extension === '.heif') mimeType = 'image/heic';
        else if (extension === '.tiff' || extension === '.tif') mimeType = 'image/tiff';
        else if (extension === '.bmp') mimeType = 'image/bmp';

        const photoId = uuidv4();
        const storageKey = `raw/${this.albumId}/${photoId}${extension}`;

        await uploadBuffer(storageKey, fileBuffer, {
          "Content-Type": mimeType,
          "x-amz-meta-original-name": encodeURIComponent(originalName),
        });

        logger.info(
          { photoId, albumId: this.albumId, storageKey },
          "☁️  Uploaded to Storage",
        );

        const database = await getDb();
        const { error: insertError } = await database.from("photos").insert({
          id: photoId,
          album_id: this.albumId,
          filename: originalName,
          original_key: storageKey,
          status: "pending",
          file_size: fileBuffer.length,
          mime_type: mimeType,
        });

        if (insertError) {
          logger.error(
            { insertError, photoId },
            "❌ Failed to insert photo record",
          );
          throw new Error("Database insert failed");
        }

        await photoQueue.add(
          "process-photo",
          {
            photoId,
            albumId: this.albumId,
            originalKey: storageKey,
          },
          {
            jobId: photoId,
          },
        );

        logger.info({ jobId: photoId }, "🚀 Added to processing queue");
      } catch (err) {
        processingFailed = true;
        logger.error({ err, fileName }, "❌ Error processing FTP upload");
      } finally {
        await cleanupFile(
          processingFailed ? "upload failed" : "upload completed",
        );
      }
    };

    // 旧的 processUpload 函数不再需要，保留它作为别名以保持兼容性
    const processUpload = wrappedProcessUpload;

    stream.once("close", async () => {
      try {
        await processUpload();
      } catch (err) {
        logger.error(
          { err, fileName },
          "❌ Unexpected error in stream close handler",
        );
      }
    });

    stream.on("error", async (err: Error) => {
      logger.error(
        { err, fileName, fsPath },
        "❌ Stream error during FTP upload",
      );
      processingFailed = true;
      try {
        await cleanupFile("stream error");
      } catch (cleanupErr) {
        logger.error(
          { cleanupErr, fileName },
          "❌ Failed to cleanup on stream error",
        );
      }
    });

    stream.on("aborted", async () => {
      logger.warn({ fileName, fsPath }, "⚠️ Client aborted FTP upload");
      processingFailed = true;
      try {
        await cleanupFile("client aborted");
      } catch (cleanupErr) {
        logger.error({ cleanupErr, fileName }, "❌ Failed to cleanup on abort");
      }
    });

    // 返回原始的 { stream, clientPath } 结构
    return result;
  }
}

/**
 * FTP 服务器服务
 *
 * @description
 * 管理 FTP 服务器的启动、停止和认证。
 * 支持基于 Album ID 或 Upload Token 的认证。
 *
 * @class
 */
export class FtpServerService {
  /** FTP 服务器实例 */
  private ftpServer: FtpSrv | null = null;
  /** FTP 根目录路径 */
  private rootPath: string;
  /** 定时清理任务 */
  private cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * 创建 FTP 服务器服务实例
   */
  constructor() {
    this.rootPath = process.env.FTP_ROOT_DIR || join(process.cwd(), "temp_ftp");
  }

  /**
   * 清理临时目录中过期的文件（超过1小时的目录）
   */
  private async cleanupExpiredDirs(): Promise<void> {
    try {
      const stats = await fs.readdir(this.rootPath, { withFileTypes: true });
      const now = Date.now();
      const ONE_HOUR = 60 * 60 * 1000;

      for (const dir of stats) {
        if (!dir.isDirectory()) continue;

        const dirPath = join(this.rootPath, dir.name);
        const dirStats = await fs.stat(dirPath);
        const age = now - dirStats.mtimeMs;

        if (age > ONE_HOUR) {
          try {
            await fs.rm(dirPath, { recursive: true, force: true });
            logger.info(
              { dirPath, age: Math.round(age / 1000 / 60) },
              "🧹 Cleaned up expired FTP temp dir",
            );
          } catch (rmErr) {
            logger.error(
              { rmErr, dirPath },
              "❌ Failed to remove expired temp dir",
            );
          }
        }
      }
    } catch (err) {
      logger.error({ err }, "❌ Error during FTP temp dir cleanup");
    }
  }

  /**
   * 启动 FTP 服务器
   *
   * @description
   * 配置并启动 FTP 服务器，包括：
   * - 监听端口（默认 21）
   * - 被动模式端口范围（30000-30009）
   * - 认证处理（Album ID 或 Slug + Upload Token）
   *
   * @returns {Promise<void>}
   */
  async start() {
    // Ensure root directory exists
    try {
      await fs.mkdir(this.rootPath, { recursive: true });
    } catch (err) {
      // Ignore if exists
    }

    const port = parseInt(process.env.FTP_PORT || "21");
    const pasvStart = parseInt(process.env.FTP_PASV_START || "30000");
    const pasvEnd = parseInt(process.env.FTP_PASV_END || "30009");

    // In Docker, we might need to advertise the public IP or Hostname
    const pasvUrl = process.env.FTP_PASV_URL || getExternalIp();

    this.ftpServer = new FtpSrv({
      url: `ftp://0.0.0.0:${port}`,
      pasv_url: pasvUrl,
      pasv_min: pasvStart,
      pasv_max: pasvEnd,
      anonymous: false,
      greeting: ["Welcome to PIS FTP Server"],
      timeout: 300000, // 5分钟超时，适应大文件上传
    });

    // Handle Authentication
    this.ftpServer.on(
      "login",
      async ({ connection, username, password }, resolve, reject) => {
        try {
          // 获取数据库客户端
          const dbClient = await getDb();
          let albumId = "";

          // 1. Check if username is UUID (Album ID)
          if (validateUuid(username)) {
            const { data: album, error } = await dbClient
              .from("albums")
              .select("id, upload_token, is_public")
              .eq("id", username)
              .single();

            if (error || !album) {
              reject(new Error("Album not found"));
              return;
            }

            if (album.upload_token !== password) {
              reject(new Error("Invalid upload token"));
              return;
            }

            albumId = album.id;
          }
          // 2. Check if username is slug (Short Code)
          else {
            const { data: album, error } = await dbClient
              .from("albums")
              .select("id, upload_token")
              .eq("slug", username)
              .single();

            if (error || !album) {
              reject(new Error("Album not found"));
              return;
            }

            if (album.upload_token !== password) {
              reject(new Error("Invalid upload token"));
              return;
            }

            albumId = album.id;
          }

          // Create album-specific temp dir
          const albumRoot = join(this.rootPath, albumId);
          await fs.mkdir(albumRoot, { recursive: true });

          resolve({
            root: albumRoot,
            cwd: "/",
            fs: new PISFileSystem(
              connection,
              { root: albumRoot, cwd: "/" },
              albumId,
            ) as any,
          });
        } catch (err) {
          logger.error({ err, username }, "Login error");
          reject(new Error("Authentication failed"));
        }
      },
    );

    this.ftpServer.on("client-error", ({ connection, context, error }) => {
      logger.error({ error, context }, "FTP Client Error");
    });

    try {
      await this.ftpServer.listen();
      logger.info(
        {
          port,
          pasvUrl,
          pasvRange: `${pasvStart}-${pasvEnd}`,
        },
        "🚀 FTP Server started",
      );

      this.cleanupInterval = setInterval(
        () => {
          this.cleanupExpiredDirs();
        },
        60 * 60 * 1000,
      );
      this.cleanupExpiredDirs();
    } catch (err) {
      logger.error({ err }, "❌ Failed to start FTP Server");
    }
  }

  /**
   * 停止 FTP 服务器
   *
   * @returns {Promise<void>}
   */
  async stop() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    if (this.ftpServer) {
      await this.ftpServer.close();
      logger.info("FTP Server stopped");
    }
  }
}

/** FTP 服务器服务单例 */
export const ftpServerService = new FtpServerService();

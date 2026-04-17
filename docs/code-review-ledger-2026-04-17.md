# PIS 全仓代码评审台账

**评审日期**：2026-04-17  
**范围**：`apps/web`（Next.js 前后端同仓）、`services/worker`（Node Worker）、抽样 `database` / 配置  
**方法**：静态阅读关键认证/代理/公开 API、模式检索（危险 API、密钥、调试路由）、与现有测试/注释交叉核对；**P1** 全量枚举 Web `route.ts`；**P2** 阅读 Worker `http.createServer` 鉴权顺序并抽样预签名/分片分支。  

## 评审边界与正确性声明

- 本台账记录的问题均有**可定位的源码依据**（路径与行为描述）；修复方案为**针对性工程建议**，实施前请在目标环境回归测试。  
- “全仓 100% 行覆盖”在工程上需结合 SAST、依赖扫描、渗透测试与 CI；本次为**定向深度评审**，未对每一源文件做等价于形式化验证的证明。  

---

## 评审计划与节奏（仓库约定）

| 阶段 | 内容 | 频度 | 产出 |
|------|------|------|------|
| **P0 门禁** | `pnpm test` / lint、环境与密钥最小集检查 | 每次 PR / CI | CI 绿 |
| **P1 API 矩阵** | 枚举 `app/api/**/route.ts`，标信任等级；启发式扫「`/api/admin` 无鉴权标记」「`/api/public` 使用 `createAdminClient`」 | 每周 + 大面积 API 变更时 | 本台账「执行记录」+ 异常清单 |
| **P2 Worker / 存储** | Worker 认证、预签名、multipart、CORS、`WORKER_URL` / `WORKER_API_KEY` 链 | 每两周或发布前 | 更新 SEC/OPS 相关条目 |
| **P3 前端面** | `NEXT_PUBLIC_*`、测试页、客户端敏感调用 | 发布前 | 更新 WEB-* |
| **P4 供应链** | 锁文件与已知 CVE（`pnpm audit` 或平台依赖扫描） | 发布前 | 独立记录或 CI 工件 |

**分支约定**：项目开发规则以 `development` 为主干；评审以**拟合并目标分支**上的代码为准。执行 P1 时工作区当前分支为 `main`（事实记录），与后续在 `development` 上重复跑 P1 **不冲突**——结论以当时分支内容为准。

---

## 执行记录

### 2026-04-17 — P1：Next.js API 路由枚举与启发式扫描

| 指标 | 结果 |
|------|------|
| `apps/web/src/app/api/**/route.ts` 总数 | **88** |
| 顶层分布 | `admin` 68、`public` 10、`auth` 6、`analytics` 1、`debug` 1、`health` 1、`worker` 1 |

**启发式规则（候选生成，非证明）**：若 `route.ts` 正文未匹配 `requireAdmin` / `requireAuth` / `getCurrentUser` / `getUserFromRequest` / `requireRetoucherOrAdmin` / `ApiError.unauthorized` 等常见鉴权模式，则在 **`/api/admin` 路径下**标为「未见鉴权标记」并人工打开文件确认。

**人工复核结论**

- **占位接口（API-004）**：`collaborators`、`collaborations` 等曾为 TODO/501 且无登录态；现已与其它 admin 路由一致增加 **`getCurrentUser` → 401** 骨架（总览表「已修复」）。实装业务时仍需补 **资源级授权**，避免复制旧骨架漏鉴权。
- **误报排除**：`retouch/[id]/upload`、`retouch/tasks` 使用 `requireRetoucherOrAdmin`，**鉴权存在**。
- **`createAdminClient` @ `public`**：**已移除**（`download-selected`、`photos/[id]/select` 改为 `createClient()`，并配合访客相册 JWT / 密码校验）；CI 由 `scripts/utils/check-security.sh` 第 9 步门禁。

**本轮新增条目**：**API-004**、**ANA-001**。

---

### 2026-04-17 — P2：Worker HTTP 入口、鉴权边界与预签名/分片抽样

**入口文件**：`services/worker/src/index.ts`（`http.createServer` 自约 1206 行起）。

**鉴权总规则（评审时快照）**

| 顺序 | 路径 / 条件 | `authenticateRequest` |
|------|-------------|------------------------|
| 1 | `GET /health` | **跳过**（监控） |
| 2 | `GET /api/sse/photos/:albumId` | 评审时曾**跳过**（见原 **WKR-001**） |
| 3 | 其余在分支树中的业务路由 | **必须通过**，否则 **401** |

**当前实现说明（与台账条目对齐）**：**WKR-001** 已在 Worker 将 SSE 纳入 API Key 校验之后；Web 侧经 **`/api/realtime/photos/[albumId]`** 代理。**WKR-002** 已对 `expirySeconds` 做钳制（含 multipart 等分支）。下文保留评审时证据式描述，便于对照历史结论。

`authenticateRequest` 实现见台账 **SEC-002**；Worker 路由树以仓库当前 `services/worker/src/index.ts` 为准。

**抽样结论（预签名 / 分片）— 评审时**

- **`POST /api/presign`**：仅校验 `key` 存在即 `getPresignedPutUrl(key)`；**无** key 前缀/格式白名单（在已持有 `WORKER_API_KEY` 的前提下等价于对桶内任意对象的 PUT 预签名能力——属**服务端密钥信任模型**，需在部署上保证 Worker 不可被公网直连或密钥泄露）。
- **`POST /api/presign/get`**：从 body 读取 `expirySeconds`（默认 300）并传入 `getPresignedGetUrl(key, expirySeconds)`；**未见**对 `expirySeconds` 的类型与**最大值钳制**（见 **WKR-002**，已修复）。
- **分片**：`/api/multipart/init`、`/api/multipart/presign-part` 等对 `key` / `uploadId` / `partNumber` 以**存在性**校验为主；`presign-part` 的 `expirySeconds` 默认 3600，仍可由客户端覆盖，同样归入 **WKR-002**（已钳制）。

**本轮新增条目**：**WKR-001**、**WKR-002**（均已修复，见总览表）。

**下一计划（P3）**：见下方 **「P3 / P4 延续」** 执行记录（本轮已抽样）。

---

### 2026-04-17 — P3 / P4 延续（`development` 工作区抽样）

**P3 — `NEXT_PUBLIC_*`、测试页、客户端 Worker / SSE**

| 检查项 | 结论 |
|--------|------|
| 浏览器端直连 Worker（`NEXT_PUBLIC_WORKER`、裸 `:3001`、`WORKER_URL` 等） | **`apps/web/src` 未命中**；与 **OPS-001 / WKR-001** 修复方向一致 |
| SSE / 实时照片 | **`use-photo-realtime.ts`** 使用同源 **`/api/realtime/photos/${albumId}`**（访客带 `?slug=`），经 Next 代理；**未发现** `EventSource` 指向公网 Worker |
| `NEXT_PUBLIC_*` 进入 bundle | **抽样**：`settings.ts`、`utils.ts`（`NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_MEDIA_URL`）、`use-settings.tsx`（轮询间隔）、`lightbox`、`turnstile`、Supabase 等；**`src/components` 下未见**非 `NEXT_PUBLIC` / `NODE_ENV` 的 `process.env`（避免密钥进客户端） |
| 测试页 | **`/test-turnstile`**：`middleware.ts` 在生产对路径 **404**（**WEB-001**）；页面文件仍存在于仓库，仅生产不可达 |

**残余建议（非缺陷）**：新增面向浏览器的调试页时，沿用「生产 404 或仅本地路由」模式；`NEXT_PUBLIC_MEDIA_URL` 等为**有意公开**的配置，部署时仍应用 HTTPS 与 CDN 策略约束。

**P4 — `pnpm audit`（供应链）**

- 在默认 registry（如 **npmmirror**）下执行 `pnpm audit` 会得到 **`ERR_PNPM_AUDIT_ENDPOINT_NOT_EXISTS`**，**本地无法完成**官方漏洞审计。
- **建议**：CI 或发布前使用 **`registry.npmjs.org`** 跑 `pnpm audit`，或启用 **Dependabot / 平台 SCA**；结果以 CI 工件或独立报告存档，不必强行写入本台账正文。

---

### 2026-04-17 — P3 路由枚举 + SSE 代理与 API-003 对齐

**`page.tsx` 路径枚举（关键词 `debug` / `test` / `dev` / `playground` / `internal`）**

- 仅 **`apps/web/src/app/test-turnstile/page.tsx`**；生产由 **`middleware.ts`** 对 **`/test-turnstile`** 返回 **404**（**WEB-001**）。
- **`apps/web/src/app/api/debug/album/[slug]`**：生产 **404**（**API-001**）。

**Worker 顺序复核（`services/worker/src/index.ts`）**

- **`authenticateRequest`** 在 **`GET /api/sse/photos/:albumId`** 处理之前执行（约 **1293–1311** 行），与 **WKR-001**「SSE 需 API Key」一致。

**匿名 SSE 与 API-003 对齐（代码修复）**

- **问题**：`GET /api/realtime/photos/[albumId]` 对未登录访客仅校验 **`slug` + `is_public`**，**有访问密码的相册**在仅知道 `slug`/`albumId` 时仍可能建立 SSE，与验密 / Cookie 模型不一致。
- **修复**：匿名分支改为 **`assertGuestAlbumAccess`**（与选片 / 批量下载一致），并支持 **`?albumPassword=`**；同源下 **`pis-album-access` Cookie** 仍随 `EventSource` 发送。单测见 **`apps/web/src/app/api/realtime/photos/[albumId]/route.test.ts`**。

**其余公开相册路由与 API-003 对齐（代码修复）**

- **问题**：部分 **`/api/public/...`** 仅凭 `slug` 或照片 `id` 返回数据，与「验密 / Cookie / 可选密码」模型不一致；带密码或受限分享的相册存在信息泄露面。
- **修复要点**：
  - **`GET .../photos`**：相册查询含 **`slug`**、**`deleted_at IS NULL`**；列表前 **`assertGuestAlbumAccess`**，支持 **`?albumPassword=`**；需密码时 **`ALBUM_PASSWORD_REQUIRED`**。
  - **`GET /api/public/download/[id]`**：按相册门禁字段校验 **`allow_download`**、过期、删除后 **`assertGuestAlbumAccess`**（**`?albumPassword=`**）。
  - **`GET .../groups`**：**`allow_share`**、过期；**`assertGuestAlbumAccess`**；相册链路与 **`photos`** 一致；单测 mock 补 **`.is('deleted_at', null)`**。
  - **`POST .../view`**：**`allow_share`**、过期、**`getTrustedClientIp` + `checkRateLimit`**（约 **120/分钟/slug**，IP 非 `unknown` 时）；**`assertGuestAlbumAccess`**；JSON 体可选 **`albumPassword`**。
  - **`POST .../search-face`**：**`albumSlugSchema`**、**`allow_share`**、限流（约 **20/分钟/IP**）、**`assertGuestAlbumAccess`**；**`FormData`** 可选 **`albumPassword`**；上传约 **12MB** 上限。
  - **`GET /api/public/albums/[slug]`**（相册元数据）：在 **`allow_share` / 过期** 校验之后增加 **`assertGuestAlbumAccess`**，支持 **`?albumPassword=`**；未通过时不再返回标题/描述等（**`ALBUM_PASSWORD_REQUIRED`** 或 **403**），与 **API-003** 一致。
- **访客相册 RSC 与 API-003 对齐（代码修复）**：**`app/album/[slug]/page.tsx`** 在 **`generateMetadata`** 与页面数据加载中复用 **`evaluateGuestAlbumAccess`**（**`cookies()`** + 查询参数 **`albumPassword`**）；未通过门禁时不生成含相册标题/封面等的 OG 元数据，**不在 HTML 中 SSR 照片行、分组、封面媒体**；**`password` 字段不进入客户端 props**。逻辑与 **`assertGuestAlbumAccess`** 一致，抽取见 **`src/lib/public-album-guest-access.ts`** 之 **`evaluateGuestAlbumAccess`**。
- **访客相册客户端与 `?albumPassword=` 对齐**：**`album-client`**（照片列表 + **`usePhotoRealtime`**）、**`photo-group-filter`**、**`album-header`**（批量下载）、**`album-hero`**（**`POST .../view`** JSON）、**`face-search-modal`**（**`FormData`**）在存在 URL 查询参数 **`albumPassword`** 时将其传给对应公开 API，与 RSC 门禁及 **HttpOnly Cookie** 二选一模型一致；**`appendAlbumPasswordIfPresent`** 见 **`src/lib/album-guest-url.ts`**。
- **回归**：`pnpm exec vitest run src/app/api/public` 绿；相关单测文件含 **`@vitest-environment node`**（与 **`jose`** 访客 JWT 一致）。

---

## 台账总览

| ID | 领域 | 严重级别 | 状态 | 摘要 |
|----|------|----------|------|------|
| SEC-001 | 认证 / JWT | 高 | **已修复** | `getUserFromRequest` 仅接受有效 access；`/api/worker`、`/api/realtime` 走 middleware 刷新；首页 `allow_public_home` 用 `updateSessionMiddleware` |
| SEC-002 | Worker 安全 | 高 | **已修复** | 生产环境无 `WORKER_API_KEY` 时进程拒绝启动；API Key 校验改为 `timingSafeEqual`（见 CRY-001） |
| OPS-001 | 配置 / 部署 | 中 | **已修复** | `getWorkerUrl` 不再回退 `NEXT_PUBLIC_WORKER_URL`；`.env.example` 补充说明 |
| OPS-002 | 可观测性 | 低 | **已修复** | 移除 middleware 一次性打印 JWT/AUTH 环境变量键名 |
| API-001 | 公开 API | 中 | **已修复** | 生产环境 `/api/debug/album/*` 返回 404 |
| API-002 | 数据访问 | 中 | **已修复** | 公开 `download-selected` / `select` 使用 `createClient`；与访客访问校验同路径 |
| API-003 | 业务一致性 | 低 | **已修复** | `verify-password` → `pis-album-access`；选片/批量下载/实时 SSE 及 **`public` 下根级 **`GET .../[slug]`**、`photos` / `download` / `groups` / `view` / `search-face`** 均 **`assertGuestAlbumAccess`**（可选 **`albumPassword`**） |
| API-004 | Admin API 契约 | 低 | **已修复** | 占位 `collaborations` / `collaborators` 路由增加 `getCurrentUser` 401 |
| ANA-001 | 分析埋点 | 中 | **已修复** | `analytics/track` 增加 IP 维度的 `checkRateLimit`（120/分钟） |
| WKR-001 | Worker / SSE | 高 | **已修复** | Worker 侧 SSE 移至 API Key 校验之后；Web 经 `/api/realtime/photos/[albumId]` 代理并做访客/登录校验 |
| WKR-002 | Worker / 预签名 | 中 | **已修复** | `expirySeconds` 经 `parseExpirySeconds` 钳制；可选 `WORKER_MAX_*` 环境变量 |
| NET-001 | 速率限制 | 中 | **已修复** | `getTrustedClientIp`；登录/验密/分析/`setup-password`/管理端上传限流等已接入 |
| WEB-001 | 前端暴露面 | 低 | **已修复** | 生产环境 `/test-turnstile` 中间件 404 |
| CRY-001 | 密码学实现 | 低 | **已修复** | Worker API Key 使用 `timingSafeEqual` |

---

## 分项说明与修复方案

### SEC-001 — 刷新令牌被当作“已登录用户”用于 API 身份解析

**状态（与台账历史结论对齐）**：当前实现已采用台账推荐的**严格模式（方案 1）**：**`getUserFromRequest`** 仅在 **`verifyToken(access)` 且 `payload.type === 'access'`** 时返回用户；**不因仅有 refresh 而返回身份**（refresh 由 **`updateSessionMiddleware`** 与专用刷新流程写回新 access）。

**历史问题摘要（评审时快照）**：旧版曾在 access 无效时凭有效 refresh 直接返回 `AuthUser`，导致「仅 refresh」在部分 API 上被当作已登录。

**验证建议（仍建议在 CI / 手测保留）**：对 **`/api/worker`**、**`/api/admin`** 等构造「**仅 refresh Cookie、无有效 access**」请求，期望 **401** 或业务等价拒绝；middleware 刷新后带新 access 再请求应 **200**。

---

### SEC-002 — Worker 在未配置 API Key 时的认证行为

**证据**：`authenticateRequest` 在 `WORKER_API_KEY` 未设置且 `CONFIG.IS_DEVELOPMENT` 为真时直接 `return true`。  

```307:316:services/worker/src/index.ts
function authenticateRequest(req: http.IncomingMessage): boolean {
  if (!WORKER_API_KEY) {
    // 开发环境：允许访问但记录警告
    if (CONFIG.IS_DEVELOPMENT) {
      // 开发环境允许访问，但建议设置 API Key
      return true;
    }
    // 生产环境：如果没有配置 API Key，拒绝访问
    console.error('❌ WORKER_API_KEY not set in production! Denying access.');
    return false;
  }
```

**影响**：若 Worker 进程监听地址对非本机开放，且环境被误判为 development，则任意客户端可直接调用 Worker 上的敏感能力（上传、处理、预签名等，取决于路由挂载）。  

**修复方案**：  

1. 生产与预发**强制** `WORKER_API_KEY`（启动时 `process.exit(1)` 或拒绝监听 HTTP）。  
2. 默认仅绑定 `127.0.0.1`，由 Next 反代出站；安全组禁止公网直达 Worker 端口。  
3. CI/CD 增加配置校验步骤。  

**验证**：在未设置密钥的容器内访问非 health 端点，期望 401/403；仅本机回环可访问时确认威胁模型可接受。  

---

### OPS-001 — Worker 代理 URL 回退链

**证据**：`getWorkerUrl` 在服务端代理中回退到 `NEXT_PUBLIC_WORKER_URL`。  

```36:38:apps/web/src/app/api/worker/[...path]/route.ts
function getWorkerUrl(): string {
  return process.env.WORKER_URL || process.env.WORKER_API_URL || process.env.NEXT_PUBLIC_WORKER_URL || 'http://localhost:3001'
}
```

**影响**：`NEXT_PUBLIC_*` 面向浏览器构建，易在部署时被误用于服务端目标；可能造成错误上游、调试困难，或在极端误配下扩大暴露面（取决于网络拓扑）。  

**修复方案**：服务端只读 `WORKER_URL` / `WORKER_API_URL`；文档与 `.env.example` 明确分离；部署时去掉对 `NEXT_PUBLIC_WORKER_URL` 的依赖。  

---

### OPS-002 — Middleware 开发环境打印环境变量键

**证据**：开发环境首次请求打印所有包含 `JWT` 或 `AUTH` 的环境变量**键名**。  

```24:35:apps/web/src/middleware.ts
  if (
    process.env.NODE_ENV === "development" &&
    !globalThis.middlewareEnvLogged
  ) {
    globalThis.middlewareEnvLogged = true;
    console.log(
      "[Middleware] All environment variables:",
      Object.keys(process.env).filter(
        (k) => k.includes("JWT") || k.includes("AUTH"),
      ),
    );
  }
```

**影响**：日志聚合或共享开发机时可能帮助攻击者缩小枚举密钥名的范围（低敏）。  

**修复方案**：删除或改为仅在 `DEBUG_AUTH=1` 时打印，且只打印非敏感布尔/枚举配置。  

---

### API-001 — 调试路由无鉴权

**证据**：`/api/debug/album/[slug]` 直接查询并返回相册字段。  

```8:23:apps/web/src/app/api/debug/album/[slug]/route.ts
export async function GET(request: NextRequest, { params }: RouteParams) {
  const paramsData = await params;
  const { slug } = paramsData;

  const db = await createClient();
  const albumResult = await db
    .from("albums")
    .select("id, title, allow_download, allow_share, is_public")
    .eq("slug", slug)
    .single();
  // ...
  return NextResponse.json(albumResult.data);
}
```

**影响**：攻击者可批量枚举 `slug` 获取策略元数据（辅助后续攻击或商业情报收集）。  

**修复方案**：生产构建排除该路由；或 `process.env.NODE_ENV === 'production'` 直接 404；或要求管理员 JWT。  

---

### API-002 — 公开路由使用 `createAdminClient`

**状态**：**已修复**（`development`）。`download-selected` 与 `photos/[id]/select` 使用 `createClient()`；与 **`assertGuestAlbumAccess`**（Cookie JWT 或 `albumPassword`）一致后再读相册/照片。

**原问题摘要**：公开路由使用 `createAdminClient` 扩大数据面并弱化 RLS 边界。

**残余治理**：数据库层仍以业务校验为主；若后续引入 RLS 专项，可再收紧 anon 策略。

---

### API-003 — 公开选片与相册可见性

**状态**：**已修复**。`POST .../verify-password` 在验密成功或无密码相册访问确认后下发 **`pis-album-access`** HttpOnly Cookie（JWT 载荷含 `sub`=`albumId`、`slug`、`scope: album_access`）。以下匿名路径在返回敏感数据或副作用前均调用 **`assertGuestAlbumAccess`**（并视路由支持 **`albumPassword`** 查询参数或 JSON / FormData）：

- `GET`/`PATCH .../select`、`GET .../download-selected`
- `GET /api/realtime/photos/[albumId]`（匿名分支）
- `GET /api/public/albums/[slug]`（元数据）、`GET .../photos`、`GET /api/public/download/[id]`、`GET .../groups`、`POST .../view`、`POST .../search-face`

**原问题摘要**：非公开相册一律 403，与密码相册访客流程不一致；部分公开接口曾仅凭 `slug`/资源 id 绕过门禁。

---

### NET-001 — 速率限制所依赖的 IP 来源

**证据**：登录路由从 `cf-connecting-ip` / `x-forwarded-for` / `x-real-ip` 推导 IP（与验密等类似）。  

```65:79:apps/web/src/app/api/auth/login/route.ts
    const forwardedFor = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const cfConnectingIp = request.headers.get('cf-connecting-ip'); // Cloudflare
    // ...
    if (cfConnectingIp) {
      ip = cfConnectingIp;
    } else if (forwardedFor) {
      ip = forwardedFor.split(',')[0].trim();
```

**影响**：应用前若无受信反向代理剥离/覆写客户端可控头，攻击者可伪造 IP 绕过或滥用限流键空间。  

**修复方案**：在 Next 前仅保留受信层注入的 IP 头；或读取平台提供的连接元数据；文档写明「必须在 Cloudflare / ALB 后启用」。  

---

### WEB-001 — 测试页面暴露面

**证据**：`apps/web/src/app/test-turnstile/page.tsx` 为 Turnstile 联调页，默认随应用部署。  

**修复方案**：生产环境通过环境变量或 `middleware` 返回 404；或移入 Storybook/仅本地路由。  

**验证（P3 延续）**：`apps/web/src/middleware.ts` 在 **`NODE_ENV === 'production'`** 且路径 **`/test-turnstile`** 时返回 **404**；源码路径仍存在，公网不可达。

---

### CRY-001 — API Key 比较方式

**证据**：`apiKey === WORKER_API_KEY`（见 Worker `authenticateRequest` 片段）。  

**影响**：理论上的微时序侧信道；对随机高熵 API Key 实际风险极低。  

**修复方案**：若需偏执加固，使用 `crypto.timingSafeEqual` 对 `Buffer` 做等长比较。  

---

### API-004 — `/api/admin` 下占位接口未校验登录态

**证据**：协作者 / 协作占位 API 直接返回 JSON 或 501，未调用任何会话或角色校验。  

```16:24:apps/web/src/app/api/admin/albums/[id]/collaborators/route.ts
export async function GET(_request: Request, { params }: RouteParams) {
  const { id: albumId } = await params
  
  // TODO: 实现协作者功能
  return NextResponse.json({
    albumId,
    collaborators: [],
    message: '协作者功能正在开发中',
  })
}
```

**影响**：当前数据敏感度低，但路径处于 **`/api/admin`** 命名空间，与「管理接口需登录」的团队心智不一致；未来实装若复制骨架代码，**易漏加鉴权**。任意匿名客户端可高频调用，造成轻微噪声与日志成本。  

**修复方案**：在占位阶段即加入与其他 admin 路由一致的 **`getCurrentUser` + `requireAdmin`（或等价）**；未登录统一 **401**。实装功能后再收紧到资源级授权。  

**验证**：无 Cookie 请求上述 URL 应返回 401。  

---

### ANA-001 — 匿名分析上报接口缺少显式速率限制

**证据**：`POST /api/analytics/track` 解析 body 后直接 `insert`，路由内未见 `checkRateLimit` 或同类保护。  

```61:114:apps/web/src/app/api/analytics/track/route.ts
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { type, albumId, photoId, sessionId: clientSessionId } = body
    // ...
    const db = await createClient()

    switch (type) {
      case 'album_view': {
        // ...
        if (!recentView) {
          await db.from('album_views').insert({
            album_id: albumId,
            viewer_ip: ip,
            // ...
          })
        }
        break
      }
```

**影响**：攻击者可伪造 `albumId` / `photoId` / `sessionId` **高频写入** `album_views`、`photo_views`、`download_logs`，造成**存储膨胀与查询噪声**（可用性 / 成本类风险）。与 **NET-001** 叠加时，`viewer_ip` 等字段也可能失真。  

**修复方案**：  

1. 对本路由增加 **IP + sessionId + type** 维度的 `checkRateLimit`（与登录、验密同栈）。  
2. 写入前校验 `albumId`/`photoId` **存在且对当前访客可见**（与公开相册策略一致），否则丢弃或单独计数。  
3. 可选：仅接受来自站点 `Origin`/`Referer` 白名单的请求（弱防护，作辅助）。  

**验证**：压测脚本在阈值内 429，且随机 UUID 不应持续产生「有效业务」视图记录（取决于第 2 条策略）。  

---

### WKR-001 — SSE 端点绕过 Worker API Key

**证据**：健康检查后匹配 SSE 路径并直接 `createSSEHandler`，**早于** `authenticateRequest`。  

```1268:1287:services/worker/src/index.ts
  // SSE 实时推送端点（不需要认证）
  const sseMatch = url.pathname.match(/^\/api\/sse\/photos\/([^/]+)$/);
  if (sseMatch && req.method === 'GET') {
    const albumId = sseMatch[1];
    const sseHandler = createSSEHandler(albumId);
    sseHandler(req, res);
    return;
  }

  // API 认证检查（除了 health 和 SSE 端点）
  if (!authenticateRequest(req)) {
```

**影响**：任何能访问 Worker HTTP 端口的客户端，可对**任意** `albumId` 建立 SSE，接收该相册在 Redis 频道 `pis:photo-events` 上广播的处理类事件（实现见 `services/worker/src/lib/sse.ts` 的 `subscribeToAlbum` / `broadcastToAlbum`）。在 **Worker 仅内网可达** 且仅由受信反代访问时风险可控；若误暴露到公网或与浏览器**跨源直连**，则为**高敏信息面 + 连接耗尽**风险。  

**修复方案（择一或组合）**：  

1. **与 Next 会话绑定**：删除 Worker 侧裸 SSE，改为经 **`/api/...` 已鉴权** 的 EventSource（由 Web 反代并校验用户对该 `albumId` 的权限）。  
2. **短期加固**：为 SSE 增加**独立**短期令牌或 HMAC 查询参数（相册级、TTL 短），仍建议仅内网监听。  
3. **运维**：安全组默认拒绝 Worker 端口公网入站；监控单 IP 并发 SSE 数。  

**验证**：无 `X-API-Key` 请求 `GET /api/sse/photos/<uuid>`，在当前实现下应仍能 **200**（用于证明问题存在）；修复后应 **401** 或 **403**（依所选方案）。  

---

### WKR-002 — 预签名 URL 过期时间未在 Worker 层钳制

**证据**：`/api/presign/get` 将 body 中的 `expirySeconds` 直接传入 `getPresignedGetUrl`。  

```1326:1338:services/worker/src/index.ts
  if (url.pathname === '/api/presign/get' && req.method === 'POST') {
    try {
      const body = await parseJsonBody(req, CONFIG.MAX_BODY_SIZE);
      const { key, expirySeconds = 300, responseContentDisposition } = body;
      // ...
      let presignedUrl = await getPresignedGetUrl(key, expirySeconds);
```

`/api/multipart/presign-part` 同样从 body 读取 `expirySeconds` 并传入 `getPresignedPartUrl`（默认 3600，可被覆盖）。  

**影响**：在已能通过 API Key（或经 Next 代理的等效信任链）调用这些端点时，客户端可请求**过长**有效期的预签名 URL，扩大泄露窗口（具体上限还受存储后端/SDK 约束，但 Worker 层未做「业务允许的最大值」统一治理）。  

**修复方案**：在 Worker 内对 `expirySeconds` 做 `Number` 校验并 **`Math.min` 到配置上限**（例如下载 900s、分片 3600s），非法值返回 **400**；与 `.env` 或 `CONFIG` 对齐并写单测。  

**验证**：传入超大 `expirySeconds` 应被钳制或拒绝；正常值行为不变。  

---

## 已核对的安全基线（简要）

- `.env` / `.env.local` 已被 `.gitignore` 忽略；**本次未将工作区中的本地 `.env` 内容写入台账**（避免泄露）。请在协作流程中持续确认无密钥提交历史。  
- 仓库内 `rg` 未命中典型 `dangerouslySetInnerHTML` / `eval(` 模式（不排除构建产物或其它扩展名）。  

---

## 建议的后续动作（非代码）

1. 将本台账中的 **SEC-001、SEC-002、API-001、ANA-001、WKR-001、WKR-002、NET-001** 纳入发布前检查表。  
2. **`check-security.sh`** 已包含对 **`app/api/public/**/route.ts`** 的 **`createAdminClient`** 扫描；合并前保持该脚本在 CI 或 `pre-commit` 中执行。  
3. 补充 E2E：无 Cookie 访问 admin/worker 代理、仅 refresh 访问敏感 API（与目标策略一致）。  
4. **供应链**：在可使用 **`registry.npmjs.org`** 的环境定期执行 **`pnpm audit`**（或 Dependabot），与当前镜像源审计缺失解耦。  

---

**台账维护**：修复完成后在「状态」列更新为「已修复」并链接到 PR / 提交 SHA。

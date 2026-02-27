/**
 * 应用版本信息
 * 
 * 版本号格式遵循语义化版本 (Semantic Versioning)
 * MAJOR.MINOR.PATCH
 * 
 * - MAJOR: 重大更新，可能包含不兼容的 API 变更
 * - MINOR: 新功能，向后兼容
 * - PATCH: Bug 修复，向后兼容
 */

// 当前版本号（与 package.json 保持同步）
export const APP_VERSION = '1.1.0'

// GitHub 仓库信息
export const GITHUB_REPO = 'JunyuZhan/pis'
export const GITHUB_API_BASE = 'https://api.github.com'
export const GITHUB_RELEASES_URL = `${GITHUB_API_BASE}/repos/${GITHUB_REPO}/releases`

// 版本比较工具函数
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.replace(/^v/, '').split('.').map(Number)
  const parts2 = v2.replace(/^v/, '').split('.').map(Number)
  
  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0
    const p2 = parts2[i] || 0
    
    if (p1 > p2) return 1
    if (p1 < p2) return -1
  }
  
  return 0
}

// 检查是否有新版本
export function hasNewerVersion(currentVersion: string, latestVersion: string): boolean {
  return compareVersions(latestVersion, currentVersion) > 0
}

// 格式化版本号（确保有 v 前缀）
export function formatVersion(version: string): string {
  return version.startsWith('v') ? version : `v${version}`
}

// 解析版本号（移除 v 前缀）
export function parseVersion(version: string): string {
  return version.replace(/^v/, '')
}

// GitHub Release 类型定义
export interface GitHubRelease {
  id: number
  tag_name: string
  name: string
  body: string
  draft: boolean
  prerelease: boolean
  created_at: string
  published_at: string
  html_url: string
  assets: Array<{
    name: string
    size: number
    download_count: number
    browser_download_url: string
  }>
}

// 版本检查结果
export interface VersionCheckResult {
  currentVersion: string
  latestVersion: string | null
  hasUpdate: boolean
  releaseNotes: string | null
  releaseName: string | null
  publishedAt: string | null
  releaseUrl: string | null
  isPrerelease: boolean
  lastChecked: string
}

import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/role-helpers'
import { 
  APP_VERSION, 
  GITHUB_RELEASES_URL, 
  hasNewerVersion,
  formatVersion,
  type GitHubRelease,
  type VersionCheckResult 
} from '@/lib/version'

/**
 * 检查升级状态 API
 * GET /api/admin/upgrade/check
 * 
 * 基于 GitHub Releases 检查版本更新
 * 
 * 返回：
 * {
 *   currentVersion: string,      // 当前版本号
 *   latestVersion: string,       // 最新版本号
 *   hasUpdate: boolean,          // 是否有更新
 *   releaseNotes: string,        // 更新日志（Markdown）
 *   releaseName: string,         // 发布名称
 *   publishedAt: string,         // 发布时间
 *   releaseUrl: string,          // GitHub Release 链接
 *   isPrerelease: boolean,       // 是否为预发布版本
 *   lastChecked: string          // 最后检查时间
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // 验证管理员权限
    const admin = await requireAdmin(request)
    if (!admin) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message: '只有管理员可以执行此操作' } },
        { status: 403 }
      )
    }

    const currentVersion = formatVersion(APP_VERSION)
    
    // 调用 GitHub Releases API
    let latestRelease: GitHubRelease | null = null
    let allReleases: GitHubRelease[] = []
    
    try {
      const response = await fetch(`${GITHUB_RELEASES_URL}?per_page=10`, {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'PIS-Upgrade-Checker',
        },
        // 设置超时
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        if (response.status === 404) {
          // 仓库不存在或没有 Releases
          return NextResponse.json({
            currentVersion,
            latestVersion: null,
            hasUpdate: false,
            releaseNotes: null,
            releaseName: null,
            publishedAt: null,
            releaseUrl: null,
            isPrerelease: false,
            lastChecked: new Date().toISOString(),
            message: '暂无发布版本',
          } as VersionCheckResult)
        }
        
        if (response.status === 403) {
          // API 限流
          return NextResponse.json(
            { 
              error: { 
                code: 'RATE_LIMITED', 
                message: 'GitHub API 请求限制，请稍后再试',
              } 
            },
            { status: 429 }
          )
        }
        
        throw new Error(`GitHub API 返回错误: ${response.status}`)
      }

      allReleases = await response.json()
      
      // 找到最新的非预发布版本（或所有版本中最新的）
      // 优先选择正式版本
      latestRelease = allReleases.find(r => !r.draft && !r.prerelease) || 
                      allReleases.find(r => !r.draft) ||
                      null
                      
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        return NextResponse.json(
          { 
            error: { 
              code: 'TIMEOUT', 
              message: '连接 GitHub 超时，请检查网络连接',
            } 
          },
          { status: 504 }
        )
      }
      
      console.error('获取 GitHub Releases 失败:', error)
      return NextResponse.json(
        { 
          error: { 
            code: 'GITHUB_ERROR', 
            message: '无法获取版本信息',
            details: error instanceof Error ? error.message : '未知错误',
          } 
        },
        { status: 502 }
      )
    }

    // 构建响应
    if (!latestRelease) {
      return NextResponse.json({
        currentVersion,
        latestVersion: null,
        hasUpdate: false,
        releaseNotes: null,
        releaseName: null,
        publishedAt: null,
        releaseUrl: null,
        isPrerelease: false,
        lastChecked: new Date().toISOString(),
        message: '暂无发布版本',
      } as VersionCheckResult)
    }

    const latestVersion = formatVersion(latestRelease.tag_name)
    const hasUpdate = hasNewerVersion(currentVersion, latestVersion)

    const result: VersionCheckResult = {
      currentVersion,
      latestVersion,
      hasUpdate,
      releaseNotes: latestRelease.body || null,
      releaseName: latestRelease.name || latestRelease.tag_name,
      publishedAt: latestRelease.published_at,
      releaseUrl: latestRelease.html_url,
      isPrerelease: latestRelease.prerelease,
      lastChecked: new Date().toISOString(),
    }

    return NextResponse.json(result)
    
  } catch (error) {
    console.error('升级检查 API 错误:', error)
    return NextResponse.json(
      {
        error: {
          code: 'INTERNAL_ERROR',
          message: '服务器错误',
        },
      },
      { status: 500 }
    )
  }
}

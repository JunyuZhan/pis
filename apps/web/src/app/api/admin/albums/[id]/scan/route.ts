import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/database'
import { requireAdmin } from '@/lib/auth/role-helpers'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import { albumIdSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, ApiError } from '@/lib/validation/error-handler'
import { getInternalApiUrl } from '@/lib/utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * 触发扫描同步
 * POST /api/admin/albums/{id}/scan
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const paramsData = await params
    
    // 验证路径参数
    const idValidation = safeValidate(albumIdSchema, paramsData)
    if (!idValidation.success) {
      return handleError(idValidation.error, '无效的相册ID')
    }
    
    const albumId = idValidation.data.id
    const db = await createClient()

    // 先检查用户是否已登录
    const user = await getCurrentUser(request)
    if (!user) {
      return ApiError.unauthorized('需要登录才能执行此操作')
    }

    // 再检查用户是否为管理员
    const admin = await requireAdmin(request)
    if (!admin) {
      return ApiError.forbidden('需要管理员权限才能执行此操作')
    }

    // 验证相册存在
    const albumResult = await db
      .from('albums')
      .select('id, title')
      .eq('id', albumId)
      .is('deleted_at', null)
      .single()

    if (albumResult.error || !albumResult.data) {
      return ApiError.notFound('相册不存在')
    }

    // 使用代理路由调用 Worker 扫描 API
    // 代理路由会自动处理 Worker URL 配置和认证
    const proxyUrl = getInternalApiUrl('/api/worker/scan')
    
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    }
    
    // 传递认证 cookie，代理路由会处理认证
    const cookieHeader = request.headers.get('cookie')
    if (cookieHeader) {
      headers['cookie'] = cookieHeader
    }
    
    const workerResponse = await fetch(proxyUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ albumId }),
    })

    if (!workerResponse.ok) {
      const error = await workerResponse.json()
      return ApiError.internal(`Worker 服务错误: ${error.error || '未知错误'}`)
    }

    const result = await workerResponse.json()
    return NextResponse.json(result)
  } catch (error) {
    return handleError(error, '扫描相册失败')
  }
}

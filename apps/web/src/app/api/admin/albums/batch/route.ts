import { NextRequest } from 'next/server'
import { createClient } from '@/lib/database'
import { requireAdmin } from '@/lib/auth/role-helpers'
import { batchOperationSchema, batchUpdateSchema } from '@/lib/validation/schemas'
import { safeValidate, handleError, createSuccessResponse, ApiError } from '@/lib/validation/error-handler'
import { getInternalApiUrl } from '@/lib/utils'

/**
 * 相册批量操作 API
 * DELETE /api/admin/albums/batch - 批量删除相册
 */

export async function DELETE(request: NextRequest) {
  try {
    const db = await createClient()

    // 先检查用户是否已登录
    const { getCurrentUser } = await import('@/lib/auth/api-helpers')
    const user = await getCurrentUser(request)
    if (!user) {
      return ApiError.unauthorized('需要登录才能执行此操作')
    }

    // 再检查用户是否为管理员
    const admin = await requireAdmin(request)

    if (!admin) {
      return ApiError.forbidden('需要管理员权限才能执行此操作')
    }

    // 解析和验证请求体
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return handleError(new Error('请求格式错误'), '请求体格式错误，请提供有效的JSON')
    }

    // 验证输入（注意：batchOperationSchema 包含 operation，但这里只支持 delete）
    const validation = safeValidate(batchOperationSchema, body)
    if (!validation.success) {
      return handleError(validation.error, '输入验证失败')
    }

    const { albumIds, operation } = validation.data

    // 验证操作类型
    if (operation !== 'delete') {
      return ApiError.badRequest(`不支持的操作类型: ${operation}`)
    }

    // 验证相册存在且未删除
    const albumsResult = await db
      .from('albums')
      .select('id, title')
      .in('id', albumIds)
      .is('deleted_at', null)

    if (albumsResult.error) {
      return handleError(albumsResult.error, '查询相册失败')
    }

    const validAlbums = albumsResult.data as { id: string; title: string }[] | null
    const validAlbumIds = validAlbums?.map((a) => a.id) || []

    if (validAlbumIds.length === 0) {
      return ApiError.notFound('未找到有效的相册')
    }

    // 执行软删除
    // 批量更新：为每个相册ID执行更新操作
    const deletePromises = validAlbumIds.map((id) => 
      db.update('albums', { deleted_at: new Date().toISOString() }, { id, deleted_at: null })
    )
    const deleteResults = await Promise.all(deletePromises)
    const deleteError = deleteResults.find((r) => r.error)?.error

    if (deleteError) {
      return handleError(deleteError, '批量删除相册失败')
    }

    return createSuccessResponse({
      success: true,
      deletedCount: validAlbumIds.length,
      message: `已删除 ${validAlbumIds.length} 个相册`,
    })
  } catch (error) {
    return handleError(error, '批量删除相册失败')
  }
}

// PATCH /api/admin/albums/batch - 批量更新相册
export async function PATCH(request: NextRequest) {
  try {
    const db = await createClient()

    // 先检查用户是否已登录
    const { getCurrentUser } = await import('@/lib/auth/api-helpers')
    const user = await getCurrentUser(request)
    if (!user) {
      return ApiError.unauthorized('需要登录才能执行此操作')
    }

    // 再检查用户是否为管理员
    const admin = await requireAdmin(request)

    if (!admin) {
      return ApiError.forbidden('需要管理员权限才能执行此操作')
    }

    // 解析和验证请求体
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return handleError(new Error('请求格式错误'), '请求体格式错误，请提供有效的JSON')
    }

    // 验证输入
    const validation = safeValidate(batchUpdateSchema, body)
    if (!validation.success) {
      return handleError(validation.error, '输入验证失败')
    }

    const { albumIds, updates } = validation.data

    // 构建更新数据（只允许更新特定字段）
    const updateData: Record<string, boolean | string> = {}
    
    if (updates.is_public !== undefined) updateData.is_public = updates.is_public
    if (updates.layout !== undefined) updateData.layout = updates.layout
    if (updates.sort_rule !== undefined) updateData.sort_rule = updates.sort_rule
    if (updates.allow_download !== undefined) updateData.allow_download = updates.allow_download
    if (updates.show_exif !== undefined) updateData.show_exif = updates.show_exif
    if (updates.enable_ai_retouch !== undefined) updateData.enable_ai_retouch = updates.enable_ai_retouch

    // 执行批量更新
    // 优化：使用单次更新操作（使用 WHERE IN）
    // 通过将 ID 数组传递给 filters，利用 PostgreSQL 的 = ANY($1) 语法
    const updateResult = await db.update(
      'albums', 
      updateData, 
      { 'id[]': albumIds, deleted_at: null }
    )

    if (updateResult.error) {
      return handleError(updateResult.error, '批量更新相册失败')
    }

    // 如果更新了 enable_ai_retouch，清除相关相册的 worker 缓存
    // 确保 worker 使用最新的相册配置
    if (updates.enable_ai_retouch !== undefined) {
      try {
        // 使用内部API URL调用worker代理，传递认证cookie
        const workerUrl = getInternalApiUrl('/api/worker/clear-album-cache')
        const cookieHeader = request.headers.get('cookie')
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
        }
        if (cookieHeader) {
          headers['cookie'] = cookieHeader
        }
        
        // 并行清除所有相册的缓存
        await Promise.allSettled(
          albumIds.map(async (albumId) => {
            try {
              const response = await fetch(workerUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({ albumId }),
              })
              if (!response.ok) {
                console.warn(`Failed to clear cache for album ${albumId}: ${response.status}`)
              }
            } catch (err) {
              // 忽略清除缓存的错误，不影响主流程
              console.warn(`Failed to clear cache for album ${albumId}:`, err)
            }
          })
        )
      } catch (err) {
        // 忽略清除缓存的错误，不影响主流程
        console.warn('Failed to clear worker cache:', err)
      }
    }

    return createSuccessResponse({
      success: true,
      updatedCount: updateResult.data?.length || 0,
      message: `已更新 ${updateResult.data?.length || 0} 个相册`,
    })
  } catch (error) {
    return handleError(error, '批量更新相册失败')
  }
}

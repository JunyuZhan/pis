
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/database'
import { getCurrentUser } from '@/lib/auth/api-helpers'
import { ApiError } from '@/lib/validation/error-handler'

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return ApiError.unauthorized('请先登录')
  }

  // TODO: 检查用户角色是否为 admin 或 retoucher
  // 目前所有登录用户(admin)都可以访问

  const db = await createClient()
  
  // 获取待修图的照片
  const { data: photos, error } = await db
    .from('photos')
    .select(`
      id,
      filename,
      original_key,
      status,
      created_at,
      albums (
        id,
        title
      )
    `)
    .in('status', ['pending_retouch', 'retouching'])
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json(
      { error: { code: 'DB_ERROR', message: error.message } },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: photos })
}

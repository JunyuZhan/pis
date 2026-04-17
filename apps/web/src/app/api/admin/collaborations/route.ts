/**
 * 协作邀请列表 API
 * GET: 获取当前用户的协作邀请列表
 * 
 * 注意：此功能正在开发中
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/api-helpers'

// 获取协作邀请列表
export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '请先登录' } }, { status: 401 })
  }

  return NextResponse.json({
    pending: [],
    active: [],
    message: '协作功能正在开发中',
  })
}

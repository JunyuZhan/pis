/**
 * 单个协作者管理 API
 * PATCH: 更新协作者权限
 * DELETE: 移除协作者
 * 
 * 注意：此功能正在开发中
 */

import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth/api-helpers'

interface RouteParams {
  params: Promise<{ id: string; collaboratorId: string }>
}

// 更新协作者权限
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '请先登录' } }, { status: 401 })
  }

  const { id: albumId, collaboratorId } = await params
  
  // TODO: 实现协作者功能
  return NextResponse.json(
    {
      error: {
        code: 'NOT_IMPLEMENTED',
        message: '协作者功能正在开发中',
      },
      albumId,
      collaboratorId,
    },
    { status: 501 }
  )
}

// 移除协作者
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await getCurrentUser(request)
  if (!user) {
    return NextResponse.json({ error: { code: 'UNAUTHORIZED', message: '请先登录' } }, { status: 401 })
  }

  const { id: albumId, collaboratorId } = await params
  
  // TODO: 实现协作者功能
  return NextResponse.json(
    {
      error: {
        code: 'NOT_IMPLEMENTED',
        message: '协作者功能正在开发中',
      },
      albumId,
      collaboratorId,
    },
    { status: 501 }
  )
}

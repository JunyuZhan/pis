import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/role-helpers'
import { createAdminClient } from '@/lib/database'

interface SystemSetting {
  id: string
  key: string
  value: unknown
  category: string
  description: string | null
  is_public: boolean
  created_at: string
  updated_at: string
}

/**
 * 获取所有系统设置
 * GET /api/admin/settings
 */
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if (!admin) {
      return NextResponse.json(
        { error: '需要管理员权限' },
        { status: 403 }
      )
    }

    const db = await createAdminClient()
    
    const { data: settings, error } = await db
      .from('system_settings')
      .select('*')
      .order('category')
      .order('key')

    if (error) {
      console.error('获取系统设置失败:', error)
      return NextResponse.json(
        { error: '获取设置失败' },
        { status: 500 }
      )
    }

    // 按分类组织设置
    const grouped: Record<string, Record<string, unknown>> = {}
    const typedSettings = (settings || []) as SystemSetting[]
    for (const setting of typedSettings) {
      if (!grouped[setting.category]) {
        grouped[setting.category] = {}
      }
      grouped[setting.category][setting.key] = setting.value
    }

    return NextResponse.json({
      success: true,
      data: {
        settings: settings || [],
        grouped,
      },
    })
  } catch (error) {
    console.error('系统设置 API 错误:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}

/**
 * 更新系统设置
 * PATCH /api/admin/settings
 * 
 * 请求体：
 * {
 *   settings: { [key: string]: any }
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if (!admin) {
      return NextResponse.json(
        { error: '需要管理员权限' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { settings } = body

    if (!settings || typeof settings !== 'object') {
      return NextResponse.json(
        { error: '无效的设置数据' },
        { status: 400 }
      )
    }

    const db = await createAdminClient()
    const updatedKeys: string[] = []
    const errors: string[] = []

    // 批量更新设置
    for (const [key, value] of Object.entries(settings)) {
      const { error } = await db
        .from('system_settings')
        .update({ 
          value: JSON.stringify(value),
          updated_at: new Date().toISOString(),
        })
        .eq('key', key)

      if (error) {
        console.error(`更新设置 ${key} 失败:`, error)
        errors.push(key)
      } else {
        updatedKeys.push(key)
      }
    }

    if (errors.length > 0 && updatedKeys.length === 0) {
      return NextResponse.json(
        { error: '更新设置失败', failedKeys: errors },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: `已更新 ${updatedKeys.length} 项设置`,
      updatedKeys,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    console.error('更新系统设置错误:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/database'
import { requireAdmin } from '@/lib/auth/role-helpers'
import { ApiError } from '@/lib/validation/error-handler'
import { z } from 'zod'

interface RouteParams {
  params: Promise<{ id: string }>
}

// 客户更新 schema
const customerUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().max(20).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  wechat: z.string().max(100).optional().nullable(),
  company: z.string().max(200).optional().nullable(),
  address: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  source: z.enum(['referral', 'website', 'social', 'other']).optional().nullable(),
  status: z.enum(['active', 'inactive', 'archived']).optional(),
})

/**
 * GET /api/admin/customers/[id]
 * 获取单个客户详情
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const admin = await requireAdmin(request)
  if (!admin) {
    return ApiError.forbidden('需要管理员权限')
  }

  const { id } = await params

  try {
    const db = await createAdminClient()

    // 获取客户信息
    const { data: customer, error } = await db.from('customers')
      .select('*')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (error || !customer) {
      return ApiError.notFound('客户不存在')
    }

    // 获取关联的相册
    const { data: albums } = await db.query(`
      SELECT 
        a.id, a.title, a.slug, a.cover_photo_id, a.photo_count, a.created_at,
        ca.role, ca.notes as relation_notes, ca.notified_at
      FROM customer_albums ca
      JOIN albums a ON ca.album_id = a.id
      WHERE ca.customer_id = $1 AND a.deleted_at IS NULL
      ORDER BY a.created_at DESC
    `, [id])

    return NextResponse.json({
      customer,
      albums: albums || [],
    })
  } catch (error) {
    console.error('获取客户详情失败:', error)
    return ApiError.internal('获取客户详情失败')
  }
}

/**
 * PATCH /api/admin/customers/[id]
 * 更新客户信息
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const admin = await requireAdmin(request)
  if (!admin) {
    return ApiError.forbidden('需要管理员权限')
  }

  const { id } = await params

  try {
    const body = await request.json()
    const validatedData = customerUpdateSchema.parse(body)

    const db = await createAdminClient()

    // 检查客户是否存在
    const { data: existing } = await db.from('customers')
      .select('id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (!existing) {
      return ApiError.notFound('客户不存在')
    }

    // 如果更新电话，检查是否与其他客户冲突
    if (validatedData.phone) {
      const { data: phoneConflict } = await db.from('customers')
        .select('id')
        .eq('phone', validatedData.phone)
        .neq('id', id)
        .is('deleted_at', null)
        .single()

      if (phoneConflict) {
        return ApiError.badRequest('该电话号码已被其他客户使用')
      }
    }

    // 更新客户
    const { data: customer, error } = await db.from('customers')
      .update(validatedData)
      .eq('id', id)
      .select()
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ customer })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return ApiError.badRequest(error.errors[0].message)
    }
    console.error('更新客户失败:', error)
    return ApiError.internal('更新客户失败')
  }
}

/**
 * DELETE /api/admin/customers/[id]
 * 删除客户（软删除）
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const admin = await requireAdmin(request)
  if (!admin) {
    return ApiError.forbidden('需要管理员权限')
  }

  const { id } = await params

  try {
    const db = await createAdminClient()

    // 软删除
    const { error } = await db.from('customers')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .is('deleted_at', null)

    if (error) {
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('删除客户失败:', error)
    return ApiError.internal('删除客户失败')
  }
}

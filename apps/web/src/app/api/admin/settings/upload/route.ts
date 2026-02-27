import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/role-helpers'
import { createAdminClient } from '@/lib/database'
import { z } from 'zod'

/**
 * 允许上传的设置文件类型
 */
const ALLOWED_FILE_TYPES: Record<string, { mimeTypes: string[]; maxSize: number }> = {
  logo: {
    mimeTypes: ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'],
    maxSize: 2 * 1024 * 1024, // 2MB
  },
  favicon: {
    mimeTypes: ['image/png', 'image/x-icon', 'image/svg+xml', 'image/ico'],
    maxSize: 512 * 1024, // 512KB
  },
  wechat_qrcode: {
    mimeTypes: ['image/png', 'image/jpeg', 'image/webp'],
    maxSize: 1 * 1024 * 1024, // 1MB
  },
}

/**
 * 设置类型验证
 */
const uploadSchema = z.object({
  type: z.enum(['logo', 'favicon', 'wechat_qrcode']),
})

/**
 * 上传系统设置文件（Logo、Favicon、微信二维码）
 * POST /api/admin/settings/upload
 */
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin(request)
    if (!admin) {
      return NextResponse.json(
        { error: '需要管理员权限' },
        { status: 403 }
      )
    }

    // 解析 FormData
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const type = formData.get('type') as string | null

    if (!file) {
      return NextResponse.json(
        { error: '未提供文件' },
        { status: 400 }
      )
    }

    // 验证类型
    const typeValidation = uploadSchema.safeParse({ type })
    if (!typeValidation.success) {
      return NextResponse.json(
        { error: '无效的文件类型，支持: logo, favicon, wechat_qrcode' },
        { status: 400 }
      )
    }

    const fileType = typeValidation.data.type
    const config = ALLOWED_FILE_TYPES[fileType]

    // 验证 MIME 类型
    if (!config.mimeTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `不支持的文件格式，支持: ${config.mimeTypes.join(', ')}` },
        { status: 400 }
      )
    }

    // 验证文件大小
    if (file.size > config.maxSize) {
      const maxSizeKB = Math.round(config.maxSize / 1024)
      return NextResponse.json(
        { error: `文件太大，最大 ${maxSizeKB}KB` },
        { status: 400 }
      )
    }

    // 生成文件路径
    const ext = file.name.split('.').pop() || 'png'
    const timestamp = Date.now()
    const key = `settings/${fileType}_${timestamp}.${ext}`

    // 上传到 MinIO（通过 Worker）
    const workerUrl = process.env.WORKER_API_URL || 
                      process.env.NEXT_PUBLIC_WORKER_URL || 
                      'http://localhost:3001'
    const workerApiKey = process.env.WORKER_API_KEY

    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const uploadResponse = await fetch(
      `${workerUrl}/api/upload?key=${encodeURIComponent(key)}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
          'Content-Length': buffer.length.toString(),
          ...(workerApiKey ? { 'X-API-Key': workerApiKey } : {}),
        },
        body: buffer,
      }
    )

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text()
      console.error('文件上传失败:', uploadResponse.status, errorText)
      return NextResponse.json(
        { error: '文件上传失败' },
        { status: 500 }
      )
    }

    // 构建文件 URL
    const mediaUrl = process.env.NEXT_PUBLIC_MEDIA_URL || 
                     process.env.MEDIA_URL || 
                     'http://localhost:9000/pis'
    const fileUrl = `${mediaUrl.replace(/\/$/, '')}/${key}`

    // 更新数据库设置
    const settingKey = `${fileType}_url`
    const db = await createAdminClient()
    
    const { error: updateError } = await db.update(
      'system_settings',
      { 
        value: JSON.stringify(fileUrl),
        updated_at: new Date().toISOString(),
      },
      { key: settingKey }
    )

    // 如果设置不存在，则插入
    if (updateError) {
      // 尝试插入新设置
      const categoryMap: Record<string, string> = {
        logo: 'brand',
        favicon: 'brand',
        wechat_qrcode: 'social',
      }
      
      const descriptionMap: Record<string, string> = {
        logo: '网站 Logo URL',
        favicon: '网站 Favicon URL',
        wechat_qrcode: '微信二维码 URL',
      }
      
      const { error: insertError } = await db.insert('system_settings', {
        key: settingKey,
        value: JSON.stringify(fileUrl),
        category: categoryMap[fileType],
        description: descriptionMap[fileType],
        is_public: true,
      })
      
      if (insertError) {
        console.error('保存设置失败:', insertError)
        // 即使数据库更新失败，文件已经上传成功，仍然返回 URL
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        url: fileUrl,
        key,
        type: fileType,
      },
    })
  } catch (error) {
    console.error('设置文件上传错误:', error)
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    )
  }
}

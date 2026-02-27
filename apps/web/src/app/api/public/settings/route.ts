import { NextResponse } from 'next/server'
import { createClient } from '@/lib/database'

interface PublicSetting {
  key: string
  value: unknown
  category: string
}

/**
 * 获取公开系统设置
 * GET /api/public/settings
 * 
 * 返回 is_public=true 的设置，用于前台显示
 */
export async function GET() {
  try {
    const db = await createClient()
    
    // 获取公开设置
    const { data: publicSettings, error: publicError } = await db
      .from('system_settings')
      .select('key, value, category')
      .eq('is_public', true)
      .order('category')
      .order('key')
    
    // 同时获取 polling_interval（前端需要，即使不是公开设置）
    const { data: pollingSetting, error: pollingError } = await db
      .from('system_settings')
      .select('key, value, category')
      .eq('key', 'polling_interval')
      .single()
    
    // 合并设置（如果 polling_interval 存在且不在公开设置中，则添加）
    let settings = (publicSettings || []) as PublicSetting[]
    if (!pollingError && pollingSetting) {
      // 检查是否已经在公开设置中
      const hasPolling = settings.some(s => s.key === 'polling_interval')
      if (!hasPolling) {
        settings = [...settings, pollingSetting as PublicSetting]
      }
    }
    
    const error = publicError || pollingError

    if (error) {
      console.error('获取公开设置失败:', error)
      // 返回默认值，不报错
      return NextResponse.json({
        success: true,
        data: getDefaultPublicSettings(),
      })
    }

    // 转换为键值对格式，并解析 JSON 字符串值
    const result: Record<string, unknown> = {}
    const typedSettings = (settings || []) as PublicSetting[]
    for (const setting of typedSettings) {
      let value = setting.value
      // 如果值是 JSON 字符串，尝试解析
      if (typeof value === 'string') {
        // 尝试解析 JSON（包括数字字符串）
        try {
          const parsed = JSON.parse(value)
          value = parsed
        } catch {
          // 解析失败，检查是否是纯数字字符串（如 "3000"）
          // 此时 value 仍然是 string 类型
          const trimmedValue = (value as string).trim()
          if (/^\d+$/.test(trimmedValue)) {
            value = parseInt(trimmedValue, 10)
          }
          // 否则保持原值
        }
      }
      result[setting.key] = value
      
      // 兼容性：如果 key 是 wechat_qrcode_url，也设置到 social_wechat_qrcode
      if (setting.key === 'wechat_qrcode_url') {
        result.social_wechat_qrcode = value
      }
    }

    // 合并默认值（确保所有必需字段都存在）
    const merged = {
      ...getDefaultPublicSettings(),
      ...result,
    }

    return NextResponse.json({
      success: true,
      data: merged,
    })
  } catch (error) {
    console.error('公开设置 API 错误:', error)
    // 出错时返回默认值
    return NextResponse.json({
      success: true,
      data: getDefaultPublicSettings(),
    })
  }
}

/**
 * 获取默认公开设置
 * 当数据库不可用时使用
 */
function getDefaultPublicSettings(): Record<string, unknown> {
  return {
    // 品牌
    brand_name: process.env.NEXT_PUBLIC_PHOTOGRAPHER_NAME || 'PIS Photography',
    brand_tagline: process.env.NEXT_PUBLIC_PHOTOGRAPHER_TAGLINE || '专业活动摄影',
    brand_logo: null,
    brand_favicon: null,
    logo_url: null,
    favicon_url: null,
    copyright_text: process.env.NEXT_PUBLIC_COPYRIGHT_TEXT || '',
    icp_number: process.env.NEXT_PUBLIC_ICP_NUMBER || '',
    police_number: process.env.NEXT_PUBLIC_POLICE_NUMBER || '',
    // 站点
    site_title: 'PIS - 即时影像分享',
    site_description: '专业级私有化即时摄影分享系统',
    site_keywords: '摄影,相册,分享,活动摄影',
    // 社交
    social_wechat_qrcode: null,
    wechat_qrcode_url: null,
    social_weibo: '',
    social_instagram: '',
    social_email: '',
    social_phone: '',
    // 功能
    polling_interval: parseInt(process.env.NEXT_PUBLIC_POLLING_INTERVAL || '3000', 10),
    // 主题
    theme_mode: 'system',
    theme_primary_color: '#D4AF37',
  }
}

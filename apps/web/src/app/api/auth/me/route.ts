import { NextRequest } from 'next/server'
import { createSuccessResponse } from '@/lib/validation/error-handler'
import { getCurrentUser } from '@/lib/auth'
import { getUserRole } from '@/lib/auth/role-helpers'

/**
 * 获取当前用户信息 API
 *
 * @route GET /api/auth/me
 * @description 获取当前登录用户的信息，包括角色信息，用于客户端检查登录状态和权限
 *
 * @auth 可选（如果未登录，返回 user: null）
 *
 * @returns {Object} 200 - 成功返回用户信息
 * @returns {Object|null} 200.data.user - 用户信息对象（如果已登录）或 null（如果未登录）
 * @returns {string} [200.data.user.id] - 用户ID（如果已登录）
 * @returns {string} [200.data.user.email] - 用户邮箱（如果已登录）
 * @returns {string} [200.data.user.role] - 用户角色（如果已登录）：'admin' | 'photographer' | 'retoucher' | 'guest'
 *
 * @returns {Object} 200 - 未登录时也返回 200，但 user 为 null
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/auth/me')
 * const data = await response.json()
 * if (data.user) {
 *   console.log('已登录:', data.user.email, '角色:', data.user.role)
 * } else {
 *   console.log('未登录')
 * }
 * ```
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return createSuccessResponse({ user: null })
    }

    // 获取用户角色信息
    const role = await getUserRole(request)
    
    return createSuccessResponse({ 
      user: {
        ...user,
        role: role || null, // 添加角色信息，如果无法获取则返回 null
      }
    })
  } catch {
    return createSuccessResponse({ user: null })
  }
}

/**
 * @fileoverview 角色权限检查辅助函数
 *
 * @description
 * 提供统一的角色权限检查功能，用于 API Routes。
 * 实现基于角色的访问控制（RBAC），支持多角色检查。
 *
 * @module lib/auth/role-helpers
 *
 * @example
 * ```typescript
 * import { requireRole, getUserRole } from '@/lib/auth/role-helpers'
 * import { ApiError } from '@/lib/validation/error-handler'
 *
 * // 检查用户是否具有指定角色
 * const userWithRole = await requireRole(request, ['admin', 'retoucher'])
 * if (!userWithRole) {
 *   return ApiError.forbidden('权限不足，需要管理员或修图师权限')
 * }
 *
 * // 仅获取用户角色（不进行权限检查）
 * const role = await getUserRole(request)
 * if (role === 'admin') {
 *   // 管理员专属逻辑
 * }
 * ```
 */
import { NextRequest } from 'next/server'
import { getCurrentUser } from './api-helpers' // 这个 getCurrentUser 接受 NextRequest 参数
import { getCurrentUser as getCurrentUserFromCookies } from './index' // 这个 getCurrentUser 从 cookies 读取（用于 Server Components）
import { createAdminClient } from '@/lib/database'

/**
 * 用户角色类型定义
 */
export type UserRole = 'admin' | 'photographer' | 'retoucher' | 'guest'

/**
 * 带角色的用户信息
 */
export interface UserWithRole {
  id: string
  email: string
  role: UserRole
}

/**
 * 从用户 ID 获取角色（内部辅助函数）
 */
async function getUserRoleById(userId: string): Promise<UserRole | null> {
  try {
    if (!userId) {
      if (process.env.NODE_ENV === 'development') {
        console.error('getUserRoleById: userId is empty or undefined')
      }
      return null
    }

    const db = await createAdminClient()
    const { data, error } = await db
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    // 处理数据库查询错误
    if (error) {
      // 数据库查询错误
      if (process.env.NODE_ENV === 'development') {
        const errorMessage = error instanceof Error ? error.message : String(error)
        console.error(`Failed to get user role for user ${userId}:`, errorMessage || 'Unknown error')
      }
      return null
    }

    // 处理查询结果为空的情况（用户不存在）
    if (!data) {
      // 数据为空但没有错误 - 用户不存在于数据库中
      // 这可能是正常情况（用户从 JWT 获取但数据库中没有记录）
      // 在生产环境中静默处理，开发环境记录警告
      if (process.env.NODE_ENV === 'development') {
        console.warn(`User ${userId} not found in database. User may need to be created.`)
      }
      return null
    }

    const role = (data as { role: string | null }).role
    if (!role) {
      // 用户存在但没有角色字段或角色为 null
      if (process.env.NODE_ENV === 'development') {
        console.warn(`User ${userId} exists but has no role field or role is null`)
      }
      return null
    }

    // 验证角色是否有效
    const validRoles: UserRole[] = ['admin', 'photographer', 'retoucher', 'guest']
    if (validRoles.includes(role as UserRole)) {
      return role as UserRole
    }

    // 如果角色不在有效列表中，默认返回 null（安全起见）
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Invalid role "${role}" for user ${userId}, treating as null`)
    }
    return null
  } catch (error) {
    // 捕获意外的异常
    if (process.env.NODE_ENV === 'development') {
      console.error('Unexpected error getting user role:', error)
    }
    return null
  }
}

/**
 * 获取当前用户的角色（用于 API Routes）
 *
 * @description
 * 从数据库查询当前登录用户的角色信息。
 * 如果用户未登录或查询失败，返回 null。
 *
 * @param {NextRequest} request - Next.js 请求对象
 * @returns {Promise<UserRole | null>} 用户角色，未登录或查询失败返回 null
 *
 * @example
 * ```typescript
 * const role = await getUserRole(request)
 * if (role === 'admin') {
 *   // 管理员逻辑
 * }
 * ```
 */
export async function getUserRole(request: NextRequest): Promise<UserRole | null> {
  // 使用 getCurrentUser 从 api-helpers，它接受 NextRequest 参数
  const user = await getCurrentUser(request)
  if (!user) {
    return null
  }

  return getUserRoleById(user.id)
}

/**
 * 获取当前用户的角色（用于 Server Components）
 *
 * @description
 * 从数据库查询当前登录用户的角色信息。
 * 适用于 Server Components，直接从 cookies 读取用户信息。
 * 如果用户未登录或查询失败，返回 null。
 *
 * @returns {Promise<UserRole | null>} 用户角色，未登录或查询失败返回 null
 *
 * @example
 * ```typescript
 * const role = await getUserRoleFromCookies()
 * if (role === 'admin') {
 *   // 管理员逻辑
 * }
 * ```
 */
export async function getUserRoleFromCookies(): Promise<UserRole | null> {
  // 使用 getCurrentUser 从 index，它从 cookies 读取（用于 Server Components）
  const user = await getCurrentUserFromCookies()
  if (!user) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('getUserRoleFromCookies: No user found in cookies')
    }
    return null
  }

  if (!user.id) {
    if (process.env.NODE_ENV === 'development') {
      console.error('getUserRoleFromCookies: User object has no id field')
    }
    return null
  }

  return getUserRoleById(user.id)
}

/**
 * 要求用户具有指定角色之一
 *
 * @description
 * 检查当前用户是否已登录且具有允许的角色之一。
 * 如果用户未登录或不具有允许的角色，返回 null。
 *
 * @param {NextRequest} request - Next.js 请求对象
 * @param {UserRole[]} allowedRoles - 允许的角色列表
 * @returns {Promise<UserWithRole | null>} 带角色的用户信息，权限不足返回 null
 *
 * @example
 * ```typescript
 * // 只允许管理员或修图师访问
 * const user = await requireRole(request, ['admin', 'retoucher'])
 * if (!user) {
 *   return ApiError.forbidden('需要管理员或修图师权限')
 * }
 * // 现在可以使用 user.id, user.email, user.role
 * ```
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: UserRole[]
): Promise<UserWithRole | null> {
  const user = await getCurrentUser(request)
  if (!user) {
    return null
  }

  const role = await getUserRole(request)
  if (!role) {
    return null
  }

  if (!allowedRoles.includes(role)) {
    return null
  }

  return {
    id: user.id,
    email: user.email,
    role,
  }
}

/**
 * 检查用户是否为管理员
 *
 * @description
 * 便捷函数，检查当前用户是否为管理员。
 *
 * @param {NextRequest} request - Next.js 请求对象
 * @returns {Promise<UserWithRole | null>} 如果是管理员返回用户信息，否则返回 null
 *
 * @example
 * ```typescript
 * const admin = await requireAdmin(request)
 * if (!admin) {
 *   return ApiError.forbidden('需要管理员权限')
 * }
 * ```
 */
export async function requireAdmin(request: NextRequest): Promise<UserWithRole | null> {
  return requireRole(request, ['admin'])
}

/**
 * 检查用户是否为修图师或管理员
 *
 * @description
 * 便捷函数，检查当前用户是否为修图师或管理员。
 * 常用于修图相关的 API。
 *
 * @param {NextRequest} request - Next.js 请求对象
 * @returns {Promise<UserWithRole | null>} 如果是修图师或管理员返回用户信息，否则返回 null
 *
 * @example
 * ```typescript
 * const user = await requireRetoucherOrAdmin(request)
 * if (!user) {
 *   return ApiError.forbidden('需要修图师或管理员权限')
 * }
 * ```
 */
export async function requireRetoucherOrAdmin(request: NextRequest): Promise<UserWithRole | null> {
  return requireRole(request, ['admin', 'retoucher'])
}

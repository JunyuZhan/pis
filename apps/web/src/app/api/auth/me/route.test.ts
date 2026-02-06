/**
 * 获取当前用户 API 路由测试
 *
 * 测试 GET 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
import { createMockRequest } from '@/test/test-utils'

vi.mock('@/lib/auth', () => ({
  getCurrentUser: vi.fn(),
}))

vi.mock('@/lib/auth/role-helpers', () => ({
  getUserRole: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(null),
  }),
}))

describe("GET /api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("user retrieval", () => {
    it('should return user if token is valid', async () => {
      const { getCurrentUser } = await import('@/lib/auth')
      const { getUserRole } = await import('@/lib/auth/role-helpers')

      vi.mocked(getCurrentUser).mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
      } as any)
      vi.mocked(getUserRole).mockResolvedValue('admin')

      const request = createMockRequest('http://localhost:3000/api/auth/me')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.user.id).toBe('user-123')
      expect(data.data.user.email).toBe('test@example.com')
    })

    it('should return null user when unauthenticated', async () => {
      const { getCurrentUser } = await import('@/lib/auth')

      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const request = createMockRequest('http://localhost:3000/api/auth/me')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.user).toBe(null)
    })

    it('should handle errors gracefully', async () => {
      const { getCurrentUser } = await import('@/lib/auth')

      vi.mocked(getCurrentUser).mockRejectedValue(new Error('Auth error'))

      const request = createMockRequest('http://localhost:3000/api/auth/me')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data.user).toBe(null)
    })
  })
})

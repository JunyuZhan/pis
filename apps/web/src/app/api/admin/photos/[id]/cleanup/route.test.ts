/**
 * 照片清理 API 路由测试
 * 
 * 测试 DELETE 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DELETE } from './route'
import { createMockRequest } from '@/test/test-utils'
import { getCurrentUser } from '@/lib/auth/api-helpers'

// Mock dependencies
vi.mock('@/lib/database', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/auth/api-helpers', () => {
  return {
    getCurrentUser: vi.fn(),
  }
})

// Mock global fetch
global.fetch = vi.fn()

describe('DELETE /api/admin/photos/[id]/cleanup', () => {
  let mockAdminClient: any

  const validPhotoId = '550e8400-e29b-41d4-a716-446655440000'
  const validAlbumId = '550e8400-e29b-41d4-a716-446655440001'
  const validUserId = '550e8400-e29b-41d4-a716-446655440002'

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createAdminClient } = await import('@/lib/database')
    
    mockAdminClient = {
      from: vi.fn(),
      delete: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    vi.mocked(createAdminClient).mockResolvedValue(mockAdminClient)
    
    // 默认用户已登录
    vi.mocked(getCurrentUser).mockResolvedValue({
      id: validUserId,
      email: 'test@example.com',
    })

    // 默认fetch成功
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    })
  })

  describe('authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null)

      const request = createMockRequest(`http://localhost:3000/api/admin/photos/${validPhotoId}/cleanup`, {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: validPhotoId }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('photo validation', () => {
    it('should return success if photo does not exist', async () => {
      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      })

      mockAdminClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest(`http://localhost:3000/api/admin/photos/${validPhotoId}/cleanup`, {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: validPhotoId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.success).toBe(true)
      expect(data.data.message).toContain('可能已被清理')
    })

    it('should return 400 if photo status is not pending or failed', async () => {
      const mockPhoto = {
        id: validPhotoId,
        status: 'completed',
        album_id: validAlbumId,
        original_key: `raw/${validAlbumId}/${validPhotoId}.jpg`,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockAdminClient.from.mockReturnValue({
        select: mockSelect,
        eq: mockEq,
        single: mockSingle,
      })

      const request = createMockRequest(`http://localhost:3000/api/admin/photos/${validPhotoId}/cleanup`, {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: validPhotoId }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
      expect(data.error.message).toContain('只能清理pending或failed状态的照片')
    })

    it('should allow cleanup for pending status', async () => {
      const mockPhoto = {
        id: validPhotoId,
        status: 'pending',
        album_id: validAlbumId,
        original_key: `raw/${validAlbumId}/${validPhotoId}.jpg`,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          single: mockSingle,
        })

      const request = createMockRequest(`http://localhost:3000/api/admin/photos/${validPhotoId}/cleanup`, {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: validPhotoId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.success).toBe(true)
      expect(data.data.message).toContain('已清理')
    })

    it('should allow cleanup for failed status', async () => {
      const mockPhoto = {
        id: validPhotoId,
        status: 'failed',
        album_id: validAlbumId,
        original_key: `raw/${validAlbumId}/${validPhotoId}.jpg`,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          single: mockSingle,
        })

      const request = createMockRequest(`http://localhost:3000/api/admin/photos/${validPhotoId}/cleanup`, {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: validPhotoId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.success).toBe(true)
    })
  })

  describe('MinIO cleanup', () => {
    it('should call Worker API to cleanup MinIO file', async () => {
      const mockPhoto = {
        id: validPhotoId,
        status: 'pending',
        album_id: validAlbumId,
        original_key: `raw/${validAlbumId}/${validPhotoId}.jpg`,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          single: mockSingle,
        })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })

      const request = createMockRequest(`http://localhost:3000/api/admin/photos/${validPhotoId}/cleanup`, {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: validPhotoId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.success).toBe(true)
      expect(global.fetch).toHaveBeenCalled()
    })

    it('should continue cleanup even if MinIO cleanup fails', async () => {
      const mockPhoto = {
        id: validPhotoId,
        status: 'pending',
        album_id: validAlbumId,
        original_key: `raw/${validAlbumId}/${validPhotoId}.jpg`,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          single: mockSingle,
        })

      // MinIO cleanup fails
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })

      const request = createMockRequest(`http://localhost:3000/api/admin/photos/${validPhotoId}/cleanup`, {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: validPhotoId }) })
      const data = await response.json()

      // 即使 MinIO 清理失败，数据库记录也应该被删除
      expect(response.status).toBe(200)
      expect(data.data.success).toBe(true)
    })

    it('should skip MinIO cleanup if original_key is null', async () => {
      const mockPhoto = {
        id: validPhotoId,
        status: 'pending',
        album_id: validAlbumId,
        original_key: null,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          single: mockSingle,
        })

      const request = createMockRequest(`http://localhost:3000/api/admin/photos/${validPhotoId}/cleanup`, {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: validPhotoId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.success).toBe(true)
      // 如果没有 original_key，不应该调用 Worker API
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })

  describe('database deletion', () => {
    it('should delete photo record successfully', async () => {
      const mockPhoto = {
        id: validPhotoId,
        status: 'pending',
        album_id: validAlbumId,
        original_key: null,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          single: mockSingle,
        })

      const request = createMockRequest(`http://localhost:3000/api/admin/photos/${validPhotoId}/cleanup`, {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: validPhotoId }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.data.success).toBe(true)
      expect(mockAdminClient.delete).toHaveBeenCalledWith('photos', { id: validPhotoId })
    })

    it('should return 500 on database deletion error', async () => {
      const mockPhoto = {
        id: validPhotoId,
        status: 'pending',
        album_id: validAlbumId,
        original_key: null,
      }

      const mockSelect = vi.fn().mockReturnThis()
      const mockEq = vi.fn().mockReturnThis()
      const mockSingle = vi.fn().mockResolvedValue({
        data: mockPhoto,
        error: null,
      })

      mockAdminClient.from
        .mockReturnValueOnce({
          select: mockSelect,
          eq: mockEq,
          single: mockSingle,
        })

      mockAdminClient.delete.mockResolvedValueOnce({
        data: null,
        error: { message: 'Delete failed' },
      })

      const request = createMockRequest(`http://localhost:3000/api/admin/photos/${validPhotoId}/cleanup`, {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.resolve({ id: validPhotoId }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })
  })

  describe('error handling', () => {
    it('should return 500 on params error', async () => {
      const request = createMockRequest(`http://localhost:3000/api/admin/photos/${validPhotoId}/cleanup`, {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: Promise.reject(new Error('Invalid params')) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error.code).toBe('INTERNAL_ERROR')
    })
  })
})

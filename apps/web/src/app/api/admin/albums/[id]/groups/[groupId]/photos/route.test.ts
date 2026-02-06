/**
 * 分组照片 API 路由测试
 * 
 * 测试 GET、POST、DELETE 方法
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET, POST, DELETE } from './route'
import { createMockRequest, createMockDatabaseClient } from '@/test/test-utils'

// Mock dependencies
vi.mock('@/lib/database', () => ({
  createClient: vi.fn(),
  createAdminClient: vi.fn(),
}))

vi.mock('@/lib/auth/api-helpers', () => ({
  getCurrentUser: vi.fn(),
}))

describe('GET /api/admin/albums/[id]/groups/[groupId]/photos', () => {
  let mockDb: any
  let mockAdminDb: any
  let mockGetCurrentUser: any

  const validAlbumId = '550e8400-e29b-41d4-a716-446655440000'
  const validGroupId = '550e8400-e29b-41d4-a716-446655440001'
  const validPhotoId1 = '550e8400-e29b-41d4-a716-446655440002'
  const validPhotoId2 = '550e8400-e29b-41d4-a716-446655440003'

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient, createAdminClient } = await import('@/lib/database')
    const { getCurrentUser } = await import('@/lib/auth/api-helpers')
    
    mockDb = createMockDatabaseClient()
    vi.mocked(createClient).mockResolvedValue(mockDb)
    
    // Mock admin client for role queries
    mockAdminDb = createMockDatabaseClient()
    // Mock admin role query for requireAdmin
    const mockRoleSelect = vi.fn().mockReturnThis()
    const mockRoleEq = vi.fn().mockReturnThis()
    const mockRoleSingle = vi.fn().mockResolvedValue({
      data: { role: 'admin' },
      error: null,
    })
    mockAdminDb.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: mockRoleSelect,
          eq: mockRoleEq,
          single: mockRoleSingle,
        }
      }
      // For other tables, return default chain
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }
    })
    vi.mocked(createAdminClient).mockResolvedValue(mockAdminDb)
    
    mockGetCurrentUser = vi.mocked(getCurrentUser)
    
    // 默认用户已登录
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
    })
  })

  describe('validation', () => {
    it('should return 400 for invalid album ID', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/albums/invalid-id/groups/550e8400-e29b-41d4-a716-446655440001/photos'
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: 'invalid-id', groupId: validGroupId }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })

    it('should return 400 for invalid group ID', async () => {
      const request = createMockRequest(
        'http://localhost:3000/api/admin/albums/550e8400-e29b-41d4-a716-446655440000/groups/invalid-id/photos'
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: validAlbumId, groupId: 'invalid-id' }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('permissions', () => {
    it('should allow access for album owner', async () => {
      const album = {
        id: validAlbumId,
        user_id: 'user-123',
        is_public: false,
      }
      const group = {
        id: validGroupId,
      }
      const assignments = [
        { photo_id: validPhotoId1 },
        { photo_id: validPhotoId2 },
      ]

      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockSingleAlbum = vi.fn().mockResolvedValue({
        data: album,
        error: null,
      })

      // Mock group exists
      const mockSelectGroup = vi.fn().mockReturnThis()
      const mockEqGroup = vi.fn().mockReturnThis()
      const mockSingleGroup = vi.fn().mockResolvedValue({
        data: group,
        error: null,
      })

      // Mock assignments query
      const mockSelectAssignments = vi.fn().mockReturnThis()
      const mockEqAssignments = vi.fn().mockResolvedValue({
        data: assignments,
        error: null,
      })

      mockDb.from
        .mockReturnValueOnce({
          select: mockSelectAlbum,
          eq: mockEqAlbum,
          single: mockSingleAlbum,
        })
        .mockReturnValueOnce({
          select: mockSelectGroup,
          eq: mockEqGroup,
          single: mockSingleGroup,
        })
        .mockReturnValueOnce({
          select: mockSelectAssignments,
          eq: mockEqAssignments,
        })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${validAlbumId}/groups/${validGroupId}/photos`
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: validAlbumId, groupId: validGroupId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.photo_ids).toEqual([validPhotoId1, validPhotoId2])
    })

    it('should allow access for public albums', async () => {
      const album = {
        id: validAlbumId,
        user_id: 'other-user',
        is_public: true,
      }
      const group = {
        id: validGroupId,
      }

      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockSingleAlbum = vi.fn().mockResolvedValue({
        data: album,
        error: null,
      })

      // Mock group exists
      const mockSelectGroup = vi.fn().mockReturnThis()
      const mockEqGroup = vi.fn().mockReturnThis()
      const mockSingleGroup = vi.fn().mockResolvedValue({
        data: group,
        error: null,
      })

      // Mock assignments query
      const mockSelectAssignments = vi.fn().mockReturnThis()
      const mockEqAssignments = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      })

      mockDb.from
        .mockReturnValueOnce({
          select: mockSelectAlbum,
          eq: mockEqAlbum,
          single: mockSingleAlbum,
        })
        .mockReturnValueOnce({
          select: mockSelectGroup,
          eq: mockEqGroup,
          single: mockSingleGroup,
        })
        .mockReturnValueOnce({
          select: mockSelectAssignments,
          eq: mockEqAssignments,
        })

      // User not logged in
      mockGetCurrentUser.mockResolvedValue(null)

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${validAlbumId}/groups/${validGroupId}/photos`
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: validAlbumId, groupId: validGroupId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.photo_ids).toEqual([])
    })

    it('should return 403 for private albums without access', async () => {
      const album = {
        id: validAlbumId,
        user_id: 'other-user',
        is_public: false,
      }

      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockSingleAlbum = vi.fn().mockResolvedValue({
        data: album,
        error: null,
      })

      mockDb.from.mockReturnValue({
        select: mockSelectAlbum,
        eq: mockEqAlbum,
        single: mockSingleAlbum,
      })

      // User not logged in
      mockGetCurrentUser.mockResolvedValue(null)

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${validAlbumId}/groups/${validGroupId}/photos`
      )

      const response = await GET(request, {
        params: Promise.resolve({ id: validAlbumId, groupId: validGroupId }),
      })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error.code).toBe('FORBIDDEN')
    })
  })
})

describe('POST /api/admin/albums/[id]/groups/[groupId]/photos', () => {
  let mockDb: any
  let mockAdminDb: any
  let mockGetCurrentUser: any

  const validAlbumId = '550e8400-e29b-41d4-a716-446655440000'
  const validGroupId = '550e8400-e29b-41d4-a716-446655440001'
  const validPhotoId1 = '550e8400-e29b-41d4-a716-446655440002'
  const validPhotoId2 = '550e8400-e29b-41d4-a716-446655440003'

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient, createAdminClient } = await import('@/lib/database')
    const { getCurrentUser } = await import('@/lib/auth/api-helpers')
    
    mockDb = createMockDatabaseClient()
    mockAdminDb = createMockDatabaseClient()
    
    // Mock admin role query for requireAdmin
    const mockRoleSelect = vi.fn().mockReturnThis()
    const mockRoleEq = vi.fn().mockReturnThis()
    const mockRoleSingle = vi.fn().mockResolvedValue({
      data: { role: 'admin' },
      error: null,
    })
    mockAdminDb.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: mockRoleSelect,
          eq: mockRoleEq,
          single: mockRoleSingle,
        }
      }
      // For other tables, return default chain
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }
    })
    
    vi.mocked(createClient).mockResolvedValue(mockDb)
    vi.mocked(createAdminClient).mockResolvedValue(mockAdminDb)
    mockGetCurrentUser = vi.mocked(getCurrentUser)
    
    // 默认用户已登录
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
    })
  })

  describe('authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null)

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${validAlbumId}/groups/${validGroupId}/photos`,
        {
          method: 'POST',
          body: {
            photo_ids: [validPhotoId1],
          },
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: validAlbumId, groupId: validGroupId }),
      })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('validation', () => {
    it('should return 400 for invalid photo_ids', async () => {
      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockIsAlbum = vi.fn().mockReturnThis()
      const mockSingleAlbum = vi.fn().mockResolvedValue({
        data: { id: validAlbumId },
        error: null,
      })

      // Mock group exists
      const mockSelectGroup = vi.fn().mockReturnThis()
      const mockEqGroup = vi.fn().mockReturnThis()
      const mockSingleGroup = vi.fn().mockResolvedValue({
        data: { id: validGroupId },
        error: null,
      })

      mockDb.from
        .mockReturnValueOnce({
          select: mockSelectAlbum,
          eq: mockEqAlbum,
          is: mockIsAlbum,
          single: mockSingleAlbum,
        })
        .mockReturnValueOnce({
          select: mockSelectGroup,
          eq: mockEqGroup,
          single: mockSingleGroup,
        })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${validAlbumId}/groups/${validGroupId}/photos`,
        {
          method: 'POST',
          body: {
            photo_ids: [], // Empty array might be invalid based on schema?
                           // Or maybe use invalid strings if schema requires UUIDs
                           // The original test used empty array. Let's see if min(1) is required.
          },
        }
      )

      // Assuming the schema requires non-empty array or UUIDs.
      // If the original test expected 400 for empty array, schema probably has .min(1).
      // Let's assume empty array is what we want to test.
      
      const response = await POST(request, {
        params: Promise.resolve({ id: validAlbumId, groupId: validGroupId }),
      })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('photo assignment', () => {
    it('should successfully assign photos to group', async () => {
      const photoIds = [validPhotoId1, validPhotoId2]

      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockIsAlbum = vi.fn().mockReturnThis()
      const mockSingleAlbum = vi.fn().mockResolvedValue({
        data: { id: validAlbumId },
        error: null,
      })

      // Mock group exists
      const mockSelectGroup = vi.fn().mockReturnThis()
      const mockEqGroup = vi.fn().mockReturnThis()
      const mockSingleGroup = vi.fn().mockResolvedValue({
        data: { id: validGroupId },
        error: null,
      })

      // Mock photos exist
      const mockSelectPhotos = vi.fn().mockReturnThis()
      const mockEqPhotos = vi.fn().mockReturnThis()
      const mockInPhotos = vi.fn().mockResolvedValue({
        data: photoIds.map(id => ({ id })),
        error: null,
      })

      // Mock existing assignments (empty)
      const mockSelectExisting = vi.fn().mockReturnThis()
      const mockEqExisting = vi.fn().mockReturnThis()
      const mockInExisting = vi.fn().mockResolvedValue({
        data: [],
        error: null,
      })

      // Mock insert
      mockAdminDb.insert.mockResolvedValue({
        data: [],
        error: null,
      })

      mockDb.from
        .mockReturnValueOnce({
          select: mockSelectAlbum,
          eq: mockEqAlbum,
          is: mockIsAlbum,
          single: mockSingleAlbum,
        })
        .mockReturnValueOnce({
          select: mockSelectGroup,
          eq: mockEqGroup,
          single: mockSingleGroup,
        })
        .mockReturnValueOnce({
          select: mockSelectPhotos,
          eq: mockEqPhotos,
          in: mockInPhotos,
        })

      // Preserve the users table mock for requireAdmin
      const originalMockImplementation = mockAdminDb.from.getMockImplementation()
      mockAdminDb.from.mockImplementation((table: string) => {
        if (table === 'users') {
          // Return the original users mock for requireAdmin
          return originalMockImplementation!(table)
        }
        // For other tables, return the new mock
        return {
          select: mockSelectExisting,
          eq: mockEqExisting,
          in: mockInExisting,
        }
      })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${validAlbumId}/groups/${validGroupId}/photos`,
        {
          method: 'POST',
          body: {
            photo_ids: photoIds,
          },
        }
      )

      const response = await POST(request, {
        params: Promise.resolve({ id: validAlbumId, groupId: validGroupId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.assigned_count).toBe(2)
    })
  })
})

describe('DELETE /api/admin/albums/[id]/groups/[groupId]/photos', () => {
  let mockDb: any
  let mockAdminDb: any
  let mockGetCurrentUser: any

  const validAlbumId = '550e8400-e29b-41d4-a716-446655440000'
  const validGroupId = '550e8400-e29b-41d4-a716-446655440001'
  const validPhotoId1 = '550e8400-e29b-41d4-a716-446655440002'
  const validPhotoId2 = '550e8400-e29b-41d4-a716-446655440003'

  beforeEach(async () => {
    vi.clearAllMocks()
    
    const { createClient, createAdminClient } = await import('@/lib/database')
    const { getCurrentUser } = await import('@/lib/auth/api-helpers')
    
    mockDb = createMockDatabaseClient()
    mockAdminDb = createMockDatabaseClient()
    
    // Mock admin role query for requireAdmin
    const mockRoleSelect = vi.fn().mockReturnThis()
    const mockRoleEq = vi.fn().mockReturnThis()
    const mockRoleSingle = vi.fn().mockResolvedValue({
      data: { role: 'admin' },
      error: null,
    })
    mockAdminDb.from.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: mockRoleSelect,
          eq: mockRoleEq,
          single: mockRoleSingle,
        }
      }
      // For other tables, return default chain
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }
    })
    
    vi.mocked(createClient).mockResolvedValue(mockDb)
    vi.mocked(createAdminClient).mockResolvedValue(mockAdminDb)
    mockGetCurrentUser = vi.mocked(getCurrentUser)
    
    // 默认用户已登录
    mockGetCurrentUser.mockResolvedValue({
      id: 'user-123',
      email: 'test@example.com',
    })
  })

  describe('authentication', () => {
    it('should return 401 if user is not authenticated', async () => {
      mockGetCurrentUser.mockResolvedValue(null)

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${validAlbumId}/groups/${validGroupId}/photos`,
        {
          method: 'DELETE',
          body: {
            photo_ids: [validPhotoId1],
          },
        }
      )

      const response = await DELETE(request, {
        params: Promise.resolve({ id: validAlbumId, groupId: validGroupId }),
      })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('photo removal', () => {
    it('should successfully remove photos from group', async () => {
      const photoIds = [validPhotoId1, validPhotoId2]

      // Mock album exists
      const mockSelectAlbum = vi.fn().mockReturnThis()
      const mockEqAlbum = vi.fn().mockReturnThis()
      const mockIsAlbum = vi.fn().mockReturnThis()
      const mockSingleAlbum = vi.fn().mockResolvedValue({
        data: { id: validAlbumId },
        error: null,
      })

      // Mock group exists
      const mockSelectGroup = vi.fn().mockReturnThis()
      const mockEqGroup = vi.fn().mockReturnThis()
      const mockSingleGroup = vi.fn().mockResolvedValue({
        data: { id: validGroupId },
        error: null,
      })

      // Mock delete
      mockAdminDb.delete.mockResolvedValue({
        data: null,
        error: null,
      })

      mockDb.from
        .mockReturnValueOnce({
          select: mockSelectAlbum,
          eq: mockEqAlbum,
          is: mockIsAlbum,
          single: mockSingleAlbum,
        })
        .mockReturnValueOnce({
          select: mockSelectGroup,
          eq: mockEqGroup,
          single: mockSingleGroup,
        })

      const request = createMockRequest(
        `http://localhost:3000/api/admin/albums/${validAlbumId}/groups/${validGroupId}/photos`,
        {
          method: 'DELETE',
          body: {
            photo_ids: photoIds,
          },
        }
      )

      const response = await DELETE(request, {
        params: Promise.resolve({ id: validAlbumId, groupId: validGroupId }),
      })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.removed_count).toBe(2)
    })
  })
})

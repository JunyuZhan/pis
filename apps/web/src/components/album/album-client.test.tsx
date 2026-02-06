import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AlbumClient } from './album-client'
import type { Album, Photo } from '@/types/database'

// Mock Next.js router
const mockPush = vi.fn()
const mockSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
  }),
  useSearchParams: () => mockSearchParams,
}))

// Mock hooks
const mockUseInfiniteQuery = vi.fn()
const mockUseQueryClient = vi.fn()
const mockUsePhotoRealtime = vi.fn()

vi.mock('@tanstack/react-query', () => ({
  useInfiniteQuery: (...args: any[]) => mockUseInfiniteQuery(...args),
  useQueryClient: () => mockUseQueryClient(),
}))

vi.mock('@/hooks/use-photo-realtime', () => ({
  usePhotoRealtime: (...args: any[]) => mockUsePhotoRealtime(...args),
}))

vi.mock('@/lib/i18n', () => ({
  useLocale: () => 'zh-CN',
}))

// Mock components
vi.mock('./masonry', () => ({
  MasonryGrid: ({ photos, onLoadMore, hasMore }: any) => (
    <div data-testid="masonry-grid">
      <div>Photos: {photos.length}</div>
      {hasMore && (
        <button onClick={onLoadMore} data-testid="load-more">
          Load More
        </button>
      )}
    </div>
  ),
}))

// Mock fetch
global.fetch = vi.fn()

describe('AlbumClient', () => {
  const mockAlbum: Album = {
    id: 'album-1',
    title: '测试相册',
    slug: 'test-album',
    photo_count: 2,
    is_public: true,
    allow_share: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    event_date: null,
    location: null,
    sort_rule: 'capture_desc',
    poster_image_url: null,
    cover_photo_id: null,
  }

  const mockPhotos: Photo[] = [
    {
      id: 'photo-1',
      album_id: 'album-1',
      file_key: 'test1.jpg',
      thumb_key: 'thumb1.jpg',
      processed_key: 'processed1.jpg',
      width: 1920,
      height: 1080,
      file_size: 1024000,
      capture_time: '2024-01-01T00:00:00Z',
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      is_deleted: false,
      group_id: null,
      order_index: 0,
    },
    {
      id: 'photo-2',
      album_id: 'album-1',
      file_key: 'test2.jpg',
      thumb_key: 'thumb2.jpg',
      processed_key: 'processed2.jpg',
      width: 1920,
      height: 1080,
      file_size: 1024000,
      capture_time: '2024-01-01T01:00:00Z',
      created_at: '2024-01-01T01:00:00Z',
      updated_at: '2024-01-01T01:00:00Z',
      is_deleted: false,
      group_id: null,
      order_index: 1,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams.delete('search')
    mockSearchParams.delete('group')
    
    // Mock useInfiniteQuery
    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [
          {
            photos: mockPhotos,
            pagination: {
              page: 1,
              limit: 20,
              total: 2,
              totalPages: 1,
            },
          },
        ],
        pageParams: [1],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: vi.fn(),
    } as any)
    
    // Mock useQueryClient
    mockUseQueryClient.mockReturnValue({
      invalidateQueries: vi.fn().mockResolvedValue(undefined),
      setQueryData: vi.fn(),
    } as any)
    
    // Mock usePhotoRealtime
    mockUsePhotoRealtime.mockReturnValue({} as any)
  })

  it('应该渲染照片网格', () => {
    render(<AlbumClient album={mockAlbum} initialPhotos={mockPhotos} />)
    
    expect(screen.getByTestId('masonry-grid')).toBeInTheDocument()
    expect(screen.getByText('Photos: 2')).toBeInTheDocument()
  })

  it('应该显示空状态', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [
          {
            photos: [],
            pagination: {
              page: 1,
              limit: 20,
              total: 0,
              totalPages: 0,
            },
          },
        ],
        pageParams: [1],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: vi.fn(),
    } as any)
    
    render(<AlbumClient album={mockAlbum} initialPhotos={[]} />)
    
    expect(screen.getByText('暂无照片')).toBeInTheDocument()
    expect(screen.getByText('摄影师正在上传照片，请稍后再来查看')).toBeInTheDocument()
  })

  it('应该显示加载状态', () => {
    mockUseInfiniteQuery.mockReturnValue({
      data: undefined,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: true,
      refetch: vi.fn(),
    } as any)
    
    render(<AlbumClient album={mockAlbum} initialPhotos={[]} />)
    
    // 应该显示加载指示器（Loader2 组件，通常有 aria-label 或特定的类名）
    // 查找包含加载动画的元素
    const loadingIndicator = screen.queryByRole('status') || 
                            document.querySelector('.animate-spin') ||
                            screen.queryByText(/加载/i)
    expect(loadingIndicator).toBeTruthy()
  })

  it('应该支持加载更多', async () => {
    const user = userEvent.setup()
    const mockFetchNextPage = vi.fn()
    
    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [
          {
            photos: mockPhotos,
            pagination: {
              page: 1,
              limit: 20,
              total: 50,
              totalPages: 3,
            },
          },
        ],
        pageParams: [1],
      },
      fetchNextPage: mockFetchNextPage,
      hasNextPage: true,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: vi.fn(),
    } as any)
    
    render(<AlbumClient album={mockAlbum} initialPhotos={mockPhotos} />)
    
    const loadMoreButton = screen.getByTestId('load-more')
    await user.click(loadMoreButton)
    
    expect(mockFetchNextPage).toHaveBeenCalled()
  })

  it('应该显示新照片通知', async () => {
    let onInsertCallback: ((photo: Photo) => void) | null = null
    
    mockUsePhotoRealtime.mockImplementation(({ onInsert }: any) => {
      onInsertCallback = onInsert
      return {}
    })
    
    render(<AlbumClient album={mockAlbum} initialPhotos={mockPhotos} />)
    
    // 触发新照片插入
    if (onInsertCallback) {
      const newPhoto: Photo = {
        ...mockPhotos[0],
        id: 'photo-3',
      }
      onInsertCallback(newPhoto)
    }
    
    // 应该显示新照片通知
    await waitFor(() => {
      expect(screen.getByText(/张新照片/i)).toBeInTheDocument()
    })
  })

  it('应该支持刷新功能', async () => {
    const user = userEvent.setup()
    const mockRefetch = vi.fn()
    let onInsertCallback: ((photo: Photo) => void) | null = null
    
    mockUseInfiniteQuery.mockReturnValue({
      data: {
        pages: [
          {
            photos: mockPhotos,
            pagination: {
              page: 1,
              limit: 20,
              total: 2,
              totalPages: 1,
            },
          },
        ],
        pageParams: [1],
      },
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
      isLoading: false,
      refetch: mockRefetch,
    } as any)
    
    mockUsePhotoRealtime.mockImplementation(({ onInsert }: any) => {
      onInsertCallback = onInsert
      return {}
    })
    
    render(<AlbumClient album={mockAlbum} initialPhotos={mockPhotos} />)
    
    // 触发新照片通知
    if (onInsertCallback) {
      const newPhoto: Photo = {
        ...mockPhotos[0],
        id: 'photo-3',
      }
      onInsertCallback(newPhoto)
    }
    
    // 点击刷新按钮
    await waitFor(() => {
      const refreshButton = screen.getByText(/点击刷新/i)
      expect(refreshButton).toBeInTheDocument()
    })
    
    const refreshButton = screen.getByText(/点击刷新/i)
    await user.click(refreshButton)
    
    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled()
    })
  })

  it('应该支持关闭通知', async () => {
    const user = userEvent.setup()
    let onInsertCallback: ((photo: Photo) => void) | null = null
    
    mockUsePhotoRealtime.mockImplementation(({ onInsert }: any) => {
      onInsertCallback = onInsert
      return {}
    })
    
    render(<AlbumClient album={mockAlbum} initialPhotos={mockPhotos} />)
    
    if (onInsertCallback) {
      const newPhoto: Photo = {
        ...mockPhotos[0],
        id: 'photo-3',
      }
      onInsertCallback(newPhoto)
    }
    
    await waitFor(() => {
      const dismissButton = screen.getByLabelText('Dismiss')
      expect(dismissButton).toBeInTheDocument()
    })
    
    const dismissButton = screen.getByLabelText('Dismiss')
    await user.click(dismissButton)
    
    await waitFor(() => {
      expect(screen.queryByText(/张新照片/i)).not.toBeInTheDocument()
    })
  })

  it('应该显示人脸搜索结果提示', () => {
    mockSearchParams.set('search', 'face')
    
    render(<AlbumClient album={mockAlbum} initialPhotos={mockPhotos} />)
    
    expect(screen.getByText('人脸搜索结果')).toBeInTheDocument()
  })

  it('应该支持关闭人脸搜索', async () => {
    const user = userEvent.setup()
    mockSearchParams.set('search', 'face')
    
    render(<AlbumClient album={mockAlbum} initialPhotos={mockPhotos} />)
    
    const closeButtons = screen.getAllByRole('button')
    const closeButton = closeButtons.find(btn => 
      btn.querySelector('svg') || btn.textContent === ''
    )
    
    if (closeButton) {
      await user.click(closeButton)
      expect(mockPush).toHaveBeenCalled()
    }
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AlbumList } from './album-list'
import type { Album } from '@/types/database'

// Mock Next.js router
const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  Link: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

// Mock Next.js Image
vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => (
    <img src={src} alt={alt} {...props} />
  ),
}))

// Mock react-swipeable
vi.mock('react-swipeable', () => ({
  useSwipeable: (config: any) => ({
    onMouseDown: vi.fn(),
    onTouchStart: vi.fn(),
  }),
}))

// Mock components
vi.mock('./create-album-dialog', () => ({
  CreateAlbumDialog: ({ open, onOpenChange }: any) => (
    <div data-testid="create-album-dialog">
      {open ? 'Dialog Open' : 'Dialog Closed'}
      <button onClick={() => onOpenChange(false)}>Close</button>
    </div>
  ),
}))

vi.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: ({ open, onConfirm, title, message }: any) =>
    open ? (
      <div data-testid="confirm-dialog">
        <h2>{title}</h2>
        <p>{message}</p>
        <button onClick={onConfirm}>Confirm</button>
      </div>
    ) : null,
}))

vi.mock('@/components/ui/pull-to-refresh', () => ({
  PullToRefresh: ({ children, onRefresh }: any) => (
    <div data-testid="pull-to-refresh">
      {children}
      <button onClick={onRefresh}>Refresh</button>
    </div>
  ),
}))

vi.mock('@/components/ui/long-press-menu', () => ({
  LongPressMenu: ({ children }: any) => <div>{children}</div>,
}))

// Mock toast
vi.mock('@/lib/toast', () => ({
  showSuccess: vi.fn(),
  handleApiError: vi.fn(),
}))

// Mock utils
vi.mock('@/lib/utils', () => ({
  formatRelativeTime: (date: string) => '2小时前',
  formatDate: (date: string) => '2024-01-01',
  getAlbumShareUrl: (slug: string) => `http://localhost:3000/album/${slug}`,
  getSafeMediaUrl: () => 'http://localhost:3000/media',
  getAppBaseUrl: () => 'http://localhost:3000',
  cn: (...classes: any[]) => classes.filter(Boolean).join(' '),
}))

// Mock fetch
global.fetch = vi.fn()

describe('AlbumList', () => {
  const mockAlbums: Album[] = [
    {
      id: 'album-1',
      title: '测试相册1',
      slug: 'test-album-1',
      photo_count: 10,
      is_public: true,
      allow_share: true,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      event_date: null,
      location: null,
      sort_rule: 'capture_desc',
      poster_image_url: null,
      cover_photo_id: null,
    },
    {
      id: 'album-2',
      title: '测试相册2',
      slug: 'test-album-2',
      photo_count: 5,
      is_public: false,
      allow_share: false,
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
      event_date: null,
      location: null,
      sort_rule: 'capture_desc',
      poster_image_url: null,
      cover_photo_id: null,
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('应该渲染相册列表', () => {
    render(<AlbumList initialAlbums={mockAlbums} />)
    
    expect(screen.getByText('测试相册1')).toBeInTheDocument()
    expect(screen.getByText('测试相册2')).toBeInTheDocument()
  })

  it('应该显示空状态', () => {
    render(<AlbumList initialAlbums={[]} />)
    
    expect(screen.getByText('还没有相册')).toBeInTheDocument()
    expect(screen.getByText('创建您的第一个相册开始使用吧')).toBeInTheDocument()
  })

  it('应该支持筛选功能', async () => {
    const user = userEvent.setup()
    render(<AlbumList initialAlbums={mockAlbums} />)
    
    const filterSelect = screen.getByDisplayValue('全部相册')
    await user.selectOptions(filterSelect, 'shared')
    
    // 应该只显示已分享的相册
    expect(screen.getByText('测试相册1')).toBeInTheDocument()
    expect(screen.queryByText('测试相册2')).not.toBeInTheDocument()
  })

  it('应该支持批量选择模式', async () => {
    const user = userEvent.setup()
    render(<AlbumList initialAlbums={mockAlbums} />)
    
    const batchButton = screen.getByText('批量管理')
    await user.click(batchButton)
    
    // 应该进入选择模式
    expect(screen.getByText('已选择 0 个')).toBeInTheDocument()
    expect(screen.getByText('取消')).toBeInTheDocument()
  })

  it('应该支持选择相册', async () => {
    const user = userEvent.setup()
    render(<AlbumList initialAlbums={mockAlbums} />)
    
    // 进入批量选择模式
    const batchButton = screen.getByText('批量管理')
    await user.click(batchButton)
    
    // 点击第一个相册卡片进行选择
    const albumCard = screen.getByText('测试相册1').closest('.card')
    if (albumCard) {
      await user.click(albumCard)
      expect(screen.getByText('已选择 1 个')).toBeInTheDocument()
    }
  })

  it('应该支持批量删除', async () => {
    const user = userEvent.setup()
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({ message: '删除成功' }),
    })
    
    render(<AlbumList initialAlbums={mockAlbums} />)
    
    // 进入批量选择模式
    const batchButton = screen.getByText('批量管理')
    await user.click(batchButton)
    
    // 选择相册
    const albumCard = screen.getByText('测试相册1').closest('.card')
    if (albumCard) {
      await user.click(albumCard)
    }
    
    // 点击删除按钮
    const deleteButton = screen.getByText('删除')
    await user.click(deleteButton)
    
    // 确认删除
    const confirmButton = screen.getByText('Confirm')
    await user.click(confirmButton)
    
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith('/api/admin/albums/batch', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          albumIds: ['album-1'],
        }),
      })
    })
  })

  it('应该处理批量删除失败', async () => {
    const user = userEvent.setup()
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    ;(global.fetch as any).mockResolvedValue({
      ok: false,
      json: async () => ({}),
    })
    
    render(<AlbumList initialAlbums={mockAlbums} />)
    
    const batchButton = screen.getByText('批量管理')
    await user.click(batchButton)
    
    const albumCard = screen.getByText('测试相册1').closest('.card')
    if (albumCard) {
      await user.click(albumCard)
    }
    
    const deleteButton = screen.getByText('删除')
    await user.click(deleteButton)
    
    const confirmButton = screen.getByText('Confirm')
    await user.click(confirmButton)
    
    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalled()
    })
    
    consoleErrorSpy.mockRestore()
  })

  it('应该支持打开创建相册对话框', async () => {
    const user = userEvent.setup()
    render(<AlbumList initialAlbums={mockAlbums} />)
    
    const createButton = screen.getByText('新建相册')
    await user.click(createButton)
    
    expect(screen.getByTestId('create-album-dialog')).toBeInTheDocument()
  })

  it('应该显示筛选后的空状态', async () => {
    const user = userEvent.setup()
    // 使用只有 allow_share 为 true 的相册列表，这样筛选 not_shared 时才会显示空状态
    const albumsWithShare: Album[] = [
      {
        id: 'album-1',
        title: '测试相册1',
        slug: 'test-album-1',
        photo_count: 10,
        is_public: true,
        allow_share: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        event_date: null,
        location: null,
        sort_rule: 'capture_desc',
        poster_image_url: null,
        cover_photo_id: null,
      },
    ]
    render(<AlbumList initialAlbums={albumsWithShare} />)
    
    const filterSelect = screen.getByDisplayValue('全部相册')
    await user.selectOptions(filterSelect, 'not_shared')
    
    // 应该显示筛选后的空状态（需要等待状态更新）
    await waitFor(() => {
      expect(screen.getByText('没有符合条件的相册')).toBeInTheDocument()
    })
  })

  it('应该支持刷新功能', async () => {
    const user = userEvent.setup()
    render(<AlbumList initialAlbums={mockAlbums} />)
    
    const refreshButton = screen.getByText('Refresh')
    await user.click(refreshButton)
    
    await waitFor(() => {
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('应该显示相册照片数量', () => {
    render(<AlbumList initialAlbums={mockAlbums} />)
    
    expect(screen.getByText('10 张照片')).toBeInTheDocument()
    expect(screen.getByText('5 张照片')).toBeInTheDocument()
  })

  it('应该显示相册公开/私有状态', () => {
    render(<AlbumList initialAlbums={mockAlbums} />)
    
    expect(screen.getByText('公开')).toBeInTheDocument()
    expect(screen.getByText('私有')).toBeInTheDocument()
  })
})

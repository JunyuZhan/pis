import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SidebarContent } from './sidebar'
import type { AuthUser } from '@/hooks/use-auth'

// Mock Next.js Link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => {
    return <a href={href} {...props}>{children}</a>
  },
}))

// Mock Next.js router
const mockPush = vi.fn()
const mockRefresh = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
  usePathname: () => '/admin',
}))

// Mock next/dynamic
vi.mock('next/dynamic', () => ({
  default: (importFn: () => Promise<any>) => {
    const MockComponent = () => null
    MockComponent.displayName = 'DynamicComponent'
    return MockComponent
  },
}))

// Mock fetch
global.fetch = vi.fn()

describe('SidebarContent', () => {
  const mockUser: AuthUser = {
    id: 'user-1',
    email: 'admin@example.com',
    role: 'admin',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    ;(global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    })
  })

  it('应该渲染用户邮箱', () => {
    render(<SidebarContent user={mockUser} />)
    expect(screen.getByText('admin@example.com')).toBeInTheDocument()
  })

  it('应该显示用户头像首字母', () => {
    render(<SidebarContent user={mockUser} />)
    const avatar = screen.getByText('A')
    expect(avatar).toBeInTheDocument()
  })

  it('应该显示所有导航菜单项（管理员角色）', () => {
    render(<SidebarContent user={mockUser} />)
    
    expect(screen.getByText('相册管理')).toBeInTheDocument()
    expect(screen.getByText('修图工作台')).toBeInTheDocument()
    expect(screen.getByText('用户管理')).toBeInTheDocument()
    expect(screen.getByText('系统设置')).toBeInTheDocument()
  })

  it('应该根据角色过滤菜单项（修图师）', () => {
    const retoucherUser: AuthUser = {
      ...mockUser,
      role: 'retoucher',
    }
    render(<SidebarContent user={retoucherUser} />)
    
    expect(screen.getByText('相册管理')).toBeInTheDocument()
    expect(screen.getByText('修图工作台')).toBeInTheDocument()
    expect(screen.queryByText('用户管理')).not.toBeInTheDocument()
    expect(screen.queryByText('系统设置')).not.toBeInTheDocument()
  })

  it('应该根据角色过滤菜单项（摄影师）', () => {
    const photographerUser: AuthUser = {
      ...mockUser,
      role: 'photographer',
    }
    render(<SidebarContent user={photographerUser} />)
    
    expect(screen.getByText('相册管理')).toBeInTheDocument()
    expect(screen.queryByText('修图工作台')).not.toBeInTheDocument()
    expect(screen.queryByText('用户管理')).not.toBeInTheDocument()
    expect(screen.queryByText('系统设置')).not.toBeInTheDocument()
  })

  it('应该在没有角色时只显示相册管理', () => {
    const guestUser: AuthUser = {
      ...mockUser,
      role: null,
    }
    render(<SidebarContent user={guestUser} />)
    
    expect(screen.getByText('相册管理')).toBeInTheDocument()
    expect(screen.queryByText('修图工作台')).not.toBeInTheDocument()
    expect(screen.queryByText('用户管理')).not.toBeInTheDocument()
    expect(screen.queryByText('系统设置')).not.toBeInTheDocument()
  })

  it('应该处理登出操作', async () => {
    const user = userEvent.setup()
    render(<SidebarContent user={mockUser} />)
    
    const logoutButton = screen.getByTitle('退出登录')
    await user.click(logoutButton)
    
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/signout', {
      method: 'POST',
    })
    expect(mockPush).toHaveBeenCalledWith('/admin/login')
    expect(mockRefresh).toHaveBeenCalled()
  })

  it('应该处理登出API失败的情况', async () => {
    const user = userEvent.setup()
    ;(global.fetch as any).mockRejectedValue(new Error('Network error'))
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    render(<SidebarContent user={mockUser} />)
    
    const logoutButton = screen.getByTitle('退出登录')
    await user.click(logoutButton)
    
    expect(consoleErrorSpy).toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/admin/login')
    
    consoleErrorSpy.mockRestore()
  })

  it('应该显示返回前端链接', () => {
    render(<SidebarContent user={mockUser} />)
    const homeLink = screen.getByText('返回前端')
    expect(homeLink).toBeInTheDocument()
    expect(homeLink.closest('a')).toHaveAttribute('href', '/')
  })

  it('应该处理长邮箱地址的截断', () => {
    const longEmailUser: AuthUser = {
      ...mockUser,
      email: 'verylongemailaddressthatshouldbetruncated@example.com',
    }
    render(<SidebarContent user={longEmailUser} />)
    
    const emailElement = screen.getByText(longEmailUser.email)
    expect(emailElement).toHaveClass('truncate')
  })

  it('应该正确显示用户头像首字母（小写邮箱）', () => {
    const lowercaseUser: AuthUser = {
      ...mockUser,
      email: 'test@example.com',
    }
    render(<SidebarContent user={lowercaseUser} />)
    
    expect(screen.getByText('T')).toBeInTheDocument()
  })

  it('应该正确显示用户头像首字母（特殊字符）', () => {
    const specialCharUser: AuthUser = {
      ...mockUser,
      email: '123@example.com',
    }
    render(<SidebarContent user={specialCharUser} />)
    
    // 应该显示数字或默认字符
    const avatar = screen.getByText('1')
    expect(avatar).toBeInTheDocument()
  })
})

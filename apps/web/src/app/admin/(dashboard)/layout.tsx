import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { getUserRoleFromCookies } from '@/lib/auth/role-helpers'
import { AdminSidebar } from '@/components/admin/sidebar'
import { MobileSidebar } from '@/components/admin/mobile-sidebar'
import { MobileBottomNav } from '@/components/admin/mobile-bottom-nav'

/**
 * 管理后台布局
 * 包含侧边栏导航
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // ⚠️ 注意：中间件已经检查过认证状态，如果未登录，请求不会到达这里
  // 这里只需要读取用户信息用于显示，不需要再次验证
  // 如果 getCurrentUser 返回 null，可能是系统错误，应该重定向到登录页
  const user = await getCurrentUser()

  if (!user) {
    // 在开发环境下记录日志，帮助调试
    if (process.env.NODE_ENV === 'development') {
      console.warn('[AdminLayout] User not found, but middleware allowed access. This should not happen.')
    }
    redirect('/admin/login')
  }

  // 获取用户角色信息（用于前端权限控制）
  const role = await getUserRoleFromCookies()
  
  // 将角色信息添加到用户对象中
  const userWithRole = {
    ...user,
    role: role || null,
  }

  return (
    <div className="min-h-screen bg-background">
      {/* 桌面端侧边栏 */}
      <AdminSidebar user={userWithRole} />
      
      {/* 移动端侧边栏 */}
      <MobileSidebar user={userWithRole} />

      {/* 主内容区 - 移动端优化 */}
      <main className="md:ml-64 min-h-screen pb-20 md:pb-0 transition-[padding] duration-200">
        <div className="p-3 sm:p-4 md:p-8 pt-16 md:pt-8 safe-area-inset-bottom">{children}</div>
      </main>

      {/* 移动端底部导航栏 */}
      <MobileBottomNav />
    </div>
  )
}

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { EmailConfigManager } from '@/components/admin/email-config-manager'

export default function EmailConfigPage() {
  return (
    <div className="space-y-6">
      {/* 返回按钮 */}
      <div className="flex items-center gap-2 text-text-secondary">
        <Link
          href="/admin/settings"
          className="flex items-center gap-1 hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          返回系统设置
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">邮件通知配置</h1>
        <p className="text-text-muted mt-1">
          配置 SMTP 邮件服务器，用于发送客户通知（如相册就绪通知）
        </p>
      </div>

      <div className="card">
        <EmailConfigManager />
      </div>
    </div>
  )
}

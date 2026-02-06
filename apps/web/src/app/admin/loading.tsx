'use client'

import { Loader2 } from 'lucide-react'

export default function AdminLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
        <span className="text-sm text-text-secondary">加载中...</span>
      </div>
    </div>
  )
}

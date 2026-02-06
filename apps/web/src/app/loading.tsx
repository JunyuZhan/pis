'use client'

import { Camera } from 'lucide-react'

export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4">
        {/* Logo 动画 */}
        <div className="relative">
          <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center animate-pulse">
            <Camera className="w-8 h-8 text-accent" />
          </div>
          {/* 旋转边框 */}
          <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-accent animate-spin" />
        </div>
        
        {/* 加载文字 */}
        <div className="flex items-center gap-1 text-text-secondary">
          <span>加载中</span>
          <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
          <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
          <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
        </div>
      </div>
    </div>
  )
}

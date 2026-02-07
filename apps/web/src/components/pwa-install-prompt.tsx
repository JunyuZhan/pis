'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Download } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isStandalone, setIsStandalone] = useState(false)
  const hasBeforeInstallPromptRef = useRef(false)
  const promptShownRef = useRef(false)
  const installTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    // 检查是否已经安装
    interface NavigatorStandalone extends Navigator {
      standalone?: boolean
    }
    interface WindowMSStream extends Window {
      MSStream?: unknown
    }
    const standalone = window.matchMedia('(display-mode: standalone)').matches
      || (window.navigator as NavigatorStandalone).standalone === true
    setIsStandalone(standalone)

    if (standalone) {
      console.log('[PWA] Already installed, skipping prompt')
      return
    }

    // 检查是否已经提示过（永久不再提示）
    const lastPrompt = localStorage.getItem('pwa-prompt-dismissed')
    if (lastPrompt) {
      console.log('[PWA] Prompt was dismissed before, skipping')
      return
    }

    // 标记：用于防止多个 setTimeout 同时显示提示
    const markPromptShown = () => {
      if (!promptShownRef.current) {
        promptShownRef.current = true
        localStorage.setItem('pwa-prompt-dismissed', Date.now().toString())
        console.log('[PWA] Marked prompt as shown, will not show again')
      }
    }
    
    // 检查是否应该显示提示的辅助函数
    const shouldShowPrompt = () => {
      return !localStorage.getItem('pwa-prompt-dismissed') && !promptShownRef.current
    }

    // 检查是否是 iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as WindowMSStream).MSStream
    setIsIOS(iOS)
    

    // 检查 Service Worker 是否已注册
    const checkServiceWorker = async () => {
      if ('serviceWorker' in navigator) {
        try {
          const registration = await navigator.serviceWorker.getRegistration()
          if (registration) {
            console.log('[PWA] Service Worker is registered')
          } else {
            console.log('[PWA] Service Worker not yet registered, waiting...')
            // 等待 Service Worker 注册
            navigator.serviceWorker.ready.then(() => {
              console.log('[PWA] Service Worker ready')
            })
          }
        } catch (error) {
          console.error('[PWA] Error checking Service Worker:', error)
        }
      }
    }
    checkServiceWorker()

    // 监听 beforeinstallprompt 事件（仅 Chrome/Edge/Opera 等支持）
    const handler = async (e: Event) => {
      console.log('[PWA] beforeinstallprompt event fired')
      e.preventDefault()
      const promptEvent = e as BeforeInstallPromptEvent
      setDeferredPrompt(promptEvent)
      hasBeforeInstallPromptRef.current = true
      
      // 显示自定义提示框
      setTimeout(() => {
        if (shouldShowPrompt()) {
          console.log('[PWA] Showing custom install prompt')
          markPromptShown()
          setShowPrompt(true)
        }
      }, 3000)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // iOS 设备显示手动安装提示（只有在未关闭过的情况下）
    if (iOS) {
      console.log('[PWA] iOS device detected, showing manual install instructions')
      setTimeout(() => {
        // 再次检查是否已经显示过（防止重复）
        if (shouldShowPrompt()) {
          markPromptShown()
          setShowPrompt(true)
        }
      }, 5000)
    } else {
      // 非 iOS 设备：即使没有 beforeinstallprompt 事件，也尝试显示提示
      // 但需要等待 Service Worker 注册完成
      setTimeout(() => {
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(() => {
            // 如果 7 秒后还没有 beforeinstallprompt 事件，也显示提示
            // 用户可以通过浏览器菜单手动安装
            setTimeout(() => {
              // 使用 ref 检查，避免闭包问题
              // 再次检查是否已经显示过（防止重复）
              if (!hasBeforeInstallPromptRef.current && shouldShowPrompt()) {
                console.log('[PWA] No beforeinstallprompt event, showing manual install prompt')
                markPromptShown()
                setShowPrompt(true)
              }
            }, 2000)
          })
        }
      }, 5000)
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  const handleInstall = useCallback(async () => {
    // 防抖：如果正在安装，忽略重复点击
    if (isInstalling) {
      return
    }

    setIsInstalling(true)

    // 清除之前的超时
    if (installTimeoutRef.current) {
      clearTimeout(installTimeoutRef.current)
    }

    // 设置超时，防止长时间无响应
    installTimeoutRef.current = setTimeout(() => {
      setIsInstalling(false)
    }, 5000)

    try {
      if (deferredPrompt) {
        // 有 deferredPrompt，直接调用系统安装提示
        await deferredPrompt.prompt()
        const { outcome } = await deferredPrompt.userChoice
        
        if (outcome === 'accepted') {
          console.log('[PWA] User accepted install prompt')
          // 标记已处理，关闭提示
          promptShownRef.current = true
          localStorage.setItem('pwa-prompt-dismissed', Date.now().toString())
          setDeferredPrompt(null)
          setShowPrompt(false)
        } else {
          // 用户取消，保持提示框显示
          console.log('[PWA] User dismissed install prompt')
        }
      } else {
        // 没有 deferredPrompt，关闭提示（用户需要手动安装）
        console.log('[PWA] No deferredPrompt, user needs to install manually')
        promptShownRef.current = true
        localStorage.setItem('pwa-prompt-dismissed', Date.now().toString())
        setShowPrompt(false)
      }
    } catch (error) {
      console.error('[PWA] Install error:', error)
      // 如果调用失败，关闭提示
      promptShownRef.current = true
      localStorage.setItem('pwa-prompt-dismissed', Date.now().toString())
      setShowPrompt(false)
    } finally {
      setIsInstalling(false)
      if (installTimeoutRef.current) {
        clearTimeout(installTimeoutRef.current)
        installTimeoutRef.current = null
      }
    }
  }, [deferredPrompt, isInstalling])

  const handleDismiss = useCallback(() => {
    // 确保标记已设置（防止重复显示）
    promptShownRef.current = true
    localStorage.setItem('pwa-prompt-dismissed', Date.now().toString())
    setShowPrompt(false)
  }, [])

  // 清理超时
  useEffect(() => {
    return () => {
      if (installTimeoutRef.current) {
        clearTimeout(installTimeoutRef.current)
      }
    }
  }, [])

  if (isStandalone || !showPrompt) return null

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-slide-up">
      <div className="bg-surface-elevated border border-border rounded-xl shadow-2xl p-4">
        <div className="flex items-start gap-3">
          {/* 图标 */}
          <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center shrink-0">
            <Download className="w-6 h-6 text-accent" />
          </div>

          {/* 内容 */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-text-primary mb-1">
              安装 PIS 应用
            </h3>
            <p className="text-sm text-text-secondary mb-3">
              {isIOS 
                ? '添加到主屏幕，获得更好的体验'
                : '安装应用，随时随地查看照片'
              }
            </p>

            {/* 安装按钮 */}
            <button
              onClick={handleInstall}
              disabled={isInstalling}
              className="btn-primary text-sm w-full disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              {isInstalling ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  安装中...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  {deferredPrompt ? '立即安装' : '安装应用'}
                </>
              )}
            </button>
          </div>

          {/* 关闭按钮 */}
          <button
            onClick={handleDismiss}
            className="text-text-muted hover:text-text-primary p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}

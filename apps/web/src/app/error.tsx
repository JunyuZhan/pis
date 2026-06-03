'use client'

/**
 * Global Error Boundary for Next.js App Router
 *
 * This component catches all unhandled errors in the app and displays
 * a user-friendly error message. Error details are only shown in development.
 *
 * Note: This is a Client Component and should NOT include <html> or <body> tags.
 * Those are handled by layout.tsx.
 */

import { useEffect } from 'react'

const isDev = process.env.NODE_ENV === 'development'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to the console for debugging
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4" role="alert">
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-16 h-16 text-red-500 mx-auto mb-4 text-4xl" aria-hidden="true">⚠️</div>
          <h1 className="text-2xl font-bold text-text-primary mb-2">
            应用错误
          </h1>
          <p className="text-text-secondary mb-4">
            应用遇到了一个错误，请刷新页面重试。
          </p>
          {isDev && error?.message && (
            <div className="bg-surface-elevated border border-border rounded-lg p-4 mb-4 text-left">
              <p className="text-sm font-mono text-text-muted break-all">
                {error.message}
              </p>
              {error.digest && (
                <p className="text-xs text-text-muted mt-2">
                  错误 ID: {error.digest}
                </p>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="btn-primary"
          >
            重试
          </button>
          <button
            onClick={() => {
              window.location.href = '/'
            }}
            className="btn-secondary"
          >
            返回首页
          </button>
        </div>
      </div>
    </div>
  )
}

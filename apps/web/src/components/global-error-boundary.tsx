'use client'

/**
 * Global Error Boundary Component
 * 
 * Catches errors in client components and displays a fallback UI.
 * This is a React Error Boundary (class component required).
 */

import { Component, ReactNode } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console for debugging
    console.error('Global Error Boundary caught an error:', error, errorInfo)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background px-4">
          <div className="max-w-md w-full text-center">
            <div className="mb-6">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h1 className="text-2xl font-bold text-text-primary mb-2">
                客户端错误
              </h1>
              <p className="text-text-secondary mb-4">
                应用遇到了一个客户端错误，请查看浏览器控制台获取更多信息。
              </p>
              {this.state.error?.message && (
                <div className="bg-surface-elevated border border-border rounded-lg p-4 mb-4 text-left">
                  <p className="text-sm font-mono text-text-muted break-all">
                    {this.state.error.message}
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="btn-primary flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                刷新页面
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
            <div className="mt-6 text-xs text-text-muted">
              <p>如果问题持续存在，请检查：</p>
              <ul className="list-disc list-inside mt-2 space-y-1 text-left max-w-sm mx-auto">
                <li>浏览器控制台中的错误信息</li>
                <li>网络连接是否正常</li>
                <li>环境变量配置是否正确</li>
              </ul>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

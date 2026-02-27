'use client'

import { useState, useEffect } from 'react'
import { 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Download, 
  Clock, 
  Loader2, 
  Server,
  Tag,
  ExternalLink,
  FileText,
  ChevronDown,
  ChevronUp,
  History,
  XCircle,
  RotateCcw,
} from 'lucide-react'
import { showSuccess, handleApiError } from '@/lib/toast'
import { cn } from '@/lib/utils'
import type { VersionCheckResult } from '@/lib/version'

interface UpgradeLog {
  type: 'start' | 'stdout' | 'stderr' | 'success' | 'error'
  message: string
  stdout?: string
  stderr?: string
}

interface UpgradeHistoryItem {
  id: string
  from_version: string
  to_version: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'rolled_back'
  started_at: string
  completed_at: string | null
  executor_name: string | null
  notes: string | null
  error_message: string | null
  rebuild_performed: boolean
  rollback_available: boolean
  duration: number | null
}

type TabType = 'status' | 'history'

export function UpgradeManager() {
  const [activeTab, setActiveTab] = useState<TabType>('status')
  const [checking, setChecking] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const [status, setStatus] = useState<VersionCheckResult | null>(null)
  const [logs, setLogs] = useState<UpgradeLog[]>([])
  const [skipRestart, setSkipRestart] = useState(false)
  const [rebuildImages, setRebuildImages] = useState(false)
  const [showReleaseNotes, setShowReleaseNotes] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // 升级历史状态
  const [history, setHistory] = useState<UpgradeHistoryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  
  // 回滚状态
  const [rollingBack, setRollingBack] = useState(false)
  const [rollbackTarget, setRollbackTarget] = useState<string | null>(null)
  const [rollbackLogs, setRollbackLogs] = useState<UpgradeLog[]>([])

  // 组件加载时自动检查
  useEffect(() => {
    checkStatus()
  }, [])
  
  // 切换到历史标签时加载历史
  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory()
    }
  }, [activeTab])
  
  const fetchHistory = async () => {
    setLoadingHistory(true)
    setHistoryError(null)
    try {
      const response = await fetch('/api/admin/upgrade/history?limit=20')
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error?.message || '获取历史失败')
      }
      
      setHistory(data.data?.history || [])
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取升级历史失败'
      setHistoryError(message)
    } finally {
      setLoadingHistory(false)
    }
  }

  const checkStatus = async () => {
    setChecking(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/upgrade/check')
      const data = await response.json()

      if (!response.ok) {
        const errorMessage = data.error?.message || data.error?.details || '检查失败'
        setError(errorMessage)
        return
      }

      setStatus(data)
    } catch (err) {
      const message = err instanceof Error ? err.message : '检查版本状态失败'
      setError(message)
      handleApiError(err, '检查版本状态失败')
    } finally {
      setChecking(false)
    }
  }

  const executeUpgrade = async () => {
    if (!status?.hasUpdate) {
      showSuccess('已是最新版本，无需升级')
      return
    }

    if (!confirm(`确定要升级到 ${status.latestVersion} 吗？升级过程中服务可能会短暂中断。`)) {
      return
    }

    setUpgrading(true)
    setLogs([])

    try {
      const response = await fetch('/api/admin/upgrade/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          skipRestart, 
          rebuildImages,
          targetVersion: status.latestVersion,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || '升级失败')
      }

      // 读取流式响应
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('无法读取响应流')
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              setLogs((prev) => [...prev, data])

              if (data.type === 'success') {
                showSuccess('升级完成')
                // 重新检查状态
                setTimeout(() => {
                  checkStatus()
                }, 2000)
              } else if (data.type === 'error') {
                handleApiError(new Error(data.message), '升级失败')
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (err) {
      handleApiError(err, '执行升级失败')
    } finally {
      setUpgrading(false)
    }
  }

  // 执行回滚
  const executeRollback = async (targetVersion: string) => {
    if (!confirm(`确定要回滚到版本 ${targetVersion} 吗？回滚过程中服务可能会短暂中断。`)) {
      return
    }

    setRollingBack(true)
    setRollbackTarget(targetVersion)
    setRollbackLogs([])

    try {
      const response = await fetch('/api/admin/upgrade/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          target_version: targetVersion,
          rebuild: false,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || data.error || '回滚失败')
      }

      // 读取流式响应
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('无法读取响应流')
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))
              setRollbackLogs((prev) => [...prev, data])

              if (data.type === 'success') {
                showSuccess(`已成功回滚到版本 ${targetVersion}`)
                // 刷新历史
                setTimeout(() => {
                  fetchHistory()
                  checkStatus()
                }, 2000)
              } else if (data.type === 'error') {
                handleApiError(new Error(data.message), '回滚失败')
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (err) {
      handleApiError(err, '执行回滚失败')
    } finally {
      setRollingBack(false)
      setRollbackTarget(null)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A'
    try {
      const date = new Date(dateString)
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    } catch {
      return dateString
    }
  }

  // 简单的 Markdown 渲染（处理常见格式）
  const renderMarkdown = (text: string) => {
    if (!text) return null
    
    // 将 markdown 转换为简单的 HTML
    const lines = text.split('\n')
    const elements: React.ReactNode[] = []
    
    lines.forEach((line, index) => {
      // 处理标题
      if (line.startsWith('### ')) {
        elements.push(
          <h4 key={index} className="font-semibold mt-3 mb-1">
            {line.slice(4)}
          </h4>
        )
      } else if (line.startsWith('## ')) {
        elements.push(
          <h3 key={index} className="font-bold mt-4 mb-2 text-lg">
            {line.slice(3)}
          </h3>
        )
      } else if (line.startsWith('# ')) {
        elements.push(
          <h2 key={index} className="font-bold mt-4 mb-2 text-xl">
            {line.slice(2)}
          </h2>
        )
      }
      // 处理列表项
      else if (line.startsWith('- ') || line.startsWith('* ')) {
        elements.push(
          <li key={index} className="ml-4 list-disc">
            {line.slice(2)}
          </li>
        )
      }
      // 处理代码块
      else if (line.startsWith('```')) {
        // 忽略代码块标记
      }
      // 普通文本
      else if (line.trim()) {
        elements.push(
          <p key={index} className="my-1">
            {line}
          </p>
        )
      }
    })
    
    return elements
  }

  // 获取状态对应的图标和样式
  const getStatusDisplay = (status: UpgradeHistoryItem['status']) => {
    switch (status) {
      case 'success':
        return { icon: CheckCircle2, color: 'text-green-500', label: '成功' }
      case 'failed':
        return { icon: XCircle, color: 'text-red-500', label: '失败' }
      case 'running':
        return { icon: Loader2, color: 'text-blue-500', label: '执行中' }
      case 'rolled_back':
        return { icon: RotateCcw, color: 'text-yellow-500', label: '已回滚' }
      default:
        return { icon: Clock, color: 'text-gray-500', label: '等待中' }
    }
  }

  return (
    <div className="space-y-4">
      {/* 标签页切换 */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('status')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'status'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-muted hover:text-text-primary'
          )}
        >
          <span className="flex items-center gap-2">
            <Server className="w-4 h-4" />
            版本状态
          </span>
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
            activeTab === 'history'
              ? 'border-accent text-accent'
              : 'border-transparent text-text-muted hover:text-text-primary'
          )}
        >
          <span className="flex items-center gap-2">
            <History className="w-4 h-4" />
            升级历史
          </span>
        </button>
      </div>
      
      {/* 版本状态标签页 */}
      {activeTab === 'status' && (
        <>
      {/* 版本状态 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">版本信息</h3>
          <button
            onClick={checkStatus}
            disabled={checking}
            className="text-sm text-accent hover:text-accent/80 flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', checking && 'animate-spin')} />
            刷新
          </button>
        </div>

        {error ? (
          <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
              <div>
                <p className="font-medium text-red-400">检查失败</p>
                <p className="text-sm text-red-400/80 mt-1">{error}</p>
              </div>
            </div>
          </div>
        ) : status ? (
          <div className="space-y-3 p-4 bg-surface rounded-lg border border-border">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-text-muted" />
                <span className="text-text-muted">当前版本:</span>
                <span className="font-medium font-mono">{status.currentVersion}</span>
              </div>
              {status.latestVersion && (
                <div className="flex items-center gap-2">
                  <Download className="w-4 h-4 text-text-muted" />
                  <span className="text-text-muted">最新版本:</span>
                  <span className="font-medium font-mono">
                    {status.latestVersion}
                    {status.isPrerelease && (
                      <span className="ml-1 text-xs text-yellow-500">(预发布)</span>
                    )}
                  </span>
                </div>
              )}
              {status.publishedAt && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-text-muted" />
                  <span className="text-text-muted">发布时间:</span>
                  <span className="font-medium">{formatDate(status.publishedAt)}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-text-muted" />
                <span className="text-text-muted">最后检查:</span>
                <span className="font-medium">{formatDate(status.lastChecked)}</span>
              </div>
            </div>

            {/* 更新状态 */}
            <div className="mt-3 pt-3 border-t border-border">
              {status.hasUpdate ? (
                <div className="flex items-center gap-2 text-yellow-500">
                  <AlertCircle className="w-5 h-5" />
                  <span className="font-medium">有新版本可用: {status.latestVersion}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-green-500">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="font-medium">已是最新版本</span>
                </div>
              )}
            </div>

            {/* 更新日志 */}
            {status.releaseNotes && (
              <div className="mt-3 pt-3 border-t border-border">
                <button
                  onClick={() => setShowReleaseNotes(!showReleaseNotes)}
                  className="flex items-center gap-2 text-sm text-accent hover:text-accent/80 w-full justify-between"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    {status.releaseName || '更新日志'}
                  </span>
                  {showReleaseNotes ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
                
                {showReleaseNotes && (
                  <div className="mt-3 p-3 bg-background rounded text-sm text-text-secondary max-h-64 overflow-y-auto">
                    {renderMarkdown(status.releaseNotes)}
                  </div>
                )}
              </div>
            )}

            {/* GitHub 链接 */}
            {status.releaseUrl && (
              <div className="mt-3 pt-3 border-t border-border">
                <a
                  href={status.releaseUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-accent hover:text-accent/80"
                >
                  <ExternalLink className="w-4 h-4" />
                  在 GitHub 查看完整更新
                </a>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-surface rounded-lg border border-border text-center text-text-muted">
            {checking ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                检查中...
              </div>
            ) : (
              '点击刷新按钮检查版本状态'
            )}
          </div>
        )}
      </div>

      {/* 升级选项 */}
      {status?.hasUpdate && (
        <div>
          <h3 className="text-base font-semibold mb-2">升级选项</h3>
          <div className="space-y-3">
            <label className="flex items-start gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={rebuildImages}
                onChange={(e) => setRebuildImages(e.target.checked)}
                className="rounded border-border mt-0.5"
                disabled={upgrading}
              />
              <div className="flex-1">
                <span className="text-sm font-medium">重新构建镜像（无缓存）</span>
                <p className="text-xs text-text-muted mt-1">
                  适用于依赖更新、Dockerfile 修改或构建配置变更。构建时间较长，但确保镜像完全更新。
                </p>
              </div>
            </label>
            <label className="flex items-start gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={skipRestart}
                onChange={(e) => setSkipRestart(e.target.checked)}
                className="rounded border-border mt-0.5"
                disabled={upgrading}
              />
              <div className="flex-1">
                <span className="text-sm font-medium">跳过容器重启</span>
                <p className="text-xs text-text-muted mt-1">
                  仅更新代码和配置，不重启 Docker 容器。需要手动重启容器以应用更改。
                </p>
              </div>
            </label>
          </div>
        </div>
      )}

      {/* 升级按钮 */}
      {status?.hasUpdate && (
        <button
          onClick={executeUpgrade}
          disabled={upgrading || checking}
          className="btn-primary flex items-center gap-2 w-full"
        >
          {upgrading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              升级中...
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              升级到 {status.latestVersion}
            </>
          )}
        </button>
      )}

      {/* 升级日志 */}
      {logs.length > 0 && (
        <div className="mt-4">
          <h3 className="text-base font-semibold mb-2">升级日志</h3>
          <div className="p-4 bg-surface rounded-lg border border-border max-h-96 overflow-y-auto">
            <div className="space-y-1 font-mono text-sm">
              {logs.map((log, index) => (
                <div
                  key={index}
                  className={cn(
                    'py-1 px-2 rounded',
                    log.type === 'stderr' || log.type === 'error'
                      ? 'bg-red-500/10 text-red-400'
                      : log.type === 'success'
                      ? 'bg-green-500/10 text-green-400'
                      : 'text-text-secondary'
                  )}
                >
                  {log.message}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 提示信息 */}
      <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
        <div className="flex items-start gap-2">
          <Server className="w-4 h-4 text-blue-500 mt-0.5" />
          <div className="flex-1 text-sm text-blue-400">
            <p className="font-medium mb-1">升级说明：</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>升级基于 GitHub Releases 版本管理</li>
              <li>升级会自动切换到目标版本的 Git Tag</li>
              <li>默认会自动重启 Docker 容器以应用更改</li>
              <li>升级过程中服务可能会短暂中断</li>
              <li>建议在低峰期执行升级操作</li>
            </ul>
          </div>
        </div>
      </div>
        </>
      )}
      
      {/* 升级历史标签页 */}
      {activeTab === 'history' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold">升级历史</h3>
            <button
              onClick={fetchHistory}
              disabled={loadingHistory}
              className="text-sm text-accent hover:text-accent/80 flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw className={cn('w-4 h-4', loadingHistory && 'animate-spin')} />
              刷新
            </button>
          </div>
          
          {/* 回滚日志 */}
          {rollbackLogs.length > 0 && (
            <div className="mb-4">
              <h4 className="text-sm font-semibold mb-2">回滚日志</h4>
              <div className="p-4 bg-surface rounded-lg border border-border max-h-64 overflow-y-auto">
                <div className="space-y-1 font-mono text-sm">
                  {rollbackLogs.map((log, index) => (
                    <div
                      key={index}
                      className={cn(
                        'py-1 px-2 rounded',
                        log.type === 'stderr' || log.type === 'error'
                          ? 'bg-red-500/10 text-red-400'
                          : log.type === 'success'
                          ? 'bg-green-500/10 text-green-400'
                          : 'text-text-secondary'
                      )}
                    >
                      {log.message}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {loadingHistory && history.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
            </div>
          ) : historyError ? (
            <div className="p-4 bg-red-500/10 rounded-lg border border-red-500/20">
              <div className="flex items-center gap-2 text-red-500">
                <AlertCircle className="w-5 h-5" />
                <span>{historyError}</span>
              </div>
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8 text-text-muted">
              <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>暂无升级记录</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((item) => {
                const statusDisplay = getStatusDisplay(item.status)
                const StatusIcon = statusDisplay.icon
                
                return (
                  <div
                    key={item.id}
                    className="p-4 bg-surface-elevated rounded-lg border border-border"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <StatusIcon className={cn('w-5 h-5 mt-0.5', statusDisplay.color, item.status === 'running' && 'animate-spin')} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">
                              {item.from_version} → {item.to_version}
                            </span>
                            <span className={cn('text-xs px-2 py-0.5 rounded', statusDisplay.color, 'bg-current/10')}>
                              {statusDisplay.label}
                            </span>
                            {item.rebuild_performed && (
                              <span className="text-xs px-2 py-0.5 rounded bg-purple-500/10 text-purple-500">
                                重建镜像
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-text-muted mt-1">
                            <span>{formatDate(item.started_at)}</span>
                            {item.duration && (
                              <span className="ml-2">耗时 {item.duration}秒</span>
                            )}
                            {item.executor_name && (
                              <span className="ml-2">执行人: {item.executor_name}</span>
                            )}
                          </div>
                          {item.notes && (
                            <p className="text-sm text-text-secondary mt-1">{item.notes}</p>
                          )}
                          {item.error_message && (
                            <p className="text-sm text-red-400 mt-1 font-mono text-xs bg-red-500/10 p-2 rounded">
                              {item.error_message}
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* 回滚按钮 - 只对成功的升级且非当前版本显示 */}
                      {item.status === 'success' && item.rollback_available && item.from_version !== status?.currentVersion && (
                        <button
                          onClick={() => executeRollback(item.from_version)}
                          disabled={rollingBack}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10 rounded transition-colors disabled:opacity-50"
                          title={`回滚到 ${item.from_version}`}
                        >
                          {rollingBack && rollbackTarget === item.from_version ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              回滚中...
                            </>
                          ) : (
                            <>
                              <RotateCcw className="w-3.5 h-3.5" />
                              回滚
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { Save, Download, Loader2, FileText, ChevronDown, ChevronUp, Trash2 } from 'lucide-react'
import type { AlbumTemplate } from '@/types/database'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { showSuccess, handleApiError, showInfo } from '@/lib/toast'

// 模板可配置字段
export interface TemplateConfig {
  is_public: boolean
  layout: 'masonry' | 'grid' | 'carousel'
  sort_rule: 'capture_desc' | 'capture_asc' | 'manual'
  allow_download: boolean
  allow_batch_download: boolean
  show_exif: boolean
  password: string | null
  expires_at: string | null
  watermark_enabled: boolean
  watermark_config: Record<string, unknown>
}

interface ConfigTemplateActionsProps {
  // 获取当前表单配置
  getCurrentConfig: () => TemplateConfig
  // 将模板配置应用到表单
  onApplyConfig: (config: Partial<TemplateConfig>) => void
}

/**
 * 配置模板操作组件
 * 提供"保存为模板"和"从模板加载"功能
 */
export function ConfigTemplateActions({
  getCurrentConfig,
  onApplyConfig,
}: ConfigTemplateActionsProps) {
  const [templates, setTemplates] = useState<AlbumTemplate[]>([])
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  
  // 保存对话框
  const [showSaveDialog, setShowSaveDialog] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [saveDescription, setSaveDescription] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [saveMode, setSaveMode] = useState<'new' | 'update'>('new')
  const [saving, setSaving] = useState(false)
  
  // 加载对话框
  const [showLoadDialog, setShowLoadDialog] = useState(false)
  const [loadTemplateId, setLoadTemplateId] = useState<string | null>(null)
  const [loadingTemplate, setLoadingTemplate] = useState(false)
  
  // 确认对话框
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    message: string
    onConfirm: () => void | Promise<void>
    variant?: 'default' | 'danger'
  } | null>(null)

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/templates')
      const data = await res.json()
      if (res.ok) {
        setTemplates(data.data?.templates || data.templates || [])
      }
    } catch (error) {
      console.error('加载模板失败:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (expanded) {
      loadTemplates()
    }
  }, [expanded, loadTemplates])

  // 保存为模板
  const handleSave = async () => {
    if (saveMode === 'new' && !saveName.trim()) {
      showInfo('请输入模板名称')
      return
    }
    
    if (saveMode === 'update' && !selectedTemplateId) {
      showInfo('请选择要更新的模板')
      return
    }

    setSaving(true)
    const config = getCurrentConfig()
    
    try {
      if (saveMode === 'new') {
        // 创建新模板
        const res = await fetch('/api/admin/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: saveName.trim(),
            description: saveDescription.trim() || null,
            settings: config,
          }),
        })
        
        if (res.ok) {
          showSuccess('模板创建成功')
          setShowSaveDialog(false)
          setSaveName('')
          setSaveDescription('')
          loadTemplates()
        } else {
          const data = await res.json()
          handleApiError(new Error(data.error?.message || '创建失败'))
        }
      } else {
        // 更新现有模板
        const res = await fetch(`/api/admin/templates/${selectedTemplateId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            settings: config,
          }),
        })
        
        if (res.ok) {
          showSuccess('模板配置已更新')
          setShowSaveDialog(false)
          setSelectedTemplateId(null)
          loadTemplates()
        } else {
          const data = await res.json()
          handleApiError(new Error(data.error?.message || '更新失败'))
        }
      }
    } catch (error) {
      handleApiError(error, '操作失败，请重试')
    } finally {
      setSaving(false)
    }
  }

  // 从模板加载
  const handleLoad = async () => {
    if (!loadTemplateId) {
      showInfo('请选择要加载的模板')
      return
    }

    setLoadingTemplate(true)
    
    try {
      const res = await fetch(`/api/admin/templates/${loadTemplateId}`)
      if (res.ok) {
        const data = await res.json()
        const template = data.data || data
        
        // 应用模板配置到表单
        onApplyConfig({
          is_public: template.is_public,
          layout: template.layout,
          sort_rule: template.sort_rule,
          allow_download: template.allow_download,
          allow_batch_download: template.allow_batch_download,
          show_exif: template.show_exif,
          password: template.password,
          expires_at: template.expires_at,
          watermark_enabled: template.watermark_enabled,
          watermark_config: template.watermark_config || {},
        })
        
        showSuccess(`已加载模板「${template.name}」的配置`)
        setShowLoadDialog(false)
        setLoadTemplateId(null)
      } else {
        const data = await res.json()
        handleApiError(new Error(data.error?.message || '加载失败'))
      }
    } catch (error) {
      handleApiError(error, '加载失败，请重试')
    } finally {
      setLoadingTemplate(false)
    }
  }

  // 删除模板
  const handleDelete = (templateId: string, templateName: string) => {
    setConfirmDialog({
      open: true,
      title: '确认删除',
      message: `确定要删除模板「${templateName}」吗？`,
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`/api/admin/templates/${templateId}`, {
            method: 'DELETE',
          })

          if (res.ok) {
            showSuccess('模板已删除')
            loadTemplates()
          } else {
            const data = await res.json()
            handleApiError(new Error(data.error?.message || '删除失败'))
          }
        } catch (error) {
          handleApiError(error, '删除失败，请重试')
        }
      },
    })
  }

  return (
    <div className="space-y-4">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-accent" />
          <h3 className="font-medium">配置模板</h3>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="btn-ghost p-1"
        >
          {expanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>
      </div>
      
      <p className="text-xs text-text-muted">
        将当前相册的配置（布局、水印、权限等）保存为模板，方便快速应用到其他相册
      </p>

      {expanded && (
        <div className="space-y-4 pt-2">
          {/* 操作按钮 */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setSaveMode('new')
                setSaveName('')
                setSaveDescription('')
                setSelectedTemplateId(null)
                setShowSaveDialog(true)
              }}
              className="btn-secondary text-sm"
            >
              <Save className="w-4 h-4" />
              保存为新模板
            </button>
            
            {templates.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setSaveMode('update')
                    setSelectedTemplateId(null)
                    setShowSaveDialog(true)
                  }}
                  className="btn-secondary text-sm"
                >
                  <Save className="w-4 h-4" />
                  更新现有模板
                </button>
                
                <button
                  type="button"
                  onClick={() => {
                    setLoadTemplateId(null)
                    setShowLoadDialog(true)
                  }}
                  className="btn-secondary text-sm"
                >
                  <Download className="w-4 h-4" />
                  从模板加载
                </button>
              </>
            )}
          </div>

          {/* 模板列表 */}
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
            </div>
          ) : templates.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-text-secondary font-medium">
                已有模板 ({templates.length})
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="p-3 bg-surface-elevated rounded-lg border border-border flex items-start justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{template.name}</p>
                      {template.description && (
                        <p className="text-xs text-text-muted truncate mt-1">
                          {template.description}
                        </p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface text-text-muted">
                          {template.layout === 'masonry' ? '瀑布流' : template.layout === 'grid' ? '网格' : '轮播'}
                        </span>
                        {template.watermark_enabled && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface text-text-muted">
                            水印
                          </span>
                        )}
                        {template.is_public && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400">
                            公开
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(template.id, template.name)}
                      className="btn-ghost p-1 text-red-400 hover:text-red-300 shrink-0 ml-2"
                      title="删除模板"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-text-muted text-sm">
              还没有配置模板
            </div>
          )}
        </div>
      )}

      {/* 保存对话框 */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {saveMode === 'new' ? '保存为新模板' : '更新现有模板'}
            </DialogTitle>
            <DialogDescription>
              {saveMode === 'new'
                ? '将当前相册的配置保存为新模板'
                : '使用当前相册的配置更新已有模板'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {saveMode === 'new' ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    模板名称 <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    className="input"
                    placeholder="例如：婚礼相册模板"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-2">
                    模板描述
                  </label>
                  <textarea
                    value={saveDescription}
                    onChange={(e) => setSaveDescription(e.target.value)}
                    className="input min-h-[80px] resize-none"
                    placeholder="可选的模板描述..."
                  />
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">
                  选择要更新的模板 <span className="text-red-400">*</span>
                </label>
                <select
                  value={selectedTemplateId || ''}
                  onChange={(e) => setSelectedTemplateId(e.target.value || null)}
                  className="input"
                >
                  <option value="">请选择模板...</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="p-3 bg-surface rounded-lg text-sm text-text-muted">
              <p className="font-medium mb-1">将保存以下配置：</p>
              <ul className="list-disc list-inside space-y-0.5 text-xs">
                <li>布局和排序规则</li>
                <li>公开/私密设置</li>
                <li>下载权限</li>
                <li>EXIF 信息显示</li>
                <li>密码保护和过期时间</li>
                <li>水印配置</li>
              </ul>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <button
              type="button"
              onClick={() => setShowSaveDialog(false)}
              className="btn-secondary"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-primary"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {saveMode === 'new' ? '保存模板' : '更新模板'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 加载对话框 */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>从模板加载配置</DialogTitle>
            <DialogDescription>
              选择一个模板，将其配置应用到当前相册
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-text-secondary mb-2">
                选择模板 <span className="text-red-400">*</span>
              </label>
              <select
                value={loadTemplateId || ''}
                onChange={(e) => setLoadTemplateId(e.target.value || null)}
                className="input"
              >
                <option value="">请选择模板...</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </select>
            </div>

            {loadTemplateId && (
              <div className="p-3 bg-surface rounded-lg text-sm">
                {(() => {
                  const template = templates.find((t) => t.id === loadTemplateId)
                  if (!template) return null
                  return (
                    <div className="space-y-2">
                      <p className="font-medium">{template.name}</p>
                      {template.description && (
                        <p className="text-text-muted text-xs">{template.description}</p>
                      )}
                      <div className="flex flex-wrap gap-1 mt-2">
                        <span className="text-xs px-2 py-0.5 rounded bg-surface-elevated">
                          {template.layout === 'masonry' ? '瀑布流' : template.layout === 'grid' ? '网格' : '轮播'}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded bg-surface-elevated">
                          {template.is_public ? '公开' : '私密'}
                        </span>
                        {template.watermark_enabled && (
                          <span className="text-xs px-2 py-0.5 rounded bg-surface-elevated">
                            水印
                          </span>
                        )}
                        {template.allow_download && (
                          <span className="text-xs px-2 py-0.5 rounded bg-surface-elevated">
                            允许下载
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}

            <div className="p-3 bg-amber-500/10 rounded-lg text-sm text-amber-400">
              <p>⚠️ 加载模板将覆盖当前相册的配置（布局、水印、权限等）</p>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <button
              type="button"
              onClick={() => setShowLoadDialog(false)}
              className="btn-secondary"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleLoad}
              disabled={loadingTemplate || !loadTemplateId}
              className="btn-primary"
            >
              {loadingTemplate ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              加载配置
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 确认对话框 */}
      {confirmDialog && (
        <ConfirmDialog
          open={confirmDialog.open}
          onOpenChange={(open) => {
            if (!open) {
              setConfirmDialog(null)
            }
          }}
          title={confirmDialog.title}
          message={confirmDialog.message}
          variant={confirmDialog.variant}
          onConfirm={async () => {
            await confirmDialog.onConfirm()
            setConfirmDialog(null)
          }}
        />
      )}
    </div>
  )
}

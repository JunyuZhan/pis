'use client'

import { useState, useEffect } from 'react'
import { X, Loader2, Plus, Tag } from 'lucide-react'
import { showSuccess, handleApiError } from '@/lib/toast'

interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  wechat: string | null
  company: string | null
  address: string | null
  notes: string | null
  tags: string[] | null
  source: string | null
  status: string
}

interface CustomerDialogProps {
  open: boolean
  customer: Customer | null
  onClose: () => void
  onSaved: () => void
}

const sourceOptions = [
  { value: '', label: '请选择' },
  { value: 'referral', label: '转介绍' },
  { value: 'website', label: '网站' },
  { value: 'social', label: '社交媒体' },
  { value: 'other', label: '其他' },
]

const statusOptions = [
  { value: 'active', label: '活跃' },
  { value: 'inactive', label: '非活跃' },
  { value: 'archived', label: '已归档' },
]

export function CustomerDialog({ open, customer, onClose, onSaved }: CustomerDialogProps) {
  const [saving, setSaving] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    wechat: '',
    company: '',
    address: '',
    notes: '',
    tags: [] as string[],
    source: '',
    status: 'active',
  })

  // 编辑时填充数据
  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name || '',
        phone: customer.phone || '',
        email: customer.email || '',
        wechat: customer.wechat || '',
        company: customer.company || '',
        address: customer.address || '',
        notes: customer.notes || '',
        tags: customer.tags || [],
        source: customer.source || '',
        status: customer.status || 'active',
      })
    } else {
      setFormData({
        name: '',
        phone: '',
        email: '',
        wechat: '',
        company: '',
        address: '',
        notes: '',
        tags: [],
        source: '',
        status: 'active',
      })
    }
  }, [customer, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name.trim()) {
      handleApiError(new Error('客户姓名不能为空'))
      return
    }

    try {
      setSaving(true)
      
      const url = customer 
        ? `/api/admin/customers/${customer.id}`
        : '/api/admin/customers'
      
      const res = await fetch(url, {
        method: customer ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          phone: formData.phone || null,
          email: formData.email || null,
          wechat: formData.wechat || null,
          company: formData.company || null,
          address: formData.address || null,
          notes: formData.notes || null,
          source: formData.source || null,
          tags: formData.tags.length > 0 ? formData.tags : null,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '保存失败')
      }

      showSuccess(customer ? '客户已更新' : '客户已创建')
      onSaved()
    } catch (error) {
      handleApiError(error, '保存客户失败')
    } finally {
      setSaving(false)
    }
  }

  const addTag = () => {
    const tag = tagInput.trim()
    if (tag && !formData.tags.includes(tag)) {
      setFormData({ ...formData, tags: [...formData.tags, tag] })
      setTagInput('')
    }
  }

  const removeTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) })
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto m-4">
        {/* 头部 */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold">
            {customer ? '编辑客户' : '添加客户'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-surface-elevated rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 表单 */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* 基本信息 */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                姓名 <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                placeholder="客户姓名"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">电话</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="input"
                  placeholder="联系电话"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">微信</label>
                <input
                  type="text"
                  value={formData.wechat}
                  onChange={(e) => setFormData({ ...formData, wechat: e.target.value })}
                  className="input"
                  placeholder="微信号"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">邮箱</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="input"
                placeholder="电子邮箱"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">公司/单位</label>
              <input
                type="text"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                className="input"
                placeholder="公司或单位名称"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">地址</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="input"
                placeholder="联系地址"
              />
            </div>
          </div>

          {/* 分类信息 */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">客户来源</label>
                <select
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  className="input"
                >
                  {sourceOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">状态</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="input"
                >
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 标签 */}
            <div>
              <label className="block text-sm font-medium mb-1">标签</label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTag()
                    }
                  }}
                  className="input flex-1"
                  placeholder="输入标签后按回车添加"
                />
                <button
                  type="button"
                  onClick={addTag}
                  className="btn-secondary"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-sm bg-accent/10 text-accent"
                    >
                      <Tag className="w-3 h-3" />
                      {tag}
                      <button
                        type="button"
                        onClick={() => removeTag(tag)}
                        className="ml-1 hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 备注 */}
            <div>
              <label className="block text-sm font-medium mb-1">备注</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="input min-h-[80px] resize-none"
                placeholder="客户备注信息..."
              />
            </div>
          </div>

          {/* 按钮 */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-secondary"
              disabled={saving}
            >
              取消
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 btn-primary"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  保存中...
                </>
              ) : (
                '保存'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

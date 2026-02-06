'use client'

import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { 
  Search, 
  X, 
  UserPlus, 
  Loader2, 
  Check, 
  UserCheck,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { showSuccess, handleApiError } from '@/lib/toast'

interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  company: string | null
  status: string
  tags: string[]
}

interface CustomerSelectorProps {
  albumId: string
  linkedCustomerIds?: string[]
  onUpdate?: () => void
}

/**
 * 获取相册关联的客户
 */
async function fetchAlbumCustomers(albumId: string): Promise<Customer[]> {
  const response = await fetch(`/api/admin/albums/${albumId}/customers`)
  if (!response.ok) {
    throw new Error('获取关联客户失败')
  }
  const data = await response.json()
  return data.data || []
}

/**
 * 搜索客户
 */
async function searchCustomers(query: string): Promise<Customer[]> {
  const params = new URLSearchParams({ search: query, limit: '10' })
  const response = await fetch(`/api/admin/customers?${params}`)
  if (!response.ok) {
    throw new Error('搜索客户失败')
  }
  const data = await response.json()
  return data.data?.customers || []
}

/**
 * 相册关联客户选择器
 */
export function CustomerSelector({ albumId, onUpdate }: CustomerSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<Customer[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const queryClient = useQueryClient()

  // 获取当前相册关联的客户
  const { data: linkedCustomers = [], isLoading } = useQuery({
    queryKey: ['album-customers', albumId],
    queryFn: () => fetchAlbumCustomers(albumId),
  })

  // 关联客户
  const linkMutation = useMutation({
    mutationFn: async (customerId: string) => {
      const response = await fetch(`/api/admin/customers/${customerId}/albums`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ album_id: albumId }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '关联失败')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['album-customers', albumId] })
      showSuccess('已关联客户')
      onUpdate?.()
    },
    onError: (error) => {
      handleApiError(error, '关联客户失败')
    },
  })

  // 取消关联
  const unlinkMutation = useMutation({
    mutationFn: async (customerId: string) => {
      const response = await fetch(`/api/admin/customers/${customerId}/albums`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ album_id: albumId }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || '取消关联失败')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['album-customers', albumId] })
      showSuccess('已取消关联')
      onUpdate?.()
    },
    onError: (error) => {
      handleApiError(error, '取消关联失败')
    },
  })

  // 搜索客户（防抖）
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }

    setIsSearching(true)
    try {
      const results = await searchCustomers(query)
      setSearchResults(results)
    } catch (error) {
      console.error('搜索失败:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  // 防抖搜索
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch(searchQuery)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, handleSearch])

  // 检查客户是否已关联
  const isLinked = (customerId: string) => {
    return linkedCustomers.some(c => c.id === customerId)
  }

  // 处理关联/取消关联
  const handleToggleLink = (customer: Customer) => {
    if (isLinked(customer.id)) {
      unlinkMutation.mutate(customer.id)
    } else {
      linkMutation.mutate(customer.id)
    }
  }

  const isPending = linkMutation.isPending || unlinkMutation.isPending

  return (
    <div className="space-y-3">
      {/* 标题和操作按钮 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium">关联客户</span>
          {linkedCustomers.length > 0 && (
            <span className="text-xs text-text-muted">
              ({linkedCustomers.length})
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="btn-secondary text-xs px-2 py-1 flex items-center gap-1"
        >
          <UserPlus className="w-3 h-3" />
          添加
          <ChevronDown className={cn(
            'w-3 h-3 transition-transform',
            isOpen && 'rotate-180'
          )} />
        </button>
      </div>

      {/* 已关联的客户列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-4 h-4 animate-spin text-accent" />
        </div>
      ) : linkedCustomers.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {linkedCustomers.map((customer) => (
            <div
              key={customer.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-surface-elevated rounded-full text-sm border border-border"
            >
              <span>{customer.name}</span>
              {customer.phone && (
                <span className="text-text-muted text-xs">{customer.phone}</span>
              )}
              <button
                type="button"
                onClick={() => handleToggleLink(customer)}
                disabled={isPending}
                className="text-text-muted hover:text-red-500 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-text-muted">暂无关联客户</p>
      )}

      {/* 搜索添加面板 */}
      {isOpen && (
        <div className="border border-border rounded-lg p-3 bg-surface space-y-3">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索客户姓名、电话、邮箱..."
              className="input w-full pl-9 pr-4 text-sm"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-accent" />
            )}
          </div>

          {/* 搜索结果 */}
          {searchQuery && (
            <div className="max-h-48 overflow-y-auto">
              {searchResults.length > 0 ? (
                <div className="space-y-1">
                  {searchResults.map((customer) => {
                    const linked = isLinked(customer.id)
                    return (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => handleToggleLink(customer)}
                        disabled={isPending}
                        className={cn(
                          'w-full flex items-center justify-between p-2 rounded-lg transition-colors text-left',
                          linked
                            ? 'bg-accent/10 border border-accent/30'
                            : 'hover:bg-surface-elevated'
                        )}
                      >
                        <div>
                          <p className="font-medium text-sm">{customer.name}</p>
                          <p className="text-xs text-text-muted">
                            {[customer.phone, customer.email, customer.company]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        </div>
                        {linked ? (
                          <Check className="w-4 h-4 text-accent" />
                        ) : (
                          <UserPlus className="w-4 h-4 text-text-muted" />
                        )}
                      </button>
                    )
                  })}
                </div>
              ) : !isSearching ? (
                <p className="text-xs text-text-muted text-center py-4">
                  未找到匹配的客户
                </p>
              ) : null}
            </div>
          )}

          {!searchQuery && (
            <p className="text-xs text-text-muted text-center">
              输入关键词搜索客户
            </p>
          )}
        </div>
      )}
    </div>
  )
}

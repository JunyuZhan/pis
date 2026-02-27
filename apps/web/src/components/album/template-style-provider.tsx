'use client'

import { useEffect, ReactNode, createContext, useContext, useMemo } from 'react'
import { 
  ALBUM_TEMPLATES, 
  type AlbumTemplateStyle,
  getTemplateCSSVariables 
} from '@/lib/album-templates'

// 模板上下文类型
interface TemplateContextValue {
  template: AlbumTemplateStyle | null
  templateId: string | null
}

// 创建上下文
const TemplateContext = createContext<TemplateContextValue>({
  template: null,
  templateId: null,
})

// 导出 hook 用于获取模板配置
export function useTemplate() {
  return useContext(TemplateContext)
}

interface TemplateStyleProviderProps {
  templateId: string | null | undefined
  children: ReactNode
}

/**
 * 模板样式提供者
 * 在客户端应用模板的CSS变量和样式，并提供模板配置上下文
 */
export function TemplateStyleProvider({ templateId, children }: TemplateStyleProviderProps) {
  // 获取模板配置
  const template = useMemo(() => {
    if (!templateId) return null
    return ALBUM_TEMPLATES[templateId] || null
  }, [templateId])

  // 上下文值
  const contextValue = useMemo(() => ({
    template,
    templateId: templateId || null,
  }), [template, templateId])

  // 应用模板的 CSS 变量
  useEffect(() => {
    if (!template) return

    const root = document.documentElement
    const cssVars = getTemplateCSSVariables(template)
    
    // 保存原始值以便恢复
    const originalValues: Record<string, string> = {}
    const originalClasses: string[] = []
    
    // 设置主题模式相关类
    if (template.theme.mode === 'light') {
      root.classList.add('light')
      originalClasses.push('light')
    }
    
    // 设置模板特定的 CSS 变量
    Object.entries(cssVars).forEach(([key, value]) => {
      originalValues[key] = root.style.getPropertyValue(key)
      root.style.setProperty(key, value)
    })
    
    // 设置模板的主题颜色
    root.style.setProperty('--template-primary', template.theme.primaryColor)
    root.style.setProperty('--template-bg', template.theme.backgroundColor)
    root.style.setProperty('--template-text', template.theme.textColor)
    root.style.setProperty('--template-accent', template.theme.accentColor)
    
    // 设置模板背景色
    document.body.style.backgroundColor = template.theme.backgroundColor
    
    // 设置模板标记
    root.dataset.template = template.id
    root.dataset.templateTheme = template.theme.mode
    
    // 清理函数：恢复原始值
    return () => {
      // 恢复原始类
      originalClasses.forEach(cls => {
        root.classList.remove(cls)
      })
      
      // 恢复原始CSS变量
      delete root.dataset.template
      delete root.dataset.templateTheme
      
      Object.entries(cssVars).forEach(([key]) => {
        if (originalValues[key]) {
          root.style.setProperty(key, originalValues[key])
        } else {
          root.style.removeProperty(key)
        }
      })
      
      // 移除模板主题颜色
      root.style.removeProperty('--template-primary')
      root.style.removeProperty('--template-bg')
      root.style.removeProperty('--template-text')
      root.style.removeProperty('--template-accent')
      
      // 恢复body背景色
      document.body.style.backgroundColor = ''
    }
  }, [template])

  return (
    <TemplateContext.Provider value={contextValue}>
      {children}
    </TemplateContext.Provider>
  )
}

/**
 * 获取模板配置的辅助函数（用于服务端）
 */
export function getTemplate(templateId: string | null | undefined): AlbumTemplateStyle | null {
  if (!templateId) return null
  return ALBUM_TEMPLATES[templateId] || null
}

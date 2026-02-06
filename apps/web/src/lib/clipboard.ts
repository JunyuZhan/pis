/**
 * 安全的复制到剪贴板函数
 * 支持 HTTPS 和 HTTP 环境，提供多种降级方案
 */

export async function copyToClipboard(text: string): Promise<boolean> {
  // 验证输入
  if (!text || typeof text !== 'string') {
    console.error('copyToClipboard: Invalid text provided')
    return false
  }

  // 方案1：优先使用现代 Clipboard API（需要 HTTPS 或 localhost）
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch (error) {
      console.warn('Clipboard API failed, trying fallback:', error)
      // 继续使用降级方案
    }
  }

  // 方案2：使用传统 execCommand 方法（兼容 HTTP 和非安全上下文）
  try {
    const textArea = document.createElement('textarea')
    textArea.value = text
    
    // 样式设置：隐藏但可选中
    textArea.style.position = 'fixed'
    textArea.style.top = '0'
    textArea.style.left = '0'
    textArea.style.width = '2em'
    textArea.style.height = '2em'
    textArea.style.padding = '0'
    textArea.style.border = 'none'
    textArea.style.outline = 'none'
    textArea.style.boxShadow = 'none'
    textArea.style.background = 'transparent'
    textArea.style.opacity = '0'
    textArea.style.pointerEvents = 'none'
    textArea.setAttribute('readonly', '')
    textArea.setAttribute('aria-hidden', 'true')
    
    document.body.appendChild(textArea)
    
    // 兼容 iOS
    if (navigator.userAgent.match(/ipad|iphone/i)) {
      const range = document.createRange()
      range.selectNodeContents(textArea)
      const selection = window.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      textArea.setSelectionRange(0, text.length)
    } else {
      textArea.select()
      textArea.setSelectionRange(0, text.length)
    }
    
    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    
    if (successful) {
      return true
    }
  } catch (error) {
    console.error('Fallback copy method failed:', error)
  }

  // 所有方法都失败
  return false
}

/**
 * 复制到剪贴板并显示提示
 * @param text 要复制的文本
 * @param onSuccess 成功回调
 * @param onError 失败回调（可选）
 */
export async function copyWithFeedback(
  text: string,
  onSuccess: () => void,
  onError?: (error: string) => void
): Promise<void> {
  const success = await copyToClipboard(text)
  
  if (success) {
    onSuccess()
  } else if (onError) {
    onError('复制失败，请手动复制')
  }
}

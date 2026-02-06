'use client'

import { Camera, Heart } from 'lucide-react'
import { useTranslations } from 'next-intl'

// 从环境变量获取配置
const ICP_NUMBER = process.env.NEXT_PUBLIC_ICP_NUMBER || ''
const POLICE_NUMBER = process.env.NEXT_PUBLIC_POLICE_NUMBER || ''
const COPYRIGHT_TEXT = process.env.NEXT_PUBLIC_COPYRIGHT_TEXT || ''

export function AlbumFooter() {
  const t = useTranslations('footer')
  const currentYear = new Date().getFullYear()
  const photographerName = process.env.NEXT_PUBLIC_PHOTOGRAPHER_NAME || 'PIS Photography'

  return (
    <footer className="bg-surface border-t border-border mt-12">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12">
        {/* 上部分：品牌信息 */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 pb-8 border-b border-border/50">
          {/* 品牌 Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Camera className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="font-serif font-bold text-lg">PIS</p>
              <p className="text-xs text-text-muted">{t('description')}</p>
            </div>
          </div>

          {/* 感谢语 */}
          <div className="flex items-center gap-2 text-text-secondary text-sm">
            <span>{t('thankYou')}</span>
            <Heart className="w-4 h-4 text-red-400 fill-current" />
          </div>
        </div>

        {/* 下部分：版权信息 */}
        <div className="flex flex-col gap-3 pt-6 text-text-muted text-xs">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <span>© {currentYear} {COPYRIGHT_TEXT || photographerName}. All rights reserved.</span>
              <span className="hidden md:inline">|</span>
              <a href="#" className="hover:text-accent transition-colors">{t('privacyPolicy')}</a>
              <a href="#" className="hover:text-accent transition-colors">{t('termsOfService')}</a>
            </div>

            <div className="flex items-center gap-1">
              <span>{t('poweredBy')}</span>
              <a
                href="https://github.com/JunyuZhan/pis"
                target="_blank"
                rel="noopener noreferrer"
                className="text-accent hover:underline"
              >
                PIS
              </a>
            </div>
          </div>

          {/* 备案信息（如果配置了）*/}
          {(ICP_NUMBER || POLICE_NUMBER) && (
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-text-muted/80">
              {ICP_NUMBER && (
                <a
                  href="https://beian.miit.gov.cn/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent transition-colors"
                >
                  {ICP_NUMBER}
                </a>
              )}
              {POLICE_NUMBER && (
                <a
                  href="http://www.beian.gov.cn/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-accent transition-colors"
                >
                  <img 
                    src="/images/police-badge.png" 
                    alt="" 
                    className="w-3.5 h-3.5"
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                  {POLICE_NUMBER}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </footer>
  )
}

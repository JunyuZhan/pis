'use client'

import { cn, getSafeMediaUrl } from '@/lib/utils'
import type { Photo } from '@/types/database'
import { OptimizedImage } from '@/components/ui/optimized-image'
import { CheckCircle2, Circle } from 'lucide-react'

interface PhotoGridProps {
  photos: Photo[]
  selectedIds?: string[]
  onSelect?: (photo: Photo) => void
  className?: string
}

export function PhotoGrid({
  photos,
  selectedIds = [],
  onSelect,
  className
}: PhotoGridProps) {
  const safeMediaUrl = getSafeMediaUrl()

  if (!photos?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p>暂无照片</p>
      </div>
    )
  }

  return (
    <div className={cn("grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4", className)}>
      {photos.map((photo) => {
        const isSelected = selectedIds.includes(photo.id)
        const imageKey = photo.preview_key || photo.thumb_key || photo.original_key
        const src = imageKey 
          ? `${safeMediaUrl.replace(/\/$/, "")}/${imageKey.replace(/^\//, "")}`
          : ''
        
        return (
          <div 
            key={photo.id} 
            className={cn(
              "group relative aspect-square bg-muted rounded-lg overflow-hidden border-2 transition-all cursor-pointer",
              isSelected ? "border-primary" : "border-transparent hover:border-muted-foreground/50"
            )}
            onClick={() => onSelect?.(photo)}
            data-testid={`photo-card-${photo.id}`}
          >
            {src && (
              <OptimizedImage
                src={src}
                alt={photo.filename}
                fill
                className="object-cover"
              />
            )}
            
            {onSelect && (
              <div className={cn(
                "absolute inset-0 bg-black/20 transition-opacity flex items-start justify-end p-2",
                isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              )}>
                {isSelected ? (
                  <CheckCircle2 className="w-5 h-5 text-primary fill-primary-foreground" />
                ) : (
                  <Circle className="w-5 h-5 text-white/70" />
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

import { render, screen, fireEvent } from '@testing-library/react'
import { PhotoGrid } from './photo-grid'
import { vi, describe, it, expect } from 'vitest'
import type { Photo } from '@/types/database'

// Mock dependencies
vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual('@/lib/utils')
  return {
    ...actual as any,
    getSafeMediaUrl: vi.fn().mockReturnValue('/media'),
  }
})

vi.mock('@/components/ui/optimized-image', () => ({
  OptimizedImage: ({ src, alt, className }: any) => (
    <img src={src} alt={alt} className={className} data-testid="optimized-image" />
  ),
}))

const mockPhotos = [
  {
    id: '1',
    filename: 'photo1.jpg',
    preview_key: 'albums/1/preview.jpg',
    thumb_key: 'albums/1/thumb.jpg',
    original_key: 'albums/1/original.jpg',
    width: 800,
    height: 600,
  },
  {
    id: '2',
    filename: 'photo2.jpg',
    preview_key: null,
    thumb_key: 'albums/2/thumb.jpg',
    original_key: 'albums/2/original.jpg',
    width: 800,
    height: 600,
  },
] as unknown as Photo[]

describe('PhotoGrid', () => {
  it('renders empty state when no photos', () => {
    render(<PhotoGrid photos={[]} />)
    expect(screen.getByText('暂无照片')).toBeInTheDocument()
  })

  it('renders photos correctly', () => {
    render(<PhotoGrid photos={mockPhotos} />)
    
    expect(screen.getByTestId('photo-card-1')).toBeInTheDocument()
    expect(screen.getByTestId('photo-card-2')).toBeInTheDocument()
    
    const images = screen.getAllByTestId('optimized-image')
    expect(images[0]).toHaveAttribute('src', '/media/albums/1/preview.jpg')
    expect(images[1]).toHaveAttribute('src', '/media/albums/2/thumb.jpg')
  })

  it('handles selection', () => {
    const onSelect = vi.fn()
    render(<PhotoGrid photos={mockPhotos} onSelect={onSelect} selectedIds={['1']} />)
    
    fireEvent.click(screen.getByTestId('photo-card-2'))
    expect(onSelect).toHaveBeenCalledWith(mockPhotos[1])
  })
})

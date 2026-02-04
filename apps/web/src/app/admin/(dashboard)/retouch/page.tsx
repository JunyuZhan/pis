
import { Suspense } from 'react'
import { RetouchDashboard } from '@/components/admin/retouch-dashboard'

export const metadata = {
  title: '修图工作台 - PIS Admin',
}

export default function RetouchPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RetouchDashboard />
    </Suspense>
  )
}

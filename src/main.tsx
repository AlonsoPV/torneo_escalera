import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'

import { AppProviders } from '@/app/providers'
import { router } from '@/app/router'
import { AppErrorBoundary } from '@/components/layout/AppErrorBoundary'
import { RouteLoadingFallback } from '@/components/layout/RouteLoadingFallback'
import { initAuthListener } from '@/stores/authStore'

import './index.css'

void initAuthListener()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <AppProviders>
        <Suspense fallback={<RouteLoadingFallback />}>
          <RouterProvider router={router} />
        </Suspense>
      </AppProviders>
    </AppErrorBoundary>
  </StrictMode>,
)

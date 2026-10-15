import { Suspense, lazy, useEffect } from 'react'
import ErrorBoundary from './ErrorBoundary.jsx'
import Overlay from './ui/Overlay.jsx'
import { useInput } from './input.js'
import { resetAfterBack } from './portal-nav.js'
import { uiStore } from './store.js'

// three.js is the heavy part: load it after the HTML overlay is on screen
const Stage = lazy(() => import('./world/Stage.jsx'))

export default function App() {
  useInput()
  useEffect(() => {
    const onShow = (e) => e.persisted && resetAfterBack()
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [])

  return (
    <>
      <ErrorBoundary onError={() => uiStore.set({ failed: true })}>
        <Suspense fallback={null}>
          <Stage />
        </Suspense>
      </ErrorBoundary>
      <Overlay />
    </>
  )
}

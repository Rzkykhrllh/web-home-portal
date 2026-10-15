import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { PCFShadowMap } from 'three'
import Experience from './Experience.jsx'
import { uiStore } from '../store.js'

const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

export default function Stage() {
  return (
    <Canvas
      className="stage"
      flat // no tone mapping: toon colours stay as picked
      shadows={{ type: PCFShadowMap }}
      dpr={coarse ? [1, 1.5] : [1, 2]}
      camera={{ fov: 45, near: 0.1, far: 300, position: [0, 16, 24] }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', () => uiStore.set({ failed: true }))
      }}
    >
      <Suspense fallback={null}>
        <Experience />
      </Suspense>
    </Canvas>
  )
}

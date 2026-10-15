import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { ACESFilmicToneMapping, WebGPURenderer } from 'three/webgpu'
import Experience from './Experience.jsx'
import { uiStore } from '../store.js'
import { QUALITY } from '../quality.js'

// WebGPU first. Browsers without it get the same renderer on its WebGL 2
// backend, so every material and effect (all TSL) still works.
async function createRenderer(props) {
  // No MSAA on the canvas: the scene renders into the pipeline's own target, and FXAA runs at the end
  const renderer = new WebGPURenderer({ ...props, antialias: false, powerPreference: 'high-performance' })
  await renderer.init()
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.05
  if (import.meta.env.DEV) console.info('[portal] backend:', renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL 2')
  return renderer
}

export default function Stage() {
  return (
    <Canvas
      className="stage"
      gl={createRenderer}
      dpr={QUALITY.dpr}
      camera={{ fov: 45, near: 0.1, far: 400, position: [0, 14, 22] }}
      onCreated={({ gl }) => {
        gl.domElement.addEventListener('webglcontextlost', () => uiStore.set({ failed: true }))
        gl.backend?.device?.lost?.then(() => uiStore.set({ failed: true }))
      }}
    >
      <Suspense fallback={null}>
        <Experience />
      </Suspense>
    </Canvas>
  )
}

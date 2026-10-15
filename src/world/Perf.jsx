import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { QUALITY } from '../quality.js'

const showStats = typeof location !== 'undefined' && new URLSearchParams(location.search).has('stats')

// Keeps the frame rate up on slower machines: every couple of seconds, if
// we're under ~50 fps, render at a lower pixel ratio (down to 1). It only
// ever steps down, so it can't flicker between two resolutions.
// With ?stats, also shows fps, resolution, draw calls and the backend.
export default function Perf() {
  const gl = useThree((s) => s.gl)
  const setDpr = useThree((s) => s.setDpr)
  const s = useRef({ t: 0, n: 0, dpr: QUALITY.dpr, settle: 2 })
  const box = useRef(null)

  useEffect(() => {
    setDpr(QUALITY.dpr)
    if (!showStats) return
    const el = document.createElement('pre')
    el.className = 'stats'
    document.body.appendChild(el)
    box.current = el
    return () => el.remove()
  }, [setDpr])

  // Priority 2: runs after Effects has rendered the frame, so the counters are filled
  useFrame((_, dt) => {
    const st = s.current
    st.t += dt
    st.n++
    if (st.t < 1.5) return
    const fps = st.n / st.t
    st.t = 0
    st.n = 0
    if (st.settle > 0) st.settle-- // ignore the first windows: shaders still compiling
    else if (fps < 50 && st.dpr > 1) {
      st.dpr = Math.max(1, Math.round((st.dpr - 0.25) * 100) / 100)
      setDpr(st.dpr)
    }
    if (box.current) {
      const info = gl.info.render
      box.current.textContent = [
        `${fps.toFixed(0)} fps`,
        `dpr ${st.dpr}`,
        `${info.drawCalls} draws`,
        `${(info.triangles / 1000).toFixed(0)}k tris`,
        gl.backend?.isWebGPUBackend ? 'WebGPU' : 'WebGL 2',
      ].join('\n')
    }
  }, 2)
  return null
}

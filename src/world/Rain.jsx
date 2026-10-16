import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry } from 'three/webgpu'
import { QUALITY } from '../quality.js'
import { reducedMotion } from '../portal-nav.js'
import { player } from '../store.js'
import { rng } from './canvasTexture.js'
import { atmos } from './Atmosphere.jsx'

// Light rain: thin lavender streaks falling at a slant in a box that follows
// the cat, so the camera always looks through it. One draw call.
const BOX = { x: 16, y: 14, z: 14 }
const FALL = 13 // m/s
const LEN = 0.45
const WIND = 0.18 // sideways drift per metre fallen

export default function Rain() {
  const count = reducedMotion ? Math.round(QUALITY.rain / 3) : QUALITY.rain
  const { geometry, drops } = useMemo(() => {
    const r = rng(9)
    const drops = Array.from({ length: count }, () => [(r() - 0.5) * BOX.x * 2, r() * BOX.y, (r() - 0.5) * BOX.z * 2, 0.8 + r() * 0.4])
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(count * 6), 3))
    return { geometry: g, drops }
  }, [count])

  const lines = useRef()
  useFrame((_, dt) => {
    dt = Math.min(dt, 0.05)
    // fades with the weather; skip the work entirely when it's dry
    lines.current.visible = atmos.rain > 0.02
    lines.current.material.opacity = 0.32 * atmos.rain
    if (!lines.current.visible) return
    const speed = reducedMotion ? 0.3 : 1
    const pos = geometry.attributes.position.array
    const cx = player.pos.x
    const cz = player.pos.z - 3
    const wrap = (v, c, half) => ((((v + c + half) % (half * 2)) + half * 2) % (half * 2)) - half + c
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i]
      const step = FALL * d[3] * dt * speed
      d[1] -= step
      d[0] += step * WIND
      if (d[1] < 0) {
        d[1] += BOX.y
        d[0] -= BOX.y * WIND
      }
      const x = wrap(d[0], cx, BOX.x)
      const z = wrap(d[2], cz, BOX.z)
      const o = i * 6
      pos[o] = x
      pos[o + 1] = d[1]
      pos[o + 2] = z
      pos[o + 3] = x - LEN * WIND
      pos[o + 4] = d[1] + LEN
      pos[o + 5] = z
    }
    geometry.attributes.position.needsUpdate = true
  })

  return (
    <lineSegments ref={lines} geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial color="#cdbfff" transparent opacity={0.32} depthWrite={false} />
    </lineSegments>
  )
}

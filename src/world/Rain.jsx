import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry } from 'three/webgpu'
import { QUALITY } from '../quality.js'
import { reducedMotion } from '../portal-nav.js'
import { player } from '../store.js'
import { rng } from './canvasTexture.js'

// Light rain: short streaks falling at a slant in a box that follows the cat
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

  useFrame((_, dt) => {
    dt = Math.min(dt, 0.05)
    const speed = reducedMotion ? 0.3 : 1
    const pos = geometry.attributes.position.array
    const cx = player.pos.x
    const cz = player.pos.z - 2
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i]
      d[1] -= FALL * d[3] * dt * speed
      d[0] += FALL * d[3] * dt * speed * WIND
      if (d[1] < 0) {
        d[1] += BOX.y
        d[0] -= BOX.y * WIND
      }
      // wrap round the cat so the rain always surrounds the camera's view
      const x = ((((d[0] + cx + BOX.x) % (BOX.x * 2)) + BOX.x * 2) % (BOX.x * 2)) - BOX.x + cx
      const z = ((((d[2] + cz + BOX.z) % (BOX.z * 2)) + BOX.z * 2) % (BOX.z * 2)) - BOX.z + cz
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
    <lineSegments geometry={geometry} frustumCulled={false}>
      <lineBasicMaterial color="#a9bde0" transparent opacity={0.28} depthWrite={false} />
    </lineSegments>
  )
}

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshBasicMaterial, Object3D, PlaneGeometry } from 'three/webgpu'
import { QUALITY } from '../quality.js'
import { reducedMotion } from '../portal-nav.js'
import { player } from '../store.js'
import { atmos } from './Atmosphere.jsx'
import { canvasTexture, rng } from './canvasTexture.js'

// Soft flakes drifting down and swaying, in a box that follows the cat.
// Rare in Tokyo, which is why it's nice to be able to switch it on.
// Instanced camera-facing quads (WebGPU draws points one pixel wide), one draw call.
const BOX = { x: 16, y: 12, z: 14 }
const dummy = new Object3D()

export default function Snow() {
  const count = Math.round(QUALITY.rain * 0.7)
  const flakes = useMemo(() => {
    const r = rng(23)
    return Array.from({ length: count }, () => [(r() - 0.5) * BOX.x * 2, r() * BOX.y, (r() - 0.5) * BOX.z * 2, 0.6 + r() * 0.7, r() * 6.28, 0.6 + r() * 0.8])
  }, [count])
  const { geometry, material } = useMemo(() => {
    const dot = canvasTexture(64, 64, (ctx) => {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
      g.addColorStop(0, 'rgba(255,255,255,1)')
      g.addColorStop(0.45, 'rgba(255,255,255,0.7)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 64, 64)
    })
    return {
      geometry: new PlaneGeometry(0.11, 0.11),
      material: new MeshBasicMaterial({ map: dot, color: '#f4f0ff', transparent: true, opacity: 0, depthWrite: false }),
    }
  }, [])
  const mesh = useRef()

  useFrame((state, dt) => {
    dt = Math.min(dt, 0.05)
    const m = mesh.current
    m.visible = atmos.snow > 0.02
    material.opacity = 0.95 * atmos.snow
    if (!m.visible) return
    const t = state.clock.elapsedTime
    const speed = reducedMotion ? 0.4 : 1
    const cx = player.pos.x
    const cz = player.pos.z - 3
    // Drops stay put in the world; only the ones that drift out of the box
    // round the cat come back in on the far side (so the rain doesn't follow you)
    const wrap = (v, c, half) => c - half + ((((v - c + half) % (half * 2)) + half * 2) % (half * 2))
    dummy.quaternion.copy(state.camera.quaternion)
    for (let i = 0; i < flakes.length; i++) {
      const f = flakes[i]
      f[1] -= 1.1 * f[3] * dt * speed
      if (f[1] < 0) f[1] += BOX.y
      dummy.position.set(
        wrap(f[0] + Math.sin(t * 0.8 + f[4]) * 0.6, cx, BOX.x),
        f[1],
        wrap(f[2] + Math.cos(t * 0.6 + f[4]) * 0.4, cz, BOX.z),
      )
      dummy.scale.setScalar(f[5])
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={mesh} args={[geometry, material, count]} frustumCulled={false} visible={false} />
}

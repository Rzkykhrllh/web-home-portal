import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BufferAttribute, BufferGeometry, DoubleSide, MeshBasicMaterial, Object3D } from 'three/webgpu'
import { reducedMotion } from '../portal-nav.js'
import { U } from './Atmosphere.jsx'

// A small flock circling over the city by day, flapping now and then.
// Instanced V-shaped wings, one draw call; gone at night.
const COUNT = 11
const dummy = new Object3D()

function wings() {
  // two thin wings meeting at the body, tips raised a little
  const v = [0, 0, 0, -0.9, 0.18, -0.15, -0.35, 0.02, 0.12, 0, 0, 0, 0.35, 0.02, 0.12, 0.9, 0.18, -0.15]
  const g = new BufferGeometry()
  g.setAttribute('position', new BufferAttribute(new Float32Array(v), 3))
  return g
}

export default function Birds() {
  const geometry = useMemo(wings, [])
  const material = useMemo(() => new MeshBasicMaterial({ color: '#2a2f4a', side: DoubleSide, transparent: true, opacity: 0 }), [])
  const birds = useMemo(
    () => Array.from({ length: COUNT }, (_, i) => ({ phase: i * 0.57, r: 4 + (i % 4) * 1.3, y: (i % 3) * 0.9, flap: 7 + (i % 5), off: i * 0.9 })),
    [],
  )
  const mesh = useRef()
  useFrame((state) => {
    const day = U.day.value
    const m = mesh.current
    m.visible = day > 0.05
    material.opacity = Math.min(1, day * 1.4)
    if (!m.visible) return
    const t = reducedMotion ? 0 : state.clock.elapsedTime
    // the flock's centre drifts slowly across the sky ahead
    const cx = Math.sin(t * 0.03) * 30
    const cz = -70 + Math.cos(t * 0.05) * 10
    birds.forEach((b, i) => {
      const a = t * 0.25 + b.phase
      dummy.position.set(cx + Math.cos(a) * b.r * 3, 22 + b.y + Math.sin(a * 2 + b.off) * 0.8, cz + Math.sin(a) * b.r * 2)
      dummy.rotation.set(0, -a, 0)
      // flap in bursts, glide in between
      const flapping = Math.sin(t * 0.7 + b.off) > -0.2
      dummy.scale.set(1.4, flapping ? Math.sin(t * b.flap + b.off) * 1.6 : 0.4, 1.4)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return <instancedMesh ref={mesh} args={[geometry, material, COUNT]} frustumCulled={false} visible={false} />
}

import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MeshBasicMaterial, Object3D, PlaneGeometry, Vector3 } from 'three/webgpu'
import { QUALITY } from '../quality.js'
import { reducedMotion } from '../portal-nav.js'
import { player } from '../store.js'
import { atmos } from './Atmosphere.jsx'
import { canvasTexture, rng } from './canvasTexture.js'

// Snow the way it actually falls: slow, round, soft flakes that sway and
// flutter on their own, in a box round the cat. A few big out-of-focus flakes
// drift right in front of the lens for depth. Instanced quads, two draw calls.
const BOX = { x: 16, y: 12, z: 14 }
const dummy = new Object3D()
const toCam = new Vector3()

function flakeTexture(soft) {
  return canvasTexture(64, 64, (ctx) => {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(soft ? 0.15 : 0.4, 'rgba(255,255,255,0.85)')
    g.addColorStop(soft ? 0.6 : 0.7, 'rgba(255,255,255,0.25)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 64, 64)
  })
}

// x, y, z, fall speed, phase, size, sway radius, flutter rate
function makeFlakes(count, seed, size) {
  const r = rng(seed)
  return Array.from({ length: count }, () => [
    (r() - 0.5) * BOX.x * 2,
    r() * BOX.y,
    (r() - 0.5) * BOX.z * 2,
    0.55 + r() * 0.5,
    r() * 6.28,
    size[0] + r() * r() * (size[1] - size[0]),
    0.3 + r() * 0.6,
    0.6 + r() * 1.2,
  ])
}

const wrap = (v, c, half) => c - half + ((((v - c + half) % (half * 2)) + half * 2) % (half * 2))

function Layer({ flakes, material, opacity, near }) {
  const mesh = useRef()
  const geometry = useMemo(() => new PlaneGeometry(1, 1), [])

  useFrame((state, dt) => {
    dt = Math.min(dt, 0.05)
    const m = mesh.current
    m.visible = atmos.snow > 0.02
    material.opacity = opacity * atmos.snow
    if (!m.visible) return
    const t = state.clock.elapsedTime
    const speed = reducedMotion ? 0.4 : 1
    const cam = state.camera
    // the far layer wraps round the cat; the bokeh layer round the lens
    let cx, cy, cz, half
    if (near) {
      cam.getWorldDirection(toCam)
      cx = cam.position.x + toCam.x * 2.5
      cy = cam.position.y + toCam.y * 2.5 - 1.5
      cz = cam.position.z + toCam.z * 2.5
      half = 2.5
    } else {
      cx = player.pos.x
      cy = 0
      cz = player.pos.z - 3
    }
    dummy.quaternion.copy(cam.quaternion)
    for (let i = 0; i < flakes.length; i++) {
      const f = flakes[i]
      f[1] -= f[3] * dt * speed
      // a gentle breeze from the left, plus each flake's own lazy spiral
      f[0] += 0.25 * dt * speed
      const sx = Math.sin(t * f[7] + f[4]) * f[6]
      const sz = Math.cos(t * f[7] * 0.8 + f[4]) * f[6] * 0.6
      if (near) {
        dummy.position.set(wrap(f[0] + sx, cx, half), wrap(f[1], cy, half * 0.8), wrap(f[2] + sz, cz, half))
      } else {
        if (f[1] < 0) f[1] += BOX.y
        dummy.position.set(wrap(f[0] + sx, cx, BOX.x), f[1], wrap(f[2] + sz, cz, BOX.z))
      }
      // flakes tumble, so they flicker slightly in size
      dummy.scale.setScalar(f[5] * (0.85 + 0.15 * Math.sin(t * 3 * f[7] + f[4])))
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    }
    m.instanceMatrix.needsUpdate = true
  })

  return <instancedMesh ref={mesh} args={[geometry, material, flakes.length]} frustumCulled={false} visible={false} />
}

export default function Snow() {
  const count = Math.round(QUALITY.rain * 1.3)
  const far = useMemo(() => makeFlakes(count, 23, [0.07, 0.2]), [count])
  const near = useMemo(() => makeFlakes(Math.round(count / 45), 31, [0.12, 0.3]), [count])
  const mats = useMemo(
    () => ({
      far: new MeshBasicMaterial({ map: flakeTexture(false), color: '#f4f7ff', transparent: true, opacity: 0, depthWrite: false, fog: true }),
      near: new MeshBasicMaterial({ map: flakeTexture(true), color: '#e8eeff', transparent: true, opacity: 0, depthWrite: false, fog: false }),
    }),
    [],
  )
  return (
    <>
      <Layer flakes={far} material={mats.far} opacity={0.85} />
      <Layer flakes={near} material={mats.near} opacity={0.3} near />
    </>
  )
}

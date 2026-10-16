import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CylinderGeometry, MeshStandardMaterial } from 'three/webgpu'
import { cans } from '../vending.js'

// Drinks from the vending machine: they drop out of the slot, bounce once
// and roll to a stop on the tiles. Up to six stay around.
const geometry = new CylinderGeometry(0.065, 0.065, 0.22, 14)
const MAX = 6
const mats = Array.from({ length: MAX }, () => new MeshStandardMaterial({ metalness: 0.7, roughness: 0.3 }))

export default function Cans() {
  const refs = useRef([])
  useFrame((_, dt) => {
    dt = Math.min(dt, 0.05)
    for (let i = 0; i < MAX; i++) {
      const m = refs.current[i]
      if (!m) continue
      const c = cans[i]
      m.visible = !!c
      if (!c) continue
      c.t += dt
      // fall, bounce, roll with friction
      c.vy -= 9.8 * dt
      c.x += c.vx * dt
      c.y += c.vy * dt
      c.z += c.vz * dt
      if (c.y < 0.065) {
        c.y = 0.065
        c.vy = Math.abs(c.vy) > 0.6 ? -c.vy * 0.3 : 0
        c.vx *= Math.pow(0.25, dt)
        c.vz *= Math.pow(0.25, dt)
      }
      c.spin += Math.hypot(c.vx, c.vz) * dt / 0.065
      m.position.set(c.x, c.y, c.z)
      // lands on its side and rolls
      m.rotation.set(-c.spin, 0, Math.min(1, c.t * 3) * (Math.PI / 2))
      mats[i].color.set(c.color)
    }
  })
  return Array.from({ length: MAX }, (_, i) => (
    <mesh key={i} ref={(m) => (refs.current[i] = m)} geometry={geometry} material={mats[i]} visible={false} />
  ))
}

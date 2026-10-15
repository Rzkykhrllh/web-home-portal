import { useFrame } from '@react-three/fiber'
import { MathUtils } from 'three'
import { CAT_RADIUS, MAX_SPEED, NEAR_DISTANCE, WALK_RADIUS } from '../config.js'
import { colliders, portals, toLocal } from '../layout.js'
import { enterPortal } from '../portal-nav.js'
import { input, player, uiStore } from '../store.js'

// Reads the keys / joystick / click-to-walk path, moves the cat, keeps it on
// the plaza and out of trees, and notices when it walks into a portal.
export default function Controller() {
  useFrame((_, dt) => {
    dt = Math.min(dt, 0.05)
    player.warp += dt
    const pos = player.pos

    if (player.leaving >= 0) {
      // Drawn into the swirl
      player.leaving += dt
      const p = player.portal
      pos.x = MathUtils.damp(pos.x, p.x, 5, dt)
      pos.z = MathUtils.damp(pos.z, p.z, 5, dt)
      pos.y = MathUtils.damp(pos.y, 0.9, 3, dt)
      player.vel.set(0, 0, 0)
      player.speed = 0
      return
    }

    // Wanted direction
    const k = input.keys
    let x = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0)
    let z = (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0)
    x += input.stick.x
    z += input.stick.y
    let len = Math.hypot(x, z)
    if (len > 0.05) player.path = []
    else if (player.path.length) {
      const [tx, tz] = player.path[0]
      const dx = tx - pos.x
      const dz = tz - pos.z
      const d = Math.hypot(dx, dz)
      if (d < 0.25) player.path.shift()
      else {
        // ease in on the last waypoint instead of overshooting it
        const s = player.path.length === 1 ? Math.min(1, d / 0.8) : 1
        x = (dx / d) * s
        z = (dz / d) * s
        len = s
      }
    }
    if (len > 1) {
      x /= len
      z /= len
    }

    // Accelerate quickly, stop a little quicker
    const lambda = len > 0.05 ? 10 : 14
    player.vel.x = MathUtils.damp(player.vel.x, x * MAX_SPEED, lambda, dt)
    player.vel.z = MathUtils.damp(player.vel.z, z * MAX_SPEED, lambda, dt)

    const prevX = pos.x
    const prevZ = pos.z
    let nx = pos.x + player.vel.x * dt
    let nz = pos.z + player.vel.z * dt

    // Push out of trees, the sign and the portal feet
    for (const [cx, cz, r] of colliders) {
      const dx = nx - cx
      const dz = nz - cz
      const min = r + CAT_RADIUS
      const d2 = dx * dx + dz * dz
      if (d2 < min * min && d2 > 1e-6) {
        const d = Math.sqrt(d2)
        nx = cx + (dx / d) * min
        nz = cz + (dz / d) * min
      }
    }
    // Stay on the island
    const r = Math.hypot(nx, nz)
    if (r > WALK_RADIUS) {
      nx *= WALK_RADIUS / r
      nz *= WALK_RADIUS / r
      player.path = []
    }
    pos.x = nx
    pos.z = nz
    pos.y = 0
    // Real speed after collisions, so the legs don't run against a tree
    player.speed = Math.min(1, Math.hypot(nx - prevX, nz - prevZ) / dt / MAX_SPEED)

    // Portals: close enough for the card, and through the ring to leave
    let near = null
    for (const p of portals) {
      const [lx, lz] = toLocal(p, nx, nz)
      const [plx, plz] = toLocal(p, prevX, prevZ)
      if (Math.hypot(lx, lz) < NEAR_DISTANCE) near = p
      const crossed = (plz > 0) !== (lz > 0) || Math.abs(lz) < 0.15
      if (crossed && Math.abs(lx) < 1.05 && Math.abs(lz) < 0.6 && (Math.abs(plx) < 1.2 || Math.abs(lx) < 1.05)) {
        enterPortal(p)
        return
      }
    }
    if (near !== uiStore.get().near) uiStore.set({ near })
  })
  return null
}

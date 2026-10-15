import { PORTALS } from './config.js'

// Portals turn to face a point just in front of the roof, roughly where the
// camera is, so you see both at a slight angle from the start.
const FACE = [0, 6]

export const portals = PORTALS.map((p) => {
  const [x, , z] = p.position
  const yaw = Math.atan2(FACE[0] - x, FACE[1] - z)
  const fx = Math.sin(yaw) // forward (local +z) in world space
  const fz = Math.cos(yaw)
  const rx = Math.cos(yaw) // right (local +x) in world space
  const rz = -Math.sin(yaw)
  return { ...p, x, z, yaw, fx, fz, rx, rz }
})

// Point in a portal's own frame: lx across the opening, lz through it
export function toLocal(p, x, z) {
  const dx = x - p.x
  const dz = z - p.z
  return [dx * p.rx + dz * p.rz, dx * p.fx + dz * p.fz]
}
export function fromLocal(p, lx, lz) {
  return [p.x + p.rx * lx + p.fx * lz, p.z + p.rz * lx + p.fz * lz]
}

// Rooftop furniture
export const VENDING = [0, -7.75]
export const AC_UNITS = [
  [-9.2, 1.2],
  [-9.2, 2.7],
  [9.2, 2.0],
]
export const TANK = [8.6, -6.9]
export const SHED = [-8.7, -6.9] // stairwell hut

// Round obstacles the cat bumps into: [x, z, radius]
export const colliders = [
  [VENDING[0], VENDING[1], 0.7],
  ...AC_UNITS.map(([x, z]) => [x, z, 0.75]),
  [TANK[0], TANK[1], 1.3],
  [SHED[0], SHED[1], 1.5],
  // the two posts of each portal
  ...portals.flatMap((p) => [-1.2, 1.2].map((lx) => [...fromLocal(p, lx, 0), 0.25])),
  // and the pole of its neon sign
  ...portals.map((p) => [...fromLocal(p, (p.x < 0 ? -1 : 1) * 2.45, -0.2), 0.2]),
]

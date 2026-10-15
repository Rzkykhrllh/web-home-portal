import { PORTALS } from './config.js'

// Portals turn to face a point just in front of the plaza, roughly where the
// camera is, so you see both swirls at a slight angle from the start.
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

// Point in a portal's own frame: lx across the ring, lz through it
export function toLocal(p, x, z) {
  const dx = x - p.x
  const dz = z - p.z
  return [dx * p.rx + dz * p.rz, dx * p.fx + dz * p.fz]
}
export function fromLocal(p, lx, lz) {
  return [p.x + p.rx * lx + p.fx * lz, p.z + p.rz * lx + p.fz * lz]
}

// Trees, kept off the paths and out of the camera's way
export const trees = [
  [-9.0, -0.8, 1.15],
  [-8.4, 3.6, 0.9],
  [-7.6, 6.8, 1.0],
  [9.1, -0.4, 1.1],
  [8.5, 3.9, 0.95],
  [7.8, 6.9, 0.85],
  [-1.6, -9.6, 1.2],
  [2.4, -9.3, 1.05],
  [-5.2, -8.7, 0.8],
  [5.6, -8.6, 0.9],
  [-9.6, -4.6, 0.85],
  [9.5, -4.8, 0.95],
]

export const SIGN = [0, -2.9]

// Round obstacles the cat bumps into: [x, z, radius]
export const colliders = [
  ...trees.map(([x, z, s]) => [x, z, 0.45 * s]),
  [SIGN[0], SIGN[1], 0.22],
  // the ring's two feet
  ...portals.flatMap((p) => [-1.45, 1.45].map((lx) => [...fromLocal(p, lx, 0), 0.32])),
]

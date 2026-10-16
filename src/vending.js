import { player } from './store.js'
import { thunk } from './audio.js'

// The vending machine: each purchase drops a can that rolls out onto the roof.
// Cans.jsx reads this list; the cat cheers.
export const cans = [] // { id, t, x, y, z, vx, vy, vz, spin, color }
let next = 0
const COLORS = ['#d23a3a', '#2f7dd1', '#f0b429', '#3aa365', '#e86a1a', '#7a4fd0', '#e9e9ee']

export function buyDrink() {
  if (player.leaving >= 0) return
  cans.push({
    id: next++,
    t: 0,
    x: (Math.random() - 0.5) * 0.3,
    y: 0.32,
    z: -7.3,
    vx: (Math.random() - 0.5) * 0.8,
    vy: 0.6,
    vz: 1.3 + Math.random() * 0.6,
    spin: 0,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  })
  if (cans.length > 6) cans.shift()
  player.cheer = -0.35 // a beat after the clunk
  thunk()
}

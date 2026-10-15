import { player, uiStore } from './store.js'
import { fromLocal } from './layout.js'
import { fadeOutSound, restoreSound } from './audio.js'

export const reducedMotion =
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches

let timer

// Step through: the cat spins into the swirl, the screen washes over in the
// portal's colour, then we navigate.
export function enterPortal(p) {
  if (player.leaving >= 0) return
  player.leaving = 0
  player.portal = p
  player.path = []
  uiStore.set({ leaving: p, near: p })
  fadeOutSound(reducedMotion ? 0.15 : 1.1)
  timer = setTimeout(() => window.location.assign(p.url), reducedMotion ? 150 : 1250)
}

// Click / tap a portal: walk up to it and through
export function walkToPortal(p) {
  if (player.leaving >= 0) return
  player.path = [fromLocal(p, 0, 1.8), fromLocal(p, 0, 0.2), fromLocal(p, 0, -1)]
}

export function walkToPoint(x, z) {
  if (player.leaving >= 0) return
  player.path = [[x, z]]
}

// Coming back with the browser's Back button can restore this page from the
// back/forward cache mid-warp: put the cat back in front of the portal.
export function resetAfterBack() {
  clearTimeout(timer)
  const p = player.portal
  player.leaving = -1
  player.portal = null
  player.path = []
  player.vel.set(0, 0, 0)
  player.warp = 0
  if (p) {
    const [x, z] = fromLocal(p, 0, 2.6)
    player.pos.set(x, 0, z)
  }
  uiStore.set({ leaving: null, near: null })
  restoreSound()
}

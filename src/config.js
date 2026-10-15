// The two worlds the plaza leads to. Swap the URLs here, or set
// VITE_DEV_URL / VITE_PHOTO_URL at build time (e.g. in Dokploy).
export const PORTALS = [
  {
    id: 'dev',
    title: 'Engineering',
    blurb: 'Backend, infrastructure and the things I build.',
    url: import.meta.env.VITE_DEV_URL || 'https://dev.byairu.com',
    color: '#45e3ff', // swirl, glow, particles
    frame: '#2b4a6b', // ring
    position: [-5.6, 0, -4.4],
  },
  {
    id: 'photo',
    title: 'Photography',
    blurb: 'Street and travel, mostly around Tokyo.',
    // TODO: point at the airu-fotografi site once it has a public URL
    url: import.meta.env.VITE_PHOTO_URL || 'https://www.instagram.com/frame_by_airu/',
    color: '#ffb54a',
    frame: '#7a3b1c',
    position: [5.6, 0, -4.4],
  },
]

export const PLAZA_RADIUS = 11 // grass edge
export const WALK_RADIUS = 10.2 // how far out the cat may go
export const MAX_SPEED = 5.2 // m/s
export const CAT_RADIUS = 0.35
export const NEAR_DISTANCE = 3.8 // show the portal card inside this
export const JUMP_TIME = 0.6
export const JUMP_HEIGHT = 1.2
export const SPIN_TIME = 0.45
export const SPIN_TURNS = 3

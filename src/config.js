// The two worlds the rooftop leads to. Swap the URLs here, or set
// VITE_DEV_URL / VITE_PHOTO_URL at build time (e.g. in Dokploy).
export const PORTALS = [
  {
    id: 'dev',
    title: 'Engineering',
    jp: '開発',
    line: 'D', // station-style line marker
    blurb: 'Backend, infrastructure and the things I build.',
    url: import.meta.env.VITE_DEV_URL || 'https://dev.byairu.com',
    color: '#39d8ff',
    position: [-5.4, 0, -4.3],
  },
  {
    id: 'photo',
    title: 'Photography',
    jp: '写真',
    line: 'P',
    blurb: 'Street and travel, mostly around Tokyo.',
    url: import.meta.env.VITE_PHOTO_URL || 'https://byairu.com',
    color: '#ffae2e',
    position: [5.4, 0, -4.3],
  },
]

// The roof: a slab from x -ROOF.x..ROOF.x, z ROOF.back..ROOF.front
export const ROOF = { x: 10.5, back: -8.5, front: 7.5 }
export const WALK = { x: 9.6, back: -7.6, front: 6.8 } // where the cat may go

export const MAX_SPEED = 5.2 // m/s
export const CAT_RADIUS = 0.35
export const NEAR_DISTANCE = 3.8 // show the portal card inside this
export const JUMP_TIME = 0.6
export const JUMP_HEIGHT = 1.2
export const SPIN_TIME = 0.45
export const SPIN_TURNS = 3

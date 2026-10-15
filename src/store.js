import { useSyncExternalStore } from 'react'
import { Vector3 } from 'three/webgpu'

// Per-frame state, mutated in place by the controller and read by the cat and
// camera. Not React state: nothing re-renders when it changes.
export const player = {
  pos: new Vector3(0, 0, 2.5),
  vel: new Vector3(),
  speed: 0, // 0..1 of MAX_SPEED
  jump: 99, // seconds since the last jump started
  hop: 99, // seconds since the last spin started
  warp: 0, // seconds since the cat appeared
  leaving: -1, // seconds since we stepped into a portal, -1 = not leaving
  portal: null, // the portal we're leaving through
  path: [], // tap / click-to-walk waypoints: [[x, z], ...]
}

export const input = {
  keys: new Set(),
  stick: { x: 0, y: 0 }, // touch joystick, -1..1, y down = towards the camera
}

// A tiny store for the HTML overlay
let ui = { near: null, leaving: null, loaded: false, failed: false }
const listeners = new Set()
export const uiStore = {
  get: () => ui,
  set(patch) {
    ui = { ...ui, ...patch }
    listeners.forEach((l) => l())
  },
  subscribe(l) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}
export const useUi = (select) => useSyncExternalStore(uiStore.subscribe, () => select(uiStore.get()))

import { uniform } from 'three/tsl'
import { player, uiStore } from './store.js'
import { current } from './sky-state.js'

// Photo mode: a free camera orbiting the cat, a few looks, and a shutter
// that saves the frame with a small caption. Fitting, for a photographer's site.

export const FILTERS = [
  { id: 'natural', label: 'Natural' },
  { id: 'film', label: 'Film' },
  { id: 'mono', label: 'Mono' },
]

// Read by the post-processing pipeline (Effects.jsx)
export const grade = {
  on: uniform(0), // 0 normal view, 1 photo mode (grain + vignette)
  mode: uniform(0), // index into FILTERS
}

// Orbit around the cat, used by FollowCamera while photo mode is on
export const orbit = { yaw: 0, pitch: 0.18, dist: 6, dragging: false }

export function setPhoto(on) {
  if (on === uiStore.get().photo) return
  if (on && player.leaving >= 0) return
  // start the orbit from wherever the follow camera is looking
  orbit.yaw = 0
  orbit.pitch = 0.2
  orbit.dist = 6.5
  grade.on.value = on ? 1 : 0
  uiStore.set({ photo: on, near: on ? null : uiStore.get().near })
}

export function setFilter(index) {
  grade.mode.value = index
  uiStore.set({ filter: index })
}

// Asked here, done by Effects right after it renders the next frame (a WebGPU
// canvas can only be read in the same task it was drawn in)
let pending = null
export function requestShot() {
  return new Promise((resolve) => (pending = resolve))
}
export function takePendingShot(canvas) {
  if (!pending) return
  const done = pending
  pending = null
  const img = new Image()
  img.onload = () => done(caption(img))
  img.src = canvas.toDataURL('image/png')
}

const fmtHour = (h) => `${String(Math.floor(h) % 24).padStart(2, '0')}:${String(Math.round((h % 1) * 60) % 60).padStart(2, '0')}`
const WEATHER_JP = { clear: '晴れ', rain: '雨', snow: '雪' }

// Draw the frame with a quiet caption in the corner, like a print's border note
function caption(img) {
  const c = document.createElement('canvas')
  c.width = img.width
  c.height = img.height
  const ctx = c.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const s = img.height / 900
  const { hour, weather } = current()
  const lines = ['frame by airu', `Tokyo rooftop  ${fmtHour(hour)}  ${WEATHER_JP[weather]}`]
  ctx.textAlign = 'right'
  ctx.textBaseline = 'alphabetic'
  ctx.shadowColor = 'rgba(10,6,30,0.6)'
  ctx.shadowBlur = 8 * s
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.font = `700 ${Math.round(26 * s)}px "Zen Kaku Gothic New", "Hiragino Sans", sans-serif`
  ctx.fillText(lines[0], c.width - 36 * s, c.height - 62 * s)
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.font = `500 ${Math.round(17 * s)}px "Zen Kaku Gothic New", "Hiragino Sans", sans-serif`
  ctx.fillText(lines[1], c.width - 36 * s, c.height - 34 * s)
  return new Promise((resolve) => c.toBlob(resolve, 'image/png'))
}

export async function shoot() {
  const blob = await requestShot()
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `airu-rooftop-${stamp}.png`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000)
}

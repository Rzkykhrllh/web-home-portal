import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, MathUtils, Vector3 } from 'three/webgpu'
import { uniform } from 'three/tsl'
import { current } from '../sky-state.js'
import { setRainSound } from '../audio.js'

// The look of the sky and city through a whole day, as keyframes by hour.
// Atmosphere blends between them every frame (and between weathers), and
// writes the result into shared uniforms that Sky, City and the lights read.

const K = [
  // hour, sky top, sky mid, horizon, haze/fog, cloud, hemi sky, hemi ground, hemi I, key light colour, key I, stars, windows, city near, city far
  [0, '#050d22', '#10275a', '#5a6a8a', '#24385e', '#0f1c3a', '#5a74b4', '#111827', 0.8, '#b0c4ff', 0.7, 1, 0.5, '#0c142a', '#243a64'],
  [4.5, '#08163a', '#1d3c78', '#7a86a8', '#30486e', '#16264a', '#6a84c0', '#141c30', 0.85, '#b8caff', 0.7, 0.9, 0.35, '#0f1a34', '#2c4472'],
  [6, '#22408a', '#6f92cc', '#ffb48e', '#a9a0b8', '#6a6a8e', '#b6c4e8', '#3e4458', 1.1, '#ffc8a0', 1.2, 0.12, 0.22, '#34405e', '#8a90b0'],
  [8, '#2462cc', '#5a96e2', '#ffd2ae', '#9ab6e0', '#f2ecf4', '#b9d2ff', '#55556a', 1.1, '#fff0dc', 1.7, 0, 0.05, '#59658a', '#a9b6d2'],
  [12, '#1d5bd0', '#4888e0', '#a6caf5', '#8fb0e0', '#ffffff', '#c4daff', '#5a5e72', 1.15, '#fff8ee', 1.9, 0, 0.03, '#5d6a90', '#b0c0dc'],
  [16, '#2a58bc', '#6a92dc', '#ffc896', '#a8a8d0', '#f6e6e0', '#d0c8ec', '#5a5264', 1.1, '#ffdcb0', 1.6, 0, 0.08, '#585c84', '#a8a8c8'],
  [17.8, '#1c3270', '#5a7cbc', '#ff9a62', '#a08a96', '#3a4170', '#a8b4dc', '#2c2c3e', 1.2, '#ffa878', 1.4, 0.1, 0.55, '#24304e', '#5a6a96'],
  [19.5, '#0d1b3d', '#2a5aa0', '#e8a882', '#48689c', '#1c2f5a', '#7a9ad8', '#1a2236', 1.1, '#c8d8ff', 1.0, 0.8, 1, '#13203e', '#3a5a8e'],
  [22, '#081530', '#1a3c78', '#9a8a8e', '#33507e', '#16264a', '#6a88c8', '#151c2e', 0.95, '#bcd0ff', 0.85, 1, 0.85, '#0f1a34', '#304c7c'],
  [24, '#050d22', '#10275a', '#5a6a8a', '#24385e', '#0f1c3a', '#5a74b4', '#111827', 0.8, '#b0c4ff', 0.7, 1, 0.5, '#0c142a', '#243a64'],
].map(([h, ...v]) => ({
  h,
  top: new Color(v[0]),
  mid: new Color(v[1]),
  hor: new Color(v[2]),
  haze: new Color(v[3]),
  cloud: new Color(v[4]),
  hemiSky: new Color(v[5]),
  hemiGround: new Color(v[6]),
  hemiI: v[7],
  key: new Color(v[8]),
  keyI: v[9],
  stars: v[10],
  windows: v[11],
  near: new Color(v[12]),
  far: new Color(v[13]),
}))

const COLOR_KEYS = ['top', 'mid', 'hor', 'haze', 'cloud', 'hemiSky', 'hemiGround', 'key', 'near', 'far']
const NUM_KEYS = ['hemiI', 'keyI', 'stars', 'windows']

// Shared uniforms (TSL nodes): read by the Sky and City materials
export const U = {
  top: uniform(new Color()),
  mid: uniform(new Color()),
  hor: uniform(new Color()),
  below: uniform(new Color()),
  cloud: uniform(new Color()),
  near: uniform(new Color()),
  far: uniform(new Color()),
  stars: uniform(0),
  moon: uniform(1),
  sun: uniform(0),
  sunDir: uniform(new Vector3(0, 0.3, -1).normalize()),
  overcast: uniform(0),
  windows: uniform(1),
  day: uniform(0), // 0 night .. 1 full clear daylight
}

// Plain numbers for components that aren't shaders (rain, snow, wet floor)
export const atmos = { hour: 20, rain: 0, snow: 0, wet: 0, overcast: 0 }

const sample = {}
for (const k of COLOR_KEYS) sample[k] = new Color()
function sampleAt(hour) {
  let i = 0
  while (i < K.length - 2 && K[i + 1].h <= hour) i++
  const a = K[i]
  const b = K[i + 1]
  const t = MathUtils.smoothstep(hour, a.h, b.h)
  for (const k of COLOR_KEYS) sample[k].copy(a[k]).lerp(b[k], t)
  for (const k of NUM_KEYS) sample[k] = MathUtils.lerp(a[k], b[k], t)
  return sample
}

const grey = new Color()
const tmp = new Color()
const keyPos = new Vector3()
const moonDir = new Vector3(0.2, 0.2, -0.96).normalize()
export { moonDir as MOON_DIR }

// Push a colour towards a rainy grey of the same brightness
function overcastTint(c, amount) {
  const l = c.r * 0.3 + c.g * 0.55 + c.b * 0.15
  grey.setRGB(l * 0.92, l * 0.92, l * 1.02)
  c.lerp(grey, amount * 0.6).multiplyScalar(1 - amount * 0.25)
}

export default function Atmosphere() {
  const scene = useThree((s) => s.scene)
  const gl = useThree((s) => s.gl)
  const hemi = useRef()
  const key = useRef()
  const st = useRef({ hour: null })

  useFrame((_, dt) => {
    dt = Math.min(dt, 0.1)
    const target = current()
    const s = st.current
    if (s.hour === null) s.hour = target.hour
    // walk the clock the short way round, quickly enough to follow the slider
    const diff = ((target.hour - s.hour + 36) % 24) - 12
    s.hour = (s.hour + diff * (1 - Math.exp(-3 * dt)) + 24) % 24
    atmos.hour = s.hour

    atmos.rain = MathUtils.damp(atmos.rain, target.weather === 'rain' ? 1 : 0, 1.2, dt)
    atmos.snow = MathUtils.damp(atmos.snow, target.weather === 'snow' ? 1 : 0, 1.2, dt)
    // the roof dries slower than it gets wet
    atmos.wet = MathUtils.damp(atmos.wet, Math.max(atmos.rain, atmos.snow * 0.5), atmos.rain > atmos.wet ? 1.5 : 0.25, dt)
    const O = Math.max(atmos.rain, atmos.snow * 0.85)
    atmos.overcast = O
    setRainSound(atmos.rain)

    const k = sampleAt(s.hour)
    for (const name of ['top', 'mid', 'hor', 'haze', 'cloud']) overcastTint(k[name], O)
    U.top.value.copy(k.top)
    U.mid.value.copy(k.mid)
    U.hor.value.copy(k.hor)
    U.below.value.copy(k.haze)
    U.cloud.value.copy(k.cloud)
    U.near.value.copy(k.near)
    U.far.value.copy(k.far)
    U.windows.value = k.windows
    U.overcast.value = O

    // sun: rises on the left at 6, sets on the right at 18, never too high so it stays in view
    const day = Math.sin(((s.hour - 6) / 12) * Math.PI)
    const across = MathUtils.clamp((s.hour - 6) / 12, 0, 1)
    // kept low (at most ~15°) so it sits inside the frame at noon
    U.sunDir.value.set(MathUtils.lerp(-0.75, 0.75, across), Math.max(day, -0.2) * 0.27, -1).normalize()
    const sunVis = MathUtils.smoothstep(day, -0.05, 0.1)
    const moonVis = 1 - MathUtils.smoothstep(day, -0.15, 0.08)
    U.sun.value = sunVis * (1 - O * 0.9)
    U.moon.value = moonVis * (1 - O * 0.85)
    U.stars.value = k.stars * (1 - O)
    U.day.value = MathUtils.smoothstep(day, 0.05, 0.45) * (1 - O * 0.6)

    // fog takes the haze colour and closes in when the weather turns
    if (scene.fog) {
      scene.fog.color.copy(k.haze)
      // clear days see further than nights; bad weather closes in
      scene.fog.near = MathUtils.lerp(MathUtils.lerp(70, 90, sunVis), 28, O)
      scene.fog.far = MathUtils.lerp(MathUtils.lerp(340, 460, sunVis), 140, O)
    }

    hemi.current.color.copy(k.hemiSky)
    hemi.current.groundColor.copy(k.hemiGround)
    hemi.current.intensity = k.hemiI * (1 - O * 0.2)
    // the key light comes from the sun by day and the moon by night
    keyPos.copy(moonDir).lerp(U.sunDir.value, sunVis).multiplyScalar(20)
    keyPos.z = Math.max(keyPos.z, 0) + 8 // keep it in front of the roof so faces get lit
    key.current.position.copy(keyPos)
    key.current.color.copy(tmp.copy(k.key))
    key.current.intensity = k.keyI * (1 - O * 0.6)
    gl.toneMappingExposure = MathUtils.lerp(1.05, 0.9, sunVis)
  })

  return (
    <>
      <fog attach="fog" args={['#48689c', 45, 230]} />
      <hemisphereLight ref={hemi} args={['#7a9ad8', '#1a2236', 1.1]} />
      <directionalLight ref={key} position={[4, 8, 8]} intensity={1} color="#c8d8ff" />
    </>
  )
}

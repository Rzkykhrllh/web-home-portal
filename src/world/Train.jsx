import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, Color, MeshBasicMaterial, MeshBasicNodeMaterial, MeshStandardMaterial, MeshStandardNodeMaterial } from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { color, mix, vec3 } from 'three/tsl'
import { setTrain } from '../audio.js'
import { U } from './Atmosphere.jsx'

// A Tokyo loop-line commuter train, after the stainless E231s on the Yamanote
// line: silver bodies with a yellow-green ("uguisu") band at the windows,
// four sliding doors a side, cabs at both ends. No markings or logos. It
// crosses on a viaduct behind the roof about once a minute, alternating
// direction, under overhead wires, lit at night, with rail clatter when the
// sound is on. Each material is one merged mesh, so it's a handful of draws.
const Z = -26 // close enough to read the livery, still behind the roof
const DECK = -0.95 // top of the viaduct: just under the roof, so trains show above the railing
const RAIL = DECK + 0.06
const CARS = 11
const L = 6.4 // car length
const GAP = 0.3
const W = 1.4 // car width
const SPEED = 19 // m/s
const SPAN = 190 // it runs from -SPAN to +SPAN
const PERIOD = 58 // seconds between departures
const LENGTH = CARS * (L + GAP)

const box = (w, h, d, x, y, z) => new BoxGeometry(w, h, d).translate(x, y, z)

function buildTrain() {
  const parts = { silver: [], green: [], door: [], glass: [], dark: [], roof: [], lamp: [] }
  const base = RAIL + 0.32 // floor of the body, above the bogies
  const bandY = base + 0.92
  for (let i = 0; i < CARS; i++) {
    const cx = i * (L + GAP) + L / 2
    // bogies and underframe
    parts.dark.push(box(L - 0.8, 0.3, W - 0.25, cx, RAIL + 0.17, Z))
    // stainless body and the green band along the windows
    parts.silver.push(box(L, 1.3, W, cx, base + 0.65, Z))
    parts.green.push(box(L + 0.01, 0.4, W + 0.02, cx, bandY, Z))
    // a thin second stripe low on the body
    parts.green.push(box(L + 0.01, 0.07, W + 0.02, cx, base + 0.32, Z))
    // four doors a side, with tall windows, and three window bays between them
    for (const dx of [-2.35, -0.78, 0.78, 2.35]) {
      parts.door.push(box(0.62, 1.12, W + 0.03, cx + dx, base + 0.62, Z))
      parts.glass.push(box(0.36, 0.42, W + 0.05, cx + dx, bandY + 0.02, Z))
    }
    for (const dx of [-1.56, 0, 1.56]) parts.glass.push(box(0.82, 0.32, W + 0.05, cx + dx, bandY + 0.02, Z))
    // roof and the air-conditioning unit on top
    parts.roof.push(box(L - 0.06, 0.1, W - 0.12, cx, base + 1.35, Z))
    parts.roof.push(box(1.6, 0.16, 0.85, cx, base + 1.48, Z))
    // cabs at both ends of the train: black windscreen, white nose, headlights
    const ends = []
    if (i === 0) ends.push(-1)
    if (i === CARS - 1) ends.push(1)
    for (const e of ends) {
      const fx = cx + e * (L / 2 + 0.02)
      parts.dark.push(box(0.06, 0.62, W - 0.1, fx, bandY + 0.1, Z))
      parts.glass.push(box(0.07, 0.4, W - 0.35, fx + e * 0.005, bandY + 0.14, Z))
      parts.silver.push(box(0.14, 0.5, W, fx + e * 0.06, base + 0.3, Z))
      for (const dz of [-0.45, 0.45]) parts.lamp.push(box(0.04, 0.08, 0.18, fx + e * 0.14, base + 0.42, Z + dz))
    }
  }
  const out = {}
  for (const [k, list] of Object.entries(parts)) out[k] = mergeGeometries(list)
  return out
}

function buildTrack() {
  const deck = [box(SPAN * 2 + 60, 0.45, 2.4, 0, DECK - 0.22, Z)]
  for (let x = -SPAN; x <= SPAN; x += 24) deck.push(box(0.7, 40, 1.0, x, DECK - 20.45, Z))
  const steel = []
  // two rails
  for (const dz of [-0.5, 0.5]) steel.push(box(SPAN * 2 + 60, 0.06, 0.07, 0, RAIL, Z + dz))
  // overhead line: poles behind the track with arms over it, and the contact wire
  for (let x = -SPAN; x <= SPAN; x += 24) {
    steel.push(box(0.1, 2.8, 0.1, x, DECK + 1.4, Z - 1.05))
    steel.push(box(0.06, 0.06, 1.5, x, DECK + 2.6, Z - 0.35))
  }
  steel.push(box(SPAN * 2 + 60, 0.025, 0.025, 0, DECK + 2.35, Z))
  steel.push(box(SPAN * 2 + 60, 0.02, 0.02, 0, DECK + 2.6, Z))
  return { deck: mergeGeometries(deck), steel: mergeGeometries(steel) }
}

export default function Train() {
  const geo = useMemo(() => ({ train: buildTrain(), track: buildTrack() }), [])

  const mats = useMemo(() => {
    const deck = new MeshStandardNodeMaterial({ roughness: 0.9 })
    deck.colorNode = mix(U.near, U.far, 0.35).mul(0.9)
    const glass = new MeshBasicNodeMaterial()
    // warm lit interiors at night; by day the glass is dark and reflects a little sky
    glass.colorNode = mix(vec3(2.1, 1.85, 1.35), color('#2a3a52'), U.day)
    return {
      deck,
      steel: new MeshStandardMaterial({ color: '#5d6270', metalness: 0.6, roughness: 0.5 }),
      silver: new MeshStandardMaterial({ color: '#c9ced6', metalness: 0.55, roughness: 0.35 }),
      green: new MeshStandardMaterial({ color: '#8cc63f', roughness: 0.5 }),
      door: new MeshStandardMaterial({ color: '#aeb4bd', metalness: 0.55, roughness: 0.4 }),
      roof: new MeshStandardMaterial({ color: '#8d929b', roughness: 0.7 }),
      dark: new MeshStandardMaterial({ color: '#16181e', roughness: 0.6 }),
      glass,
      lamp: new MeshBasicMaterial({ color: new Color('#fff6dc').multiplyScalar(3), toneMapped: false }),
    }
  }, [])

  const train = useRef()
  useFrame((state) => {
    // timed so the first one crosses in front about 15 s after load
    const t = state.clock.elapsedTime - 5.5
    const run = Math.floor(t / PERIOD)
    const k = (t % PERIOD) * SPEED
    const dir = run % 2 ? -1 : 1
    const travel = SPAN * 2 + LENGTH
    const g = train.current
    if (t < 0 || k > travel) {
      g.visible = false
      setTrain(0, 0)
      return
    }
    g.visible = true
    const tail = dir > 0 ? -SPAN - LENGTH + k : SPAN - k
    g.position.x = tail
    // louder as it passes in front of us, panned to where it is
    const mid = tail + LENGTH / 2
    const level = Math.max(0, 1 - Math.abs(mid - state.camera.position.x) / 100)
    setTrain(level * level, Math.max(-1, Math.min(1, mid / 60)))
  })

  return (
    <group>
      <mesh geometry={geo.track.deck} material={mats.deck} />
      <mesh geometry={geo.track.steel} material={mats.steel} />
      <group ref={train} visible={false}>
        {['silver', 'green', 'door', 'glass', 'dark', 'roof', 'lamp'].map((k) => (
          <mesh key={k} geometry={geo.train[k]} material={mats[k]} />
        ))}
      </group>
    </group>
  )
}

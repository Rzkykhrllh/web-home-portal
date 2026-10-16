import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, MeshBasicNodeMaterial, MeshStandardNodeMaterial } from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { color, mix, vec3 } from 'three/tsl'
import { setTrain } from '../audio.js'
import { U } from './Atmosphere.jsx'

// A commuter train crossing the city on a viaduct behind the roof, every
// minute or so, alternating direction. Lit windows at night, rail clatter
// when the sound is on. Three meshes: viaduct, carriages, window strips.
const Z = -36
const DECK = -0.7 // top of the viaduct, just under the roof so it shows above the railing
const CARS = 8
const CAR = 3.8
const SPEED = 19 // m/s
const SPAN = 170 // it runs from -SPAN to +SPAN
const PERIOD = 55 // seconds between departures

const at = (g, x, y, z) => g.translate(x, y, z)

export default function Train() {
  const { viaduct, body, windows } = useMemo(() => {
    const parts = [at(new BoxGeometry(SPAN * 2 + 40, 0.45, 2.4), 0, DECK - 0.22, Z)]
    for (let x = -SPAN; x <= SPAN; x += 24) parts.push(at(new BoxGeometry(0.7, 40, 1.0), x, DECK - 20.45, Z))
    const cars = []
    const wins = []
    for (let i = 0; i < CARS; i++) {
      const x = i * (CAR + 0.25)
      cars.push(at(new BoxGeometry(CAR, 1.05, 1.15), x, DECK + 0.62, Z))
      wins.push(at(new BoxGeometry(CAR - 0.5, 0.32, 1.18), x, DECK + 0.78, Z))
    }
    return { viaduct: mergeGeometries(parts), body: mergeGeometries(cars), windows: mergeGeometries(wins) }
  }, [])

  const mats = useMemo(() => {
    const deck = new MeshStandardNodeMaterial({ roughness: 0.9 })
    deck.colorNode = mix(U.near, U.far, 0.35).mul(0.9)
    const car = new MeshStandardNodeMaterial({ roughness: 0.45, metalness: 0.4 })
    car.colorNode = mix(color('#2a2f45'), color('#d9dde6'), U.day.mul(0.7).add(0.3)) // silver, darker at night
    const win = new MeshBasicNodeMaterial()
    // warm lit windows at night; by day they reflect the sky
    win.colorNode = mix(vec3(2.2, 1.9, 1.35), color('#7fa6d8'), U.day)
    return { deck, car, win }
  }, [])

  const train = useRef()
  useFrame((state) => {
    // timed so the first one crosses in front about 15 s after load
    const t = state.clock.elapsedTime - 5.2
    const run = Math.floor(t / PERIOD)
    const k = (t % PERIOD) * SPEED
    const dir = run % 2 ? -1 : 1
    const length = CARS * (CAR + 0.25)
    const travel = SPAN * 2 + length
    const g = train.current
    if (t < 0 || k > travel) {
      g.visible = false
      setTrain(0, 0)
      return
    }
    g.visible = true
    const head = dir > 0 ? -SPAN - length + k : SPAN - k
    g.position.x = head
    // louder as it passes in front of us, panned to where it is
    const mid = head + length / 2
    const level = Math.max(0, 1 - Math.abs(mid - state.camera.position.x) / 90)
    setTrain(level * level, Math.max(-1, Math.min(1, mid / 60)))
  })

  return (
    <group>
      <mesh geometry={viaduct} material={mats.deck} />
      <group ref={train} visible={false}>
        <mesh geometry={body} material={mats.car} />
        <mesh geometry={windows} material={mats.win} />
      </group>
    </group>
  )
}

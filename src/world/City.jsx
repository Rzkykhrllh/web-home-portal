import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, Color, Euler, Matrix4, MeshBasicMaterial, MeshStandardNodeMaterial, Quaternion, SphereGeometry, Vector3 } from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { abs, color, floor, fract, hash, mix, normalWorld, positionWorld, step, vec2 } from 'three/tsl'
import { ROOF } from '../config.js'
import { SANS, canvasTexture, rng } from './canvasTexture.js'

// Lit windows, computed in the shader from world position instead of a
// texture per building. That lets every building, plus the one under our
// roof, share one material and one merged mesh: the whole city is a single
// draw call.
export const cityMaterial = (() => {
  const m = new MeshStandardNodeMaterial({ roughness: 0.9, metalness: 0 })
  const n = normalWorld
  const wall = step(abs(n.y), 0.5) // 1 on walls, 0 on roofs
  // distance along the wall, whichever way it faces
  const along = positionWorld.x.mul(n.z.negate()).add(positionWorld.z.mul(n.x))
  const cell = vec2(along.div(1.0), positionWorld.y.div(2.2))
  const id = floor(cell)
  const f = fract(cell)
  const pane = step(0.18, f.x).mul(step(f.x, 0.82)).mul(step(0.25, f.y)).mul(step(f.y, 0.75))
  // whole floors tend to be lit or dark together, like real offices
  const floorLit = hash(id.y.mul(13.7).add(floor(along.div(9)).mul(71.3)))
  const r = hash(id.x.mul(17.1).add(id.y.mul(311.7)))
  const chance = mix(0.05, 0.75, step(0.4, floorLit)).add(step(0.75, floorLit).mul(0.1))
  const lit = step(r, chance).mul(pane).mul(wall)
  const tint = mix(color('#ffd7a0'), color('#d6e8ff'), step(0.55, hash(id.x.add(id.y.mul(7.3)).add(3.1))))
  const level = hash(id.x.mul(5.3).add(id.y.mul(2.9))).mul(0.65).add(0.35)
  m.colorNode = mix(color('#141824'), color('#0a0d16'), wall)
  m.emissiveNode = tint.mul(lit).mul(level).mul(1.1)
  return m
})()

const box = (w, h, d, x, y, z, rot = 0) => {
  const g = new BoxGeometry(w, h, d)
  g.applyMatrix4(new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(0, rot, 0)), new Vector3(1, 1, 1)))
  return g
}

// The city round the roof: blocks fading into the haze and red aircraft
// beacons blinking on the tall ones. Plus one big vertical sign.
export default function City() {
  const { geometry, beacons } = useMemo(() => {
    const r = rng(42)
    const parts = []
    const lights = []
    for (let i = 0; i < 70; i++) {
      // mostly behind and to the sides; that's where the camera looks
      const a = Math.PI * (0.05 + r() * 0.9) + Math.PI
      const side = r() < 0.2 ? Math.PI * (r() < 0.5 ? -0.35 : 0.35) : 0
      const dist = 28 + r() * 80
      const x = Math.cos(a + side) * dist
      const z = Math.sin(a + side) * dist - 4
      const w = 5 + r() * 9
      const d = 5 + r() * 9
      // near blocks sit below the roof so we look out over them; the far ones tower
      const top = dist < 48 ? -20 + r() * 16 : -12 + r() * 44
      const h = top + 70
      r() // (was the window-texture pick; still drawn so the skyline stays the same)
      parts.push(box(w, h, d, x, top - h / 2, z, (r() - 0.5) * 0.3))
      if (top > 6) lights.push(new SphereGeometry(0.35, 8, 6).translate(x, top + 0.6, z))
    }
    // the building we're standing on, and the one carrying the big sign
    const W = ROOF.x * 2 + 0.6
    const D = ROOF.front - ROOF.back + 0.6
    parts.push(box(W, 40, D, 0, -20.2, (ROOF.front + ROOF.back) / 2))
    parts.push(box(12, 60, 8, -18, -30, -40))
    return { geometry: mergeGeometries(parts), beacons: mergeGeometries(lights) }
  }, [])

  return (
    <group>
      <mesh geometry={geometry} material={cityMaterial} />
      <Beacons geometry={beacons} />
      <BigSign />
    </group>
  )
}

function Beacons({ geometry }) {
  const red = useMemo(() => new Color('#ff2a2a').multiplyScalar(5), [])
  const mat = useMemo(() => new MeshBasicMaterial({ color: red.clone(), toneMapped: false }), [red])
  useFrame((state) => {
    const on = Math.sin(state.clock.elapsedTime * 2.2) > 0.2
    mat.color.copy(red).multiplyScalar(on ? 1 : 0.08)
  })
  return <mesh geometry={geometry} material={mat} />
}

// A tall vertical sign on the building behind: the cat's name in katakana
function BigSign() {
  const tex = useMemo(
    () =>
      canvasTexture(200, 720, (ctx, w, h) => {
        ctx.fillStyle = '#12060f'
        ctx.fillRect(0, 0, w, h)
        ctx.strokeStyle = '#ff4fa0'
        ctx.lineWidth = 8
        ctx.strokeRect(12, 12, w - 24, h - 24)
        ctx.fillStyle = '#ffe3f1'
        ctx.shadowColor = '#ff4fa0'
        ctx.shadowBlur = 24
        ctx.font = `900 150px ${SANS}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ;['ア', 'イ', 'ル'].forEach((c, i) => ctx.fillText(c, w / 2, 140 + i * 220))
      }),
    [],
  )
  const tint = useMemo(() => new Color('#ffffff').multiplyScalar(1.8), [])
  return (
    <mesh position={[-13.5, 7, -35.95]}>
      <planeGeometry args={[3, 10.8]} />
      <meshBasicMaterial map={tex} color={tint} toneMapped={false} />
    </mesh>
  )
}

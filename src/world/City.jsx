import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, Color, CylinderGeometry, Euler, Matrix4, MeshBasicMaterial, MeshStandardNodeMaterial, Quaternion, SphereGeometry, Vector3 } from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { abs, color, floor, fract, hash, mix, normalWorld, positionWorld, select, smoothstep, step, vec2 } from 'three/tsl'
import { ROOF } from '../config.js'
import { SANS, canvasTexture, rng } from './canvasTexture.js'

// Lit windows, computed in the shader from world position instead of a
// texture per building. That lets every building, plus the one under our
// roof, share one material and one merged mesh: the whole city is a single
// draw call.
export const cityMaterial = (() => {
  const m = new MeshStandardNodeMaterial({ roughness: 0.95, metalness: 0 })
  const n = normalWorld
  const wall = step(abs(n.y), 0.5) // 1 on walls, 0 on roofs
  // distance along the wall, whichever way it faces
  const along = positionWorld.x.mul(n.z.negate()).add(positionWorld.z.mul(n.x))
  const cell = vec2(along.div(1.0), positionWorld.y.div(2.2))
  const id = floor(cell)
  const f = fract(cell)
  const pane = step(0.18, f.x).mul(step(f.x, 0.82)).mul(step(0.25, f.y)).mul(step(f.y, 0.75))
  // whole floors tend to be lit or dark together, like real offices
  const block = floor(along.div(9))
  const floorLit = hash(id.y.mul(13.7).add(block.mul(71.3)))
  const r = hash(id.x.mul(17.1).add(id.y.mul(311.7)))
  const chance = mix(0.04, 0.6, step(0.45, floorLit)).add(step(0.8, floorLit).mul(0.15))
  const lit = step(r, chance).mul(pane).mul(wall)
  // mostly cool cyan and blue-white, some warm orange, as in an illustrated skyline
  const k = hash(id.x.add(id.y.mul(7.3)).add(3.1))
  const tint = select(k.lessThan(0.5), color('#6fe3ff'), select(k.lessThan(0.75), color('#bcd3ff'), color('#ffa860')))
  const level = hash(id.x.mul(5.3).add(id.y.mul(2.9))).mul(0.6).add(0.4)
  // some facades are lit glass: vertical cyan stripes over the whole wall
  const glassy = step(0.86, hash(block.mul(3.7).add(floor(positionWorld.y.div(60)))))
  const stripe = step(fract(along.mul(0.5)), 0.12).mul(glassy).mul(wall).mul(0.5)
  // aerial perspective: near blocks are deep indigo, far ones lighter violet
  const dist = positionWorld.xz.length()
  const body = mix(color('#1a1442'), color('#43307a'), smoothstep(40, 170, dist))
  m.colorNode = mix(body.mul(0.8), body, wall)
  m.emissiveNode = tint.mul(lit.mul(level).add(stripe)).mul(1.15)
  return m
})()

const box = (w, h, d, x, y, z, rot = 0) => {
  const g = new BoxGeometry(w, h, d)
  g.applyMatrix4(new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(0, rot, 0)), new Vector3(1, 1, 1)))
  return g
}

// The city round the roof: a near ring of blocks, a dense far skyline fading
// to violet, antenna spires and red aircraft beacons. Plus one big sign.
export default function City() {
  const { geometry, beacons } = useMemo(() => {
    const r = rng(42)
    const parts = []
    const lights = []
    const add = (dist, x, z, w, d, top) => {
      const h = top + 80
      parts.push(box(w, h, d, x, top - h / 2, z, (r() - 0.5) * 0.25))
      if (top > 10 && r() < 0.35) {
        // antenna spire on some of the tall ones
        const sh = 4 + r() * 8
        parts.push(new CylinderGeometry(0.08, 0.5, sh, 6).translate(x, top + sh / 2, z))
        lights.push(new SphereGeometry(0.35, 8, 6).translate(x, top + sh + 0.3, z))
      } else if (top > 6) lights.push(new SphereGeometry(0.35, 8, 6).translate(x, top + 0.6, z))
    }
    // the near ring: blocks below roof level close in, getting taller with distance
    for (let i = 0; i < 70; i++) {
      const a = Math.PI * (0.02 + r() * 0.96) + Math.PI
      const side = r() < 0.25 ? Math.PI * (r() < 0.5 ? -0.3 : 0.3) : 0
      const dist = 28 + r() * 80
      const x = Math.cos(a + side) * dist
      const z = Math.sin(a + side) * dist - 4
      // mostly under the horizon so the sky stays open, with the odd tall one
      const top = dist < 48 ? -22 + r() * 14 : r() < 0.12 ? 2 + r() * 12 : -16 + r() * 18
      add(dist, x, z, 5 + r() * 9, 5 + r() * 9, top)
    }
    // the far skyline: a dense band of towers that the fog turns violet
    for (let i = 0; i < 90; i++) {
      const a = Math.PI * (-0.08 + r() * 1.16) + Math.PI
      const dist = 120 + r() * 70
      add(dist, Math.cos(a) * dist, Math.sin(a) * dist, 7 + r() * 12, 7 + r() * 12, r() < 0.15 ? 14 + r() * 16 : -8 + r() * 22)
    }
    // the building we're standing on, and the one carrying the big sign
    const W = ROOF.x * 2 + 0.6
    const D = ROOF.front - ROOF.back + 0.6
    parts.push(box(W, 40, D, 0, -20.2, (ROOF.front + ROOF.back) / 2))
    parts.push(box(12, 60, 8, -13, -30, -58))
    return { geometry: mergeGeometries(parts.map((g) => g.toNonIndexed())), beacons: mergeGeometries(lights) }
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
    <mesh position={[-8.5, 7, -53.95]}>
      <planeGeometry args={[3, 10.8]} />
      <meshBasicMaterial map={tex} color={tint} toneMapped={false} />
    </mesh>
  )
}

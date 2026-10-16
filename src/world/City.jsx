import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, BufferAttribute, Color, DoubleSide, CylinderGeometry, Euler, Matrix4, MeshBasicMaterial, MeshStandardNodeMaterial, Quaternion, SphereGeometry, Vector3 } from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { abs, attribute, color, floor, fract, hash, mix, normalWorld, positionLocal, positionWorld, select, smoothstep, step, uv, vec2 } from 'three/tsl'
import { ROOF } from '../config.js'
import { SANS, canvasTexture, rng } from './canvasTexture.js'
import { U } from './Atmosphere.jsx'

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
  // mostly warm yellow and orange against the blue, with some cool white offices
  const k = hash(id.x.add(id.y.mul(7.3)).add(3.1))
  const tint = select(k.lessThan(0.45), color('#ffd27a'), select(k.lessThan(0.72), color('#ffa860'), color('#d8e6ff')))
  const level = hash(id.x.mul(5.3).add(id.y.mul(2.9))).mul(0.6).add(0.4)
  // some facades are lit glass: vertical cyan stripes over the whole wall
  const glassy = step(0.9, hash(block.mul(3.7).add(floor(positionWorld.y.div(60)))))
  const stripe = step(fract(along.mul(0.5)), 0.12).mul(glassy).mul(wall).mul(0.5)
  // Night: deep indigo near, lighter violet far (colours follow the hour, see Atmosphere)
  const dist = positionWorld.xz.length()
  const nightBody = mix(U.near, U.far, smoothstep(40, 170, dist))
  const nightCol = mix(nightBody.mul(0.8), nightBody, wall)

  // Day: each building its own pastel (one seed per building, baked into the
  // mesh), fading into the haze with distance, and glass that reflects the sky
  const seed = attribute('bseed', 'float')
  const pastel = select(
    seed.lessThan(0.16),
    color('#dccfb9'),
    select(seed.lessThan(0.32), color('#b9c8de'), select(seed.lessThan(0.46), color('#86a2cc'), select(seed.lessThan(0.6), color('#e8e4dc'), select(seed.lessThan(0.72), color('#a7b3c6'), select(seed.lessThan(0.84), color('#d6bfb2'), color('#9db7d8')))))),
  )
  const dayBody = mix(pastel, U.far, smoothstep(50, 190, dist).mul(0.75))
  // sky in the glass: bands of blue to near-white running up the facade, and the odd bright glint
  const sky = mix(color('#3f78cc'), color('#cfe3ff'), fract(positionWorld.y.div(31).add(seed.mul(5))))
  const glint = step(0.94, r).mul(0.6)
  const glassTower = step(0.78, seed) // a few towers are glass all over
  const glass = mix(pane.mul(0.8), 1, glassTower).mul(wall)
  const glassCol = mix(sky, color('#ffffff'), glint)
  const dayCol = mix(dayBody.mul(0.86), mix(dayBody, glassCol, glass), wall)

  m.colorNode = mix(nightCol, dayCol, U.day)
  // night: lit windows; day: the reflections stay bright whatever the light
  const windowsGlow = tint.mul(lit.mul(level).mul(U.windows).add(stripe.mul(mix(0.25, 1, U.windows))))
  m.emissiveNode = windowsGlow.mul(1.15).add(glassCol.mul(glass).mul(U.day).mul(0.3))
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
    // and the half behind the camera, so photo mode can look all the way round
    const rf = rng(77)
    for (let i = 0; i < 60; i++) {
      const a = Math.PI * (0.02 + rf() * 0.96)
      const dist = 30 + rf() * 80
      const top = dist < 48 ? -22 + rf() * 14 : rf() < 0.15 ? 2 + rf() * 14 : -16 + rf() * 20
      parts.push(box(5 + rf() * 9, top + 80, 5 + rf() * 9, Math.cos(a) * dist, top - (top + 80) / 2, Math.sin(a) * dist + 6, (rf() - 0.5) * 0.25))
    }
    for (let i = 0; i < 70; i++) {
      const a = Math.PI * (0.08 + rf() * 0.84)
      const dist = 120 + rf() * 70
      const top = rf() < 0.15 ? 14 + rf() * 16 : -8 + rf() * 22
      parts.push(box(7 + rf() * 12, top + 80, 7 + rf() * 12, Math.cos(a) * dist, top - (top + 80) / 2, Math.sin(a) * dist, (rf() - 0.5) * 0.25))
    }
    // the building we're standing on, and the one carrying the big sign
    const W = ROOF.x * 2 + 0.6
    const D = ROOF.front - ROOF.back + 0.6
    parts.push(box(W, 40, D, 0, -20.2, (ROOF.front + ROOF.back) / 2))
    // tall enough that the sign hangs on its face, not above the roofline
    parts.push(box(12, 76, 8, -13, -22, -58))
    // one colour seed per building, for its daytime pastel
    const rs = rng(7)
    const seeded = parts.map((g) => {
      const flat = g.toNonIndexed()
      const n = flat.attributes.position.count
      flat.setAttribute('bseed', new BufferAttribute(new Float32Array(n).fill(rs()), 1))
      return flat
    })
    return { geometry: mergeGeometries(seeded), beacons: mergeGeometries(lights) }
  }, [])

  return (
    <group>
      <mesh geometry={geometry} material={cityMaterial} />
      <Beacons geometry={beacons} />
      <BigSign />
      {/* right of centre, behind the portals, next to the moon: in view from the start */}
      <Tower position={[29, -40, -115]} scale={0.55} />
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
  const tint = useMemo(() => new Color('#ffffff').multiplyScalar(1.35), [])
  // bolted to the facade: a dark backing box, two brackets, then the face
  return (
    <group position={[-8.5, 7, -54]}>
      <mesh position-z={0.2}>
        <boxGeometry args={[3.4, 11.2, 0.4]} />
        <meshStandardMaterial color="#1a1420" metalness={0.5} roughness={0.6} />
      </mesh>
      {[4.6, -4.6].map((y) => (
        <mesh key={y} position={[0, y, 0.15]}>
          <boxGeometry args={[3.9, 0.18, 0.3]} />
          <meshStandardMaterial color="#2a2430" metalness={0.6} roughness={0.5} />
        </mesh>
      ))}
      <mesh position-z={0.41}>
        <planeGeometry args={[3, 10.8]} />
        <meshBasicMaterial map={tex} color={tint} toneMapped={false} />
      </mesh>
    </group>
  )
}

// A red-and-white lattice broadcast tower rising over the skyline behind the
// portals. Banded red and white by day, floodlit orange at night; the lattice
// is cut out of a tapered shell.
function Tower(props) {
  const shell = useMemo(() => {
    const m = new MeshStandardNodeMaterial({ roughness: 0.6, side: DoubleSide, alphaTest: 0.5, transparent: false })
    const y = positionLocal.y
    const band = step(0.5, fract(y.div(9)))
    const paint = mix(color('#f2f2ee'), color('#e0452e'), band)
    // diagonal lattice: keep thin bars, cut out the gaps
    const u = uv().x.mul(16)
    const v = y.div(3.2)
    const d1 = fract(u.add(v))
    const d2 = fract(u.sub(v))
    const bars = step(0.86, d1).add(step(0.86, d2)).add(step(0.9, fract(v))).add(step(0.94, fract(u))).clamp(0, 1)
    m.colorNode = paint
    m.opacityNode = bars
    // floodlights at night
    m.emissiveNode = mix(color('#ff8a3a'), color('#ffd29a'), band.oneMinus().mul(0.5)).mul(U.windows.mul(1.6))
    return m
  }, [])
  const solid = useMemo(() => {
    const m = new MeshStandardNodeMaterial({ roughness: 0.5 })
    m.colorNode = color('#e9e9e4')
    m.emissiveNode = color('#ffb46a').mul(U.windows.mul(1.2))
    return m
  }, [])
  const blink = useMemo(() => new MeshBasicMaterial({ color: new Color('#ff3030').multiplyScalar(4), toneMapped: false }), [])
  return (
    <group {...props}>
      {/* legs flaring out at the base, then the slim upper mast */}
      <mesh position-y={40} material={shell}>
        <cylinderGeometry args={[4, 16, 80, 4, 1, true]} />
      </mesh>
      <mesh position-y={102} material={shell}>
        <cylinderGeometry args={[1.2, 4, 44, 4, 1, true]} />
      </mesh>
      <mesh position-y={78} material={solid} rotation-y={Math.PI / 4}>
        <boxGeometry args={[11, 4, 11]} />
      </mesh>
      <mesh position-y={110} material={solid} rotation-y={Math.PI / 4}>
        <boxGeometry args={[5, 2.2, 5]} />
      </mesh>
      <mesh position-y={130} material={solid}>
        <cylinderGeometry args={[0.25, 0.6, 12, 6]} />
      </mesh>
      <mesh position-y={136.5} material={blink}>
        <sphereGeometry args={[0.7, 8, 6]} />
      </mesh>
    </group>
  )
}

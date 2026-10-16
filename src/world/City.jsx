import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, BufferAttribute, Color, DoubleSide, CylinderGeometry, Euler, Matrix4, MeshBasicMaterial, MeshBasicNodeMaterial, MeshStandardNodeMaterial, PlaneGeometry, Quaternion, SphereGeometry, Vector3 } from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { abs, attribute, color, floor, fract, hash, mix, normalWorld, positionLocal, positionWorld, select, smoothstep, step, texture, uv, vec2 } from 'three/tsl'
import { ROOF } from '../config.js'
import { SANS, canvasTexture, rng } from './canvasTexture.js'
import { U } from './Atmosphere.jsx'

// Lit windows, computed in the shader from world position instead of a
// texture per building. That lets every building, plus the one under our
// roof, share one material and one merged mesh: the whole city is a single
// draw call. Each building carries a seed that picks its facade: punched
// windows, office ribbon windows or a glass curtain wall, at its own floor
// height and window width, so no two read the same.
export const cityMaterial = (() => {
  const m = new MeshStandardNodeMaterial({ roughness: 0.95, metalness: 0 })
  const n = normalWorld
  const seed = attribute('bseed', 'float')
  const plain = attribute('plain', 'float') // rooftop plant and sign frames: no windows
  const wall = step(abs(n.y), 0.5) // 1 on walls, 0 on roofs
  // distance along the wall, whichever way it faces
  const along = positionWorld.x.mul(n.z.negate()).add(positionWorld.z.mul(n.x))
  const cellW = mix(0.75, 1.3, fract(seed.mul(7.13)))
  const floorH = mix(1.8, 2.5, fract(seed.mul(13.31)))
  const cell = vec2(along.div(cellW), positionWorld.y.div(floorH))
  const id = floor(cell)
  const f = fract(cell)
  const style = fract(seed.mul(3.71))
  const punched = step(0.18, f.x).mul(step(f.x, 0.82)).mul(step(0.25, f.y)).mul(step(f.y, 0.75))
  const ribbon = step(0.04, f.x).mul(step(0.3, f.y)).mul(step(f.y, 0.72))
  const curtain = step(0.05, f.x).mul(step(f.x, 0.95)).mul(step(0.08, f.y)).mul(step(f.y, 0.92))
  const isRibbon = step(0.5, style).mul(step(style, 0.78))
  const pane = select(style.lessThan(0.5), punched, select(style.lessThan(0.78), ribbon, curtain)).mul(plain.oneMinus())
  // whole floors tend to be lit or dark together, like real offices; ribbon
  // windows light up in long runs
  const block = floor(along.div(9))
  const floorLit = hash(id.y.mul(13.7).add(block.mul(71.3)).add(seed.mul(91.0)))
  const rid = mix(id.x, floor(id.x.div(5)), isRibbon)
  const r = hash(rid.mul(17.1).add(id.y.mul(311.7)).add(seed.mul(37.0)))
  const busy = mix(0.45, 1.3, fract(seed.mul(29.7))) // some buildings are half empty
  const chance = mix(0.04, 0.6, step(0.45, floorLit)).add(step(0.8, floorLit).mul(0.15)).mul(busy)
  const lit = step(r, chance).mul(pane).mul(wall)
  // mostly warm yellow and orange against the blue; glass towers run cool white
  const k = hash(id.x.add(id.y.mul(7.3)).add(3.1).add(seed))
  const warm = select(k.lessThan(0.55), color('#ffd27a'), color('#ffa860'))
  const tint = select(style.greaterThan(0.78), mix(color('#d8e6ff'), warm, step(0.75, k)), select(k.lessThan(0.85), warm, color('#d8e6ff')))
  const level = hash(id.x.mul(5.3).add(id.y.mul(2.9))).mul(0.6).add(0.4)
  // Night: deep blue near, lighter far (colours follow the hour, see Atmosphere)
  const dist = positionWorld.xz.length()
  const nightBody = mix(U.near, U.far, smoothstep(40, 170, dist))
  // curtain walls read a touch lighter and bluer than masonry
  const nightWall = mix(nightBody, nightBody.mul(1.25).add(color('#0a1a3a').mul(0.3)), step(0.78, style))
  const nightCol = mix(nightBody.mul(0.8), nightWall, wall)

  // Day: each building its own pastel, fading into the haze with distance,
  // and glass that reflects the sky
  const pastel = select(
    seed.lessThan(0.16),
    color('#dccfb9'),
    select(seed.lessThan(0.32), color('#b9c8de'), select(seed.lessThan(0.46), color('#86a2cc'), select(seed.lessThan(0.6), color('#e8e4dc'), select(seed.lessThan(0.72), color('#a7b3c6'), select(seed.lessThan(0.84), color('#d6bfb2'), color('#9db7d8')))))),
  )
  const dayBody = mix(pastel, U.far, smoothstep(50, 190, dist).mul(0.75))
  const sky = mix(color('#3f78cc'), color('#cfe3ff'), fract(positionWorld.y.div(31).add(seed.mul(5))))
  const glint = step(0.94, r).mul(0.6)
  const glassTower = step(0.78, style).mul(plain.oneMinus())
  const glass = mix(pane.mul(0.8), 1, glassTower).mul(wall)
  const glassCol = mix(sky, color('#ffffff'), glint)
  const dayCol = mix(dayBody.mul(0.86), mix(dayBody, glassCol, glass), wall)

  m.colorNode = mix(nightCol, dayCol, U.day)
  // the streets below glow orange and light the lower floors from underneath
  const street = color('#ff8a4a').mul(smoothstep(8, 45, positionWorld.y.negate())).mul(wall).mul(0.22).mul(U.windows)
  const windowsGlow = tint.mul(lit.mul(level).mul(U.windows))
  m.emissiveNode = windowsGlow.mul(1.15).add(street).add(glassCol.mul(glass).mul(U.day).mul(0.3))
  return m
})()

const box = (w, h, d, x, y, z, rot = 0) => {
  const g = new BoxGeometry(w, h, d)
  g.applyMatrix4(new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(0, rot, 0)), new Vector3(1, 1, 1)))
  return g
}

// Shop signs and rooftop billboards, all on one atlas. Top half: eight
// vertical blade signs; bottom half: four billboards.
const BLADES = [
  ['カラオケ', '#ff5aa8'],
  ['ラーメン', '#ff4a3a'],
  ['居酒屋', '#ffa040'],
  ['ホテル', '#5ad8ff'],
  ['薬', '#5aff9a'],
  ['珈琲', '#ffe0b0'],
  ['歯科', '#7aa8ff'],
  ['焼肉', '#ffcc40'],
]
function signAtlas() {
  return canvasTexture(1024, 1024, (ctx) => {
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    BLADES.forEach(([word, c], i) => {
      const x = i * 128
      ctx.fillStyle = '#0c0a12'
      ctx.fillRect(x, 0, 128, 512)
      ctx.strokeStyle = c
      ctx.lineWidth = 5
      ctx.strokeRect(x + 8, 8, 112, 496)
      ctx.fillStyle = '#fff6fa'
      ctx.shadowColor = c
      ctx.shadowBlur = 14
      const chars = [...word]
      const size = chars.length === 1 ? 110 : Math.min(100, 440 / chars.length)
      ctx.font = `900 ${size}px ${SANS}`
      chars.forEach((ch, j) => ctx.fillText(ch, x + 64, 256 + (j - (chars.length - 1) / 2) * size * 1.08))
      ctx.shadowBlur = 0
    })
    // billboards: two lit text boards and two soft colour ads
    const boards = [
      (x, y) => {
        ctx.fillStyle = '#10204a'
        ctx.fillRect(x, y, 512, 256)
        ctx.fillStyle = '#ffffff'
        ctx.font = `900 120px ${SANS}`
        ctx.fillText('24時間', x + 256, y + 110)
        ctx.font = `700 40px ${SANS}`
        ctx.fillStyle = '#7ad0ff'
        ctx.fillText('OPEN ALL NIGHT', x + 256, y + 200)
      },
      (x, y) => {
        const g = ctx.createLinearGradient(x, y, x + 512, y + 256)
        g.addColorStop(0, '#ff6aa0')
        g.addColorStop(1, '#ffb05a')
        ctx.fillStyle = g
        ctx.fillRect(x, y, 512, 256)
        ctx.fillStyle = 'rgba(255,240,230,0.55)'
        ctx.beginPath()
        ctx.arc(x + 380, y + 128, 90, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#2a0a20'
        ctx.font = `900 72px ${SANS}`
        ctx.fillText('新発売', x + 160, y + 128)
      },
      (x, y) => {
        const g = ctx.createLinearGradient(x, y, x, y + 256)
        g.addColorStop(0, '#3a8aff')
        g.addColorStop(1, '#1a3a9a')
        ctx.fillStyle = g
        ctx.fillRect(x, y, 512, 256)
        ctx.fillStyle = '#ffffff'
        ctx.font = `900 96px ${SANS}`
        ctx.fillText('コーヒー', x + 256, y + 128)
      },
      (x, y) => {
        ctx.fillStyle = '#0e0e14'
        ctx.fillRect(x, y, 512, 256)
        ctx.fillStyle = '#a8ff5a'
        ctx.font = `900 110px ${SANS}`
        ctx.fillText('ゲーム', x + 256, y + 128)
      },
    ]
    boards.forEach((draw, j) => draw((j % 2) * 512, 512 + Math.floor(j / 2) * 256))
  })
}

function tilePlane(w, h, u0, v0, u1, v1) {
  const g = new PlaneGeometry(w, h)
  const uv = g.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0))
  return g
}

// place a geometry on a building's front face (local +z), rotated with it
function onFace(g, b, lx, y, out = 0.06) {
  const c = Math.cos(b.rot)
  const sn = Math.sin(b.rot)
  const lz = b.d / 2 + out
  g.rotateY(b.rot)
  g.translate(b.x + lx * c + lz * sn, y, b.z - lx * sn + lz * c)
  return g
}

// The city round the roof: a near ring of blocks, a dense far skyline,
// setback towers with rooftop plant, antenna spires, red aircraft beacons,
// shop signs and billboards. Plus one big sign.
export default function City() {
  const { geometry, beacons, signs } = useMemo(() => {
    const parts = []
    const lights = []
    const seeds = rng(7)
    const add = (r, x, z, w, d, top) => {
      const s = seeds()
      const rot = (r() - 0.5) * 0.25
      const h = top + 80
      parts.push({ g: box(w, h, d, x, top - h / 2, z, rot), s })
      let t = top
      let cw = w
      let cd = d
      // the taller ones step back as they rise
      if (top > -4 && r() < 0.55) {
        const tiers = r() < 0.35 ? 2 : 1
        for (let k = 0; k < tiers; k++) {
          cw *= 0.6 + r() * 0.2
          cd *= 0.6 + r() * 0.2
          const th = 2 + r() * 5
          parts.push({ g: box(cw, th, cd, x, t + th / 2, z, rot), s })
          t += th
        }
      }
      // rooftop plant rooms and tanks
      const c = Math.cos(rot)
      const sn = Math.sin(rot)
      const nb = r() < 0.75 ? 1 + Math.floor(r() * 3) : 0
      for (let k = 0; k < nb; k++) {
        const bw = Math.min(cw * 0.5, 1 + r() * 2.4)
        const bd = Math.min(cd * 0.5, 1 + r() * 2.4)
        const bh = 0.7 + r() * 1.8
        const ox = (r() - 0.5) * (cw - bw) * 0.8
        const oz = (r() - 0.5) * (cd - bd) * 0.8
        parts.push({ g: box(bw, bh, bd, x + ox * c + oz * sn, t + bh / 2, z - ox * sn + oz * c, rot), s, plain: 1 })
      }
      if (t > 10 && r() < 0.35) {
        const sh = 4 + r() * 8
        parts.push({ g: new CylinderGeometry(0.08, 0.5, sh, 6).translate(x, t + sh / 2, z), s, plain: 1 })
        lights.push(new SphereGeometry(0.35, 8, 6).translate(x, t + sh + 0.3, z))
      } else if (t > 6) lights.push(new SphereGeometry(0.35, 8, 6).translate(x, t + 0.6, z))
      return { x, z, w, d, top, rot }
    }

    const front = []
    const r = rng(42)
    // the near ring: blocks below roof level close in, getting taller with distance
    for (let i = 0; i < 70; i++) {
      const a = Math.PI * (0.02 + r() * 0.96) + Math.PI
      const side = r() < 0.25 ? Math.PI * (r() < 0.5 ? -0.3 : 0.3) : 0
      const dist = 28 + r() * 80
      const x = Math.cos(a + side) * dist
      const z = Math.sin(a + side) * dist - 4
      // mostly under the horizon so the sky stays open, with the odd tall one
      const top = dist < 48 ? -22 + r() * 14 : r() < 0.12 ? 2 + r() * 12 : -16 + r() * 18
      front.push(add(r, x, z, 5 + r() * 9, 5 + r() * 9, top))
    }
    // the far skyline: a dense band of towers
    for (let i = 0; i < 90; i++) {
      const a = Math.PI * (-0.08 + r() * 1.16) + Math.PI
      const dist = 120 + r() * 70
      add(r, Math.cos(a) * dist, Math.sin(a) * dist, 7 + r() * 12, 7 + r() * 12, r() < 0.15 ? 14 + r() * 16 : -8 + r() * 22)
    }
    // and the half behind the camera, so photo mode can look all the way round
    const rf = rng(77)
    for (let i = 0; i < 60; i++) {
      const a = Math.PI * (0.02 + rf() * 0.96)
      const dist = 30 + rf() * 80
      const top = dist < 48 ? -22 + rf() * 14 : rf() < 0.15 ? 2 + rf() * 14 : -16 + rf() * 20
      add(rf, Math.cos(a) * dist, Math.sin(a) * dist + 6, 5 + rf() * 9, 5 + rf() * 9, top)
    }
    for (let i = 0; i < 70; i++) {
      const a = Math.PI * (0.08 + rf() * 0.84)
      const dist = 120 + rf() * 70
      add(rf, Math.cos(a) * dist, Math.sin(a) * dist, 7 + rf() * 12, 7 + rf() * 12, rf() < 0.15 ? 14 + rf() * 16 : -8 + rf() * 22)
    }

    // signs on the buildings in view: blade signs down the upper floors,
    // billboards on frames on the roofs
    const signGeos = []
    const rs = rng(5)
    for (const b of front) {
      if (b.top < -13 || b.z > -14) continue
      const roll = rs()
      if (roll < 0.4 && b.top > -6) {
        const i = Math.floor(rs() * BLADES.length)
        const lx = (rs() < 0.5 ? -1 : 1) * (b.w / 2 - 1.1)
        const y = b.top - 3.4 - rs() * 2
        parts.push({ g: onFace(new BoxGeometry(1.5, 5.6, 0.2), b, lx, y, 0.1), s: 0.5, plain: 1 })
        signGeos.push(onFace(tilePlane(1.3, 5.2, i / 8, 0.5, (i + 1) / 8, 1), b, lx, y, 0.22))
      } else if (roll < 0.85 && b.w > 5) {
        const j = Math.floor(rs() * 4)
        const bw = Math.min(b.w * 0.8, 8)
        const bh = bw / 2
        const y = b.top + 1.2 + bh / 2
        const lz = -b.d / 2 + 1.5
        for (const sx of [-0.35, 0.35]) parts.push({ g: onFace(new BoxGeometry(0.2, bh + 1.2, 0.2), b, sx * bw, b.top + (bh + 1.2) / 2, lz), s: 0.5, plain: 1 })
        parts.push({ g: onFace(new BoxGeometry(bw + 0.3, bh + 0.3, 0.25), b, 0, y, lz + 0.1), s: 0.5, plain: 1 })
        const v1 = 1 - (512 + Math.floor(j / 2) * 256) / 1024
        signGeos.push(onFace(tilePlane(bw, bh, (j % 2) * 0.5, v1 - 0.25, (j % 2) * 0.5 + 0.5, v1), b, 0, y, lz + 0.24))
      }
    }

    // the building we're standing on, and the one carrying the big sign
    const W = ROOF.x * 2 + 0.6
    const D = ROOF.front - ROOF.back + 0.6
    parts.push({ g: box(W, 40, D, 0, -20.2, (ROOF.front + ROOF.back) / 2), s: seeds() })
    // tall enough that the sign hangs on its face, not above the roofline
    parts.push({ g: box(12, 76, 8, -13, -22, -58), s: 0.4 })

    const flat = parts.map(({ g, s, plain = 0 }) => {
      const f = g.toNonIndexed()
      const n = f.attributes.position.count
      f.setAttribute('bseed', new BufferAttribute(new Float32Array(n).fill(s), 1))
      f.setAttribute('plain', new BufferAttribute(new Float32Array(n).fill(plain), 1))
      return f
    })
    return { geometry: mergeGeometries(flat), beacons: mergeGeometries(lights), signs: mergeGeometries(signGeos) }
  }, [])

  return (
    <group>
      <mesh geometry={geometry} material={cityMaterial} />
      <Beacons geometry={beacons} />
      <Signs geometry={signs} />
      <BigSign />
      {/* right of centre, behind the portals, next to the moon: in view from the start */}
      <Tower position={[29, -40, -115]} scale={0.55} />
    </group>
  )
}

// Shop signs glow at night and sit back to plain printed boards by day
function Signs({ geometry }) {
  const material = useMemo(() => {
    const m = new MeshBasicNodeMaterial({ toneMapped: false })
    m.colorNode = texture(signAtlas(), uv()).rgb.mul(mix(0.55, 1.1, U.windows))
    return m
  }, [])
  return <mesh geometry={geometry} material={material} />
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

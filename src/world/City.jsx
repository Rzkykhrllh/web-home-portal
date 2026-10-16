import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, BufferAttribute, Color, DoubleSide, CylinderGeometry, Euler, Matrix4, MeshBasicMaterial, MeshBasicNodeMaterial, MeshStandardNodeMaterial, PlaneGeometry, IcosahedronGeometry, LineBasicMaterial, Float32BufferAttribute, BufferGeometry, Quaternion, SphereGeometry, Vector3 } from 'three/webgpu'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { attribute, color, dot, floor, fract, hash, mix, normalWorld, positionLocal, positionWorld, select, step, texture, uv, vec2, vec3 } from 'three/tsl'
import { ROOF } from '../config.js'
import { SANS, canvasTexture, rng } from './canvasTexture.js'
import { U } from './Atmosphere.jsx'

// Flat illustrated city, like a vector or pixel-art poster: no realistic
// lighting, just three tones per colour (roof, sunny side, shaded side) from
// a fixed illustrator's light at the upper left. Every building, trim, tank
// and railing shares this one unlit material and one merged mesh; a `kind`
// attribute picks the colour family and a per-building seed picks the
// palette and the window pattern.
const L = vec3(-0.53, 0.73, 0.44)

const BODY = ['#c75a4a', '#7e2438', '#e8dccb', '#b9b4ae', '#a7c4b5', '#9aa6c8', '#d9a066', '#c8bfd8', '#efece4']
const pick = (list, t) => {
  let c = color(list[list.length - 1])
  for (let i = list.length - 2; i >= 0; i--) c = select(t.lessThan((i + 1) / list.length), color(list[i]), c)
  return c
}

export const cityMaterial = (() => {
  const m = new MeshBasicNodeMaterial()
  const n = normalWorld
  const seed = attribute('bseed', 'float')
  const kind = attribute('kind', 'float')
  const fh = attribute('fh', 'float')
  const ndl = dot(n, L)
  const top = step(0.5, n.y)
  const strong = step(0.5, ndl).mul(top.oneMinus())
  const shade = step(ndl, 0.1).mul(top.oneMinus())
  const wall = top.oneMinus()

  // colour family: 0 body, 1 trim, 2 metal, 3 green rail, 4 rust tank, 5 plant, 6 glass tower
  const body = pick(BODY, fract(seed.mul(9.17)))
  const base = select(
    kind.lessThan(0.5),
    body,
    select(kind.lessThan(1.5), color('#f1e9dd'), select(kind.lessThan(2.5), color('#4a5068'), select(kind.lessThan(3.5), color('#4f9a62'), select(kind.lessThan(4.5), color('#a0583c'), select(kind.lessThan(5.5), color('#6aa84f'), color('#8fa8d0')))))),
  )
  const roofCol = select(kind.lessThan(0.5), color('#cfc8bf'), base.mul(1.12))

  // windows on the walls of ordinary buildings
  const isBody = step(kind, 0.5).mul(wall)
  const along = positionWorld.x.mul(n.z.negate()).add(positionWorld.z.mul(n.x))
  const cellW = mix(1.0, 1.8, fract(seed.mul(7.13)))
  const cell = vec2(along.div(cellW), positionWorld.y.div(fh))
  const id = floor(cell)
  const f = fract(cell)
  const inBox = (x0, x1, y0, y1) => step(x0, f.x).mul(step(f.x, x1)).mul(step(y0, f.y)).mul(step(f.y, y1))
  const frame = inBox(0.18, 0.82, 0.22, 0.78).mul(isBody)
  const pane = inBox(0.24, 0.76, 0.3, 0.72).mul(isBody)
  const slab = step(f.y, 0.07).mul(isBody)
  const rnd = hash(id.x.mul(17.1).add(id.y.mul(311.7)).add(seed.mul(37.0)))
  const glint = step(fract(f.x.add(f.y.mul(0.6)).add(rnd)), 0.22)
  const glassCol = select(rnd.greaterThan(0.82), color('#e8dcc4'), mix(color('#2f4468'), color('#6f8fc4'), glint))
  // glass towers: curtain wall with vertical mullions and a diagonal sheen
  const isGlass = step(5.5, kind).mul(wall)
  const mull = step(0.9, fract(along.div(1.4)))
  const sheen = step(0.7, fract(positionWorld.y.mul(0.04).add(along.mul(0.02)).add(seed)))
  const curtain = mix(mix(color('#7f9cc8'), color('#b8cbe6'), sheen), color('#5a6e96'), mull)

  const wallCol = mix(mix(base.mul(mix(1, 0.88, slab)), color('#f1e9dd'), frame), glassCol, pane)
  const lit = select(isGlass.greaterThan(0.5), curtain, wallCol)
  // sunny side a touch warmer, shaded side darker and bluer, roofs pale
  const strongCol = lit.mul(1.08).add(color('#1a0e00').mul(0.6))
  const shadeCol = mix(lit.mul(0.6), color('#3a3f80'), 0.22)
  const flat = select(top.greaterThan(0.5), roofCol, select(strong.greaterThan(0.5), strongCol, select(shade.greaterThan(0.5), shadeCol, lit)))

  // night: the poster goes dark blue, lights come on in some windows
  const light = U.day.max(U.sun.mul(0.6))
  const night = U.far.mul(1.05).add(0.015)
  const dusk = mix(vec3(1), U.hor, light.oneMinus().mul(0.35).mul(strong.add(0.5).min(1)))
  const shaded = flat.mul(mix(night, dusk, light))
  const block = floor(along.div(9))
  const floorLit = hash(id.y.mul(13.7).add(block.mul(71.3)).add(seed.mul(91.0)))
  const on = step(rnd, mix(0.05, 0.65, step(0.45, floorLit))).mul(pane)
  const warm = select(fract(rnd.mul(7.0)).lessThan(0.7), color('#ffcf7a'), color('#ffa860'))
  const glassNight = isGlass.mul(step(0.55, hash(floor(along.div(1.4)).add(floor(positionWorld.y.div(2.4)).mul(57.0)).add(seed)))).mul(0.6)
  m.colorNode = shaded.add(warm.mul(on.add(glassNight)).mul(1.25).mul(U.windows))
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

// The city round the roof, drawn like a poster: low neighbours close in
// at about our height so their clutter reads (coping, balconies with green
// railings, AC units, tanks, antennas, rooftop plants), power lines sagging
// between them, taller blocks further out, and a pale skyline of towers that
// the haze turns lavender. Plus shop signs and one big sign.
export default function City() {
  const { geometry, beacons, signs, wires } = useMemo(() => {
    const parts = []
    const lights = []
    const anchors = []
    const seeds = rng(7)
    const push = (g, s, kind = 0, fh = 2.4) => parts.push({ g, s, kind, fh })
    // place a geometry relative to a building: lx along its front, lz out of it
    const at = (g, b, lx, y, lz) => {
      const c = Math.cos(b.rot)
      const sn = Math.sin(b.rot)
      g.rotateY(b.rot)
      g.translate(b.x + lx * c + lz * sn, y, b.z - lx * sn + lz * c)
      return g
    }

    const add = (r, x, z, w, d, top, { detail = false, glass = false } = {}) => {
      const s = seeds()
      const rot = (r() - 0.5) * 0.2
      const fh = 2.0 + r() * 0.9
      const h = top + 60
      const b = { x, z, w, d, top, rot, fh, s }
      push(box(w, h, d, x, top - h / 2, z, rot), s, glass ? 6 : 0, fh)
      // white coping round the roof edge, the poster's signature highlight
      push(box(w + 0.3, 0.35, d + 0.3, x, top + 0.17, z, rot), s, 1)
      if (glass) {
        if (top > 12) lights.push(new SphereGeometry(0.35, 8, 6).translate(x, top + 0.8, z))
        return b
      }
      if (!detail) return b
      const rail = r() < 0.6 ? 3 : 1
      if (r() < 0.45) {
        // apartment block: a balcony on every floor, green or white rails
        const floors = Math.min(6, Math.floor((top + 14) / fh))
        for (let k = 1; k <= floors; k++) {
          const y = top - k * fh + 0.05
          push(at(new BoxGeometry(w * 0.86, 0.14, 0.8), b, 0, y, d / 2 + 0.4), s, 1)
          push(at(new BoxGeometry(w * 0.86, 0.6, 0.05), b, 0, y + 0.37, d / 2 + 0.78), s, rail)
          if (r() < 0.6) push(at(new BoxGeometry(0.7, 0.5, 0.35), b, (r() - 0.5) * w * 0.7, y + 0.32, d / 2 + 0.45), s, 1)
        }
      } else {
        // offices and shops: AC units hung on the wall and a drainpipe
        const nAc = 2 + Math.floor(r() * 5)
        for (let k = 0; k < nAc; k++) {
          const y = top - (1 + Math.floor(r() * 5)) * fh + 0.35
          push(at(new BoxGeometry(0.75, 0.55, 0.32), b, (r() - 0.5) * (w - 1.2), y, d / 2 + 0.16), s, 1)
        }
        push(at(new BoxGeometry(0.14, 14, 0.14), b, w / 2 - 0.3, top - 7, d / 2 + 0.08), s, 2)
      }
      // the roof: stair hut, water tank on legs, antennas, plants, a railing
      const roof = top + 0.35
      if (r() < 0.4) {
        const hw = Math.min(2.4, w * 0.35)
        const lx = (r() - 0.5) * (w - hw) * 0.6
        push(at(new BoxGeometry(hw, 2.2, hw), b, lx, roof + 1.1, -d * 0.15), s, 0, fh)
        push(at(new BoxGeometry(hw + 0.2, 0.2, hw + 0.2), b, lx, roof + 2.3, -d * 0.15), s, 1)
      }
      if (r() < 0.5) {
        const tr = 0.6 + r() * 0.5
        const th = 1.1 + r() * 0.8
        const lx = (r() - 0.5) * (w - 2.5)
        const lz = (r() - 0.5) * (d - 2.5)
        for (const [ox, oz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) push(at(new BoxGeometry(0.08, 0.9, 0.08), b, lx + ox * tr, roof + 0.45, lz + oz * tr), s, 2)
        push(at(new CylinderGeometry(tr, tr, th, 10), b, lx, roof + 0.9 + th / 2, lz), s, r() < 0.5 ? 4 : 1)
      }
      if (r() < 0.45) {
        const ah = 2.5 + r() * 3
        const lx = (r() - 0.5) * (w - 1)
        const lz = (r() - 0.5) * (d - 1)
        push(at(new CylinderGeometry(0.06, 0.08, ah, 5), b, lx, roof + ah / 2, lz), s, 2)
        push(at(new BoxGeometry(1.0, 0.06, 0.06), b, lx, roof + ah * 0.8, lz), s, 2)
        push(at(new BoxGeometry(0.18, 0.9, 0.18), b, lx + 0.25, roof + ah * 0.85, lz), s, 1)
        const p = at(new BoxGeometry(0.01, 0.01, 0.01), b, lx, roof + ah * 0.8, lz)
        p.computeBoundingBox()
        anchors.push(p.boundingBox.getCenter(new Vector3()))
      } else {
        // otherwise a short pole at the front corner carries the wires
        const lx = (r() < 0.5 ? -1 : 1) * (w / 2 - 0.3)
        push(at(new CylinderGeometry(0.07, 0.07, 2.2, 5), b, lx, roof + 1.1, d / 2 - 0.3), s, 2)
        const p = at(new BoxGeometry(0.01, 0.01, 0.01), b, lx, roof + 2.0, d / 2 - 0.3)
        p.computeBoundingBox()
        anchors.push(p.boundingBox.getCenter(new Vector3()))
      }
      const nPlants = r() < 0.5 ? 1 + Math.floor(r() * 3) : 0
      for (let k = 0; k < nPlants; k++) {
        const pr = 0.35 + r() * 0.45
        const g = new IcosahedronGeometry(pr, 0)
        g.scale(1, 0.8, 1)
        push(at(g, b, (r() - 0.5) * (w - 1), roof + pr * 0.6, d / 2 - 0.6), s, 5)
      }
      if (r() < 0.3) push(at(new BoxGeometry(w * 0.9, 0.06, 0.06), b, 0, roof + 0.8, d / 2 - 0.15), s, rail)
      return b
    }

    const front = []
    const r = rng(42)
    // the train runs across the front at z = -26: keep that strip clear
    const clearOfTrain = (x, z) => !(z > -33 && z < -19) && !(z > -33 && Math.abs(x) < 15)
    // close neighbours either side, a little above and below our roof
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const w = 6 + r() * 5
        const x = side * (17 + w / 2 + r() * 4 + (i % 2) * 8)
        const z = 10 - i * 9 - r() * 3
        if (!clearOfTrain(x, z)) continue
        front.push(add(r, x, z, w, 6 + r() * 4, -6 + r() * 8, { detail: true }))
      }
    }
    // the near ring in front, just beyond the train
    for (let i = 0; i < 70; i++) {
      const a = Math.PI * (1.04 + r() * 0.92)
      const dist = 34 + r() * 50
      const x = Math.cos(a) * dist
      const z = Math.sin(a) * dist - 4
      if (!clearOfTrain(x, z)) continue
      const top = r() < 0.1 ? 1 + r() * 6 : -11 + r() * 8
      front.push(add(r, x, z, 6 + r() * 7, 6 + r() * 7, top, { detail: dist < 70 }))
    }
    // a taller mid ring
    for (let i = 0; i < 50; i++) {
      const a = Math.PI * (1.0 + r() * 1.0)
      const dist = 85 + r() * 35
      add(r, Math.cos(a) * dist, Math.sin(a) * dist, 8 + r() * 10, 8 + r() * 10, -8 + r() * 12)
    }
    // the far skyline: towers, some of them glass, pale in the haze
    for (let i = 0; i < 90; i++) {
      const a = Math.PI * (0.92 + r() * 1.16)
      const dist = 130 + r() * 65
      const top = r() < 0.25 ? 12 + r() * 18 : -2 + r() * 12
      add(r, Math.cos(a) * dist, Math.sin(a) * dist, 8 + r() * 12, 8 + r() * 12, top, { glass: r() < 0.4 })
    }
    // the half behind the camera, so photo mode can look all the way round
    const rf = rng(77)
    for (let i = 0; i < 45; i++) {
      const a = Math.PI * (0.04 + rf() * 0.92)
      const dist = 30 + rf() * 55
      const z = Math.sin(a) * dist + 10
      add(rf, Math.cos(a) * dist, Math.max(z, 28), 6 + rf() * 7, 6 + rf() * 7, -8 + rf() * 11, { detail: dist < 60 })
    }
    for (let i = 0; i < 70; i++) {
      const a = Math.PI * (0.08 + rf() * 0.84)
      const dist = 120 + rf() * 70
      add(rf, Math.cos(a) * dist, Math.sin(a) * dist, 8 + rf() * 12, 8 + rf() * 12, rf() < 0.25 ? 14 + rf() * 18 : 2 + rf() * 14, { glass: rf() < 0.35 })
    }

    // power lines: two sagging wires between nearby poles and antennas
    const wirePts = []
    const sorted = anchors.filter((p) => p.z < 0 || Math.abs(p.x) > 15).sort((p, q) => Math.atan2(p.z, p.x) - Math.atan2(q.z, q.x))
    for (let i = 0; i < sorted.length - 1; i++) {
      const p = sorted[i]
      const q = sorted[i + 1]
      const len = p.distanceTo(q)
      if (len > 34 || len < 4) continue
      for (const dy of [0, -0.35]) {
        const sag = len * 0.06
        for (let k = 0; k < 12; k++) {
          for (const t of [k / 12, (k + 1) / 12]) {
            wirePts.push(p.x + (q.x - p.x) * t, p.y + dy + (q.y - p.y) * t - sag * 4 * t * (1 - t), p.z + (q.z - p.z) * t)
          }
        }
      }
    }
    const wires = new BufferGeometry()
    wires.setAttribute('position', new Float32BufferAttribute(wirePts, 3))

    // signs on the buildings in view: blade signs down the upper floors,
    // billboards on frames on the roofs
    const signGeos = []
    const rs = rng(5)
    for (const b of front) {
      if (b.z > -30) continue
      const roll = rs()
      if (roll < 0.35) {
        const i = Math.floor(rs() * BLADES.length)
        const lx = (rs() < 0.5 ? -1 : 1) * (b.w / 2 - 1.1)
        const y = b.top - 3.2
        push(onFace(new BoxGeometry(1.5, 5.6, 0.2), b, lx, y, 0.1), 0.5, 2)
        signGeos.push(onFace(tilePlane(1.3, 5.2, i / 8, 0.5, (i + 1) / 8, 1), b, lx, y, 0.22))
      } else if (roll < 0.47 && b.w > 6) {
        const j = Math.floor(rs() * 4)
        const bw = Math.min(b.w * 0.8, 7)
        const bh = bw / 2
        const y = b.top + 1.4 + bh / 2
        const lz = -b.d / 2 + 1.5
        for (const sx of [-0.35, 0.35]) push(onFace(new BoxGeometry(0.15, bh + 1.4, 0.15), b, sx * bw, b.top + (bh + 1.4) / 2, lz), 0.5, 2)
        push(onFace(new BoxGeometry(bw + 0.3, bh + 0.3, 0.25), b, 0, y, lz + 0.1), 0.5, 1)
        const v1 = 1 - (512 + Math.floor(j / 2) * 256) / 1024
        signGeos.push(onFace(tilePlane(bw, bh, (j % 2) * 0.5, v1 - 0.25, (j % 2) * 0.5 + 0.5, v1), b, 0, y, lz + 0.24))
      }
    }

    // the building we're standing on, and the one carrying the big sign
    const W = ROOF.x * 2 + 0.6
    const D = ROOF.front - ROOF.back + 0.6
    push(box(W, 40, D, 0, -20.2, (ROOF.front + ROOF.back) / 2), 0.35, 0, 2.6)
    push(box(12, 76, 8, -13, -22, -58), 0.12, 0, 2.4)
    push(box(12.3, 0.35, 8.3, -13, 16.17, -58), 0.12, 1)

    const flat = parts.map(({ g, s, kind, fh }) => {
      const f = g.index ? g.toNonIndexed() : g
      const n = f.attributes.position.count
      f.setAttribute('bseed', new BufferAttribute(new Float32Array(n).fill(s), 1))
      f.setAttribute('kind', new BufferAttribute(new Float32Array(n).fill(kind), 1))
      f.setAttribute('fh', new BufferAttribute(new Float32Array(n).fill(fh), 1))
      if (!f.attributes.uv) f.setAttribute('uv', new BufferAttribute(new Float32Array(n * 2), 2))
      return f
    })
    return { geometry: mergeGeometries(flat), beacons: mergeGeometries(lights), signs: mergeGeometries(signGeos), wires }
  }, [])

  const wireMat = useMemo(() => new LineBasicMaterial({ color: '#1c2236' }), [])
  return (
    <group>
      <mesh geometry={geometry} material={cityMaterial} />
      <lineSegments geometry={wires} material={wireMat} />
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

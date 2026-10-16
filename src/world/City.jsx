import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { BoxGeometry, BufferAttribute, Color, DoubleSide, CylinderGeometry, Euler, Matrix4, MeshBasicMaterial, MeshBasicNodeMaterial, MeshStandardNodeMaterial, PlaneGeometry, IcosahedronGeometry, ConeGeometry, LineBasicMaterial, Float32BufferAttribute, BufferGeometry, Quaternion, SphereGeometry, Vector3 } from 'three/webgpu'
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

// how much daylight the poster gets, and its night colour (shared with the rooftop)
export const posterDay = U.day.max(U.sun.mul(0.6))
export const posterNight = U.far.mul(1.05).add(0.015)
export const posterLight = mix(posterNight, vec3(1), posterDay)

// Give any geometry the attributes cityMaterial reads. Faces get no windows
// unless the geometry already carries a layout (see bodyBox).
export function posterize(g, kind = 0, seed = 0.35, fh = 2.4) {
  const f = g.index ? g.toNonIndexed() : g
  const n = f.attributes.position.count
  const fill = (name, size, v) => f.setAttribute(name, new BufferAttribute(new Float32Array(n * size).fill(v), size))
  fill('bseed', 1, seed)
  fill('kind', 1, kind)
  fill('fh', 1, fh)
  if (!f.attributes.lpos) fill('lpos', 3, 0)
  if (!f.attributes.face) fill('face', 1, 2)
  if (!f.attributes.span) fill('span', 1, 0)
  if (!f.attributes.uv) fill('uv', 2, 0)
  return f
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

  // colour family: 0 body, 1 trim, 2 metal, 3 green rail, 4 rust/wood, 5 plant, 6 glass tower,
  // 7 vermilion, 8 roof tile, 9 stone, 10 dark green
  const body = pick(BODY, fract(seed.mul(9.17)))
  const base = select(
    kind.lessThan(0.5),
    body,
    select(kind.lessThan(1.5), color('#f1e9dd'), select(kind.lessThan(2.5), color('#4a5068'), select(kind.lessThan(3.5), color('#4f9a62'), select(kind.lessThan(4.5), color('#a0583c'), select(kind.lessThan(5.5), color('#6aa84f'), select(kind.lessThan(6.5), color('#8fa8d0'), select(kind.lessThan(7.5), color('#d8452e'), select(kind.lessThan(8.5), color('#3d4458'), select(kind.lessThan(9.5), color('#a59e94'), color('#3f7a4a')))))))))),
  )
  const roofCol = select(kind.lessThan(0.5), color('#cfc8bf'), base.mul(1.12))

  // windows on the walls of ordinary buildings
  // Windows are laid out on each face of each building, in its own frame:
  // a whole number of columns centred on the face with a margin at the
  // corners, and floors counted down from just under the roof, so nothing
  // is ever cut in half at an edge.
  const lp = attribute('lpos', 'vec3')
  const face = attribute('face', 'float') // 0 front/back, 1 sides, 2 no windows
  const span = attribute('span', 'float')
  const along = select(face.lessThan(0.5), lp.x, lp.z)
  const usable = span.sub(1.0).max(0.5)
  const cols = floor(usable.div(mix(1.0, 1.8, fract(seed.mul(7.13))))).max(1)
  const u = along.add(usable.mul(0.5)).div(usable.div(cols))
  const v = lp.y.negate().sub(0.75).div(fh)
  const inside = step(0, u).mul(step(u, cols)).mul(step(0, v))
  const isBody = step(kind, 0.5).mul(step(face, 1.5)).mul(wall).mul(inside)
  const id = vec2(floor(u), floor(v))
  const f = vec2(fract(u), fract(v).oneMinus())
  const inBox = (x0, x1, y0, y1) => step(x0, f.x).mul(step(f.x, x1)).mul(step(y0, f.y)).mul(step(f.y, y1))
  const frame = inBox(0.16, 0.84, 0.22, 0.8).mul(isBody)
  const pane = inBox(0.22, 0.78, 0.3, 0.74).mul(isBody)
  const slab = step(f.y, 0.07).mul(isBody)
  const rnd = hash(id.x.mul(17.1).add(id.y.mul(311.7)).add(seed.mul(37.0)))
  const glint = step(fract(f.x.add(f.y.mul(0.6)).add(rnd)), 0.22)
  const glassCol = select(rnd.greaterThan(0.82), color('#e8dcc4'), mix(color('#2f4468'), color('#6f8fc4'), glint))
  // glass towers: curtain wall with vertical mullions and a diagonal sheen
  const isGlass = step(5.5, kind).mul(step(kind, 6.5)).mul(wall)
  const gAlong = positionWorld.x.mul(n.z.negate()).add(positionWorld.z.mul(n.x))
  const mull = step(0.9, fract(gAlong.div(1.4)))
  const sheen = step(0.7, fract(positionWorld.y.mul(0.04).add(gAlong.mul(0.02)).add(seed)))
  const curtain = mix(mix(color('#7f9cc8'), color('#b8cbe6'), sheen), color('#5a6e96'), mull)

  const wallCol = mix(mix(base.mul(mix(1, 0.88, slab)), color('#f1e9dd'), frame), glassCol, pane)
  // stone (kind 9) walls: coursed blocks, staggered every other row
  const isStone = step(8.5, kind).mul(step(kind, 9.5)).mul(wall)
  const row = positionWorld.y.div(0.7)
  const stag = fract(gAlong.div(1.3).add(floor(row).mul(0.5)))
  const mortar = step(fract(row), 0.1).max(step(stag, 0.06)).mul(isStone)
  const stoneTone = mix(1.0, 0.9, step(0.5, hash(floor(row).add(floor(gAlong.div(1.3).add(floor(row).mul(0.5))).mul(13.0))))).mul(isStone).add(isStone.oneMinus())
  const masonry = mix(wallCol.mul(stoneTone), wallCol.mul(0.62), mortar)
  const lit = select(isGlass.greaterThan(0.5), curtain, masonry)
  // sunny side a touch warmer, shaded side darker and bluer, roofs pale
  const strongCol = lit.mul(1.08).add(color('#1a0e00').mul(0.6))
  const shadeCol = mix(lit.mul(0.6), color('#3a3f80'), 0.22)
  const flat = select(top.greaterThan(0.5), roofCol, select(strong.greaterThan(0.5), strongCol, select(shade.greaterThan(0.5), shadeCol, lit)))

  // night: the poster goes dark blue, lights come on in some windows
  const light = posterDay
  const night = posterNight
  const dusk = mix(vec3(1), U.hor, light.oneMinus().mul(0.35).mul(strong.add(0.5).min(1)))
  const shaded = flat.mul(mix(night, dusk, light))
  const block = floor(id.x.div(4))
  const floorLit = hash(id.y.mul(13.7).add(block.mul(71.3)).add(seed.mul(91.0)))
  const on = step(rnd, mix(0.05, 0.65, step(0.45, floorLit))).mul(pane)
  const warm = select(fract(rnd.mul(7.0)).lessThan(0.7), color('#ffcf7a'), color('#ffa860'))
  const glassNight = isGlass.mul(step(0.55, hash(floor(gAlong.div(1.4)).add(floor(positionWorld.y.div(2.4)).mul(57.0)).add(seed)))).mul(0.6)
  m.colorNode = shaded.add(warm.mul(on.add(glassNight)).mul(1.25).mul(U.windows))
  return m
})()

const box = (w, h, d, x, y, z, rot = 0) => {
  const g = new BoxGeometry(w, h, d)
  g.applyMatrix4(new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(new Euler(0, rot, 0)), new Vector3(1, 1, 1)))
  return g
}

// A building body with its top at `top`: every vertex remembers where it
// sits on its own building (lpos, relative to the top centre), which face
// it is on, and how wide that face is, for the window layout in the shader.
const bodyBox = (w, h, d, x, top, z, rot = 0) => {
  const g = new BoxGeometry(w, h, d).translate(0, -h / 2, 0).toNonIndexed()
  const pos = g.attributes.position
  const nor = g.attributes.normal
  const n = pos.count
  const face = new Float32Array(n)
  const span = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const ax = Math.abs(nor.getX(i))
    const ay = Math.abs(nor.getY(i))
    face[i] = ay > 0.5 ? 2 : ax > 0.5 ? 1 : 0
    span[i] = ax > 0.5 ? d : w
  }
  g.setAttribute('lpos', new BufferAttribute(new Float32Array(pos.array), 3))
  g.setAttribute('face', new BufferAttribute(face, 1))
  g.setAttribute('span', new BufferAttribute(span, 1))
  g.applyMatrix4(new Matrix4().compose(new Vector3(x, top, z), new Quaternion().setFromEuler(new Euler(0, rot, 0)), new Vector3(1, 1, 1)))
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

// A small shrine on a hill across the tracks, front left: a stone-walled
// mound, a vermilion torii, a stone path with lanterns, a white-walled hall
// under a tiered tile roof, a five-storey pagoda, and trees round it all.
// Built from the same poster kinds so it shares the city's one draw call;
// only the lantern lights are a separate mesh (they glow at night).
const SHRINE = { x: -24, z: -42, g: -2 }
// street level: the asphalt every building and the shrine hill stands on
export const STREET = -16
const SQ = Math.SQRT2
// a square frustum / pyramid, scaled to w x d at the bottom
const hipRoof = (w, h, d, topScale, x, y, z) =>
  new CylinderGeometry(topScale, 1, 1, 4, 1).rotateY(Math.PI / 4).scale(w / SQ, h, d / SQ).translate(x, y + h / 2, z)

function shrine(push, lanterns) {
  const { x: X, z: Z, g: G } = SHRINE
  const at = (geo, x, y, z) => geo.translate(X + x, y, Z + z)
  // the hill: a battered stone wall (ishigaki), wider at the foot, standing
  // on a plinth that runs down out of sight, with grass along the top edge
  const HW = 20
  const HD = 16
  const wallH = G - STREET
  push(hipRoof(HW / 0.78, wallH, HD / 0.78, 0.78, X, G - wallH, Z), 0.5, 9)
  push(at(new BoxGeometry(HW / 0.78 + 1, 60, HD / 0.78 + 1), 0, G - wallH - 30, 0), 0.5, 9)
  push(at(new BoxGeometry(HW + 0.2, 0.25, HD + 0.2), 0, G + 0.02, 0), 0.5, 5)
  // long flight of steps down the front, with red handrails on posts
  // all the way down to the street at the foot of the hill
  const steps = Math.round(wallH / 0.5)
  for (let i = 0; i < steps; i++) {
    // each step is solid down to the foot of the hill, so the flight reads as built
    const topY = G - i * 0.5
    const h = topY - (G - wallH)
    push(at(new BoxGeometry(3, h, 0.6), 2, topY - h / 2, HD / 2 - 0.2 + i * 0.55), 0.5, 1)
  }
  for (const sx of [-1.65, 1.65]) {
    for (let i = 0; i <= steps; i += 4) push(at(new BoxGeometry(0.1, 0.9, 0.1), 2 + sx, G - i * 0.5 + 0.2, HD / 2 - 0.2 + i * 0.55), 0.5, 7)
    const len = Math.hypot(steps * 0.55, steps * 0.5)
    const rail = new BoxGeometry(0.1, 0.1, len).rotateX(Math.atan2(0.5, 0.55))
    push(at(rail, 2 + sx, G + 0.65 - (steps * 0.5) / 2, HD / 2 - 0.2 + (steps * 0.55) / 2), 0.5, 7)
  }
  // precinct wall: white plaster under a tile cap, open at the torii
  const pw = (w, d, x, z) => {
    push(at(new BoxGeometry(w, 1.1, d), x, G + 0.55, z), 0.5, 1)
    push(at(new BoxGeometry(w + 0.3, 0.22, d + 0.3), x, G + 1.2, z), 0.5, 8)
  }
  pw(HW - 0.6, 0.3, 0, -HD / 2 + 0.4)
  pw(0.3, HD - 0.8, -HW / 2 + 0.4, 0)
  pw(0.3, HD - 0.8, HW / 2 - 0.4, 0)
  pw(HW / 2 - 2.6, 0.3, -HW / 4 - 0.4, HD / 2 - 0.4)
  pw(HW / 2 - 4.6, 0.3, HW / 4 + 2.6, HD / 2 - 0.4)
  // stone path from the torii to the hall
  push(at(new BoxGeometry(1.8, 0.12, 9), 2, G + 0.06, 2.5), 0.5, 1)

  // torii at the top of the steps
  const tz = 6.8
  for (const sx of [-1.7, 1.7]) push(at(new CylinderGeometry(0.22, 0.26, 4, 10), 2 + sx, G + 2, tz), 0.5, 7)
  push(at(new BoxGeometry(5.6, 0.32, 0.55), 2, G + 4.25, tz), 0.5, 2)
  push(at(new BoxGeometry(5.0, 0.3, 0.45), 2, G + 3.95, tz), 0.5, 7)
  push(at(new BoxGeometry(4.2, 0.24, 0.26), 2, G + 3.25, tz), 0.5, 7)
  push(at(new BoxGeometry(0.5, 0.7, 0.12), 2, G + 3.6, tz + 0.12), 0.5, 2)

  // stone lanterns along the path
  for (const lz of [4.6, 1.2]) {
    for (const sx of [-1.6, 1.6]) {
      const lx = 2 + sx
      push(at(new BoxGeometry(0.6, 0.25, 0.6), lx, G + 0.12, lz), 0.5, 9)
      push(at(new CylinderGeometry(0.12, 0.14, 0.8, 6), lx, G + 0.65, lz), 0.5, 9)
      push(at(new BoxGeometry(0.62, 0.12, 0.62), lx, G + 1.1, lz), 0.5, 9)
      lanterns.push(at(new BoxGeometry(0.42, 0.4, 0.42), lx, G + 1.36, lz))
      push(at(hipRoof(0.9, 0.35, 0.9, 0.05, 0, 0, 0), lx, G + 1.56, lz), 0.5, 9)
    }
  }

  // the hall: stone base, vermilion posts and beam, white walls, tiered roof
  const hx = 3
  const hz = -4
  push(at(new BoxGeometry(9, 0.6, 7), hx, G + 0.3, hz), 0.5, 9)
  push(at(new BoxGeometry(6.4, 2.6, 4.6), hx, G + 1.9, hz), 0.5, 1)
  for (const px of [-3.6, -1.2, 1.2, 3.6]) for (const pz of [-2.8, 2.8]) push(at(new CylinderGeometry(0.18, 0.18, 2.9, 8), hx + px, G + 2.05, hz + pz), 0.5, 7)
  push(at(new BoxGeometry(7.6, 0.32, 5.9), hx, G + 3.5, hz), 0.5, 7)
  lanterns.push(at(new BoxGeometry(1.6, 1.8, 0.1), hx, G + 1.6, hz + 2.33)) // the open doorway, lit inside
  // paper lanterns hanging under the front eave
  for (const sx of [-2.4, 2.4]) {
    lanterns.push(at(new CylinderGeometry(0.28, 0.28, 0.6, 10), hx + sx, G + 2.95, hz + 3.0))
    push(at(new BoxGeometry(0.04, 0.5, 0.04), hx + sx, G + 3.5, hz + 3.0), 0.5, 2)
  }
  push(at(new BoxGeometry(10.6, 0.22, 8.4), hx, G + 3.77, hz), 0.5, 8)
  push(hipRoof(10.4, 0.9, 8.2, 0.62, X + hx, G + 3.88, Z + hz), 0.5, 8)
  push(hipRoof(6.4, 1.7, 5.0, 0.0, X + hx, G + 4.78, Z + hz), 0.5, 8)
  push(at(new BoxGeometry(3.2, 0.32, 0.36), hx, G + 6.1, hz), 0.5, 8) // ridge
  for (const sx of [-1.7, 1.7]) push(at(new BoxGeometry(0.3, 0.55, 0.42), hx + sx, G + 6.3, hz), 0.5, 2)

  // five-storey pagoda at the back left
  const px = -6
  const pz = -3
  push(at(new BoxGeometry(5.6, 0.7, 5.6), px, G + 0.35, pz), 0.5, 9)
  let y = G + 0.7
  for (let i = 0; i < 5; i++) {
    const s = 4.4 - i * 0.55
    const bh = i === 0 ? 2.1 : 1.5
    push(at(new BoxGeometry(s * 0.66, bh, s * 0.66), px, y + bh / 2, pz), 0.5, 7)
    push(at(new BoxGeometry(s * 0.7, 0.18, s * 0.7), px, y + bh - 0.09, pz), 0.5, 1)
    push(hipRoof(s + 1.6, 0.55, s + 1.6, 0.55, X + px, y + bh, Z + pz), 0.5, 8)
    y += bh + 0.55
  }
  push(at(new CylinderGeometry(0.1, 0.16, 4, 6), px, y + 2, pz), 0.5, 2)
  for (let i = 0; i < 5; i++) push(at(new CylinderGeometry(0.32, 0.32, 0.1, 10), px, y + 0.6 + i * 0.5, pz), 0.5, 2)

  // trees: round broadleaf crowns in two greens and a few tall cedars
  const r = rng(61)
  const spots = [[-9, 6], [-8.5, -7.5], [8.5, 6.5], [8.6, -7], [-2, -7.6], [7, -1], [-9, 1], [5.5, 7]]
  for (const [tx, tz2] of spots) {
    if (r() < 0.4) {
      const h = 4 + r() * 2
      push(at(new BoxGeometry(0.25, 1, 0.25), tx, G + 0.5, tz2), 0.5, 4)
      push(at(new ConeGeometry(1.1, h, 7), tx, G + 1 + h / 2, tz2), 0.5, 10)
    } else {
      const cr = 1.3 + r() * 0.7
      push(at(new BoxGeometry(0.3, 1.6, 0.3), tx, G + 0.8, tz2), 0.5, 4)
      push(at(new IcosahedronGeometry(cr, 0).scale(1, 0.85, 1), tx, G + 1.6 + cr * 0.6, tz2), 0.5, 10)
      push(at(new IcosahedronGeometry(cr * 0.6, 0), tx + 0.3, G + 2.2 + cr, tz2 + 0.3), 0.5, 5)
    }
  }
}

function LanternLights({ geometry }) {
  const material = useMemo(() => {
    const m = new MeshBasicNodeMaterial({ toneMapped: false })
    m.colorNode = color('#ffc27a').mul(mix(0.45, 2.2, U.windows))
    return m
  }, [])
  return <mesh geometry={geometry} material={material} />
}

// The city round the roof, drawn like a poster: low neighbours close in
// at about our height so their clutter reads (coping, balconies with green
// railings, AC units, tanks, antennas, rooftop plants), power lines sagging
// between them, taller blocks further out, and a pale skyline of towers that
// the haze turns lavender. Plus shop signs and one big sign.
export default function City() {
  const { geometry, beacons, signs, wires, lanterns } = useMemo(() => {
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

    // footprints taken so far, so buildings never grow into each other
    const taken = [{ x: 0, z: (ROOF.front + ROOF.back) / 2, rad: 13 }, { x: -13, z: -58, rad: 7 }, { x: SHRINE.x, z: SHRINE.z, rad: 13 }]
    // Roof clutter for every building, sized to it: plant rooms, cooling
    // towers, water tanks on legs, ducts, lattice masts, a perimeter rail.
    // Items take different quarters of the roof so they don't pile up.
    const clutter = (r, b, cw, cd, t, s, rail, anchor) => {
      const k = Math.min(1.6, Math.max(0.6, Math.min(cw, cd) / 8))
      const roof = t + 0.35
      const slots = [[-0.25, -0.22], [0.25, -0.22], [-0.25, 0.22], [0.25, 0.22]].sort(() => r() - 0.5)
      let si = 0
      const slot = () => {
        const [sx, sz] = slots[si++ % 4]
        return [sx * cw, sz * cd]
      }
      if (r() < 0.6) {
        const [lx, lz] = slot()
        const pw = cw * (0.28 + r() * 0.2)
        const pd = cd * (0.28 + r() * 0.2)
        const ph = (2 + r() * 1.4) * k
        push(at(new BoxGeometry(pw, ph, pd), b, lx, roof + ph / 2, lz), s, 0)
        push(at(new BoxGeometry(pw + 0.25, 0.22, pd + 0.25), b, lx, roof + ph + 0.11, lz), s, 1)
        if (r() < 0.5) push(at(new BoxGeometry(pw + 0.04, ph * 0.3, pd + 0.04), b, lx, roof + ph * 0.55, lz), s, 2) // louvre band
      }
      if (r() < 0.3) {
        const [lx, lz] = slot()
        const cr = (0.7 + r() * 0.5) * k
        const ch = (1.2 + r() * 0.8) * k
        push(at(new CylinderGeometry(cr * 0.8, cr, ch, 12), b, lx, roof + ch / 2, lz), s, 1)
        push(at(new CylinderGeometry(cr * 0.82, cr * 0.82, 0.18, 12), b, lx, roof + ch, lz), s, 2)
      }
      if (r() < 0.5) {
        const [lx, lz] = slot()
        const tr = (0.55 + r() * 0.45) * k
        const th = (1.1 + r() * 0.8) * k
        const legs = 0.9 * k
        for (const [ox, oz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) push(at(new BoxGeometry(0.1, legs, 0.1), b, lx + ox * tr, roof + legs / 2, lz + oz * tr), s, 2)
        push(at(new CylinderGeometry(tr, tr, th, 12), b, lx, roof + legs + th / 2, lz), s, r() < 0.5 ? 4 : 1)
        push(at(new CylinderGeometry(tr * 0.3, tr, 0.3 * k, 12), b, lx, roof + legs + th + 0.15 * k, lz), s, 2)
      }
      if (r() < 0.45) {
        // a run of ducting across the roof
        const dz = (r() - 0.5) * cd * 0.5
        push(at(new BoxGeometry(cw * 0.7, 0.45 * k, 0.5 * k), b, 0, roof + 0.25 * k, dz), s, 2)
        push(at(new BoxGeometry(0.5 * k, 0.45 * k, cd * 0.4), b, cw * 0.3, roof + 0.25 * k, dz + cd * 0.2), s, 2)
      }
      let top = null
      if (r() < (t > 6 ? 0.6 : 0.4)) {
        // lattice mast with cross bars and panel antennas
        const [lx, lz] = slot()
        const ah = (3 + r() * 5) * k
        push(at(new CylinderGeometry(0.06, 0.12, ah, 5), b, lx, roof + ah / 2, lz), s, 2)
        for (const f of [0.55, 0.8]) push(at(new BoxGeometry(1.1 * k, 0.07, 0.07), b, lx, roof + ah * f, lz), s, 2)
        // panel antennas clamped to the ends of the upper cross bar
        push(at(new BoxGeometry(0.2, 0.9 * k, 0.16), b, lx + 0.5 * k, roof + ah * 0.8, lz), s, 1)
        push(at(new BoxGeometry(0.2, 0.9 * k, 0.16), b, lx - 0.5 * k, roof + ah * 0.8, lz), s, 1)
        if (t + ah > 8) {
          const p = at(new SphereGeometry(0.3, 8, 6), b, lx, roof + ah + 0.2, lz)
          lights.push(p)
        }
        top = [lx, roof + ah * 0.8, lz]
      }
      if (r() < 0.4) {
        // railing round the whole roof edge: posts standing on the roof,
        // a top rail and a mid rail between them
        const y = roof + 0.8
        const ex = cw / 2 - 0.15
        const ez = cd / 2 - 0.15
        for (const sz of [-1, 1]) {
          push(at(new BoxGeometry(cw - 0.3, 0.07, 0.07), b, 0, y, sz * ez), s, rail)
          push(at(new BoxGeometry(cw - 0.3, 0.05, 0.05), b, 0, y - 0.4, sz * ez), s, rail)
          const n = Math.max(2, Math.round((cw - 0.3) / 1.6))
          for (let i = 0; i <= n; i++) push(at(new BoxGeometry(0.07, 0.8, 0.07), b, -ex + (i / n) * ex * 2, roof + 0.4, sz * ez), s, rail)
        }
        for (const sx of [-1, 1]) {
          push(at(new BoxGeometry(0.07, 0.07, cd - 0.3), b, sx * ex, y, 0), s, rail)
          push(at(new BoxGeometry(0.05, 0.05, cd - 0.3), b, sx * ex, y - 0.4, 0), s, rail)
          const n = Math.max(2, Math.round((cd - 0.3) / 1.6))
          for (let i = 1; i < n; i++) push(at(new BoxGeometry(0.07, 0.8, 0.07), b, sx * ex, roof + 0.4, -ez + (i / n) * ez * 2), s, rail)
        }
      }
      if (anchor) {
        if (!top) {
          // otherwise a short pole at the front corner carries the wires
          const lx = (r() < 0.5 ? -1 : 1) * (cw / 2 - 0.3)
          push(at(new CylinderGeometry(0.07, 0.07, 2.2, 5), b, lx, roof + 1.1, cd / 2 - 0.3), s, 2)
          top = [lx, roof + 2.0, cd / 2 - 0.3]
        }
        const p = at(new BoxGeometry(0.01, 0.01, 0.01), b, ...top)
        p.computeBoundingBox()
        anchors.push(p.boundingBox.getCenter(new Vector3()))
      }
    }

    const add = (r, x, z, w, d, top, { detail = false, glass = false } = {}) => {
      const rad = Math.hypot(w, d) / 2
      // keep the line of sight from the roof to the tower low
      const tx = 29 / 126
      const lateral = Math.abs(x - tx * (11 - z)) - rad
      if (z < -10 && z > -105 && lateral < 6) top = Math.min(top, -7)
      if (taken.some((t) => Math.hypot(t.x - x, t.z - z) < (t.rad + rad) * 0.8)) return null
      taken.push({ x, z, rad })
      const s = seeds()
      const rot = (r() - 0.5) * 0.2
      const fh = 2.0 + r() * 0.9
      const h = top + 60
      const b = { x, z, w, d, top, rot, fh, s }
      push(bodyBox(w, h, d, x, top, z, rot), s, glass ? 6 : 0, fh)
      // white coping round the roof edge, the poster's signature highlight
      push(box(w + 0.3, 0.35, d + 0.3, x, top + 0.17, z, rot), s, 1)
      // taller buildings step back in one or two tiers, each with its coping
      let t = top
      let cw = w
      let cd = d
      // (not the close neighbours: they'd wall off the view)
      if (top > 2 && !detail && r() < 0.6) {
        const tiers = r() < 0.4 ? 2 : 1
        for (let i = 0; i < tiers; i++) {
          const nw = cw * (0.6 + r() * 0.2)
          const nd = cd * (0.6 + r() * 0.2)
          const ox = (r() - 0.5) * (cw - nw) * 0.6
          const th = fh * (1 + Math.floor(r() * 3))
          const c = Math.cos(rot)
          const sn = Math.sin(rot)
          const tb = { ...b, x: b.x + ox * c, z: b.z - ox * sn, w: nw, d: nd }
          push(bodyBox(nw, th, nd, tb.x, t + th, tb.z, rot), s, glass ? 6 : 0, fh)
          push(box(nw + 0.3, 0.35, nd + 0.3, tb.x, t + th + 0.17, tb.z, rot), s, 1)
          Object.assign(b, { x: tb.x, z: tb.z })
          cw = nw
          cd = nd
          t += th
        }
      }
      const rail = r() < 0.6 ? 3 : 1
      if (glass) {
        // glass towers: a dark crown band and a mast
        push(box(cw * 0.8, 1.6, cd * 0.8, b.x, t + 0.8, b.z, rot), s, 2)
        if (r() < 0.6) {
          const ah = 5 + r() * 8
          push(new CylinderGeometry(0.1, 0.25, ah, 5).translate(b.x, t + 1.6 + ah / 2, b.z), s, 2)
          lights.push(new SphereGeometry(0.4, 8, 6).translate(b.x, t + 1.8 + ah, b.z))
        }
        return { x, z, w, d, top, rot }
      }
      clutter(r, b, cw, cd, t, s, rail, detail)
      const base = { x, z, w, d, top, rot, fh, s }
      if (!detail) return base
      if (r() < 0.45) {
        // apartment block: a balcony on every floor, green or white rails
        const floors = Math.min(6, Math.floor((top + 14) / fh))
        for (let k = 1; k <= floors; k++) {
          const y = top - k * fh + 0.05
          push(at(new BoxGeometry(w * 0.86, 0.14, 0.8), base, 0, y, d / 2 + 0.4), s, 1)
          push(at(new BoxGeometry(w * 0.86, 0.6, 0.05), base, 0, y + 0.37, d / 2 + 0.78), s, rail)
          if (r() < 0.6) push(at(new BoxGeometry(0.7, 0.5, 0.35), base, (r() - 0.5) * w * 0.7, y + 0.32, d / 2 + 0.45), s, 1)
        }
      } else {
        // offices and shops: AC units hung on the wall and a drainpipe
        const nAc = 2 + Math.floor(r() * 5)
        for (let k = 0; k < nAc; k++) {
          const y = top - (1 + Math.floor(r() * 5)) * fh + 0.35
          push(at(new BoxGeometry(0.75, 0.55, 0.32), base, (r() - 0.5) * (w - 1.2), y, d / 2 + 0.16), s, 1)
        }
        push(at(new BoxGeometry(0.14, 14, 0.14), base, w / 2 - 0.3, top - 7, d / 2 + 0.08), s, 2)
      }
      // a few potted plants along the front of the roof
      const nPlants = r() < 0.5 ? 1 + Math.floor(r() * 3) : 0
      for (let k = 0; k < nPlants; k++) {
        const pr = 0.35 + r() * 0.45
        const g = new IcosahedronGeometry(pr, 0)
        g.scale(1, 0.8, 1)
        push(at(g, base, (r() - 0.5) * (w - 1), t + 0.35 + pr * 0.6, d / 2 - 0.6), s, 5)
      }
      return base
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
        const b = add(r, x, z, w, 6 + r() * 4, -6 + r() * 8, { detail: true })
        if (b) front.push(b)
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
      const b = add(r, x, z, 6 + r() * 7, 6 + r() * 7, top, { detail: dist < 70 })
      if (b) front.push(b)
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
    const sorted = anchors.filter((p) => (p.z < 0 || Math.abs(p.x) > 15) && p.y < 9).sort((p, q) => Math.atan2(p.z, p.x) - Math.atan2(q.z, q.x))
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
    push(bodyBox(W, 40, D, 0, -0.2, (ROOF.front + ROOF.back) / 2), 0.35, 0, 2.6)
    push(bodyBox(12, 76, 8, -13, 16, -58), 0.12, 0, 2.4)
    push(box(12.3, 0.35, 8.3, -13, 16.17, -58), 0.12, 1)
    clutter(rng(13), { x: -13, z: -58, rot: 0 }, 12, 8, 16, 0.12, 1, false)

    const lanternGeos = []
    shrine(push, lanternGeos)
    // the street: one asphalt plane under the whole city
    push(new PlaneGeometry(900, 900).rotateX(-Math.PI / 2).translate(0, STREET, 0), 0.5, 2)

    const flat = parts.map(({ g, s, kind, fh }) => posterize(g, kind, s, fh))
    return { geometry: mergeGeometries(flat), beacons: mergeGeometries(lights), signs: mergeGeometries(signGeos), wires, lanterns: mergeGeometries(lanternGeos) }
  }, [])

  const wireMat = useMemo(() => new LineBasicMaterial({ color: '#1c2236' }), [])
  return (
    <group>
      <mesh geometry={geometry} material={cityMaterial} />
      <lineSegments geometry={wires} material={wireMat} />
      <Beacons geometry={beacons} />
      <Signs geometry={signs} />
      <LanternLights geometry={lanterns} />
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

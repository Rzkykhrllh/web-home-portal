import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AdditiveBlending, Color, DoubleSide, MathUtils, MeshBasicMaterial, MeshBasicNodeMaterial, PlaneGeometry } from 'three/webgpu'
import { Fn, Loop, color, cos, float, fract, max, mix, pow, select, sin, smoothstep, time, uniform, uv, vec2, vec3 } from 'three/tsl'
import { walkToPortal } from '../portal-nav.js'
import { player, uiStore } from '../store.js'
import { MONO, SANS, canvasTexture } from './canvasTexture.js'

const hdr = (hex, k) => new Color(hex).multiplyScalar(k)

// Shared wrapper: placement, click-to-walk, the coloured light, the streak of
// reflected light on the wet floor and the vertical neon sign beside it. The
// opening itself is DevGate or Aperture.
export default function Portal({ p }) {
  const gl = useThree((s) => s.gl)
  const boost = useRef(0) // 0 idle .. 1 cat is near .. 2 stepping through
  const light = useRef()
  const streak = useRef()
  const side = p.x < 0 ? -1 : 1 // the sign goes on the outer side

  useFrame((state, dt) => {
    const ui = uiStore.get()
    const leaving = player.leaving >= 0 && ui.leaving?.id === p.id
    const target = leaving ? 2 : ui.near?.id === p.id ? 1 : 0
    boost.current = MathUtils.damp(boost.current, target, leaving ? 3 : 4, dt)
    const b = boost.current
    const flicker = Math.sin(state.clock.elapsedTime * 31 + p.x) > 0.985 ? 0.6 : 1
    light.current.intensity = (9 + b * 14) * flicker
    streak.current.material.opacity = (0.35 + b * 0.3) * flicker
  })

  const onClick = (e) => {
    if (e.delta > 8) return
    e.stopPropagation()
    walkToPortal(p)
  }
  const hover = (on) => (e) => {
    e.stopPropagation()
    gl.domElement.style.cursor = on ? 'pointer' : ''
  }

  return (
    <group position={[p.x, 0, p.z]} rotation-y={p.yaw} onClick={onClick} onPointerOver={hover(true)} onPointerOut={hover(false)}>
      {p.id === 'dev' ? <DevGate p={p} boost={boost} /> : <Aperture p={p} boost={boost} />}
      <pointLight ref={light} color={p.color} intensity={9} distance={11} decay={1.5} position={[0, 1.8, 1.2]} />
      <FloorStreak ref={streak} color={p.color} />
      <NeonSign p={p} position={[side * 2.45, 0, -0.2]} />
    </group>
  )
}

// Light smeared across wet concrete towards the viewer
const streakTexture = () =>
  canvasTexture(128, 256, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h * 0.25, 0, w / 2, h * 0.25, h * 0.75)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.3, 'rgba(255,255,255,0.35)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  })
function FloorStreak({ color, ref }) {
  const tex = useMemo(streakTexture, [])
  return (
    <mesh ref={ref} rotation-x={-Math.PI / 2} position={[0, 0.012, 1.6]}>
      <planeGeometry args={[2.6, 4.4]} />
      <meshBasicMaterial map={tex} color={hdr(color, 1.4)} transparent opacity={0.4} depthWrite={false} blending={AdditiveBlending} toneMapped={false} />
    </mesh>
  )
}

function NeonSign({ p, ...props }) {
  const tex = useMemo(
    () =>
      canvasTexture(180, 640, (ctx, w, h) => {
        ctx.fillStyle = '#0d0f17'
        ctx.fillRect(0, 0, w, h)
        ctx.strokeStyle = p.color
        ctx.lineWidth = 6
        ctx.shadowColor = p.color
        ctx.shadowBlur = 18
        ctx.strokeRect(14, 14, w - 28, h - 28)
        ctx.fillStyle = '#ffffff'
        ctx.font = `900 120px ${SANS}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ;[...p.jp].forEach((c, i) => ctx.fillText(c, w / 2, 120 + i * 150))
        ctx.save()
        ctx.translate(w / 2, 470)
        ctx.rotate(Math.PI / 2)
        ctx.font = `700 34px ${SANS}`
        ctx.fillStyle = p.color
        ctx.shadowBlur = 10
        ctx.fillText(p.title, 0, 0)
        ctx.restore()
      }),
    [p],
  )
  return (
    <group {...props}>
      <mesh position-y={2.1}>
        <cylinderGeometry args={[0.05, 0.05, 4.2, 8]} />
        <meshStandardMaterial color="#2a2e38" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh position={[0, 3.0, 0.1]}>
        <boxGeometry args={[0.8, 2.75, 0.12]} />
        <meshStandardMaterial color="#181b24" metalness={0.4} roughness={0.5} />
      </mesh>
      <mesh position={[0, 3.0, 0.165]}>
        <planeGeometry args={[0.74, 2.65]} />
        <meshBasicMaterial map={tex} color={hdr('#ffffff', 1.8)} toneMapped={false} />
      </mesh>
    </group>
  )
}

/* ---------------- Engineering: a doorway into a terminal ---------------- */

const CODE = `@Controller('photos')
export class PhotosController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  list(@Query() q: ListPhotosDto) {
    return this.prisma.photo.findMany({
      where: { city: q.city ?? 'Tokyo' },
      orderBy: { takenAt: 'desc' },
      take: 24,
    })
  }
}

$ docker compose up -d
 ✔ Container db      Started
 ✔ Container api     Started
$ npx prisma migrate deploy
 All migrations have been applied.
$ curl -s dev.byairu.com/health
{"status":"ok","uptime":"42d"}

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  app.enableShutdownHooks()
  await app.listen(process.env.PORT ?? 3000)
}
bootstrap()
`

function DevGate({ p, boost }) {
  const tex = useMemo(() => {
    const t = canvasTexture(
      512,
      1024,
      (ctx, w, h) => {
        ctx.fillStyle = '#04121c'
        ctx.fillRect(0, 0, w, h)
        ctx.font = `20px ${MONO}`
        ctx.textBaseline = 'top'
        const lines = CODE.split('\n')
        const lh = 27
        let y = 14
        let n = 1
        while (y < h) {
          for (const line of lines) {
            if (y >= h) break
            ctx.fillStyle = 'rgba(57,216,255,0.35)'
            ctx.fillText(String(n).padStart(3, ' '), 10, y)
            ctx.fillStyle = line.startsWith('$') ? '#e9fbff' : line.startsWith(' ✔') ? '#7dffb2' : '#7fe6ff'
            ctx.fillText(line, 62, y)
            y += lh
            n++
          }
        }
        // scanlines
        ctx.fillStyle = 'rgba(0,0,0,0.18)'
        for (let s = 0; s < h; s += 4) ctx.fillRect(0, s, w, 2)
      },
      { repeat: true },
    )
    t.repeat.set(1, 0.62)
    return t
  }, [])
  const screen = useRef()
  const tube = useMemo(() => new MeshBasicMaterial({ color: hdr(p.color, 3), toneMapped: false }), [p.color])
  const base = useMemo(() => new Color(p.color), [p.color])

  useFrame((state, dt) => {
    const b = boost.current
    tex.offset.y += dt * (0.025 + b * 0.18)
    screen.current.color.setScalar(1.1 + b * 1.1)
    const hum = 3 + b * 2.5 + Math.sin(state.clock.elapsedTime * 50) * 0.08
    tube.color.copy(base).multiplyScalar(hum)
  })

  const H = 3.1
  const Wd = 2.3
  return (
    <group>
      {/* steel frame */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[(s * (Wd + 0.2)) / 2, H / 2, 0]}>
          <boxGeometry args={[0.2, H, 0.34]} />
          <meshStandardMaterial color="#20242e" metalness={0.8} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[0, H + 0.1, 0]}>
        <boxGeometry args={[Wd + 0.4, 0.2, 0.34]} />
        <meshStandardMaterial color="#20242e" metalness={0.8} roughness={0.35} />
      </mesh>
      {/* neon tube just inside the frame */}
      {[
        [-(Wd / 2 - 0.04), H / 2, 0.06, H],
        [Wd / 2 - 0.04, H / 2, 0.06, H],
      ].map(([x, y, t, h], i) => (
        <mesh key={i} position={[x, y, 0.18]} material={tube}>
          <boxGeometry args={[t, h, t]} />
        </mesh>
      ))}
      <mesh position={[0, H - 0.04, 0.18]} material={tube}>
        <boxGeometry args={[Wd, 0.06, 0.06]} />
      </mesh>
      {/* the screen */}
      <mesh position={[0, H / 2, 0]}>
        <planeGeometry args={[Wd - 0.1, H - 0.08]} />
        <meshBasicMaterial ref={screen} map={tex} toneMapped={false} side={DoubleSide} />
      </mesh>
    </group>
  )
}

/* ---------------- Photography: a camera aperture that opens ---------------- */

const RING = 1.5
const CY = 1.95
const BLADES = 8

// Out-of-focus city lights drifting behind the lens, brighter in the middle
function bokehMaterial(hex) {
  const boost = uniform(0)
  const tint = color(hex)
  const m = new MeshBasicNodeMaterial()
  m.colorNode = Fn(() => {
    const p = uv().mul(2).sub(1)
    const r = p.length()
    const col = mix(tint.mul(0.25), tint.mul(0.9), r.oneMinus()).toVar()
    Loop(10, ({ i }) => {
      const f = float(i)
      const c = vec2(sin(f.mul(2.31).add(time.mul(f.mul(0.013).add(0.11)))), cos(f.mul(1.73).add(time.mul(f.mul(0.011).add(0.09))))).mul(0.62)
      const rad = fract(f.mul(0.371)).mul(0.09).add(0.13)
      const dot = smoothstep(rad, rad.mul(0.8), p.sub(c).length())
      const hue = mix(tint, select(f.lessThan(3), vec3(0.45, 0.85, 1.0), vec3(1.0, 0.9, 0.75)), 0.45)
      col.addAssign(hue.mul(dot).mul(0.55))
    })
    col.addAssign(vec3(1.0, 0.93, 0.82).mul(pow(max(r.oneMinus(), 0), 2.5)).mul(boost.mul(2.5).add(1.4)))
    return col.mul(boost.mul(0.8).add(1))
  })()
  m.userData.boost = boost
  return m
}

function Aperture({ p, boost }) {
  const bokeh = useMemo(() => bokehMaterial(p.color), [p.color])
  const bladeGeo = useMemo(() => {
    const g = new PlaneGeometry(1.35, 1)
    g.translate(0, 0.5, 0) // pivot on the inner edge
    return g
  }, [])
  const blades = useRef([])
  const open = useRef(0.2)
  const rim = useMemo(() => new MeshBasicMaterial({ color: hdr(p.color, 3), toneMapped: false }), [p.color])
  const engraving = useMemo(
    () =>
      canvasTexture(1024, 1024, (ctx, w) => {
        const text = '35mm  ƒ/1.4   ∞   10   5   3   2   1.5   1   0.7 m      frame by airu      '
        ctx.fillStyle = '#121318'
        ctx.beginPath()
        ctx.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#d9dbe2'
        ctx.font = `700 34px ${SANS}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        const rad = (1.76 / 1.95) * (w / 2)
        const step = (Math.PI * 2) / text.length
        ;[...text].forEach((ch, i) => {
          const a = -Math.PI / 2 + i * step
          ctx.save()
          ctx.translate(w / 2 + Math.cos(a) * rad, w / 2 + Math.sin(a) * rad)
          ctx.rotate(a + Math.PI / 2)
          ctx.fillText(ch, 0, 0)
          ctx.restore()
        })
        // amber index mark at the top
        ctx.fillStyle = p.color
        ctx.fillRect(w / 2 - 4, w / 2 - (1.95 / 1.95) * (w / 2) + 6, 8, 26)
      }),
    [p.color],
  )

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const b = boost.current
    // idle: stopped down and breathing a little; near: wide open
    const want = MathUtils.clamp(0.16 + Math.sin(t * 0.8) * 0.04 + b * 0.84, 0, 1)
    open.current = MathUtils.damp(open.current, want, 5, dt)
    const r = MathUtils.lerp(0.1, 1.3, open.current)
    blades.current.forEach((m, i) => {
      if (!m) return
      const a = (i / BLADES) * Math.PI * 2 + open.current * 0.6
      m.position.set(Math.cos(a) * r, Math.sin(a) * r, 0.02 + i * 0.004)
      m.rotation.z = a - Math.PI / 2 + 0.42
      m.scale.y = Math.max(0.05, 1.75 - r)
    })
    bokeh.userData.boost.value = b
  })

  return (
    <group>
      {/* cradle */}
      <mesh position={[0, 0.16, 0]}>
        <boxGeometry args={[2.8, 0.32, 0.7]} />
        <meshStandardMaterial color="#1e2129" metalness={0.7} roughness={0.4} />
      </mesh>
      <group position-y={CY}>
        <mesh position-z={-0.06} material={bokeh}>
          <circleGeometry args={[RING - 0.1, 64]} />
        </mesh>
        {Array.from({ length: BLADES }, (_, i) => (
          <mesh key={i} ref={(m) => (blades.current[i] = m)} geometry={bladeGeo}>
            <meshStandardMaterial color="#17181d" metalness={0.75} roughness={0.32} side={DoubleSide} />
          </mesh>
        ))}
        {/* lens barrel */}
        <mesh>
          <torusGeometry args={[RING + 0.05, 0.24, 20, 72]} />
          <meshStandardMaterial color="#1a1b20" metalness={0.85} roughness={0.28} />
        </mesh>
        <mesh position-z={0.2}>
          <ringGeometry args={[RING + 0.1, 1.95, 96]} />
          <meshStandardMaterial map={engraving} metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position-z={0.12} material={rim}>
          <torusGeometry args={[RING - 0.14, 0.025, 8, 96]} />
        </mesh>
      </group>
    </group>
  )
}

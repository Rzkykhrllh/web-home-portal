import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Color, MeshStandardNodeMaterial, Vector2 } from 'three/webgpu'
import { color, float, mx_noise_float, positionWorld, reflector, texture, time, vec2, vec3 } from 'three/tsl'
import { ROOF } from '../config.js'
import { AC_UNITS, SHED, TANK, VENDING } from '../layout.js'
import { walkToPoint } from '../portal-nav.js'
import { QUALITY } from '../quality.js'
import { SANS, canvasTexture, rng } from './canvasTexture.js'
import { windowsTexture } from './City.jsx'

const W = ROOF.x * 2
const D = ROOF.front - ROOF.back
const CZ = (ROOF.front + ROOF.back) / 2

const glow = (hex, k) => new Color(hex).multiplyScalar(k)

// Concrete slab after rain: panel seams, stains, darker wet patches, and
// puddles cut out of it (alpha) so the mirror underneath shows through.
function concreteTextures() {
  const PX = 64 // pixels per metre
  const w = W * PX
  const h = D * PX
  const r = rng(11)
  const puddles = Array.from({ length: 9 }, () => {
    const x = r() * w
    const y = r() * h
    return { x, y, rx: (0.5 + r() * 1.3) * PX, ry: (0.35 + r() * 0.7) * PX, a: r() * Math.PI }
  })
  // keep the middle and the portal pads mostly dry-ish: shove a few puddles there anyway for reflections
  // and a few where the neon will land in them: in front of each portal and mid-roof
  puddles.push({ x: w / 2 + 0.6 * PX, y: h * 0.58, rx: 1.9 * PX, ry: 0.7 * PX, a: 0.12 })
  puddles.push({ x: w * 0.26, y: h * 0.36, rx: 1.3 * PX, ry: 0.6 * PX, a: 0.5 })
  puddles.push({ x: w * 0.74, y: h * 0.37, rx: 1.4 * PX, ry: 0.55 * PX, a: -0.4 })

  const blob = (ctx, p, grow = 1) => {
    ctx.beginPath()
    ctx.ellipse(p.x, p.y, p.rx * grow, p.ry * grow, p.a, 0, Math.PI * 2)
  }

  const map = canvasTexture(
    w,
    h,
    (ctx) => {
      ctx.fillStyle = '#4a4e57'
      ctx.fillRect(0, 0, w, h)
      // grain
      const g = rng(5)
      for (let i = 0; i < 9000; i++) {
        const v = 60 + g() * 40
        ctx.fillStyle = `rgba(${v},${v + 2},${v + 8},0.25)`
        ctx.fillRect(g() * w, g() * h, 2, 2)
      }
      // stains
      for (let i = 0; i < 40; i++) {
        const x = g() * w
        const y = g() * h
        const rad = (0.5 + g() * 2.5) * PX
        const grad = ctx.createRadialGradient(x, y, 0, x, y, rad)
        grad.addColorStop(0, 'rgba(20,22,30,0.35)')
        grad.addColorStop(1, 'rgba(20,22,30,0)')
        ctx.fillStyle = grad
        ctx.fillRect(x - rad, y - rad, rad * 2, rad * 2)
      }
      // panel seams every 3 m
      ctx.strokeStyle = 'rgba(15,16,22,0.8)'
      ctx.lineWidth = 3
      for (let x = 0; x <= w; x += 3 * PX) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, h)
        ctx.stroke()
      }
      for (let y = 0; y <= h; y += 3 * PX) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(w, y)
        ctx.stroke()
      }
      // wet rims round each puddle
      for (const p of puddles) {
        ctx.fillStyle = 'rgba(18,20,28,0.55)'
        blob(ctx, p, 1.35)
        ctx.fill()
      }
      // the puddles themselves: transparent
      ctx.globalCompositeOperation = 'destination-out'
      for (const p of puddles) {
        blob(ctx, p)
        ctx.fill()
      }
      ctx.globalCompositeOperation = 'source-over'
    },
  )
  // Puddles and wet patches are glossy, dry concrete is matte
  const rough = canvasTexture(
    w / 4,
    h / 4,
    (ctx) => {
      ctx.fillStyle = '#d0d0d0'
      ctx.fillRect(0, 0, w / 4, h / 4)
      ctx.scale(0.25, 0.25)
      ctx.fillStyle = '#404040'
      for (const p of puddles) {
        blob(ctx, p, 1.4)
        ctx.fill()
      }
    },
    { color: false },
  )
  return { map, rough }
}

export default function Rooftop() {
  const gl = useThree((s) => s.gl)
  const { map, rough } = useMemo(concreteTextures, [])

  // One material for the slab: concrete where it's dry, a mirror of the scene
  // (screen-space reflector) in the puddles, and a faint sheen of it on the
  // wet concrete. Raindrop ripples wobble the reflection.
  const { floor, target } = useMemo(() => {
    const m = new MeshStandardNodeMaterial({ roughnessMap: rough, roughness: 1, metalness: 0.05 })
    const concrete = texture(map)
    const wet = concrete.a.oneMinus() // 1 inside a puddle
    m.colorNode = concrete.rgb.mul(concrete.a)
    if (!QUALITY.reflections) {
      // No mirror on phones: puddles get a dim night-sky tint instead of going black
      m.emissiveNode = color('#2a2550').mul(wet.mul(0.9))
      return { floor: m, target: null }
    }
    const mirror = reflector({ resolutionScale: 0.5 })
    mirror.target.rotateX(-Math.PI / 2)
    const p = positionWorld.xz.mul(6)
    const ripple = vec2(mx_noise_float(vec3(p, time.mul(1.7))), mx_noise_float(vec3(p.add(9.1), time.mul(1.7))))
    mirror.uvNode = mirror.uvNode.add(ripple.mul(wet.mul(0.006).add(0.002)))
    m.emissiveNode = mirror.rgb.mul(vec3(0.62, 0.66, 0.78)).mul(wet.mul(0.85).add(float(0.1)))
    return { floor: m, target: mirror.target }
  }, [map, rough])

  const onGround = (e) => {
    if (e.delta > 8) return
    e.stopPropagation()
    walkToPoint(e.point.x, e.point.z)
  }
  const cursor = (c) => () => (gl.domElement.style.cursor = c)

  return (
    <group>
      {target && <primitive object={target} />}
      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, 0, CZ]}
        material={floor}
        receiveShadow
        onClick={onGround}
        onPointerOver={cursor('pointer')}
        onPointerOut={cursor('')}
      >
        <planeGeometry args={[W, D]} />
      </mesh>

      <Building />
      <Parapet />
      <VendingMachine position={[VENDING[0], 0, VENDING[1]]} />
      {AC_UNITS.map(([x, z], i) => (
        <AcUnit key={i} position={[x, 0, z]} rotation-y={x < 0 ? Math.PI / 2 : -Math.PI / 2} />
      ))}
      <WaterTank position={[TANK[0], 0, TANK[1]]} />
      <Stairwell position={[SHED[0], 0, SHED[1]]} />
      <Festoon />
    </group>
  )
}

// The building under the roof, so the slab sits on something with lit floors
function Building() {
  const tex = useMemo(() => {
    const t = windowsTexture(3).clone()
    t.repeat.set(W / 3, 40 / 3.4)
    t.needsUpdate = true
    return t
  }, [])
  return (
    <mesh position={[0, -20.2, CZ]}>
      <boxGeometry args={[W + 0.6, 40, D + 0.6]} />
      <meshStandardMaterial color="#0b0e17" emissive="#ffffff" emissiveMap={tex} emissiveIntensity={0.9} roughness={0.9} />
    </mesh>
  )
}

function Parapet() {
  const H = 0.85
  const T = 0.3
  const wall = '#3b3f4a'
  const pieces = [
    // back, left, right: full height; front: a low lip so the camera sees over it
    [0, H / 2, ROOF.back - T / 2, W + T * 2, H, T],
    [-ROOF.x - T / 2, H / 2, CZ, T, H, D],
    [ROOF.x + T / 2, H / 2, CZ, T, H, D],
    [0, 0.12, ROOF.front + T / 2, W + T * 2, 0.24, T],
  ]
  const posts = []
  for (let x = -ROOF.x; x <= ROOF.x + 0.01; x += 1.5) posts.push([x, ROOF.back - T / 2])
  for (let z = ROOF.back + 1.5; z <= ROOF.front; z += 1.5) {
    posts.push([-ROOF.x - T / 2, z])
    posts.push([ROOF.x + T / 2, z])
  }
  return (
    <group>
      {pieces.map(([x, y, z, w, h, d], i) => (
        <mesh key={i} position={[x, y, z]} castShadow receiveShadow>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial color={wall} roughness={0.85} />
        </mesh>
      ))}
      {/* Safety railing on top of the parapet */}
      {posts.map(([x, z], i) => (
        <mesh key={i} position={[x, H + 0.5, z]}>
          <cylinderGeometry args={[0.025, 0.025, 1, 6]} />
          <meshStandardMaterial color="#6d7380" metalness={0.8} roughness={0.35} />
        </mesh>
      ))}
      {[
        [0, ROOF.back - T / 2, W, 0],
        [-ROOF.x - T / 2, CZ, D, Math.PI / 2],
        [ROOF.x + T / 2, CZ, D, Math.PI / 2],
      ].map(([x, z, len, rot], i) => (
        <mesh key={i} position={[x, H + 1, z]} rotation={[0, rot, Math.PI / 2]}>
          <cylinderGeometry args={[0.035, 0.035, len, 6]} />
          <meshStandardMaterial color="#7a808d" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
    </group>
  )
}

// A drinks machine glowing at the back of the roof: the brightest white in the scene
function VendingMachine(props) {
  const front = useMemo(
    () =>
      canvasTexture(256, 460, (ctx, w, h) => {
        ctx.fillStyle = '#e9f1ff'
        ctx.fillRect(0, 0, w, h)
        const colors = ['#d23a3a', '#2f7dd1', '#f0b429', '#3aa365', '#e86a1a', '#7a4fd0', '#f2f2f2', '#2a2a2a']
        const r = rng(4)
        for (let row = 0; row < 4; row++) {
          ctx.fillStyle = '#c5d3ea'
          ctx.fillRect(14, 34 + row * 62 + 44, w - 28, 6)
          for (let i = 0; i < 6; i++) {
            ctx.fillStyle = colors[Math.floor(r() * colors.length)]
            const x = 20 + i * 37
            ctx.fillRect(x, 34 + row * 62, 24, 44)
            ctx.fillStyle = 'rgba(255,255,255,0.5)'
            ctx.fillRect(x + 3, 34 + row * 62 + 4, 4, 34)
            // little price buttons
            ctx.fillStyle = '#29c46b'
            ctx.fillRect(x + 4, 34 + row * 62 + 52, 16, 4)
          }
        }
        ctx.fillStyle = '#1d2433'
        ctx.fillRect(14, 300, w - 28, 150)
        ctx.fillStyle = '#e9f1ff'
        ctx.font = `700 22px ${SANS}`
        ctx.textAlign = 'center'
        ctx.fillText('つめた〜い', w / 2, 334)
        ctx.fillStyle = '#0d1018'
        ctx.fillRect(40, 380, w - 80, 46)
      }),
    [],
  )
  return (
    <group {...props}>
      <mesh position-y={0.95} castShadow>
        <boxGeometry args={[1.05, 1.9, 0.75]} />
        <meshStandardMaterial color="#c9ccd4" roughness={0.5} metalness={0.3} />
      </mesh>
      <mesh position={[0, 1.02, 0.377]}>
        <planeGeometry args={[0.9, 1.62]} />
        <meshBasicMaterial map={front} color={glow('#ffffff', 1.5)} toneMapped={false} />
      </mesh>
      <pointLight position={[0, 1.2, 1.1]} color="#dbe8ff" intensity={6} distance={6} decay={1.8} />
    </group>
  )
}

function AcUnit(props) {
  const grille = useMemo(
    () =>
      canvasTexture(128, 128, (ctx, w, h) => {
        ctx.fillStyle = '#b9bdc6'
        ctx.fillRect(0, 0, w, h)
        ctx.strokeStyle = '#3a3e48'
        ctx.lineWidth = 3
        for (let r = 8; r < 52; r += 7) {
          ctx.beginPath()
          ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.beginPath()
        ctx.moveTo(w / 2 - 52, h / 2)
        ctx.lineTo(w / 2 + 52, h / 2)
        ctx.moveTo(w / 2, h / 2 - 52)
        ctx.lineTo(w / 2, h / 2 + 52)
        ctx.stroke()
      }),
    [],
  )
  const fan = useRef()
  useFrame((_, dt) => fan.current && (fan.current.rotation.z += dt * 6))
  return (
    <group {...props}>
      <mesh position-y={0.4} castShadow receiveShadow>
        <boxGeometry args={[1.2, 0.8, 0.5]} />
        <meshStandardMaterial color="#b9bdc6" roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[0.15, 0.4, 0.252]}>
        <circleGeometry args={[0.3, 24]} />
        <meshStandardMaterial map={grille} roughness={0.6} />
      </mesh>
      <mesh ref={fan} position={[0.15, 0.4, 0.24]}>
        <boxGeometry args={[0.5, 0.06, 0.01]} />
        <meshStandardMaterial color="#2a2d35" />
      </mesh>
    </group>
  )
}

function WaterTank(props) {
  return (
    <group {...props}>
      {[
        [-0.7, -0.7],
        [0.7, -0.7],
        [-0.7, 0.7],
        [0.7, 0.7],
      ].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.6, z]}>
          <boxGeometry args={[0.1, 1.2, 0.1]} />
          <meshStandardMaterial color="#555b66" metalness={0.6} roughness={0.5} />
        </mesh>
      ))}
      <mesh position-y={2.1} castShadow>
        <cylinderGeometry args={[1.05, 1.05, 1.9, 24]} />
        <meshStandardMaterial color="#8d939e" metalness={0.5} roughness={0.45} />
      </mesh>
      <mesh position-y={3.1}>
        <coneGeometry args={[1.1, 0.35, 24]} />
        <meshStandardMaterial color="#7a808b" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  )
}

// The stairwell hut with its one fluorescent light over the door
function Stairwell(props) {
  return (
    <group {...props}>
      <mesh position-y={1.4} castShadow receiveShadow>
        <boxGeometry args={[2.6, 2.8, 2.2]} />
        <meshStandardMaterial color="#454a55" roughness={0.85} />
      </mesh>
      <mesh position={[0.4, 1.05, 1.105]}>
        <planeGeometry args={[0.95, 2.05]} />
        <meshStandardMaterial color="#2a3240" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0.4, 2.35, 1.16]}>
        <boxGeometry args={[0.7, 0.06, 0.08]} />
        <meshBasicMaterial color={glow('#eaf4ff', 3)} toneMapped={false} />
      </mesh>
      <pointLight position={[0.4, 2.2, 1.6]} color="#dfeaff" intensity={4} distance={5} decay={1.8} />
    </group>
  )
}

// Two strings of warm bulbs across the roof, for a bit of warmth against the blue
function Festoon() {
  const strings = useMemo(() => {
    const make = (a, b, sag, n) => {
      const pts = []
      for (let i = 0; i <= n; i++) {
        const t = i / n
        pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(t * Math.PI) * sag, a[2] + (b[2] - a[2]) * t])
      }
      return pts
    }
    return [make([-10.4, 3.5, -8.3], [10.4, 3.5, -8.3], 0.7, 14)]
  }, [])
  const bulb = useMemo(() => glow('#ffc46b', 2.6), [])
  const mats = useRef([])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    // one bulb on each string flickers now and then
    mats.current.forEach((m, i) => {
      if (!m) return
      const f = Math.sin(t * 13 + i * 7) > 0.97 ? 0.35 : 1
      m.color.copy(bulb).multiplyScalar(f)
    })
  })
  return strings.map((pts, s) => (
    <group key={s}>
      {pts.map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <sphereGeometry args={[0.07, 8, 6]} />
          <meshBasicMaterial
            ref={i === 5 ? (m) => (mats.current[s] = m) : undefined}
            color={bulb}
            toneMapped={false}
          />
        </mesh>
      ))}
      {pts.slice(1).map(([x, y, z], i) => {
        const [px, py, pz] = pts[i]
        const v = new Vector2(x - px, z - pz)
        const len = Math.hypot(v.length(), y - py)
        return (
          <mesh
            key={`w${i}`}
            position={[(x + px) / 2, (y + py) / 2 + 0.05, (z + pz) / 2]}
            rotation={[0, -Math.atan2(z - pz, x - px), Math.atan2(y - py, v.length()) + Math.PI / 2]}
          >
            <cylinderGeometry args={[0.008, 0.008, len, 4]} />
            <meshBasicMaterial color="#111" />
          </mesh>
        )
      })}
      <pointLight position={[0, pts[Math.floor(pts.length / 2)][1] - 0.3, pts[Math.floor(pts.length / 2)][2] + 1]} color="#ffb85c" intensity={4} distance={10} decay={1.5} />
    </group>
  ))
}

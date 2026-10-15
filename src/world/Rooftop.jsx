import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BoxGeometry, Color, CylinderGeometry } from 'three/webgpu'
import { ROOF } from '../config.js'
import { AC_UNITS, SHED, TANK, VENDING } from '../layout.js'
import { walkToPoint } from '../portal-nav.js'
import { SANS, canvasTexture, rng } from './canvasTexture.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const W = ROOF.x * 2
const D = ROOF.front - ROOF.back
const CZ = (ROOF.front + ROOF.back) / 2

const glow = (hex, k) => new Color(hex).multiplyScalar(k)

// Square floor tiles with dark grout, a few slightly off in tone like real
// balcony tiles. Flat colours to match the illustrated skyline.
function tileTexture() {
  const PX = 48 // pixels per metre
  const w = W * PX
  const h = D * PX
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = '#231d3f'
    ctx.fillRect(0, 0, w, h)
    const r = rng(11)
    const T = PX // 1 m tiles
    for (let y = 0; y < h; y += T) {
      for (let x = 0; x < w; x += T) {
        const k = r()
        ctx.fillStyle = k < 0.08 ? '#3e3566' : k < 0.2 ? '#352d5a' : '#393160'
        ctx.fillRect(x + 2, y + 2, T - 4, T - 4)
      }
    }
  })
}

export default function Rooftop() {
  const gl = useThree((s) => s.gl)
  const map = useMemo(tileTexture, [])

  const onGround = (e) => {
    if (e.delta > 8) return
    e.stopPropagation()
    walkToPoint(e.point.x, e.point.z)
  }
  const cursor = (c) => () => (gl.domElement.style.cursor = c)

  return (
    <group>
      <mesh
        rotation-x={-Math.PI / 2}
        position={[0, 0, CZ]}
       
        onClick={onGround}
        onPointerOver={cursor('pointer')}
        onPointerOut={cursor('')}
      >
        <planeGeometry args={[W, D]} />
        {/* rain-wet tiles: glossy enough to catch the neon */}
        <meshStandardMaterial map={map} roughness={0.38} metalness={0.15} />
      </mesh>

      <Parapet />
      <VendingMachine position={[VENDING[0], 0, VENDING[1]]} />
      {AC_UNITS.map(([x, z], i) => (
        <AcUnit key={i} position={[x, 0, z]} rotation-y={x < 0 ? Math.PI / 2 : -Math.PI / 2} />
      ))}
      <WaterTank position={[TANK[0], 0, TANK[1]]} />
      <Stairwell position={[SHED[0], 0, SHED[1]]} />
    </group>
  )
}

// Parapet walls and the railing on top, merged into three meshes
function Parapet() {
  const { walls, posts, rails } = useMemo(() => {
    const H = 0.85
    const T = 0.3
    const at = (g, x, y, z) => g.translate(x, y, z)
    const walls = mergeGeometries([
      // back, left, right: full height; front: a low lip so the camera sees over it
      at(new BoxGeometry(W + T * 2, H, T), 0, H / 2, ROOF.back - T / 2),
      at(new BoxGeometry(T, H, D), -ROOF.x - T / 2, H / 2, CZ),
      at(new BoxGeometry(T, H, D), ROOF.x + T / 2, H / 2, CZ),
      at(new BoxGeometry(W + T * 2, 0.24, T), 0, 0.12, ROOF.front + T / 2),
    ])
    const spots = []
    for (let x = -ROOF.x; x <= ROOF.x + 0.01; x += 0.5) spots.push([x, ROOF.back - T / 2])
    for (let z = ROOF.back + 0.5; z <= ROOF.front; z += 0.5) spots.push([-ROOF.x - T / 2, z], [ROOF.x + T / 2, z])
    const posts = mergeGeometries(spots.map(([x, z]) => at(new CylinderGeometry(0.025, 0.025, 1, 6), x, H + 0.5, z)))
    const rail = (len) => new CylinderGeometry(0.035, 0.035, len, 6).rotateZ(Math.PI / 2)
    const rails = mergeGeometries([
      at(rail(W), 0, H + 1, ROOF.back - T / 2),
      at(rail(D).rotateY(Math.PI / 2), -ROOF.x - T / 2, H + 1, CZ),
      at(rail(D).rotateY(Math.PI / 2), ROOF.x + T / 2, H + 1, CZ),
    ])
    return { walls, posts, rails }
  }, [])
  return (
    <group>
      <mesh geometry={walls}>
        <meshStandardMaterial color="#2e2650" roughness={0.85} />
      </mesh>
      <mesh geometry={posts}>
        <meshStandardMaterial color="#4a3f7a" metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh geometry={rails}>
        <meshStandardMaterial color="#c75a9a" emissive="#c75a9a" emissiveIntensity={0.35} metalness={0.6} roughness={0.35} />
      </mesh>
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
      <mesh position-y={0.95}>
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
      <mesh position-y={0.4}>
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
      <mesh position-y={2.1}>
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
      <mesh position-y={1.4}>
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
    </group>
  )
}

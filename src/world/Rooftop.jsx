import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { BoxGeometry, Color, CylinderGeometry, MeshBasicNodeMaterial } from 'three/webgpu'
import { mix, texture, uniform, uv, vec3 } from 'three/tsl'
import { cityMaterial, posterLight, posterize } from './City.jsx'
import { ROOF } from '../config.js'
import { AC_UNITS, BENCH, PLANTS, SHED, TANK, VENDING } from '../layout.js'
import { walkToPoint } from '../portal-nav.js'
import { U, atmos } from './Atmosphere.jsx'
import { SANS, canvasTexture, rng } from './canvasTexture.js'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const W = ROOF.x * 2
const D = ROOF.front - ROOF.back
const CZ = (ROOF.front + ROOF.back) / 2

const glow = (hex, k) => new Color(hex).multiplyScalar(k)
const wetU = uniform(0)
const snowU = uniform(0)

// Square pale concrete tiles with grey grout, a few slightly off in tone like real
// balcony tiles. Flat colours to match the illustrated skyline.
function tileTexture() {
  const PX = 48 // pixels per metre
  const w = W * PX
  const h = D * PX
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = '#a9a198'
    ctx.fillRect(0, 0, w, h)
    const r = rng(11)
    const T = PX // 1 m tiles
    for (let y = 0; y < h; y += T) {
      for (let x = 0; x < w; x += T) {
        const k = r()
        ctx.fillStyle = k < 0.08 ? '#d6cfc4' : k < 0.2 ? '#c4bcb1' : '#cdc6bb'
        ctx.fillRect(x + 2, y + 2, T - 4, T - 4)
      }
    }
  })
}

export default function Rooftop() {
  const gl = useThree((s) => s.gl)
  // pale concrete tiles in the poster's flat light: darker when wet, dusted
  // white when it snows, blue at night like the rest of the city
  const tileMat = useMemo(() => {
    const m = new MeshBasicNodeMaterial()
    const tex = texture(tileTexture(), uv()).rgb
    m.colorNode = mix(tex.mul(wetU.mul(-0.3).add(1)), vec3(0.95, 0.96, 1.0), snowU.mul(0.5)).mul(posterLight)
    return m
  }, [])
  useFrame(() => {
    wetU.value = atmos.wet
    snowU.value = atmos.snow
  })

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
        <primitive object={tileMat} attach="material" />
      </mesh>

      <Parapet />
      <VendingMachine position={[VENDING[0], 0, VENDING[1]]} />
      {AC_UNITS.map(([x, z], i) => (
        <AcUnit key={i} position={[x, 0, z]} rotation-y={x < 0 ? Math.PI / 2 : -Math.PI / 2} />
      ))}
      <WaterTank position={[TANK[0], 0, TANK[1]]} />
      <Stairwell position={[SHED[0], 0, SHED[1]]} />
      {PLANTS.map(([x, z, s], i) => (
        <Plant key={i} position={[x, 0, z]} scale={s} seed={i} />
      ))}
      <Bench position={[BENCH[0], 0, BENCH[1]]} rotation-y={Math.PI} />
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
      // a cream coping along the top of every wall
      at(new BoxGeometry(W + T * 2 + 0.1, 0.12, T + 0.1), 0, H + 0.06, ROOF.back - T / 2),
      at(new BoxGeometry(T + 0.1, 0.12, D), -ROOF.x - T / 2, H + 0.06, CZ),
      at(new BoxGeometry(T + 0.1, 0.12, D), ROOF.x + T / 2, H + 0.06, CZ),
      at(new BoxGeometry(W + T * 2 + 0.1, 0.12, T + 0.1), 0, H + 0.06, ROOF.front + T / 2),
    ].map((g) => posterize(g, 1)).concat([
      // all four sides (the normal camera sits beyond the front edge and looks over it)
      at(new BoxGeometry(W + T * 2, H, T), 0, H / 2, ROOF.back - T / 2),
      at(new BoxGeometry(T, H, D), -ROOF.x - T / 2, H / 2, CZ),
      at(new BoxGeometry(T, H, D), ROOF.x + T / 2, H / 2, CZ),
      at(new BoxGeometry(W + T * 2, H, T), 0, H / 2, ROOF.front + T / 2),
    ].map((g) => posterize(g, 0))))
    const spots = []
    for (let x = -ROOF.x; x <= ROOF.x + 0.01; x += 0.5) spots.push([x, ROOF.back - T / 2], [x, ROOF.front + T / 2])
    for (let z = ROOF.back + 0.5; z <= ROOF.front; z += 0.5) spots.push([-ROOF.x - T / 2, z], [ROOF.x + T / 2, z])
    const posts = mergeGeometries(spots.map(([x, z]) => posterize(at(new CylinderGeometry(0.025, 0.025, 1, 6), x, H + 0.5, z), 3)))
    const rail = (len) => new CylinderGeometry(0.035, 0.035, len, 6).rotateZ(Math.PI / 2)
    const rails = mergeGeometries(
      [
        at(rail(W), 0, H + 1, ROOF.back - T / 2),
        at(rail(W), 0, H + 1, ROOF.front + T / 2),
        at(rail(D).rotateY(Math.PI / 2), -ROOF.x - T / 2, H + 1, CZ),
        at(rail(D).rotateY(Math.PI / 2), ROOF.x + T / 2, H + 1, CZ),
      ].map((g) => posterize(g, 3)),
    )
    return { walls, posts, rails }
  }, [])
  return (
    <group>
      {/* maroon walls like the building below, cream coping, green railings */}
      <mesh geometry={walls} material={cityMaterial} />
      <mesh geometry={posts} material={cityMaterial} />
      <mesh geometry={rails} material={cityMaterial} />
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

// Potted plants in the front corners: a pot and a few leafy clumps
function Plant({ seed, ...props }) {
  const greens = ['#3f7a4a', '#4f8d55', '#356b46']
  return (
    <group {...props}>
      <mesh position-y={0.28}>
        <cylinderGeometry args={[0.3, 0.24, 0.56, 14]} />
        <meshStandardMaterial color={seed % 2 ? '#b0623c' : '#8a8f9a'} roughness={0.8} />
      </mesh>
      {[
        [0, 0.85, 0, 0.36],
        [0.18, 1.05, 0.08, 0.28],
        [-0.16, 1.0, -0.1, 0.26],
      ].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]}>
          <icosahedronGeometry args={[r, 1]} />
          <meshStandardMaterial color={greens[(seed + i) % 3]} roughness={0.9} flatShading />
        </mesh>
      ))}
    </group>
  )
}

// A slatted bench facing the city
function Bench(props) {
  return (
    <group {...props}>
      {[-0.7, 0.7].map((x) => (
        <mesh key={x} position={[x, 0.22, 0]}>
          <boxGeometry args={[0.08, 0.44, 0.42]} />
          <meshStandardMaterial color="#3a3f4a" metalness={0.6} roughness={0.4} />
        </mesh>
      ))}
      {[-0.13, 0, 0.13].map((z) => (
        <mesh key={z} position={[0, 0.46, z]}>
          <boxGeometry args={[1.7, 0.05, 0.1]} />
          <meshStandardMaterial color="#9a6a42" roughness={0.8} />
        </mesh>
      ))}
      {[0.62, 0.78].map((y) => (
        <mesh key={y} position={[0, y, -0.22]} rotation-x={-0.12}>
          <boxGeometry args={[1.7, 0.08, 0.04]} />
          <meshStandardMaterial color="#9a6a42" roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

import { useMemo } from 'react'
import { Color, Object3D } from 'three'
import { useThree } from '@react-three/fiber'
import { PLAZA_RADIUS } from '../config.js'
import { SIGN, portals, trees } from '../layout.js'
import { walkToPoint } from '../portal-nav.js'
import { canvasTexture, roundRect } from './canvasTexture.js'
import { OUTLINE, TOON_RAMP } from './toon.js'

const GRASS = '#8fd060'
const GRASS_SIDE = '#5f9c3d'
const DIRT = '#9a6b45'
const ROCK = '#7d5b43'
const STONE = '#f1e3c2'

const Toon = ({ color, ...rest }) => <meshToonMaterial color={color} gradientMap={TOON_RAMP} {...rest} />

// Floating grass island: a disc of grass on a rocky cone, a paved circle in
// the middle with paths out to the two portals, trees round the rim.
export default function Plaza() {
  const gl = useThree((s) => s.gl)
  const onGround = (e) => {
    if (e.delta > 8) return
    e.stopPropagation()
    walkToPoint(e.point.x, e.point.z)
  }
  return (
    <group>
      {/* Grass top + soil band */}
      <mesh position-y={-0.35} receiveShadow onClick={onGround} onPointerOver={() => (gl.domElement.style.cursor = 'pointer')} onPointerOut={() => (gl.domElement.style.cursor = '')}>
        <cylinderGeometry args={[PLAZA_RADIUS, PLAZA_RADIUS * 0.96, 0.7, 64]} />
        <Toon attach="material-0" color={GRASS_SIDE} />
        <Toon attach="material-1" color={GRASS} />
        <Toon attach="material-2" color={DIRT} />
      </mesh>
      <mesh position-y={-0.95}>
        <cylinderGeometry args={[PLAZA_RADIUS * 0.96, PLAZA_RADIUS * 0.9, 0.6, 48]} />
        <Toon color={DIRT} />
      </mesh>
      {/* Rocky underside */}
      <mesh position-y={-5.2} rotation-x={Math.PI}>
        <coneGeometry args={[PLAZA_RADIUS * 0.9, 8, 11, 3]} />
        <Toon color={ROCK} flatShading />
      </mesh>
      <mesh position={[3, -8, 2]} rotation-x={Math.PI}>
        <coneGeometry args={[2.2, 4, 7]} />
        <Toon color={ROCK} flatShading />
      </mesh>

      {/* Paving */}
      <mesh rotation-x={-Math.PI / 2} position-y={0.012} receiveShadow>
        <circleGeometry args={[2.4, 48]} />
        <Toon color={STONE} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.014}>
        <ringGeometry args={[2.4, 2.6, 48]} />
        <Toon color="#d2bf98" />
      </mesh>
      {portals.map((p) => {
        const len = Math.hypot(p.x, p.z)
        const yaw = Math.atan2(p.x, p.z)
        return (
          <group key={p.id} rotation-y={yaw}>
            <mesh rotation-x={-Math.PI / 2} position={[0, 0.01, len / 2]} receiveShadow>
              <planeGeometry args={[1.5, len]} />
              <Toon color={STONE} />
            </mesh>
          </group>
        )
      })}

      <Signpost />
      {trees.map(([x, z, s], i) => (
        <Tree key={i} position={[x, 0, z]} scale={s} seed={i} />
      ))}
      <Flowers />
      <Rocks />
    </group>
  )
}

function Tree({ seed, ...props }) {
  const greens = ['#4fae4a', '#3f9a48', '#5cba4e']
  const g = greens[seed % greens.length]
  return (
    <group {...props} rotation-y={seed * 1.7}>
      <mesh position-y={0.7} castShadow>
        <cylinderGeometry args={[0.14, 0.2, 1.4, 7]} />
        <Toon color="#7a4b28" />
      </mesh>
      {[
        [0, 1.9, 0, 0.95],
        [0.35, 2.55, 0.1, 0.7],
        [-0.3, 2.45, -0.15, 0.65],
      ].map(([x, y, z, r], i) => (
        <group key={i} position={[x, y, z]}>
          <mesh castShadow>
            <icosahedronGeometry args={[r, 1]} />
            <Toon color={g} flatShading />
          </mesh>
          <mesh material={OUTLINE} scale={1.07}>
            <icosahedronGeometry args={[r, 1]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// Wooden signpost in the middle pointing at both portals
function Signpost() {
  const boards = useMemo(
    () =>
      portals.map((p) => {
        const left = p.x < 0
        const tex = canvasTexture(512, 128, (ctx, w, h) => {
          ctx.fillStyle = '#c98b4e'
          roundRect(ctx, 4, 4, w - 8, h - 8, 18)
          ctx.fill()
          ctx.lineWidth = 8
          ctx.strokeStyle = '#5e3a1a'
          ctx.stroke()
          ctx.fillStyle = '#3a2412'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          const text = left ? `◀ ${p.title}` : `${p.title} ▶`
          // shrink to fit whichever font has loaded
          let size = 64
          do ctx.font = `${size}px "Lilita One", "Arial Black", sans-serif`
          while (ctx.measureText(text).width > w - 56 && --size > 20)
          ctx.fillText(text, w / 2, h / 2 + 4)
        })
        return { p, tex, left }
      }),
    [],
  )
  return (
    <group position={[SIGN[0], 0, SIGN[1]]}>
      <mesh position-y={1} castShadow>
        <cylinderGeometry args={[0.08, 0.1, 2, 8]} />
        <Toon color="#6b4423" />
      </mesh>
      {boards.map(({ p, tex, left }, i) => (
        <group key={p.id} position-y={1.65 - i * 0.48} rotation-y={left ? 0.12 : -0.12}>
          <mesh position-x={left ? -0.55 : 0.55} castShadow>
            <boxGeometry args={[1.5, 0.38, 0.06]} />
            <Toon color="#c98b4e" />
          </mesh>
          <mesh position={[left ? -0.55 : 0.55, 0, 0.032]}>
            <planeGeometry args={[1.5, 0.375]} />
            <meshBasicMaterial map={tex} toneMapped={false} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// Little flowers dotted over the grass, off the paths. One draw call.
function Flowers() {
  const ref = (m) => {
    if (!m || m.userData.done) return
    const o = new Object3D()
    const colors = ['#ffffff', '#ffd84a', '#ff8fb1', '#b9a3ff', '#ffb36b'].map((c) => new Color(c))
    let n = 0
    let seed = 7
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    while (n < m.count) {
      const a = rand() * Math.PI * 2
      const r = 2.9 + Math.sqrt(rand()) * (PLAZA_RADIUS - 3.5)
      const x = Math.cos(a) * r
      const z = Math.sin(a) * r
      // keep off the portal paths and the portal pads
      const onPath = portals.some((p) => {
        const len = Math.hypot(p.x, p.z)
        const t = (x * p.x + z * p.z) / (len * len)
        const px = p.x * t
        const pz = p.z * t
        return (t > 0 && t < 1.25 && Math.hypot(x - px, z - pz) < 1.3) || Math.hypot(x - p.x, z - p.z) < 2.6
      })
      if (onPath) continue
      o.position.set(x, 0.08, z)
      o.scale.setScalar(0.6 + rand() * 0.7)
      o.updateMatrix()
      m.setMatrixAt(n, o.matrix)
      m.setColorAt(n, colors[Math.floor(rand() * colors.length)])
      n++
    }
    m.instanceMatrix.needsUpdate = true
    m.userData.done = true
  }
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 160]}>
      <icosahedronGeometry args={[0.09, 0]} />
      <meshToonMaterial gradientMap={TOON_RAMP} />
    </instancedMesh>
  )
}

function Rocks() {
  const rocks = [
    [-3.6, 6.2, 0.35],
    [4.2, 6.9, 0.28],
    [-10, 1.6, 0.4],
    [10.1, 1.8, 0.32],
    [0.6, 9.8, 0.3],
    [-2.8, -6.6, 0.25],
  ]
  return rocks.map(([x, z, s], i) => (
    <mesh key={i} position={[x, s * 0.4, z]} scale={s} rotation={[i, i * 2, 0]} castShadow>
      <dodecahedronGeometry args={[1, 0]} />
      <Toon color="#a89a8a" flatShading />
    </mesh>
  ))
}

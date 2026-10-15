import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  MathUtils,
  ShaderMaterial,
} from 'three'
import { walkToPortal } from '../portal-nav.js'
import { player, uiStore } from '../store.js'
import { canvasTexture, roundRect } from './canvasTexture.js'
import { OUTLINE, TOON_RAMP } from './toon.js'

const RING = 1.45
const CENTER_Y = 1.72

const swirlVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }`
const swirlFragment = /* glsl */ `
  uniform float uTime;
  uniform float uBoost;
  uniform vec3 uColor;
  varying vec2 vUv;
  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    float a = atan(p.y, p.x);
    float t = uTime * (1.6 + uBoost * 2.0);
    float arms = sin(a * 3.0 + r * 9.0 - t * 2.0) * 0.5 + 0.5;
    float fine = sin(a * 7.0 - r * 16.0 + t * 1.3) * 0.5 + 0.5;
    float core = pow(1.0 - r, 3.0);
    vec3 deep = uColor * 0.28;
    vec3 col = mix(deep, uColor * 1.15, arms * 0.75 + fine * 0.25);
    col = mix(col, vec3(1.0), core * (0.7 + uBoost * 0.3));
    col += uColor * smoothstep(0.75, 1.0, r) * 0.6; // bright rim
    float alpha = smoothstep(1.0, 0.94, r);
    gl_FragColor = vec4(col, alpha);
    #include <colorspace_fragment>
  }`

export default function Portal({ p }) {
  const gl = useThree((s) => s.gl)
  const boost = useRef(0)
  const ring = useRef()
  const light = useRef()
  const pad = useRef()
  const label = useRef()

  const swirl = useMemo(
    () =>
      new ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        uniforms: { uTime: { value: 0 }, uBoost: { value: 0 }, uColor: { value: new Color(p.color) } },
        vertexShader: swirlVertex,
        fragmentShader: swirlFragment,
      }),
    [p.color],
  )

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime
    const ui = uiStore.get()
    const focus = ui.near?.id === p.id || ui.leaving?.id === p.id
    boost.current = MathUtils.damp(boost.current, focus ? 1 : 0, 4, dt)
    const b = boost.current
    swirl.uniforms.uTime.value = t
    swirl.uniforms.uBoost.value = b
    ring.current.scale.setScalar(1 + b * 0.04 + Math.sin(t * 2) * 0.01)
    light.current.intensity = 6 + b * 10 + (player.leaving >= 0 && ui.leaving?.id === p.id ? 30 : 0)
    pad.current.material.opacity = 0.35 + b * 0.35 + Math.sin(t * 3) * 0.05
    label.current.position.y = 3.85 + Math.sin(t * 1.4 + p.x) * 0.06
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
    // Anything that belongs to the portal (ring, swirl, sign, floating bits) is clickable
    <group position={[p.x, 0, p.z]} rotation-y={p.yaw} onClick={onClick} onPointerOver={hover(true)} onPointerOut={hover(false)}>
      <group ref={ring} position-y={CENTER_Y}>
        <mesh material={swirl}>
          <circleGeometry args={[RING - 0.08, 64]} />
        </mesh>
        <mesh castShadow>
          <torusGeometry args={[RING, 0.17, 14, 64]} />
          <meshToonMaterial color={p.frame} gradientMap={TOON_RAMP} />
        </mesh>
        <mesh material={OUTLINE}>
          <torusGeometry args={[RING, 0.21, 10, 64]} />
        </mesh>
        <Studs color={p.color} />
      </group>

      {/* Feet */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 1.45, 0.2, 0]} castShadow>
          <boxGeometry args={[0.55, 0.4, 0.7]} />
          <meshToonMaterial color="#cbb79a" gradientMap={TOON_RAMP} />
        </mesh>
      ))}

      {/* Glowing pad on the ground */}
      <mesh ref={pad} rotation-x={-Math.PI / 2} position-y={0.02}>
        <ringGeometry args={[1.3, 2.0, 48]} />
        <meshBasicMaterial color={p.color} transparent opacity={0.4} depthWrite={false} blending={AdditiveBlending} />
      </mesh>

      <pointLight ref={light} color={p.color} intensity={6} distance={8} decay={1.6} position={[0, CENTER_Y, 0.8]} />
      <Sparks color={p.color} />
      <group ref={label}>
        <Label p={p} />
      </group>
      {p.id === 'dev' ? <CodeBits color={p.color} /> : <PhotoFrames />}
    </group>
  )
}

function Studs({ color }) {
  return Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2
    return (
      <mesh key={i} position={[Math.cos(a) * RING, Math.sin(a) * RING, 0.17]}>
        <sphereGeometry args={[0.055, 8, 6]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    )
  })
}

function Label({ p }) {
  const tex = useMemo(
    () =>
      canvasTexture(640, 220, (ctx, w, h) => {
        ctx.fillStyle = '#fff8e6'
        roundRect(ctx, 8, 8, w - 16, h - 16, 40)
        ctx.fill()
        ctx.lineWidth = 10
        ctx.strokeStyle = '#3a2412'
        ctx.stroke()
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = '#3a2412'
        ctx.font = '92px "Lilita One", "Arial Black", sans-serif'
        ctx.fillText(p.title, w / 2, h / 2 - 18)
        ctx.fillStyle = p.frame
        ctx.font = '800 40px Nunito, "Trebuchet MS", sans-serif'
        ctx.fillText(new URL(p.url).host.replace(/^www\./, ''), w / 2, h / 2 + 56)
      }),
    [p],
  )
  return (
    <mesh>
      <planeGeometry args={[2.6, 0.89]} />
      <meshBasicMaterial map={tex} transparent toneMapped={false} side={DoubleSide} />
    </mesh>
  )
}

// Motes drifting up through the ring
function Sparks({ color, count = 48 }) {
  const { geometry, seeds } = useMemo(() => {
    const g = new BufferGeometry()
    g.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3))
    const seeds = Array.from({ length: count }, () => [Math.random(), Math.random(), Math.random()])
    return { geometry: g, seeds }
  }, [count])
  const dot = useMemo(
    () =>
      canvasTexture(64, 64, (ctx) => {
        const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
        grad.addColorStop(0, 'rgba(255,255,255,1)')
        grad.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = grad
        ctx.fillRect(0, 0, 64, 64)
      }),
    [],
  )
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const pos = geometry.attributes.position
    for (let i = 0; i < count; i++) {
      const [a, b, c] = seeds[i]
      const life = (t * (0.25 + c * 0.25) + a) % 1
      const ang = a * Math.PI * 2 + t * 0.3
      const r = 0.5 + b * 1.4
      pos.setXYZ(i, Math.cos(ang) * r, 0.1 + life * 3.6, Math.sin(ang) * r * 0.5)
    }
    pos.needsUpdate = true
  })
  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        color={color}
        map={dot}
        size={0.16}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
        toneMapped={false}
      />
    </points>
  )
}

// Floating code blocks round the engineering portal
function CodeBits({ color }) {
  const glyphs = ['</>', '{ }', '$_', 'λ', '01', 'db']
  const spots = [
    [-2.4, 2.6, -0.4],
    [-2.0, 1.2, 0.2],
    [2.3, 2.9, -0.3],
    [2.1, 1.4, 0.3],
    [-0.9, 4.6, -0.5],
    [1.1, 4.7, -0.4],
  ]
  const textures = useMemo(
    () =>
      glyphs.map((g) =>
        canvasTexture(128, 128, (ctx, w, h) => {
          ctx.fillStyle = '#14233a'
          ctx.fillRect(0, 0, w, h)
          ctx.strokeStyle = color
          ctx.lineWidth = 6
          ctx.strokeRect(6, 6, w - 12, h - 12)
          ctx.fillStyle = color
          ctx.font = '800 52px ui-monospace, Menlo, monospace'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText(g, w / 2, h / 2 + 2)
        }),
      ),
    [color],
  )
  const refs = useRef([])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    refs.current.forEach((m, i) => {
      if (!m) return
      m.position.y = spots[i][1] + Math.sin(t * 1.2 + i * 1.3) * 0.15
      m.rotation.y = t * 0.5 + i
      m.rotation.x = Math.sin(t * 0.7 + i) * 0.3
    })
  })
  return spots.map((s, i) => (
    <mesh key={i} ref={(m) => (refs.current[i] = m)} position={s} castShadow>
      <boxGeometry args={[0.42, 0.42, 0.42]} />
      <meshBasicMaterial map={textures[i]} toneMapped={false} />
    </mesh>
  ))
}

// Floating prints round the photography portal: little made-up "photos"
// (sunset, blue hour, neon street, sea, sakura) in white borders
function PhotoFrames() {
  const shots = [
    ['#ff9a5a', '#ffd38a', '#3a2a4a', 'sun'],
    ['#1d2b5a', '#5a7bd0', '#0f1630', 'city'],
    ['#2a1240', '#ff4fa3', '#120818', 'neon'],
    ['#7fd3e8', '#e8f6ff', '#2f7e96', 'sea'],
    ['#ffd1dc', '#fff2f5', '#8a5a64', 'bloom'],
  ]
  const spots = [
    [-2.5, 2.7, -0.3, 0.25],
    [-2.1, 1.3, 0.3, -0.15],
    [2.4, 2.9, -0.2, -0.3],
    [2.2, 1.4, 0.3, 0.2],
    [0, 4.75, -0.5, 0.05],
  ]
  const textures = useMemo(
    () =>
      shots.map(([a, b, ground, kind]) =>
        canvasTexture(200, 150, (ctx, w, h) => {
          ctx.fillStyle = '#fbfaf6'
          ctx.fillRect(0, 0, w, h)
          const x = 10
          const y = 10
          const iw = w - 20
          const ih = h - 34
          const g = ctx.createLinearGradient(0, y, 0, y + ih)
          g.addColorStop(0, a)
          g.addColorStop(1, b)
          ctx.fillStyle = g
          ctx.fillRect(x, y, iw, ih)
          ctx.fillStyle = ground
          if (kind === 'sun' || kind === 'sea') {
            ctx.beginPath()
            ctx.arc(x + iw * 0.62, y + ih * 0.62, 16, 0, Math.PI * 2)
            ctx.fillStyle = kind === 'sun' ? '#fff3c4' : '#ffffff'
            ctx.fill()
            ctx.fillStyle = ground
            ctx.fillRect(x, y + ih * 0.7, iw, ih * 0.3)
          } else if (kind === 'city' || kind === 'neon') {
            let cx = x
            let i = 0
            while (cx < x + iw) {
              const bw = 12 + ((i * 37) % 18)
              const bh = 25 + ((i * 53) % 50)
              ctx.fillStyle = ground
              ctx.fillRect(cx, y + ih - bh, bw - 2, bh)
              if (kind === 'neon') {
                ctx.fillStyle = i % 2 ? '#4ff0ff' : '#ffd84a'
                ctx.fillRect(cx + 3, y + ih - bh + 6, 4, 4)
              }
              cx += bw
              i++
            }
          } else {
            for (let i = 0; i < 18; i++) {
              ctx.fillStyle = i % 2 ? '#ff9fb6' : '#ffc4d2'
              ctx.beginPath()
              ctx.arc(x + ((i * 47) % iw), y + ((i * 29) % ih), 7, 0, Math.PI * 2)
              ctx.fill()
            }
          }
        }),
      ),
    [],
  )
  const refs = useRef([])
  useFrame((state) => {
    const t = state.clock.elapsedTime
    refs.current.forEach((m, i) => {
      if (!m) return
      m.position.y = spots[i][1] + Math.sin(t * 1.1 + i * 1.7) * 0.14
      m.rotation.z = spots[i][3] + Math.sin(t * 0.8 + i) * 0.06
      m.rotation.y = Math.sin(t * 0.5 + i * 2) * 0.35
    })
  })
  return spots.map(([x, y, z], i) => (
    <group key={i} ref={(m) => (refs.current[i] = m)} position={[x, y, z]}>
      <mesh castShadow>
        <boxGeometry args={[0.84, 0.64, 0.03]} />
        <meshToonMaterial color="#fbfaf6" gradientMap={TOON_RAMP} />
      </mesh>
      {[0.016, -0.016].map((dz) => (
        <mesh key={dz} position-z={dz} rotation-y={dz < 0 ? Math.PI : 0}>
          <planeGeometry args={[0.8, 0.6]} />
          <meshBasicMaterial map={textures[i]} toneMapped={false} />
        </mesh>
      ))}
    </group>
  ))
}

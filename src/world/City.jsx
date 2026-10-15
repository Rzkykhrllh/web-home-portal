import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, MeshBasicMaterial } from 'three/webgpu'
import { SANS, canvasTexture, rng } from './canvasTexture.js'

// Lit office and apartment windows. A few variants, shared by every building.
const cache = new Map()
export function windowsTexture(seed) {
  if (cache.has(seed)) return cache.get(seed)
  const tex = canvasTexture(
    128,
    256,
    (ctx, w, h) => {
      const r = rng(seed * 97 + 3)
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, w, h)
      const cols = 8
      const rows = 16
      const cw = w / cols
      const rh = h / rows
      for (let y = 0; y < rows; y++) {
        // whole floors tend to be lit or dark together, like real offices
        const floor = r()
        for (let x = 0; x < cols; x++) {
          const lit = r() < (floor > 0.6 ? 0.75 : floor > 0.25 ? 0.3 : 0.05)
          if (!lit) continue
          const k = r()
          ctx.fillStyle = k < 0.55 ? '#ffd7a0' : k < 0.85 ? '#d6e8ff' : '#9fffe0'
          ctx.globalAlpha = 0.35 + r() * 0.65
          ctx.fillRect(x * cw + 3, y * rh + 3, cw - 6, rh - 6)
        }
      }
      ctx.globalAlpha = 1
    },
    { repeat: true },
  )
  cache.set(seed, tex)
  return tex
}

// The city around the roof: blocks of lit windows fading into the haze, red
// aircraft lights blinking on the tall ones, and one big vertical sign.
export default function City() {
  const { buildings, beacons } = useMemo(() => {
    const r = rng(42)
    const buildings = []
    const beacons = []
    for (let i = 0; i < 70; i++) {
      // mostly behind and to the sides; the camera looks that way
      const a = Math.PI * (0.05 + r() * 0.9) + Math.PI // 180°..360° = behind (−z)
      const side = r() < 0.2 ? Math.PI * (r() < 0.5 ? -0.35 : 0.35) : 0
      const dist = 28 + r() * 80
      const x = Math.cos(a + side) * dist
      const z = Math.sin(a + side) * dist - 4
      const w = 5 + r() * 9
      const d = 5 + r() * 9
      // near blocks sit below the roof so we look out over them; the far ones tower
      const top = dist < 48 ? -20 + r() * 16 : -12 + r() * 44
      const h = top + 70
      buildings.push({ x, z, w, d, h, top, seed: 1 + Math.floor(r() * 4), rot: (r() - 0.5) * 0.3 })
      if (top > 6) beacons.push([x, top + 0.6, z])
    }
    return { buildings, beacons }
  }, [])

  const mats = useMemo(
    () =>
      buildings.map((b) => {
        const t = windowsTexture(b.seed).clone()
        t.repeat.set(Math.max(1, Math.round(b.w / 3.2)), Math.round(b.h / 3.4))
        t.needsUpdate = true
        return t
      }),
    [buildings],
  )

  return (
    <group>
      {buildings.map((b, i) => (
        <mesh key={i} position={[b.x, b.top - b.h / 2, b.z]} rotation-y={b.rot}>
          <boxGeometry args={[b.w, b.h, b.d]} />
          {/* windows on the walls, a plain dark roof on top (box face 2) */}
          {[0, 1, 2, 3, 4, 5].map((f) =>
            f === 2 || f === 3 ? (
              <meshStandardMaterial key={f} attach={`material-${f}`} color="#141824" roughness={0.95} />
            ) : (
              <meshStandardMaterial key={f} attach={`material-${f}`} color="#0a0d16" emissive="#ffffff" emissiveMap={mats[i]} emissiveIntensity={1.1} roughness={0.9} />
            ),
          )}
        </mesh>
      ))}
      <Beacons points={beacons} />
      <BigSign />
    </group>
  )
}

function Beacons({ points }) {
  const red = useMemo(() => new Color('#ff2a2a').multiplyScalar(5), [])
  const mat = useMemo(() => new MeshBasicMaterial({ color: red.clone(), toneMapped: false }), [red])
  useFrame((state) => {
    const on = Math.sin(state.clock.elapsedTime * 2.2) > 0.2
    mat.color.copy(red).multiplyScalar(on ? 1 : 0.08)
  })
  return (
    <group>
      {points.map((p, i) => (
        <mesh key={i} position={p} material={mat}>
          <sphereGeometry args={[0.35, 8, 6]} />
        </mesh>
      ))}
    </group>
  )
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
  const color = useMemo(() => new Color('#ffffff').multiplyScalar(1.8), [])
  return (
    <group position={[-18, 0, -40]}>
      <mesh position-y={-30}>
        <boxGeometry args={[12, 60, 8]} />
        <meshStandardMaterial color="#090b12" roughness={0.9} />
      </mesh>
      <mesh position={[4.5, 7, 4.05]}>
        <planeGeometry args={[3, 10.8]} />
        <meshBasicMaterial map={tex} color={color} toneMapped={false} />
      </mesh>
      
    </group>
  )
}

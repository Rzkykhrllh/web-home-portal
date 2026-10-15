import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { TOON_RAMP } from './toon.js'

// Puffy clouds drifting round (and below) the island
export default function Clouds() {
  const group = useRef()
  const clouds = useMemo(() => {
    let seed = 3
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    return Array.from({ length: 14 }, (_, i) => {
      const a = (i / 14) * Math.PI * 2 + rand() * 0.3
      const r = 17 + rand() * 18
      const y = -7 + rand() * 9
      const puffs = Array.from({ length: 3 + Math.floor(rand() * 3) }, (_, j) => [
        (j - 1.5) * 1.1 + rand() * 0.4,
        rand() * 0.6,
        rand() * 0.8,
        0.9 + rand() * 0.9,
      ])
      return { pos: [Math.cos(a) * r, y, Math.sin(a) * r], s: 0.8 + rand() * 0.9, puffs }
    })
  }, [])
  useFrame((_, dt) => {
    group.current.rotation.y += dt * 0.012
  })
  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <group key={i} position={c.pos} scale={c.s}>
          {c.puffs.map(([x, y, z, r], j) => (
            <mesh key={j} position={[x, y, z]}>
              <icosahedronGeometry args={[r, 2]} />
              <meshToonMaterial color="#fff4ec" gradientMap={TOON_RAMP} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

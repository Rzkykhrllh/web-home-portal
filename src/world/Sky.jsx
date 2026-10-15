import { useMemo } from 'react'
import { BackSide, MeshBasicNodeMaterial } from 'three/webgpu'
import { Fn, color, mix, mx_noise_float, positionLocal, select, smoothstep, max, vec3 } from 'three/tsl'

// Tokyo night: no stars, a deep blue overhead going to the dull magenta glow
// of city light bouncing off low cloud near the horizon.
export const HAZE = '#2a1d33'

export default function Sky() {
  const material = useMemo(() => {
    const m = new MeshBasicNodeMaterial({ side: BackSide, depthWrite: false, fog: false })
    m.colorNode = Fn(() => {
      const top = color('#050816')
      const mid = color('#1b1838')
      const glow = color('#5a2e4c')
      const low = color(HAZE)
      const dir = positionLocal.normalize()
      const h = dir.y
      const above = mix(mix(mid, top, smoothstep(0.05, 0.6, h)), glow, smoothstep(0.25, 0.0, h).mul(0.9))
      const below = mix(glow, low, smoothstep(0.0, -0.2, h))
      const c = select(h.lessThan(0), below, above).toVar()
      // a layer of low cloud catching the light
      const uv = dir.xz.div(max(h, 0.08)).mul(0.6)
      const n = mx_noise_float(vec3(uv.mul(2), 0)).mul(0.5).add(0.5) // one octave is plenty this faint
      c.addAssign(glow.mul(0.35).mul(smoothstep(0.45, 0.85, n)).mul(smoothstep(0.5, 0.08, h)).mul(h.greaterThan(0).select(1, 0)))
      return c
    })()
    return m
  }, [])
  return (
    <mesh material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[250, 32, 16]} />
    </mesh>
  )
}

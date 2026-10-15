import { useMemo } from 'react'
import { BackSide, MeshBasicNodeMaterial, Vector3 } from 'three/webgpu'
import { Fn, asin, atan, color, dot, floor, fract, hash, max, mix, mx_noise_float, positionLocal, pow, select, sin, smoothstep, step, time, vec2, vec3 } from 'three/tsl'

// Clear night over Tokyo, illustrated: deep indigo overhead, violet in the
// middle, a magenta-pink band of city glow on the horizon, stars, a crescent
// moon, and a few dark clouds lying low over the skyline.
export const HAZE = '#7a3f86' // fog colour: what the far skyline fades into
export const MOON_DIR = new Vector3(0.2, 0.2, -0.96).normalize()

export default function Sky() {
  const material = useMemo(() => {
    const m = new MeshBasicNodeMaterial({ side: BackSide, depthWrite: false, fog: false })
    m.colorNode = Fn(() => {
      const dir = positionLocal.normalize()
      const h = dir.y
      const c = mix(color('#b24c8f'), color('#5a2f86'), smoothstep(0.0, 0.16, h)).toVar()
      c.assign(mix(c, color('#2a1d63'), smoothstep(0.14, 0.42, h)))
      c.assign(mix(c, color('#100c35'), smoothstep(0.4, 0.85, h)))
      c.assign(select(h.lessThan(0), mix(color('#b24c8f'), color(HAZE), smoothstep(0.0, -0.15, h)), c))

      // stars: one per cell of a lat/long grid, most cells empty
      const uv = vec2(atan(dir.z, dir.x).mul(70), asin(h).mul(70))
      const id = floor(uv)
      const f = fract(uv).sub(0.5)
      const r = hash(id.x.mul(12.9).add(id.y.mul(78.2)))
      const offset = vec2(hash(id.x.add(id.y.mul(3.1))), hash(id.y.add(id.x.mul(5.7)))).sub(0.5).mul(0.6)
      const d = f.sub(offset).length()
      const twinkle = sin(time.mul(r.mul(3).add(1)).add(r.mul(80))).mul(0.35).add(0.65)
      const star = step(0.955, r).mul(smoothstep(0.12, 0.0, d)).mul(twinkle).mul(smoothstep(0.12, 0.35, h))
      c.addAssign(vec3(1.0, 0.95, 1.0).mul(star).mul(1.6))

      // crescent moon: a disc with a slightly offset disc taken out of it, and a soft halo
      const moon = vec3(MOON_DIR.x, MOON_DIR.y, MOON_DIR.z)
      const bite = vec3(MOON_DIR.x - 0.028, MOON_DIR.y + 0.014, MOON_DIR.z).normalize()
      const a = dot(dir, moon)
      const disc = smoothstep(0.99935, 0.9995, a).mul(smoothstep(0.9995, 0.99935, dot(dir, bite)))
      c.addAssign(vec3(1.0, 0.97, 0.9).mul(disc).mul(3.0))
      c.addAssign(color('#8f7ad6').mul(pow(max(a, 0), 400)).mul(0.35))

      // low dark clouds over the skyline
      const cu = dir.xz.div(max(h, 0.04))
      const n = mx_noise_float(vec3(cu.x.mul(0.8), cu.y.mul(2.2), 1)).mul(0.5).add(0.5)
      const band = smoothstep(0.02, 0.07, h).mul(smoothstep(0.2, 0.09, h))
      c.assign(mix(c, color('#3a2366'), smoothstep(0.55, 0.75, n).mul(band).mul(0.8)))
      return c
    })()
    return m
  }, [])
  return (
    <mesh material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[350, 48, 24]} />
    </mesh>
  )
}

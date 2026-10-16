import { useMemo } from 'react'
import { BackSide, MeshBasicNodeMaterial } from 'three/webgpu'
import { Fn, asin, atan, color, dot, floor, fract, hash, max, mix, mx_noise_float, positionLocal, pow, select, sin, smoothstep, step, time, vec2, vec3 } from 'three/tsl'
import { MOON_DIR, U } from './Atmosphere.jsx'

// Illustrated Tokyo sky for any hour: a gradient from the horizon glow up to
// the zenith (colours come from Atmosphere), stars, a crescent moon, the sun
// by day, and low clouds that thicken into overcast when it rains or snows.
export default function Sky() {
  const material = useMemo(() => {
    const m = new MeshBasicNodeMaterial({ side: BackSide, depthWrite: false, fog: false })
    m.colorNode = Fn(() => {
      const dir = positionLocal.normalize()
      const h = dir.y
      const c = mix(U.hor, U.mid, smoothstep(0.0, 0.16, h)).toVar()
      c.assign(mix(c, U.top, smoothstep(0.14, 0.75, h)))
      c.assign(select(h.lessThan(0), mix(U.hor, U.below, smoothstep(0.0, -0.15, h)), c))

      // stars: one per cell of a lat/long grid, most cells empty
      const uv = vec2(atan(dir.z, dir.x).mul(70), asin(h).mul(70))
      const id = floor(uv)
      const f = fract(uv).sub(0.5)
      const r = hash(id.x.mul(12.9).add(id.y.mul(78.2)))
      const offset = vec2(hash(id.x.add(id.y.mul(3.1))), hash(id.y.add(id.x.mul(5.7)))).sub(0.5).mul(0.6)
      const d = f.sub(offset).length()
      const twinkle = sin(time.mul(r.mul(3).add(1)).add(r.mul(80))).mul(0.35).add(0.65)
      const star = step(0.955, r).mul(smoothstep(0.12, 0.0, d)).mul(twinkle).mul(smoothstep(0.12, 0.35, h))
      c.addAssign(vec3(1.0, 0.95, 1.0).mul(star).mul(1.6).mul(U.stars))

      // crescent moon: a disc with a slightly offset disc taken out of it, and a soft halo
      const moon = vec3(MOON_DIR.x, MOON_DIR.y, MOON_DIR.z)
      const bite = vec3(MOON_DIR.x - 0.028, MOON_DIR.y + 0.014, MOON_DIR.z).normalize()
      const a = dot(dir, moon)
      const disc = smoothstep(0.99935, 0.9995, a).mul(smoothstep(0.9995, 0.99935, dot(dir, bite)))
      c.addAssign(vec3(1.0, 0.97, 0.9).mul(disc).mul(3.0).mul(U.moon))
      c.addAssign(color('#8f7ad6').mul(pow(max(a, 0), 400)).mul(0.35).mul(U.moon))

      // sun: warmer the lower it sits, with a wide glow
      const sa = max(dot(dir, U.sunDir), 0)
      const low = smoothstep(0.35, 0.0, U.sunDir.y)
      const sunCol = mix(vec3(1.0, 0.96, 0.86), vec3(1.0, 0.62, 0.35), low)
      c.addAssign(sunCol.mul(smoothstep(0.99955, 0.9997, sa)).mul(4.0).mul(U.sun))
      c.addAssign(sunCol.mul(pow(sa, 60).mul(0.35).add(pow(sa, 8).mul(0.12))).mul(U.sun))

      // clouds: a low band normally, most of the sky when it's overcast
      const cu = dir.xz.div(max(h, 0.04))
      const n = mx_noise_float(vec3(cu.x.mul(0.8), cu.y.mul(2.2), time.mul(0.01))).mul(0.5).add(0.5)
      const band = smoothstep(0.02, 0.07, h).mul(smoothstep(mix(0.2, 0.9, U.overcast), 0.09, h))
      const cover = smoothstep(mix(0.55, 0.3, U.overcast), mix(0.75, 0.55, U.overcast), n)
      c.assign(mix(c, U.cloud, cover.mul(band).mul(mix(0.8, 0.9, U.overcast))))
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

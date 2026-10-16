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

      // clouds. By day: big cumulus, white where the sun catches them and
      // lavender-grey underneath. By night: a dark band low over the city.
      // Overcast weather spreads them over the whole sky.
      // Sampled by direction (azimuth, height) rather than projected onto a
      // flat layer, so they billow upwards from the skyline like cumulus.
      const az = atan(dir.z, dir.x)
      const q = vec3(az.mul(2.4), h.mul(7.0), time.mul(0.01))
      const fbm = (v) => mx_noise_float(v).mul(0.55).add(mx_noise_float(v.mul(2.1)).mul(0.3)).add(mx_noise_float(v.mul(4.3)).mul(0.15)).mul(0.5).add(0.5)
      const n = fbm(q)
      // denser towards the horizon, taller by day and when overcast
      const rise = smoothstep(mix(0.16, 0.34, U.day).add(U.overcast.mul(0.6)), 0.02, h)
      const dens = n.add(rise.mul(0.35)).sub(0.22)
      const threshold = mix(mix(0.52, 0.55, U.day), 0.22, U.overcast)
      // crisp poster edges instead of soft vapour
      const cover = smoothstep(threshold, threshold.add(0.02), dens).mul(smoothstep(0.012, 0.02, h))
      // lit from above and from the sun's side: compare with a sample nudged that way
      const nUp = mx_noise_float(q.add(vec3(U.sunDir.x.mul(0.25), 0.35, 0))).mul(0.5).add(0.5)
      // two flat tones, with a thin mid band, like a cut-paper cloud
      const light = smoothstep(0.46, 0.5, n.sub(nUp).mul(3.0).add(0.55)).mul(0.75).add(smoothstep(0.7, 0.74, n.sub(nUp).mul(3.0).add(0.55)).mul(0.25))
      const lit = mix(U.cloud, vec3(1.0, 0.99, 0.97), U.day.mul(0.9))
      const shade = mix(U.cloud.mul(0.7), color('#8e9cc8'), U.day)
      const cloudCol = mix(shade, lit, light).add(sunCol.mul(pow(sa, 6).mul(0.25)).mul(U.sun)) // warm rim near the sun
      c.assign(mix(c, cloudCol, cover.mul(mix(0.88, 0.94, U.overcast))))
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

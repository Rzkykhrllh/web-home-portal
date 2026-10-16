import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RenderPipeline } from 'three/webgpu'
import { Fn, dot, fract, hash, mix, pass, renderOutput, screenUV, select, smoothstep, time, vec3, vec4 } from 'three/tsl'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { fxaa } from 'three/addons/tsl/display/FXAANode.js'
import { grade, takePendingShot } from '../photo.js'
import { QUALITY } from '../quality.js'

// Bloom so the neon actually glows. Only things brighter than white (signs,
// portals, bulbs, the vending machine; their colours are pushed past 1) cross
// the threshold, so the rest of the scene stays crisp. FXAA after tone
// mapping, as a cheap stand-in for MSAA. Last, photo mode's looks: a film
// or mono grade, grain and a vignette (all off in the normal view).
export default function Effects() {
  const { gl, scene, camera } = useThree()
  const pipeline = useMemo(() => {
    const p = new RenderPipeline(gl)
    p.outputColorTransform = false
    const color = pass(scene, camera).getTextureNode('output')
    const graded = renderOutput(color.add(bloom(color, 0.5, 0.4, 1.0)))
    // at retina resolution edges are already fine; FXAA would only soften them
    const out = QUALITY.dpr >= 1.75 ? graded : fxaa(graded)
    p.outputNode = Fn(() => {
      const c = out.rgb.toVar()
      // the everyday look: a gentle S-curve and a touch more colour, so the
      // picture has some bite instead of looking flat
      c.assign(mix(c, c.mul(c).mul(c.mul(-2).add(3)), 0.22))
      const l0 = dot(c, vec3(0.299, 0.587, 0.114))
      c.assign(mix(vec3(l0), c, 1.1).max(0))
      const lum = dot(c, vec3(0.299, 0.587, 0.114))
      // film: a little faded and warm, blacks lifted
      const film = mix(vec3(lum), c, 0.85).mul(vec3(1.04, 1.0, 0.9)).mul(0.9).add(vec3(0.055, 0.045, 0.06))
      // mono: contrasty black and white
      const mono = vec3(smoothstep(0.03, 0.95, lum))
      c.assign(select(grade.mode.equal(1), film, select(grade.mode.equal(2), mono, c)))
      // grain (stronger on film and mono) and a vignette, only in photo mode
      const n = hash(screenUV.x.mul(1931.7).add(screenUV.y.mul(6113.3)).add(fract(time.mul(23.0)).mul(97.0)))
      const amount = select(grade.mode.equal(0), 0.035, 0.07).mul(grade.on)
      c.addAssign(n.sub(0.5).mul(amount))
      const vig = smoothstep(0.9, 0.3, screenUV.sub(0.5).length())
      c.mulAssign(mix(1, mix(0.6, 1, vig), grade.on))
      return vec4(c, 1)
    })()
    return p
  }, [gl, scene, camera])

  // Priority 1 takes over rendering from R3F. A requested photo is read back
  // straight after the frame is drawn, in the same task.
  useFrame(() => {
    pipeline.render()
    takePendingShot(gl.domElement)
  }, 1)
  return null
}

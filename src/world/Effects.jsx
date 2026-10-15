import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RenderPipeline } from 'three/webgpu'
import { pass, renderOutput } from 'three/tsl'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'
import { fxaa } from 'three/addons/tsl/display/FXAANode.js'

// Bloom so the neon actually glows. Only things brighter than white (signs,
// portals, bulbs, the vending machine; their colours are pushed past 1) cross
// the threshold, so the rest of the scene stays crisp. FXAA last, after tone
// mapping, as a cheap stand-in for MSAA.
export default function Effects() {
  const { gl, scene, camera } = useThree()
  const pipeline = useMemo(() => {
    const p = new RenderPipeline(gl)
    p.outputColorTransform = false
    const color = pass(scene, camera).getTextureNode('output')
    p.outputNode = fxaa(renderOutput(color.add(bloom(color, 0.8, 0.5, 0.92))))
    return p
  }, [gl, scene, camera])

  // Priority 1 takes over rendering from R3F
  useFrame(() => pipeline.render(), 1)
  return null
}

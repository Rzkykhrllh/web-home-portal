import { useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { RenderPipeline } from 'three/webgpu'
import { pass } from 'three/tsl'
import { bloom } from 'three/addons/tsl/display/BloomNode.js'

// Bloom so the neon actually glows. Only things brighter than white (signs,
// portals, bulbs, the vending machine; their colours are pushed past 1) cross
// the threshold, so the rest of the scene stays crisp.
export default function Effects() {
  const { gl, scene, camera } = useThree()
  const pipeline = useMemo(() => {
    const p = new RenderPipeline(gl)
    const scenePass = pass(scene, camera)
    const color = scenePass.getTextureNode('output')
    p.outputNode = color.add(bloom(color, 0.8, 0.5, 0.92))
    return p
  }, [gl, scene, camera])

  // Priority 1 takes over rendering from R3F
  useFrame(() => pipeline.render(), 1)
  return null
}

import { BackSide, DataTexture, MeshBasicNodeMaterial, NearestFilter, RedFormat } from 'three/webgpu'
import { normalLocal, positionLocal } from 'three/tsl'

// Three-band ramp for the cat's MeshToonMaterial, same as the island game
// (web-3d-project/src/render/toon.js), so it keeps its look under neon.
export const TOON_RAMP = new DataTexture(new Uint8Array([90, 180, 255]), 3, 1, RedFormat)
TOON_RAMP.minFilter = TOON_RAMP.magFilter = NearestFilter
TOON_RAMP.generateMipmaps = false
TOON_RAMP.needsUpdate = true

// Dark shell pushed out along the normals. In a node material the offset runs
// after skinning, so it follows the animated cat.
export function outlineMaterial(thickness, color = 0x07080c) {
  const m = new MeshBasicNodeMaterial({ color, side: BackSide })
  m.positionNode = positionLocal.add(normalLocal.mul(thickness))
  return m
}

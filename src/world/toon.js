import { DataTexture, MeshBasicMaterial, BackSide, NearestFilter, RedFormat } from 'three'

// Cartoon shading, same as the game (web-3d-project/src/render/toon.js): every
// lit surface uses MeshToonMaterial with this three-band ramp, so light falls
// off in clean steps instead of a smooth PBR gradient. Cheaper than
// MeshStandardMaterial too (no specular, no env map).
//
// In JSX: <meshToonMaterial gradientMap={TOON_RAMP} color="..." />

export const TOON_RAMP = new DataTexture(new Uint8Array([90, 180, 255]), 3, 1, RedFormat)
TOON_RAMP.minFilter = TOON_RAMP.magFilter = NearestFilter
TOON_RAMP.generateMipmaps = false
TOON_RAMP.needsUpdate = true

// Dark back-face shell for the cartoon outline on the runner and the crates
export const OUTLINE = new MeshBasicMaterial({ color: 0x1e1e22, side: BackSide })

import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three/webgpu'

export const SANS = '"Zen Kaku Gothic New", "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif'
export const MONO = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace'

// Draw into a canvas and wrap it as a texture. Drawings that use the web font
// are redrawn once it has loaded, so the fallback face doesn't stick.
export function canvasTexture(w, h, draw, { repeat = false, color = true } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  const tex = new CanvasTexture(canvas)
  if (color) tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 8
  if (repeat) tex.wrapS = tex.wrapT = RepeatWrapping
  const paint = () => {
    ctx.clearRect(0, 0, w, h)
    draw(ctx, w, h)
    tex.needsUpdate = true
  }
  paint()
  if (draw.length && document.fonts) {
    document.fonts.load(`700 40px "Zen Kaku Gothic New"`).then(paint, () => {})
  }
  return tex
}

// Small deterministic random, so the city and the puddles look the same on every visit
export function rng(seed = 1) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

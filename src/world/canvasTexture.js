import { CanvasTexture, SRGBColorSpace } from 'three'

// Draw into a canvas and wrap it as a texture. If the drawing uses web fonts,
// it's redrawn once they've loaded so the first frame's fallback font doesn't stick.
export function canvasTexture(w, h, draw) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  const tex = new CanvasTexture(canvas)
  tex.colorSpace = SRGBColorSpace
  tex.anisotropy = 4
  const paint = () => {
    ctx.clearRect(0, 0, w, h)
    draw(ctx, w, h)
    tex.needsUpdate = true
  }
  paint()
  document.fonts?.ready.then(paint)
  document.fonts?.load('80px "Lilita One"').then(paint, () => {})
  return tex
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

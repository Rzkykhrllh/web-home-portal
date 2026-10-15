// One switch for the expensive bits.
// Phones and `?quality=low` get the light version; `?quality=high` forces the full one.
const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('quality') : null
const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

export const LOW = q === 'low' || (q !== 'high' && coarse)
export const QUALITY = {
  rain: LOW ? 400 : 900,
  // starting pixel ratio; Perf.jsx lowers it further if the frame rate drops
  dpr: Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, LOW ? 1.25 : 1.5),
}

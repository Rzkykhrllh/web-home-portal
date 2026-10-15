// One switch for the expensive bits (puddle reflections, shadows, rain count).
// Phones and `?quality=low` get the light version; `?quality=high` forces the full one.
const q = typeof location !== 'undefined' ? new URLSearchParams(location.search).get('quality') : null
const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches

export const LOW = q === 'low' || (q !== 'high' && coarse)
export const QUALITY = {
  reflections: !LOW,
  shadows: !LOW,
  rain: LOW ? 500 : 1400,
  dpr: LOW ? [1, 1.5] : [1, 2],
}

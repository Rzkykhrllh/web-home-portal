import { useEffect, useRef, useState } from 'react'
import { FILTERS, orbit, setFilter, setPhoto, shoot } from '../photo.js'
import { shutter } from '../audio.js'
import { useUi } from '../store.js'

// Photo mode controls: drag anywhere to orbit, wheel or pinch to zoom, pick a
// look, press the shutter. Everything else in the HUD steps aside.
export default function PhotoHud() {
  const filter = useUi((s) => s.filter)
  const [flash, setFlash] = useState(0)
  const [saved, setSaved] = useState(false)
  const pointers = useRef(new Map())
  const pinch = useRef(0)

  const take = async () => {
    shutter()
    setFlash((f) => f + 1)
    await shoot()
    setSaved(true)
    setTimeout(() => setSaved(false), 1800)
  }

  useEffect(() => {
    const key = (e) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        take()
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  // drag to orbit, two fingers to zoom
  const down = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }
  const move = (e) => {
    const p = pointers.current.get(e.pointerId)
    if (!p) return
    const dx = e.clientX - p.x
    const dy = e.clientY - p.y
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      if (pinch.current) orbit.dist = clampDist(orbit.dist * (pinch.current / d))
      pinch.current = d
      return
    }
    orbit.yaw -= dx * 0.006
    orbit.pitch = Math.max(-0.05, Math.min(1.2, orbit.pitch + dy * 0.004))
  }
  const up = (e) => {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = 0
  }
  const wheel = (e) => (orbit.dist = clampDist(orbit.dist * (1 + e.deltaY * 0.001)))

  return (
    <>
      <div className="photo-surface" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={wheel} />
      <div className="photo-frame" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="photo-top">
        <span className="photo-badge">
          <span className="rec" aria-hidden="true" /> Photo mode
        </span>
        <button className="photo-exit" onClick={() => setPhoto(false)}>
          Done <kbd>Esc</kbd>
        </button>
      </div>
      <div className="photo-bar">
        <div className="photo-filters" role="radiogroup" aria-label="Look">
          {FILTERS.map((f, i) => (
            <button key={f.id} role="radio" aria-checked={filter === i} className={filter === i ? 'on' : ''} onClick={() => setFilter(i)}>
              {f.label}
            </button>
          ))}
        </div>
        <button className="shutter" onClick={take} aria-label="Take photo">
          <span />
        </button>
        <p className="photo-tip">{saved ? 'Saved to your downloads' : 'Drag to turn, scroll to zoom'}</p>
      </div>
      {flash > 0 && <div key={flash} className="photo-flash" aria-hidden="true" />}
    </>
  )
}

const clampDist = (d) => Math.max(2.5, Math.min(14, d))

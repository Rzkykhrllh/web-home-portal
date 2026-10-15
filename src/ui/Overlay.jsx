import { useRef } from 'react'
import { PORTALS } from '../config.js'
import { enterPortal } from '../portal-nav.js'
import { input, player, useUi } from '../store.js'
import { jump } from '../input.js'

const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
const hostOf = (url) => new URL(url).host.replace(/^www\./, '')

// Plain links still go through the warp; modified clicks (new tab etc.) don't
function warpClick(p) {
  return (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    enterPortal(p)
  }
}

export default function Overlay() {
  const near = useUi((s) => s.near)
  const leaving = useUi((s) => s.leaving)
  const loaded = useUi((s) => s.loaded)
  const failed = useUi((s) => s.failed)

  return (
    <>
      <header className="top">
        <div className="brand">
          <h1>
            Airu<span className="sr-only">: software engineer and photographer</span>
          </h1>
          <p>Software engineer · Photographer · Tokyo</p>
        </div>
        <nav className="skip" aria-label="Skip the walk">
          {PORTALS.map((p) => (
            <a key={p.id} href={p.url} className={`chip chip-${p.id}`} onClick={warpClick(p)}>
              {p.title} <span aria-hidden="true">↗</span>
            </a>
          ))}
        </nav>
      </header>

      {near && !leaving && (
        <aside className={`card card-${near.id}`} aria-live="polite">
          <p className="card-kicker">Portal</p>
          <h2>{near.title}</h2>
          <p className="card-blurb">{near.blurb}</p>
          <a className="card-go" href={near.url} onClick={warpClick(near)}>
            Enter {hostOf(near.url)} <span aria-hidden="true">→</span>
          </a>
          <p className="card-hint">{coarse ? 'or walk into the ring' : 'or walk in · press E'}</p>
        </aside>
      )}

      {loaded && !near && !leaving && (
        <p className="hint">
          {coarse ? (
            <>Drag the stick or tap to walk</>
          ) : (
            <>
              <kbd>WASD</kbd> walk · <kbd>Space</kbd> jump · <kbd>K</kbd> spin · or click where to go
            </>
          )}
        </p>
      )}

      {coarse && loaded && !leaving && <TouchControls />}

      <div className={`loader ${loaded || failed ? 'done' : ''}`} aria-hidden={loaded}>
        <div className="paw">🐾</div>
        <p>Waking up the cat…</p>
      </div>

      {failed && (
        <main className="fallback">
          <h2>Pick a world</h2>
          <p>The 3D plaza couldn't start on this device, but the doors are right here.</p>
          {PORTALS.map((p) => (
            <a key={p.id} href={p.url} className={`chip chip-${p.id}`}>
              {p.title} — {hostOf(p.url)}
            </a>
          ))}
        </main>
      )}

      <div className={`warp ${leaving ? 'on' : ''}`} style={{ '--c': leaving?.color ?? '#fff' }} aria-hidden="true" />
    </>
  )
}

function TouchControls() {
  const base = useRef()
  const knob = useRef()
  const id = useRef(null)

  const move = (e) => {
    const r = base.current.getBoundingClientRect()
    const max = r.width / 2
    let dx = e.clientX - (r.left + max)
    let dy = e.clientY - (r.top + max)
    const l = Math.hypot(dx, dy)
    if (l > max) {
      dx *= max / l
      dy *= max / l
    }
    input.stick.x = dx / max
    input.stick.y = dy / max
    knob.current.style.transform = `translate(${dx}px, ${dy}px)`
    player.path = []
  }
  const down = (e) => {
    id.current = e.pointerId
    base.current.setPointerCapture(e.pointerId)
    move(e)
  }
  const up = (e) => {
    if (e.pointerId !== id.current) return
    id.current = null
    input.stick.x = input.stick.y = 0
    knob.current.style.transform = ''
  }

  return (
    <>
      <div
        ref={base}
        className="stick"
        onPointerDown={down}
        onPointerMove={(e) => id.current === e.pointerId && move(e)}
        onPointerUp={up}
        onPointerCancel={up}
        role="presentation"
      >
        <div ref={knob} className="knob" />
      </div>
      <button className="jump-btn" onPointerDown={jump} aria-label="Jump">
        ⤒
      </button>
    </>
  )
}

import { useEffect, useRef, useState } from 'react'
import { PORTALS } from '../config.js'
import { enterPortal } from '../portal-nav.js'
import { input, player, useUi } from '../store.js'
import { jump } from '../input.js'
import { setSound } from '../audio.js'
import SkyControl from './SkyControl.jsx'

const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
const hostOf = (url) => new URL(url).host.replace(/^www\./, '')

// Plain clicks go through the warp; modified clicks (new tab etc.) behave like links
function warpClick(p) {
  return (e) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
    e.preventDefault()
    enterPortal(p)
  }
}

// The portal's letter in a ring of its neon colour
const Mark = ({ p }) => (
  <span className={`mark mark-${p.id}`} aria-hidden="true">
    {p.line}
  </span>
)

export default function Overlay() {
  const near = useUi((s) => s.near)
  const leaving = useUi((s) => s.leaving)
  const loaded = useUi((s) => s.loaded)
  const failed = useUi((s) => s.failed)

  return (
    <>
      {/* darkens the top and bottom edges a touch, like a film frame, so text reads over the city */}
      <div className="vignette" aria-hidden="true" />
      <header className={`top ${loaded ? 'in' : ''}`}>
        <div className="title">
          <p className="kana" lang="ja">
            アイル
          </p>
          <h1>Airu</h1>
          <p className="role">Software engineer and photographer, Tokyo</p>
        </div>
        <nav className="tags" aria-label="Go straight to">
          {PORTALS.map((p) => (
            <a key={p.id} href={p.url} className={`tag tag-${p.id}`} onClick={warpClick(p)}>
              <Mark p={p} />
              <span className="tag-jp" lang="ja">
                {p.jp}
              </span>
              <span className="tag-en">{p.title}</span>
            </a>
          ))}
        </nav>
      </header>

      {loaded && !leaving && (
        <div className="corner">
          <SkyControl />
          <NowPlaying />
        </div>
      )}

      {near && !leaving && (
        <aside className={`card card-${near.id}`} aria-live="polite">
          <div className="card-head">
            <p className="card-jp" lang="ja">
              {near.jp}
            </p>
            <h2>{near.title}</h2>
          </div>
          <p className="card-blurb">{near.blurb}</p>
          <a className="card-go" href={near.url} onClick={warpClick(near)}>
            Enter {hostOf(near.url)}
          </a>
          <p className="card-hint">{coarse ? 'Or walk through the portal' : 'Or walk through the portal, or press E'}</p>
        </aside>
      )}

      {loaded && !near && !leaving && (
        <p className="hint">
          {coarse ? (
            'Drag the stick or tap the roof to walk'
          ) : (
            <>
              <kbd>W</kbd>
              <kbd>A</kbd>
              <kbd>S</kbd>
              <kbd>D</kbd> walk <span className="sep" /> <kbd>Space</kbd> jump <span className="sep" /> click to go
            </>
          )}
        </p>
      )}

      {coarse && loaded && !leaving && <TouchControls />}

      <div className={`loader ${loaded || failed ? 'done' : ''}`} aria-hidden={loaded}>
        <p className="loader-jp" lang="ja">
          屋上へ
        </p>
        <p className="loader-en">Taking the stairs to the roof</p>
      </div>

      {failed && (
        <main className="fallback">
          <h2>Two doors</h2>
          <p>The 3D rooftop couldn't start on this device. Both sites are one tap away.</p>
          {PORTALS.map((p) => (
            <a key={p.id} href={p.url} className={`tag tag-${p.id}`}>
              <Mark p={p} />
              <span className="tag-jp" lang="ja">
                {p.jp}
              </span>
              <span className="tag-en">
                {p.title}, {hostOf(p.url)}
              </span>
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
        <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
          <path d="M12 4l-7 8h4.5v8h5v-8H19z" fill="currentColor" />
        </svg>
      </button>
    </>
  )
}

const SOUND_KEY = 'portal-sound'
const readPref = () => {
  try {
    return localStorage.getItem(SOUND_KEY) === 'on'
  } catch {
    return false
  }
}

// Rain and lofi, shown like the "now playing" corner of a lofi stream.
// Off by default; if it was on last visit, it comes back on with the first
// click or key press (browsers block audio before that).
function NowPlaying() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!readPref()) return
    const wake = () => {
      setOn(true)
      setSound(true)
    }
    window.addEventListener('pointerdown', wake, { once: true })
    window.addEventListener('keydown', wake, { once: true })
    return () => {
      window.removeEventListener('pointerdown', wake)
      window.removeEventListener('keydown', wake)
    }
  }, [])
  const toggle = (e) => {
    e.stopPropagation()
    const next = !on
    setOn(next)
    setSound(next)
    try {
      localStorage.setItem(SOUND_KEY, next ? 'on' : 'off')
    } catch {
      /* private mode: just don't remember */
    }
  }
  return (
    <button
      className={`playing ${on ? 'on' : ''}`}
      onClick={toggle}
      onPointerDown={(e) => e.stopPropagation()}
      aria-pressed={on}
      aria-label={on ? 'Turn sound off' : 'Turn on rain and lofi'}
    >
      <span className="eq" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
      <span className="playing-text">
        <span className="playing-title">{on ? 'Rain on the roof' : 'Sound is off'}</span>
        <span className="playing-sub">{on ? 'lofi, 76 bpm' : 'Tap for rain and lofi'}</span>
      </span>
    </button>
  )
}

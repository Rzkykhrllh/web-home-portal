import { useRef } from 'react'
import { PORTALS } from '../config.js'
import { enterPortal } from '../portal-nav.js'
import { input, player, useUi } from '../store.js'
import { jump } from '../input.js'

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

// Line marker, as on Tokyo station signs: a coloured ring with the line's letter
const Line = ({ p, big }) => (
  <span className={`line line-${p.id} ${big ? 'line-big' : ''}`} aria-hidden="true">
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
      <header className="top">
        <div className="nameboard">
          <p className="kana" lang="ja">
            アイル
          </p>
          <h1>Airu</h1>
          <p className="role">Software engineer and photographer in Tokyo</p>
        </div>
        <nav className="lines" aria-label="Go straight to">
          {PORTALS.map((p) => (
            <a key={p.id} href={p.url} className="line-link" onClick={warpClick(p)}>
              <Line p={p} />
              <span className="line-jp" lang="ja">
                {p.jp}
              </span>
              <span className="line-en">{p.title}</span>
            </a>
          ))}
        </nav>
      </header>

      {near && !leaving && (
        <aside className={`platform platform-${near.id}`} aria-live="polite">
          <div className="platform-head">
            <Line p={near} big />
            <div>
              <p className="platform-jp" lang="ja">
                {near.jp}
              </p>
              <h2>{near.title}</h2>
            </div>
          </div>
          <p className="platform-blurb">{near.blurb}</p>
          <a className="platform-go" href={near.url} onClick={warpClick(near)}>
            Go to {hostOf(near.url)}
          </a>
          <p className="platform-hint">{coarse ? 'Or walk through' : 'Or walk through, or press E'}</p>
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
              <kbd>D</kbd> to walk, <kbd>Space</kbd> to jump, or click where to go
            </>
          )}
        </p>
      )}

      {coarse && loaded && !leaving && <TouchControls />}

      <div className={`loader ${loaded || failed ? 'done' : ''}`} aria-hidden={loaded}>
        <p lang="ja">まもなく</p>
        <p className="loader-en">Heading up to the roof</p>
      </div>

      {failed && (
        <main className="fallback">
          <h2>Pick a line</h2>
          <p>The 3D rooftop couldn't start on this device. Both sites are one tap away.</p>
          {PORTALS.map((p) => (
            <a key={p.id} href={p.url} className="line-link">
              <Line p={p} />
              <span className="line-jp" lang="ja">
                {p.jp}
              </span>
              <span className="line-en">
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

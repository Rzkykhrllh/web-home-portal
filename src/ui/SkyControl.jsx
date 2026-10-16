import { useEffect, useId, useRef, useState } from 'react'
import { WEATHERS, goLive, setHour, setWeather, useSky } from '../sky-state.js'

const fmt = (h) => {
  const m = Math.round((h % 1) * 60)
  const hh = (Math.floor(h) + (m === 60 ? 1 : 0)) % 24
  return `${String(hh).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
// Japanese names for the parts of the day, as on a weather report
function period(h) {
  if (h >= 4.5 && h < 7) return { jp: '夜明け', en: 'Dawn' }
  if (h >= 7 && h < 16) return { jp: '昼', en: 'Day' }
  if (h >= 16 && h < 19) return { jp: '夕方', en: 'Dusk' }
  return { jp: '夜', en: 'Night' }
}
const WEATHER_LABEL = {
  clear: { jp: '晴れ', en: 'Clear' },
  rain: { jp: '雨', en: 'Rain' },
  snow: { jp: '雪', en: 'Snow' },
}

function Icon({ hour, weather }) {
  if (weather === 'rain')
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M7 15a4 4 0 0 1 .5-8 5 5 0 0 1 9.6 1.5A3.3 3.3 0 0 1 17 15z" fill="currentColor" opacity=".9" />
        <path d="M9 17l-1 3M13 17l-1 3M17 17l-1 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  if (weather === 'snow')
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    )
  const day = hour >= 6 && hour < 18
  return day ? (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <circle cx="12" cy="12" r="4.5" fill="currentColor" />
      <path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path d="M15.5 3.5a8.5 8.5 0 1 0 5 13.6A7 7 0 0 1 15.5 3.5z" fill="currentColor" />
    </svg>
  )
}

// The sky corner: Tokyo's time and weather at a glance, and a small panel to
// set your own hour and weather (or go back to what Tokyo has right now).
export default function SkyControl() {
  const sky = useSky((s) => s)
  const [open, setOpen] = useState(false)
  const root = useRef()
  const panelId = useId()

  const live = sky.mode === 'live'
  const hour = live ? sky.live.hour : sky.hour
  const weather = live ? sky.live.weather ?? 'clear' : sky.weather
  const p = period(hour)

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (e.type === 'keydown' ? e.key === 'Escape' : !root.current.contains(e.target)) setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', close)
    }
  }, [open])

  const liveSummary = [
    `Tokyo ${fmt(sky.live.hour)}`,
    sky.live.temp !== null ? `${sky.live.temp}°C` : null,
    sky.live.label,
  ]
    .filter(Boolean)
    .join(', ')

  return (
    <div className="sky" ref={root} onPointerDown={(e) => e.stopPropagation()}>
      {open && (
        <div className="sky-panel" id={panelId} role="dialog" aria-label="Time and weather">
          <div className="sky-row">
            <span className="sky-label">
              <span lang="ja">{p.jp}</span> {p.en}
            </span>
            <span className="sky-time">{fmt(hour)}</span>
          </div>
          <input
            className="sky-slider"
            type="range"
            min="0"
            max="23.75"
            step="0.25"
            value={Math.round(hour * 4) / 4}
            onChange={(e) => setHour(Number(e.target.value))}
            aria-label="Time of day"
            aria-valuetext={`${fmt(hour)}, ${p.en}`}
          />
          <div className="sky-ticks" aria-hidden="true">
            <span>0</span>
            <span>6</span>
            <span>12</span>
            <span>18</span>
            <span>24</span>
          </div>
          <div className="sky-weather" role="radiogroup" aria-label="Weather">
            {WEATHERS.map((w) => (
              <button
                key={w}
                role="radio"
                aria-checked={weather === w}
                className={weather === w ? 'on' : ''}
                onClick={() => setWeather(w)}
              >
                <Icon hour={12} weather={w === 'clear' ? 'clear' : w} />
                <span lang="ja">{WEATHER_LABEL[w].jp}</span>
                <span className="en">{WEATHER_LABEL[w].en}</span>
              </button>
            ))}
          </div>
          <button className={`sky-live ${live ? 'on' : ''}`} onClick={goLive} disabled={live}>
            <span className="dot" aria-hidden="true" />
            {live ? `Live: ${liveSummary}` : `Back to Tokyo now (${liveSummary})`}
          </button>
        </div>
      )}
      <button className="sky-chip" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls={panelId}>
        <Icon hour={hour} weather={weather} />
        <span className="sky-chip-text">
          <span className="sky-chip-title">
            {live ? 'Tokyo' : 'Your sky'} {fmt(hour)}
            {live && sky.live.temp !== null ? `  ${sky.live.temp}°` : ''}
          </span>
          <span className="sky-chip-sub">
            <span lang="ja">{WEATHER_LABEL[weather].jp}</span> {live ? (sky.live.label ?? WEATHER_LABEL[weather].en.toLowerCase()) : WEATHER_LABEL[weather].en.toLowerCase()}
            {live ? ', live' : ''}
          </span>
        </span>
      </button>
    </div>
  )
}

import { useSyncExternalStore } from 'react'

// Time of day and weather. "live" follows Tokyo right now: the clock in
// Asia/Tokyo and the current weather from Open-Meteo (free, no key). Moving
// the slider or picking a weather switches to "manual".
// URL overrides for sharing a look: ?hour=18.5&weather=rain

const TOKYO = { lat: 35.68, lon: 139.76 }
export const WEATHERS = ['clear', 'rain', 'snow']

const params = typeof location !== 'undefined' ? new URLSearchParams(location.search) : new URLSearchParams()
const urlHour = params.has('hour') ? Number(params.get('hour')) : null
const urlWeather = WEATHERS.includes(params.get('weather')) ? params.get('weather') : null

export function tokyoHour(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
  const h = Number(parts.find((p) => p.type === 'hour').value)
  const m = Number(parts.find((p) => p.type === 'minute').value)
  return h + m / 60
}

let state = {
  mode: urlHour !== null || urlWeather ? 'manual' : 'live',
  hour: urlHour ?? tokyoHour(),
  weather: urlWeather ?? 'clear',
  live: { hour: tokyoHour(), weather: null, temp: null, label: null }, // weather null until fetched
}
const listeners = new Set()
const emit = () => listeners.forEach((l) => l())
export const skyStore = {
  get: () => state,
  subscribe(l) {
    listeners.add(l)
    return () => listeners.delete(l)
  },
}
export const useSky = (select) => useSyncExternalStore(skyStore.subscribe, () => select(state))

// What the scene should show right now
export function current() {
  if (state.mode === 'live') return { hour: state.live.hour, weather: state.live.weather ?? 'clear' }
  return { hour: state.hour, weather: state.weather }
}

export function setHour(hour) {
  state = { ...state, mode: 'manual', hour, weather: state.mode === 'live' ? state.live.weather ?? 'clear' : state.weather }
  emit()
}
export function setWeather(weather) {
  state = { ...state, mode: 'manual', weather, hour: state.mode === 'live' ? state.live.hour : state.hour }
  emit()
}
export function goLive() {
  state = { ...state, mode: 'live' }
  emit()
}

// WMO weather codes → what we can draw
function fromCode(code) {
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { weather: 'snow', label: 'snow', jp: '雪' }
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return { weather: 'rain', label: code >= 95 ? 'thunderstorm' : 'rain', jp: '雨' }
  if (code === 45 || code === 48) return { weather: 'clear', label: 'fog', jp: '霧' }
  if (code >= 2) return { weather: 'clear', label: 'cloudy', jp: '曇り' }
  return { weather: 'clear', label: 'clear', jp: '晴れ' }
}

async function fetchWeather() {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${TOKYO.lat}&longitude=${TOKYO.lon}&current=weather_code,temperature_2m&timezone=Asia%2FTokyo`
    const res = await fetch(url)
    if (!res.ok) throw new Error(res.status)
    const { current: c } = await res.json()
    const w = fromCode(c.weather_code)
    state = { ...state, live: { ...state.live, weather: w.weather, label: w.label, jp: w.jp, temp: Math.round(c.temperature_2m) } }
  } catch {
    // offline or blocked: keep the clock, show it as clear
    state = { ...state, live: { ...state.live, weather: state.live.weather ?? 'clear', label: state.live.label ?? null } }
  }
  emit()
}

if (typeof window !== 'undefined') {
  fetchWeather()
  setInterval(fetchWeather, 15 * 60 * 1000)
  setInterval(() => {
    state = { ...state, live: { ...state.live, hour: tokyoHour() } }
    emit()
  }, 30 * 1000)
}

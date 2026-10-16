// Rooftop sound, all synthesised with Web Audio (no audio files to load or license):
//  - rain: a bed of filtered noise, close drops pattering around you, and the
//    odd drop pinging off the metal railing
//  - lofi: a slow jazzy loop (Fmaj9, Em7, Dm9, Cmaj9) on a soft electric
//    piano, round bass, a lazy swung boom-bap kit, a sparse melody through a
//    tape echo, vinyl crackle, and a slow tape wobble on the pitch
// Off until the viewer turns it on (browsers only allow audio after a click).

let ctx = null
let master = null
let music = null
let rain = null
let wobble = null
let echo = null
let white = null
let timer = 0
let on = false
let rainLevel = 0 // set by the scene's weather, see setRainSound

const BPM = 76
const BEAT = 60 / BPM
const SWING = 0.6 // share of a beat the first 8th note takes
const mtof = (m) => 440 * 2 ** ((m - 69) / 12)

// Four bars, one chord each. MIDI notes, low to high; bass is the root.
const CHORDS = [
  { bass: 41, notes: [57, 60, 64, 67] }, // Fmaj9 (A C E G over F)
  { bass: 40, notes: [55, 59, 62, 67] }, // Em7
  { bass: 38, notes: [53, 57, 60, 64] }, // Dm9
  { bass: 36, notes: [55, 59, 62, 64] }, // Cmaj9
]
const SCALE = [72, 74, 76, 79, 81, 84] // C major pentatonic, upper octave

function noiseBuffer(seconds, kind = 'white') {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
  const d = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < d.length; i++) {
    const white = Math.random() * 2 - 1
    if (kind === 'brown') {
      last = (last + 0.02 * white) / 1.02
      d[i] = last * 3.5
    } else if (kind === 'crackle') {
      // mostly silence with sparse clicks, like dust on a record
      d[i] = Math.random() < 0.0009 ? white * (0.4 + Math.random() * 0.6) : white * 0.006
    } else d[i] = white
  }
  return buffer
}

function filter(type, frequency, q = 0.7) {
  const f = ctx.createBiquadFilter()
  f.type = type
  f.frequency.value = frequency
  f.Q.value = q
  return f
}

function loopNoise(buffer, chain, out, level) {
  const src = ctx.createBufferSource()
  src.buffer = buffer
  src.loop = true
  const g = ctx.createGain()
  g.gain.value = level
  let node = src
  for (const f of chain) node = node.connect(f)
  node.connect(g).connect(out)
  src.start()
}


/* ---------------- rain ---------------- */

function buildRain() {
  rain = ctx.createGain()
  rain.gain.value = 0.32 * rainLevel // ambience under the music, not over it; follows the weather
  rain.connect(master)
  white = noiseBuffer(3)
  // the steady hiss of rain on everything, and a softer low wash under it
  loopNoise(white, [filter('highpass', 500), filter('lowpass', 7000)], rain, 0.16)
  loopNoise(noiseBuffer(4, 'brown'), [filter('lowpass', 420)], rain, 0.22)
}

function drop(at, close) {
  const src = ctx.createBufferSource()
  src.buffer = white
  src.playbackRate.value = 0.8 + Math.random() * 0.6
  const bp = filter('bandpass', close ? 1800 + Math.random() * 2600 : 3000 + Math.random() * 3000, 1.2)
  const env = ctx.createGain()
  const peak = close ? 0.05 + Math.random() * 0.08 : 0.015 + Math.random() * 0.02
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(peak, at + 0.003)
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.03 + Math.random() * 0.04)
  const pan = ctx.createStereoPanner()
  pan.pan.value = Math.random() * 1.8 - 0.9
  src.connect(bp).connect(env).connect(pan).connect(rain)
  src.start(at, Math.random() * 2, 0.1)
}

// A drop hitting the railing: a short metallic ping
function ting(at) {
  const f = 2400 + Math.random() * 1600
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(0.025, at + 0.002)
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.35)
  const pan = ctx.createStereoPanner()
  pan.pan.value = Math.random() < 0.5 ? -0.7 : 0.7
  for (const ratio of [1, 2.76]) {
    const o = ctx.createOscillator()
    o.frequency.value = f * ratio
    o.connect(env)
    o.start(at)
    o.stop(at + 0.4)
  }
  env.connect(pan).connect(rain)
}

/* ---------------- lofi ---------------- */

function buildMusic() {
  music = ctx.createGain()
  music.gain.value = 0.62
  // warm and a bit dull, like a cassette: roll off the top, glue it together
  const tone = filter('lowpass', 3200)
  const comp = ctx.createDynamicsCompressor()
  comp.threshold.value = -20
  comp.ratio.value = 3
  music.connect(tone).connect(comp).connect(master)
  loopNoise(noiseBuffer(5, 'crackle'), [filter('highpass', 900)], music, 0.5)
  // tape wobble: one slow LFO feeding every oscillator's detune
  wobble = ctx.createGain()
  wobble.gain.value = 9 // cents
  const lfo = ctx.createOscillator()
  lfo.frequency.value = 0.35
  lfo.connect(wobble)
  lfo.start()
  // tape echo for the melody
  echo = ctx.createDelay(1)
  echo.delayTime.value = BEAT * 0.75
  const fb = ctx.createGain()
  fb.gain.value = 0.35
  const echoTone = filter('lowpass', 1800)
  echo.connect(echoTone).connect(fb).connect(echo)
  echoTone.connect(music)
}

function osc(type, freq, at, dest, detune = 0) {
  const o = ctx.createOscillator()
  o.type = type
  o.frequency.value = freq
  o.detune.value = detune
  wobble.connect(o.detune)
  o.onended = () => wobble.disconnect(o.detune) // or the LFO keeps every old note alive
  o.connect(dest)
  o.start(at)
  return o
}

// Soft electric piano: sine + a quiet detuned triangle, a quick bloom then a long fade
function keys(midi, at, dur, vel) {
  const env = ctx.createGain()
  const lp = filter('lowpass', 1400 + vel * 900)
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(0.09 * vel, at + 0.02)
  env.gain.exponentialRampToValueAtTime(0.035 * vel, at + 0.6)
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  lp.connect(env).connect(music)
  const f = mtof(midi)
  osc('sine', f, at, lp).stop(at + dur + 0.05)
  const t = ctx.createGain()
  t.gain.value = 0.25
  t.connect(lp)
  osc('triangle', f, at, t, 7).stop(at + dur + 0.05)
}

function bass(midi, at, dur) {
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(0.22, at + 0.02)
  env.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  env.connect(music)
  osc('sine', mtof(midi), at, env).stop(at + dur + 0.05)
}

function lead(midi, at) {
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(0.05, at + 0.01)
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.9)
  env.connect(music)
  env.connect(echo)
  osc('triangle', mtof(midi), at, env).stop(at + 1)
}

function kick(at) {
  const o = ctx.createOscillator()
  const env = ctx.createGain()
  o.frequency.setValueAtTime(110, at)
  o.frequency.exponentialRampToValueAtTime(42, at + 0.12)
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(0.5, at + 0.005)
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.35)
  o.connect(env).connect(music)
  o.start(at)
  o.stop(at + 0.4)
}

function snare(at) {
  const src = ctx.createBufferSource()
  src.buffer = white
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(0.24, at + 0.004)
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.2)
  src.connect(filter('bandpass', 1900, 0.8)).connect(env).connect(music)
  src.start(at, Math.random() * 2, 0.25)
  const body = ctx.createGain()
  body.gain.setValueAtTime(0.0001, at)
  body.gain.exponentialRampToValueAtTime(0.08, at + 0.004)
  body.gain.exponentialRampToValueAtTime(0.0001, at + 0.1)
  body.connect(music)
  const o = ctx.createOscillator()
  o.frequency.value = 190
  o.connect(body)
  o.start(at)
  o.stop(at + 0.12)
}

function hat(at, vel) {
  const src = ctx.createBufferSource()
  src.buffer = white
  const env = ctx.createGain()
  env.gain.setValueAtTime(0.0001, at)
  env.gain.exponentialRampToValueAtTime(0.05 * vel, at + 0.002)
  env.gain.exponentialRampToValueAtTime(0.0001, at + 0.045)
  src.connect(filter('highpass', 7500)).connect(env).connect(music)
  src.start(at, Math.random() * 2, 0.06)
}

/* ---------------- scheduler ---------------- */

// Classic look-ahead scheduling: every 50 ms, queue what falls in the next 200 ms
let step = 0 // eighth notes since start
let nextStep = 0 // audio time of the next eighth
let nextDrop = 0

// Swung eighths: the first of each pair is longer, the pair still makes one beat
const eighthLength = (i) => BEAT * (i % 2 === 0 ? SWING : 1 - SWING)

function schedule() {
  const horizon = ctx.currentTime + 0.2
  while (nextStep < horizon) {
    const i = step % 8 // eighth within the bar
    const bar = Math.floor(step / 8)
    const chord = CHORDS[bar % CHORDS.length]
    const at = nextStep
    if (i === 0) {
      // strum the chord a touch, and hold it the whole bar
      chord.notes.forEach((m, k) => keys(m, at + k * 0.018, BEAT * 4 + 0.3, 0.7 + Math.random() * 0.25))
      bass(chord.bass, at, BEAT * 1.6)
    }
    if (i === 5) bass(chord.bass + (Math.random() < 0.5 ? 7 : 12), at, BEAT * 1.2)
    if (i === 0 || i === 4 || (i === 5 && Math.random() < 0.35)) kick(at)
    if (i === 2 || i === 6) snare(at + 0.012) // a hair late: lazy
    hat(at, i % 2 === 0 ? 1 : 0.55 + Math.random() * 0.3)
    // a few melody notes now and then, more on the off-beats
    if (bar % 2 === 1 && Math.random() < (i % 2 ? 0.28 : 0.12)) lead(SCALE[Math.floor(Math.random() * SCALE.length)], at)
    nextStep += eighthLength(i)
    step++
  }
  // rain drops, at their own irregular pace
  while (nextDrop < horizon) {
    if (rainLevel > 0.1) {
      drop(nextDrop, Math.random() < 0.35)
      if (Math.random() < 0.012) ting(nextDrop)
    }
    nextDrop += 0.02 + Math.random() * 0.09
  }
}

function start() {
  ctx = new AudioContext()
  master = ctx.createGain()
  master.gain.value = 0
  master.connect(ctx.destination)
  buildRain()
  buildMusic()
  nextStep = ctx.currentTime + 0.3
  nextDrop = ctx.currentTime + 0.1
  document.addEventListener('visibilitychange', () => {
    if (!ctx || !on) return
    if (document.hidden) ctx.suspend()
    else ctx.resume()
  })
}

export function setSound(enabled) {
  on = enabled
  if (enabled && !ctx) start()
  if (!ctx) return
  const t = ctx.currentTime
  master.gain.cancelScheduledValues(t)
  master.gain.setValueAtTime(master.gain.value, t)
  if (enabled) {
    ctx.resume()
    clearInterval(timer)
    timer = setInterval(schedule, 50)
    master.gain.linearRampToValueAtTime(0.9, t + 1.5)
  } else {
    master.gain.linearRampToValueAtTime(0, t + 0.4)
    setTimeout(() => {
      if (!on) {
        clearInterval(timer)
        ctx.suspend()
      }
    }, 450)
  }
}

// How hard it's raining in the scene (0..1): the rain bed and drops follow it
export function setRainSound(level) {
  if (Math.abs(level - rainLevel) < 0.02) return
  rainLevel = level
  if (rain) rain.gain.setTargetAtTime(0.32 * level, ctx.currentTime, 0.3)
}

// Stepping through a portal: let it all fade with the warp
export function fadeOutSound(seconds = 1) {
  if (!ctx || !on) return
  const t = ctx.currentTime
  master.gain.cancelScheduledValues(t)
  master.gain.setValueAtTime(master.gain.value, t)
  master.gain.linearRampToValueAtTime(0, t + seconds)
}
export function restoreSound() {
  if (on) setSound(true)
}

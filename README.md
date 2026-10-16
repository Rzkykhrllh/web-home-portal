# web-home-portal

The front door of byairu.com: a Tokyo rooftop on a drizzly night, where
Airu's tabby cat (the same rigged model as in [web-3d-project](../web-3d-project)
and [web-3d-island](../web-3d-island)) walks between two portals.

- **開発 Engineering** → `https://dev.byairu.com`: a steel doorway glowing with scrolling code
- **写真 Photography** → `https://www.instagram.com/frame_by_airu/` for now (swap in the photo site when it's public): a giant lens whose aperture opens as the cat walks up

Walk through one (or press **E**, or use the sign's button) and the cat spins
into it, the screen washes over in the portal's colour, and the browser goes
to that site.

Illustrated-skyline palette: an indigo-to-magenta sky with stars and a
crescent moon, a city in layers that fade to violet with distance (cyan and
orange windows, glass facades, antenna spires, blinking beacons), a tiled
balcony with a railing, wet tiles catching the neon, and light rain. The HUD sits in the same night: the name is set straight on the sky with a
soft glow, the two portal links are thin glass tags edged in each portal's
neon, sound is a lofi-stream style "now playing" corner, and the portal card
is violet glass with a neon edge.

Rendered with three.js `WebGPURenderer` through React Three Fiber. Browsers
without WebGPU fall back to its WebGL 2 backend automatically; every custom
effect (sky with stars and moon, the city's windows, the lens bokeh, bloom,
the cat's outline) is written in TSL so it runs on both. Everything except the cat
is procedural.

## Run it

```bash
npm install
npm run dev      # http://localhost:5175
npm run build    # static site in dist/
```

## Controls

| | Desktop | Phone |
|---|---|---|
| Walk | WASD / arrows, or click the roof | on-screen stick, or tap the roof |
| Go to a portal | walk into it, click it, or press E when the card shows | walk in or tap it |
| Jump | Space | ⤒ button |
| Spin | K / X, or click the cat | tap the cat |

The two tags at the top right are plain links that skip the walk, so a
recruiter in a hurry is one click away. Ctrl/Cmd-click on any of them (or on
the portal card's button) opens the site in a new tab without the warp.

## Quality

Phones get a lighter version: lower resolution and less rain. Force either
with `?quality=low` or `?quality=high`.

Kept light on purpose: the whole city (and the building under the roof) is one
merged mesh whose windows are drawn in the shader, the parapet and festoon are
merged too, there's no shadow pass (a blob shadow grounds the cat), and FXAA
replaces MSAA. That's about 65 draw calls a frame, down from ~900 in the
first night version. If the frame rate still drops under ~50, the
pixel ratio steps down (never below 1). Add `?stats` to see fps, pixel ratio,
draw calls and which backend (WebGPU or WebGL 2) is running.

## Time and weather

By default the rooftop shows Tokyo right now: the clock in Asia/Tokyo and the
current weather from [Open-Meteo](https://open-meteo.com) (free, no key;
refreshed every 15 minutes, and shown as clear if it can't be reached). The
sky corner (bottom left; top right on phones) shows Tokyo's time, temperature
and weather; open it to drag the time of day or pick clear, rain or snow, and
"Back to Tokyo now" returns to live.

A full day is keyframed in `src/world/Atmosphere.jsx`: night, late night,
dawn, day (blue sky, the sun crossing from left to right), afternoon and dusk.
It blends the sky, fog, light and city colours, how many windows are lit,
stars and moon. Rain and snow grey the sky, bring the fog in, wet (or dust)
the tiles, and the rain sound follows the weather.

Share a look with `?hour=18.5&weather=rain`.

## Sound

The "now playing" corner (bottom left; top right on phones) turns on rain and a lofi loop. Both are
synthesised with Web Audio in `src/audio.js`, so there are no audio files to
load or license:

- rain: a filtered-noise bed, close drops pattering around you in stereo, and
  now and then a drop pinging off the railing
- lofi at 76 BPM: Fmaj9, Em7, Dm9, Cmaj9 on a soft electric piano, round
  bass, a swung boom-bap kit with a lazy snare, a sparse pentatonic melody
  through a tape echo, vinyl crackle, and a slow tape wobble on the pitch

It's off by default (browsers block audio before a click). Once turned on it's
remembered, and comes back with the first click or key press next visit. It
fades out with the portal warp and pauses while the tab is hidden.

## Changing the portals

`src/config.js` holds both portals: title, blurb, URL and colours. The URLs can
also be set at build time:

```bash
VITE_DEV_URL=https://dev.byairu.com VITE_PHOTO_URL=https://photo.byairu.com npm run build
```

## How it works

```
src/
  config.js           portal URLs, colours, roof size, movement tuning
  layout.js           where the portals and rooftop furniture go; colliders
  quality.js          low / high tier
  store.js            per-frame player state + tiny store for the overlay
  input.js            keyboard (walk, jump, spin, E to enter)
  portal-nav.js       walk-to-portal, warp out and navigate, reset on Back
  audio.js            synthesised rain + lofi loop
  sky-state.js        live Tokyo time + Open-Meteo weather, manual overrides
  ui/Overlay.jsx      title, portal tags, now playing, portal card, touch stick, loader
  ui/SkyControl.jsx   the time/weather corner and its panel
  world/
    Stage.jsx         <Canvas> with WebGPURenderer (lazy-loaded)
    Effects.jsx       RenderPipeline: bloom + FXAA
    Perf.jsx          adaptive pixel ratio, ?stats overlay
    Controller.jsx    moves the cat, collisions, portal triggers
    Cat.jsx           the rigged cat, its clips, spin / jump / warp
    FollowCamera.jsx  third-person camera, wider on phones
    Portal.jsx        sign, floor glow, DevGate (code door), Aperture (lens)
    Rooftop.jsx       tiled balcony, railing, vending machine, AC, tank, stairwell
    City.jsx          layered skyline as one mesh with shader windows, spires, beacons, アイル sign
    Atmosphere.jsx    day/night keyframes + weather → sky, fog, lights, city uniforms
    Sky.jsx, Rain.jsx, Snow.jsx
```

Coming back with the browser's Back button restores the page from the
back/forward cache; `pageshow` puts the cat back in front of the portal it
left through instead of leaving the screen washed out.

## Deploy

Static files, so anything works. For Dokploy there's a `Dockerfile` (build,
then nginx on port 80) and `nginx.conf` (long cache on hashed assets, SPA
fallback).

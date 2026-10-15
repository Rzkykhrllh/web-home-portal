# web-home-portal

The front door of byairu.com: a rooftop in Tokyo on a rainy night, where
Airu's tabby cat (the same rigged model as in [web-3d-project](../web-3d-project)
and [web-3d-island](../web-3d-island)) walks between two portals.

- **開発 Engineering** → `https://dev.byairu.com`: a steel doorway glowing with scrolling code
- **写真 Photography** → `https://www.instagram.com/frame_by_airu/` for now (swap in the photo site when it's public): a giant lens whose aperture opens as the cat walks up

Walk through one (or press **E**, or use the sign's button) and the cat spins
into it, the screen washes over in the portal's colour, and the browser goes
to that site.

Wet concrete with puddles that mirror the neon, light rain, a vending machine,
festoon bulbs, and the city below fading into haze. The HUD borrows from
Tokyo station signs: navy plates, Japanese over English, a line marker per
portal (D and P).

Rendered with three.js `WebGPURenderer` through React Three Fiber. Browsers
without WebGPU fall back to its WebGL 2 backend automatically; every custom
effect (sky, puddle reflections with rain ripples, the lens bokeh, bloom, the
cat's outline) is written in TSL so it runs on both. Everything except the cat
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

The two line signs at the top right are plain links that skip the walk, so a
recruiter in a hurry is one click away. Ctrl/Cmd-click on any of them (or on
the platform sign's button) opens the site in a new tab without the warp.

## Quality

Phones get a lighter version: no puddle reflections, no shadows, less rain.
Force either with `?quality=low` or `?quality=high`.

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
  ui/Overlay.jsx      name board, line links, platform sign, touch stick, loader
  world/
    Stage.jsx         <Canvas> with WebGPURenderer (lazy-loaded)
    Effects.jsx       RenderPipeline + bloom
    Controller.jsx    moves the cat, collisions, portal triggers
    Cat.jsx           the rigged cat, its clips, spin / jump / warp
    FollowCamera.jsx  third-person camera, wider on phones
    Portal.jsx        sign, floor glow, DevGate (code door), Aperture (lens)
    Rooftop.jsx       wet slab + reflector, parapet, vending machine, AC, tank
    City.jsx          lit buildings, aircraft beacons, the アイル sign
    Sky.jsx, Rain.jsx
```

Coming back with the browser's Back button restores the page from the
back/forward cache; `pageshow` puts the cat back in front of the portal it
left through instead of leaving the screen washed out.

## Deploy

Static files, so anything works. For Dokploy there's a `Dockerfile` (build,
then nginx on port 80) and `nginx.conf` (long cache on hashed assets, SPA
fallback).

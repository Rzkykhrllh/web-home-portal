# web-home-portal

The front door of byairu.com: a small floating island where Airu's tabby cat
(the same rigged model as in [web-3d-project](../web-3d-project) and
[web-3d-island](../web-3d-island)) walks between two portals.

- **Engineering** → `https://dev.byairu.com`
- **Photography** → `https://www.instagram.com/frame_by_airu/` for now (swap in the photo site when it's public)

Walk into a ring (or press **E**, or use the card's button) and the cat spins
into the swirl, the screen washes over in the portal's colour, and the browser
goes to that site.

Built with Vite, React, React Three Fiber and Three.js, with the game's toon
shading, outlines, palette and fonts (Lilita One, Nunito). Everything except
the cat is procedural, so there are no other assets to load.

## Run it

```bash
npm install
npm run dev      # http://localhost:5175
npm run build    # static site in dist/
```

## Controls

| | Desktop | Phone |
|---|---|---|
| Walk | WASD / arrows, or click the ground | on-screen stick, or tap the ground |
| Go to a portal | walk into it, click it, or press E when the card shows | walk in or tap it |
| Jump | Space | ⤒ button |
| Spin | K / X, or click the cat | tap the cat |

The two chips at the top right are plain links that skip the walk, so a
recruiter in a hurry is one click away. Ctrl/Cmd-click on any of them (or on
the card button) opens the site in a new tab without the warp.

## Changing the portals

`src/config.js` holds both portals: title, blurb, URL and colours. The URLs can
also be set at build time:

```bash
VITE_DEV_URL=https://dev.byairu.com VITE_PHOTO_URL=https://photo.byairu.com npm run build
```

## How it works

```
src/
  config.js           portal URLs, colours, movement tuning
  layout.js           where the portals, trees and sign go; colliders
  store.js            per-frame player state + tiny store for the overlay
  input.js            keyboard (walk, jump, spin, E to enter)
  portal-nav.js       walk-to-portal, warp out and navigate, reset on Back
  ui/Overlay.jsx      title, skip links, portal card, touch stick, loader
  world/
    Stage.jsx         <Canvas> (lazy-loaded so the HTML shows first)
    Controller.jsx    moves the cat, collisions, portal triggers
    Cat.jsx           the rigged cat, its clips, spin / jump / warp
    FollowCamera.jsx  third-person camera, wider on phones
    Portal.jsx        ring, swirl shader, sparks, sign, code blocks / photo prints
    Plaza.jsx         floating island, paths, signpost, trees, flowers
    Sky.jsx, Clouds.jsx
```

Coming back with the browser's Back button restores the page from the
back/forward cache; `pageshow` puts the cat back in front of the portal it
left through instead of leaving the screen washed out.

## Deploy

Static files, so anything works. For Dokploy there's a `Dockerfile` (build,
then nginx on port 80) and `nginx.conf` (long cache on hashed assets, SPA
fallback).

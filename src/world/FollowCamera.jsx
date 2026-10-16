import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, Vector3 } from 'three/webgpu'
import { player, uiStore } from '../store.js'
import { orbit } from '../photo.js'
import { reducedMotion } from '../portal-nav.js'

// Third-person camera behind and above the cat. Starts high and swoops down
// on load; on a portrait screen it sits further back so both portals fit.
export default function FollowCamera() {
  const look = useMemo(() => new Vector3(0, 1, 0), [])
  const want = useMemo(() => new Vector3(), [])
  const s = useRef({ t: reducedMotion ? 10 : 0, first: true })

  useFrame((state, dt) => {
    dt = Math.min(dt, 0.05)
    const cam = state.camera
    const st = s.current
    st.t += dt
    const intro = 1 - (1 - Math.min(1, st.t / 2.4)) ** 3
    const portrait = state.size.width < state.size.height * 0.9
    const back = portrait ? 18 : 10.5
    const up = portrait ? 8.5 : 5.2
    // a wider lens on phones so both portals stay in frame
    const fov = portrait ? 64 : 45
    if (cam.fov !== fov) {
      cam.fov = fov
      cam.updateProjectionMatrix()
    }
    const p = player.pos

    // Photo mode: orbit the cat (drag to turn, wheel or pinch to zoom)
    if (uiStore.get().photo) {
      const r = orbit.dist
      want.set(
        p.x + Math.sin(orbit.yaw) * Math.cos(orbit.pitch) * r,
        p.y + 0.9 + Math.sin(orbit.pitch) * r,
        p.z + Math.cos(orbit.yaw) * Math.cos(orbit.pitch) * r,
      )
      cam.position.x = MathUtils.damp(cam.position.x, want.x, 6, dt)
      cam.position.y = MathUtils.damp(cam.position.y, Math.max(0.3, want.y), 6, dt)
      cam.position.z = MathUtils.damp(cam.position.z, want.z, 6, dt)
      look.x = MathUtils.damp(look.x, p.x, 8, dt)
      look.y = MathUtils.damp(look.y, p.y + 0.9, 8, dt)
      look.z = MathUtils.damp(look.z, p.z, 8, dt)
      cam.lookAt(look)
      return
    }

    want.set(p.x * 0.9, up + (1 - intro) * 9, p.z + back + (1 - intro) * 8)
    let lookZ = p.z - 6
    if (player.leaving >= 0 && player.portal) {
      // lean in towards the portal as we go through
      const k = Math.min(1, player.leaving / 1.2)
      want.lerp(new Vector3(player.portal.x, 3, player.portal.z + 6), k * 0.35)
      lookZ = MathUtils.lerp(lookZ, player.portal.z, k)
    }
    if (st.first) {
      cam.position.copy(want)
      st.first = false
    }
    cam.position.x = MathUtils.damp(cam.position.x, want.x, 4, dt)
    cam.position.y = MathUtils.damp(cam.position.y, want.y, 4, dt)
    cam.position.z = MathUtils.damp(cam.position.z, want.z, 4, dt)
    look.x = MathUtils.damp(look.x, p.x * 0.95, 6, dt)
    look.y = MathUtils.damp(look.y, portrait ? 2.6 : 3.0, 6, dt)
    look.z = MathUtils.damp(look.z, lookZ, 6, dt)
    cam.lookAt(look)
  })
  return null
}

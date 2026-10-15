import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { AnimationMixer, AnimationUtils, Box3, LoopOnce, MathUtils, MeshToonMaterial, SkinnedMesh } from 'three/webgpu'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import catUrl from '../assets/cat.glb?url'
import { JUMP_HEIGHT, JUMP_TIME, SPIN_TIME, SPIN_TURNS } from '../config.js'
import { reducedMotion } from '../portal-nav.js'
import { spin } from '../input.js'
import { player, uiStore } from '../store.js'
import { dampAngle } from './math.js'
import { TOON_RAMP, outlineMaterial } from './toon.js'

// Airu's tabby cat from web-3d-project / web-3d-island: the same rigged GLB
// with Mixamo clips (idle, walk, run, victory, jump, spin). Here it's driven
// by the Controller instead of a scroll trail.

const HEIGHT = 1.5 // ear tip to sole
const FPS = 30

// Keep the hips over the feet: the controller moves the cat, so the clips
// mustn't drift it (and the jump clip mustn't lift it on top of our own arc)
function pinHips(clip, all = false) {
  for (const track of clip.tracks) {
    if (!track.name.endsWith('Hips.position')) continue
    const v = track.values
    const [x, y, z] = v
    for (let i = 0; i < v.length; i += 3) {
      v[i] = x
      v[i + 2] = z
      if (all) v[i + 1] = y
    }
  }
  return clip
}
const cut = (clip, name, from, to) =>
  AnimationUtils.subclip(clip, name, Math.round(from * FPS), Math.round(to * FPS), FPS)

function gameClips(animations) {
  const src = Object.fromEntries(animations.map((c) => [c.name, c]))
  const out = {}
  for (const name of ['idle', 'walk', 'run', 'victory']) if (src[name]) out[name] = pinHips(src[name])
  if (src.tpose) out.spin = pinHips(cut(src.tpose, 'spin', 0, 0.07))
  else if (src.spin) out.spin = pinHips(cut(src.spin, 'spin', 1.1, 1.17))
  if (src.jump) {
    out.jump = pinHips(cut(src.jump, 'jump', 0.5, 0.8), true)
    out.fall = pinHips(cut(src.jump, 'fall', 0.85, 1.0), true)
  }
  return out
}

// Thin dark outline: a second skinned mesh sharing the skeleton, with its
// vertices pushed out along the normals (see toon.js)
function outlineFor(mesh, thickness) {
  const hull = new SkinnedMesh(mesh.geometry, outlineMaterial(thickness))
  hull.bind(mesh.skeleton, mesh.bindMatrix)
  hull.position.copy(mesh.position)
  hull.quaternion.copy(mesh.quaternion)
  hull.scale.copy(mesh.scale)
  hull.frustumCulled = false
  return hull
}

const withMeshopt = (loader) => loader.setMeshoptDecoder(MeshoptDecoder)
useLoader.preload(GLTFLoader, catUrl, withMeshopt)

export default function Cat() {
  const gltf = useLoader(GLTFLoader, catUrl, withMeshopt)
  const gl = useThree((s) => s.gl)
  const root = useRef()
  const body = useRef()
  const swirl = useRef()
  const shadow = useRef()
  const anim = useRef({ run: 0, heading: 0, current: null, lastHop: Infinity, lastJump: Infinity, still: 0 })

  useEffect(() => {
    player.warp = 0
    uiStore.set({ loaded: true })
  }, [])

  const { scene, scale, lift, mixer, actions } = useMemo(() => {
    const scene = clone(gltf.scene)
    scene.updateMatrixWorld(true)
    const box = new Box3().setFromObject(scene)
    const scale = HEIGHT / (box.max.y - box.min.y)
    const skinned = []
    scene.traverse((o) => o.isSkinnedMesh && skinned.push(o))
    for (const m of skinned) {
      m.material = new MeshToonMaterial({ map: m.material.map, gradientMap: TOON_RAMP })
      m.castShadow = true
      m.frustumCulled = false
      m.parent.add(outlineFor(m, 0.006 / scale))
    }
    scene.traverse((o) => {
      if (o.isMesh) o.raycast = () => {}
    })
    const mixer = new AnimationMixer(scene)
    const actions = {}
    for (const [name, clip] of Object.entries(gameClips(gltf.animations))) actions[name] = mixer.clipAction(clip)
    for (const name of ['spin', 'jump', 'fall']) {
      if (!actions[name]) continue
      actions[name].setLoop(LoopOnce)
      actions[name].clampWhenFinished = true
    }
    return { scene, scale, lift: -box.min.y * scale + 0.03, mixer, actions }
  }, [gltf])

  useFrame((state, dt) => {
    dt = Math.min(dt, 0.05)
    const a = anim.current
    a.run = MathUtils.damp(a.run, player.speed, 10, dt)
    const leaving = player.leaving >= 0

    root.current.position.copy(player.pos)

    // Face where we're going; stand still a while and look at the camera
    const moving = player.speed > 0.08
    a.still = moving ? 0 : a.still + dt
    let target = a.heading
    if (leaving) target = player.portal.yaw + Math.PI
    else if (moving) target = Math.atan2(player.vel.x, player.vel.z)
    else if (a.still > 2.5 || player.warp < 3)
      target = Math.atan2(state.camera.position.x - player.pos.x, state.camera.position.z - player.pos.z)
    a.heading = dampAngle(a.heading, target, 10, dt)
    root.current.rotation.y = a.heading

    // Spin (K / X / click the cat)
    player.hop += dt
    const spinT = player.hop / SPIN_TIME
    const spinning = spinT < 1
    const spun = player.hop < a.lastHop
    a.lastHop = player.hop
    const turn = spinning && !reducedMotion ? 1 - (1 - spinT) ** 2 : 0
    body.current.rotation.y = turn * Math.PI * 2 * SPIN_TURNS
    swirl.current.visible = spinning
    if (spinning) {
      swirl.current.material.opacity = 0.7 * Math.sin(spinT * Math.PI)
      swirl.current.scale.setScalar(0.85 + spinT * 0.3)
    }

    // Jump (Space): our own arc, the clips pose the legs
    player.jump += dt
    const jumpT = player.jump / JUMP_TIME
    const jumping = jumpT < 1
    const jumped = player.jump < a.lastJump
    a.lastJump = player.jump
    const arc = jumping ? Math.sin(jumpT * Math.PI) * JUMP_HEIGHT : 0
    root.current.position.y += arc

    // Blob shadow under the feet shrinks as we leave the ground
    shadow.current.position.y = -arc - player.pos.y + 0.02
    shadow.current.material.opacity = 0.28 * (1 - arc / (JUMP_HEIGHT * 1.6)) * (leaving ? Math.max(0, 1 - player.leaving) : 1)

    // Warp in on load, spin away to nothing through a portal
    const warpIn = reducedMotion ? 1 : Math.min(1, Math.max(0, (player.warp - 0.5) / 0.7))
    const warpOut = leaving ? Math.min(1, Math.max(0, (player.leaving - 0.35) / 0.55)) : 0
    const presence = warpIn * (1 - warpOut)
    root.current.scale.setScalar(Math.max(0.0001, presence < 1 ? 1 - (1 - presence) ** 2 : 1))
    if (presence < 1 && !reducedMotion) body.current.rotation.y += (1 - presence) * Math.PI * 4

    // Pick a clip
    const waving = player.warp > 1 && player.warp < 3.4 && !moving && !reducedMotion
    let name
    if ((spinning || leaving) && actions.spin) name = 'spin'
    else if (jumping && actions.jump) name = jumpT < 0.5 ? 'jump' : 'fall'
    else if (waving && actions.victory) name = 'victory'
    else if (a.run > 0.55) name = 'run'
    else if (a.run > 0.1) name = 'walk'
    else name = 'idle'

    const next = actions[name] ?? actions.idle
    if (next !== a.current || (spun && name === 'spin') || (jumped && name === 'jump')) {
      const fade = name === 'spin' ? 0.05 : 0.15
      next.reset().setEffectiveWeight(1).fadeIn(fade).play()
      if (a.current !== next) a.current?.fadeOut(fade)
      a.current = next
    }
    if (name === 'run') next.timeScale = 0.75 + 0.45 * a.run
    if (name === 'walk') next.timeScale = 0.7 + 1.2 * a.run
    mixer.update(dt)
  })

  const onClick = (e) => {
    if (e.delta > 8) return
    e.stopPropagation()
    spin()
  }
  const hover = (on) => (e) => {
    e.stopPropagation()
    gl.domElement.style.cursor = on ? 'pointer' : ''
  }

  return (
    <group ref={root}>
      {/* Pointer hits this invisible box, not the ~18k skinned triangles */}
      <mesh position-y={0.75} onClick={onClick} onPointerOver={hover(true)} onPointerOut={hover(false)}>
        <boxGeometry args={[0.9, 1.5, 0.9]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <mesh ref={shadow} rotation-x={-Math.PI / 2} renderOrder={1}>
        <circleGeometry args={[0.45, 24]} />
        <meshBasicMaterial color="#2a1a10" transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <group ref={body}>
        <group scale={scale} position-y={lift}>
          <primitive object={scene} />
        </group>
      </group>
      <mesh ref={swirl} position-y={0.75} rotation-x={Math.PI / 2} visible={false}>
        <torusGeometry args={[0.95, 0.06, 6, 28]} />
        <meshBasicMaterial color="#fff3d1" transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}

import Sky, { HAZE } from './Sky.jsx'
import City from './City.jsx'
import Rooftop from './Rooftop.jsx'
import Portal from './Portal.jsx'
import Cat from './Cat.jsx'
import Rain from './Rain.jsx'
import Effects from './Effects.jsx'
import Controller from './Controller.jsx'
import FollowCamera from './FollowCamera.jsx'
import { portals } from '../layout.js'
import { QUALITY } from '../quality.js'

export default function Experience() {
  return (
    <>
      <Sky />
      <fog attach="fog" args={[HAZE, 22, 115]} />
      <hemisphereLight args={['#4a5c9a', '#1a1222', 0.9]} />
      {/* Moonlight through cloud: dim and blue, but it gives the shadows */}
      <directionalLight
        castShadow={QUALITY.shadows}
        position={[-7, 14, 6]}
        intensity={0.9}
        color="#9fb2ff"
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-13}
        shadow-camera-right={13}
        shadow-camera-top={13}
        shadow-camera-bottom={-13}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.0006}
        shadow-normalBias={0.03}
      />
      <City />
      <Rooftop />
      {portals.map((p) => (
        <Portal key={p.id} p={p} />
      ))}
      <Cat />
      <Rain />
      <Controller />
      <FollowCamera />
      <Effects />
    </>
  )
}

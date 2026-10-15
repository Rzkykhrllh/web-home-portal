import Sky, { HAZE } from './Sky.jsx'
import City from './City.jsx'
import Rooftop from './Rooftop.jsx'
import Portal from './Portal.jsx'
import Cat from './Cat.jsx'
import Rain from './Rain.jsx'
import Effects from './Effects.jsx'
import Controller from './Controller.jsx'
import FollowCamera from './FollowCamera.jsx'
import Perf from './Perf.jsx'
import { portals } from '../layout.js'

export default function Experience() {
  return (
    <>
      <Sky />
      <fog attach="fog" args={[HAZE, 22, 115]} />
      <hemisphereLight args={['#4a5c9a', '#1a1222', 0.9]} />
      {/* Moonlight through cloud: dim and blue. No shadow pass, it was the
          most expensive thing on screen for something you could barely see */}
      <directionalLight position={[-7, 14, 6]} intensity={0.9} color="#9fb2ff" />
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
      <Perf />
    </>
  )
}

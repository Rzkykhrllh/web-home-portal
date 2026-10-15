import Sky, { HAZE, MOON_DIR } from './Sky.jsx'
import City from './City.jsx'
import Rooftop from './Rooftop.jsx'
import Portal from './Portal.jsx'
import Cat from './Cat.jsx'
import Effects from './Effects.jsx'
import Controller from './Controller.jsx'
import FollowCamera from './FollowCamera.jsx'
import Perf from './Perf.jsx'
import Rain from './Rain.jsx'
import { portals } from '../layout.js'

export default function Experience() {
  return (
    <>
      <Sky />
      <fog attach="fog" args={[HAZE, 45, 230]} />
      <hemisphereLight args={['#8a78d8', '#2a1d40', 1.1]} />
      {/* Moonlight from where the crescent hangs. No shadow pass: it was the
          most expensive thing on screen for something you could barely see */}
      <directionalLight position={MOON_DIR.clone().multiplyScalar(20).setZ(8)} intensity={1.0} color="#cfc6ff" />
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

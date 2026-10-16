import Sky from './Sky.jsx'
import Atmosphere from './Atmosphere.jsx'
import Snow from './Snow.jsx'
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
      {/* fog, sky light and the sun/moon key light, driven by time and weather.
          No shadow pass: it cost more than anything else for little gain */}
      <Atmosphere />
      <City />
      <Rooftop />
      {portals.map((p) => (
        <Portal key={p.id} p={p} />
      ))}
      <Cat />
      <Rain />
      <Snow />
      <Controller />
      <FollowCamera />
      <Effects />
      <Perf />
    </>
  )
}

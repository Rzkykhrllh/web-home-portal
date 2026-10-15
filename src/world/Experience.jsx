import Sky from './Sky.jsx'
import Plaza from './Plaza.jsx'
import Portal from './Portal.jsx'
import Cat from './Cat.jsx'
import Clouds from './Clouds.jsx'
import Controller from './Controller.jsx'
import FollowCamera from './FollowCamera.jsx'
import { portals } from '../layout.js'

export const HORIZON = '#f6b9a0'

export default function Experience() {
  return (
    <>
      <Sky />
      <fog attach="fog" args={[HORIZON, 35, 95]} />
      <hemisphereLight args={['#c9d8ff', '#7a5f3c', 1.1]} />
      <directionalLight
        castShadow
        position={[7, 14, 9]}
        intensity={2.4}
        color="#fff1dc"
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-bias={-0.0006}
        shadow-normalBias={0.03}
      />
      <Plaza />
      {portals.map((p) => (
        <Portal key={p.id} p={p} />
      ))}
      <Cat />
      <Clouds />
      <Controller />
      <FollowCamera />
    </>
  )
}

import { useMemo } from 'react'
import { BackSide, Color, ShaderMaterial } from 'three'

// Golden-hour gradient dome with a soft sun low behind the plaza, between the
// two portals
export default function Sky() {
  const material = useMemo(
    () =>
      new ShaderMaterial({
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          top: { value: new Color('#3552b8') },
          mid: { value: new Color('#f6b9a0') },
          low: { value: new Color('#ffdcb0') },
          sun: { value: new Color('#fff0c8') },
        },
        vertexShader: /* glsl */ `
          varying vec3 vDir;
          void main() {
            vDir = normalize(position);
            vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            gl_Position = p.xyww; // always at the far plane
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 top, mid, low, sun;
          varying vec3 vDir;
          void main() {
            float h = vDir.y;
            vec3 c = h > 0.0
              ? mix(mid, top, pow(smoothstep(0.0, 0.75, h), 0.75))
              : mix(mid, low, smoothstep(0.0, -0.35, h));
            float s = max(dot(vDir, normalize(vec3(0.0, 0.1, -1.0))), 0.0);
            c += sun * (pow(s, 400.0) * 1.2 + pow(s, 12.0) * 0.35);
            gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [],
  )
  return (
    <mesh material={material} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[200, 32, 16]} />
    </mesh>
  )
}

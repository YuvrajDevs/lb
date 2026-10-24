import * as THREE from 'three'

/**
 * A small made-up night sky for surfaces to reflect (image-based lighting): a deep blue dome with a few
 * warm, cool and pink "light panels". This is what gives glossy floors and satin furniture their soft sheen.
 */
export function makeEnvironment(renderer, time = 'night') {
  // the reflected sky for each time of day: [top, middle, low] and the sun or moon panel [colour, strength]
  const P = {
    night: ['0.04, 0.05, 0.16', '0.09, 0.09, 0.22', '0.03, 0.03, 0.08', '#c8d4ff', 3.5],
    sunset: ['0.12, 0.06, 0.28', '0.42, 0.18, 0.32', '0.10, 0.05, 0.13', '#ff9a5a', 4.5],
    dawn: ['0.14, 0.14, 0.34', '0.48, 0.36, 0.52', '0.12, 0.08, 0.14', '#ffbfa0', 4],
    morning: ['0.30, 0.48, 0.80', '0.62, 0.74, 0.92', '0.22, 0.24, 0.22', '#fff4e0', 6],
    evening: ['0.30, 0.38, 0.62', '0.75, 0.62, 0.48', '0.20, 0.15, 0.10', '#ffd090', 5.5],
    rain: ['0.16, 0.18, 0.22', '0.28, 0.30, 0.34', '0.08, 0.09, 0.10', '#c0c8d8', 1.5],
    snow: ['0.55, 0.60, 0.72', '0.80, 0.84, 0.90', '0.40, 0.42, 0.46', '#eef2ff', 3],
  }[time] || null
  const evening = time !== 'night'
  const env = new THREE.Scene()
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(50, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec3 vP; void main(){
        float h = normalize(vP).y;
        vec3 top = vec3(${(P || [])[0] || '0.04, 0.05, 0.16'});
        vec3 mid = vec3(${(P || [])[1] || '0.09, 0.09, 0.22'});
        vec3 low = vec3(${(P || [])[2] || '0.03, 0.03, 0.08'});
        vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.8, h)) : mix(mid, low, smoothstep(0.0, -0.6, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
    })
  )
  env.add(dome)
  const panel = (w, h, pos, color, power) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide }))
    m.position.set(...pos)
    m.lookAt(0, 0, 0)
    env.add(m)
  }
  panel(22, 9, [-30, 16, 18], '#ffb070', 5)  // warm lamp light, front left
  if (P) panel(evening ? 30 : 14, 7, [6, evening ? 7 : 12, 34], P[3], P[4]) // the sun (or the moon), in front
  else panel(14, 7, [6, 12, 34], '#c8d4ff', 3.5)
  panel(18, 8, [32, 14, 10], evening ? '#c98cff' : '#7f90ff', evening ? 2.5 : 2.0) // the sky, right
  panel(26, 7, [4, 20, -36], '#ff5fa8', 3)   // pink glow behind
  panel(16, 6, [0, 36, 2], evening ? '#e0b0e0' : '#8090c8', evening ? 2.0 : 1.6) // sky overhead
  panel(12, 5, [-20, 6, -28], '#9a6cff', 3)  // violet rim, back left
  const pm = new THREE.PMREMGenerator(renderer)
  const rt = pm.fromScene(env, 0.035)
  pm.dispose()
  dome.geometry.dispose()
  return rt.texture
}

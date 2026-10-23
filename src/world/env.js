import * as THREE from 'three'

/**
 * A small made-up night sky for surfaces to reflect (image-based lighting): a deep blue dome with a few
 * warm, cool and pink "light panels". This is what gives glossy floors and satin furniture their soft sheen.
 */
export function makeEnvironment(renderer) {
  const env = new THREE.Scene()
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(50, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec3 vP; void main(){
        float h = normalize(vP).y;
        vec3 top = vec3(0.04, 0.05, 0.16);
        vec3 mid = vec3(0.09, 0.09, 0.22);
        vec3 low = vec3(0.03, 0.03, 0.08);
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
  panel(14, 7, [6, 12, 34], '#c8d4ff', 3.5)    // the moon, in front
  panel(18, 8, [32, 14, 10], '#7f90ff', 2.0) // night sky, right
  panel(26, 7, [4, 20, -36], '#ff5fa8', 3)   // pink glow behind
  panel(16, 6, [0, 36, 2], '#8090c8', 1.6)   // dim sky overhead
  panel(12, 5, [-20, 6, -28], '#9a6cff', 3)  // violet rim, back left
  const pm = new THREE.PMREMGenerator(renderer)
  const rt = pm.fromScene(env, 0.035)
  pm.dispose()
  dome.geometry.dispose()
  return rt.texture
}

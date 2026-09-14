import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { TideSignal } from './atmosphereMotion'
import { mergeMirrorGeometry } from './MirrorGeometry'

/** A distant ray crosses one cloud opening, then leaves a long quiet interval. */
export default function CloudRay({ signal }: { signal: TideSignal }) {
  const group = useRef<THREE.Group>(null)
  const resources = useMemo(() => {
    const wing = new THREE.PlaneGeometry(2, 2, 32, 18), p = wing.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), v = p.getY(i), span = Math.abs(x)
      p.setXYZ(i, x * 5.2, Math.sin(span * Math.PI) * .24, v * (2.3 - span * 1.8) + span * 1.4)
    }
    wing.computeVertexNormals()
    const tail = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 1.5), new THREE.Vector3(.3, -.08, 3), new THREE.Vector3(-.4, .16, 5.4), new THREE.Vector3(.3, .5, 7),
    ]), 36, .065, 5, false)
    const body = new THREE.SphereGeometry(1, 16, 10); body.scale(.5, .27, 1.9)
    const geometry = mergeMirrorGeometry([wing, tail, body])
    const material = new THREE.ShaderMaterial({
      uniforms: { time: signal.time, pulse: signal.pulse, accent: signal.color }, side: THREE.DoubleSide,
      transparent: true, depthWrite: false,
      vertexShader: `uniform float time;varying vec3 local;void main(){vec3 p=position;local=p;
        p.y+=sin(time*.62-abs(p.x)*.36)*pow(abs(p.x)/5.2,1.5)*.95;
        gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
      fragmentShader: `uniform float pulse;uniform vec3 accent;varying vec3 local;
        void main(){float edge=pow(abs(local.x)/5.2,2.);vec3 col=mix(vec3(.18,.26,.37),vec3(.51,.70,.76),edge*.6);
        float freckles=pow(max(0.,sin(local.x*13.)*sin(local.z*16.)),18.);
        col+=vec3(.4,.67,.72)*freckles*.18+accent*pulse*.08;gl_FragColor=vec4(col,.77);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    })
    return { geometry, material }
  }, [signal])
  useEffect(() => () => { resources.geometry.dispose(); resources.material.dispose() }, [resources])
  useFrame(() => {
    if (!group.current) return
    const phase = (signal.time.value + 5) % 153
    group.current.visible = phase < 47
    group.current.position.set(-81 + phase * 3.2, 29 + Math.sin(phase * .055) * 7, -112 + Math.sin(phase * .08) * 8)
    group.current.rotation.set(.12, -Math.PI / 2, Math.sin(phase * .11) * .12)
  })
  return <group ref={group} name="occasional-cloud-ray" dispose={null}>
    <mesh geometry={resources.geometry} material={resources.material}/>
  </group>
}

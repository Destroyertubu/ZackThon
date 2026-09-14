import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CLOUD_ISLANDS, cloudfallArchGeometry, cloudfallWaterGeometry, floatingIslandGeometry, hangingRootsGeometry } from './cloudfallGeometry'
import { mirrorBranchGeometry, mirrorCrownGeometry, mirrorRandom } from './MirrorGeometry'
import type { TideSignal } from './atmosphereMotion'
import CloudRay from './CloudRay'

const noiseGLSL = `
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){return noise(p)*.57+noise(p*2.03)*.28+noise(p*4.17)*.15;}
`

function CloudRivers({ signal, night }: { signal: TideSignal; night: boolean }) {
  const resources = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(1, 1)
    const material = new THREE.ShaderMaterial({
      uniforms: { time: signal.time, pulse: signal.pulse, responseColor: signal.color,
        shade: { value: new THREE.Color(night ? '#8e9aad' : '#a9b5c9') }, rim: { value: new THREE.Color(night ? '#caa7b8' : '#f5d3be') } },
      transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide, forceSinglePass: true,
      vertexShader: `uniform float time;varying vec2 vUv;varying float phase;
      void main(){vUv=uv;vec4 world=modelMatrix*instanceMatrix*vec4(position,1.);phase=world.x*.02+world.z*.011;
      world.x+=sin(time*.055+phase)*1.8;world.y+=sin(time*.08+phase)*.26;gl_Position=projectionMatrix*viewMatrix*world;}`,
      fragmentShader: `uniform float time,pulse;uniform vec3 shade,rim,responseColor;varying vec2 vUv;varying float phase;${noiseGLSL}
      void main(){vec2 q=vUv*vec2(4.2,2.1)+vec2(time*.018+phase,phase*.31);
      float n=fbm(q),n2=noise(q*2.+vec2(0.,time*.013));
      vec2 p=(vUv-.5)*2.;float shape=1.-smoothstep(.2,1.,dot(p*vec2(.85,1.),p*vec2(.85,1.)));
      float density=smoothstep(.19,.61,n*.84+n2*.16)*shape;
      float edge=pow(clamp(n2*.5+.5-vUv.y*.35,0.,1.),2.);
      vec3 col=mix(shade,rim,edge*.42);col+=responseColor*pulse*.035;
      gl_FragColor=vec4(col,density*.76);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
    })
    const mesh = new THREE.InstancedMesh(geometry, material, 18), transform = new THREE.Object3D()
    const random = mirrorRandom(8531)
    for (let i = 0; i < 18; i++) {
      const island = CLOUD_ISLANDS[i % CLOUD_ISLANDS.length]
      transform.position.set(island.x + (random() - .5) * island.width * 1.9, i < 10 ? island.y - island.drop * .53 : -.3 + random() * 2, island.z + (random() - .5) * island.depth * 2)
      if (i < 10) { transform.position.x *= .83; transform.position.z *= .83 }
      transform.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), transform.position.clone().negate().setY(2).normalize())
      transform.scale.set(28 + random() * 28, i < 10 ? 13 + random() * 9 : 4 + random() * 4, 1)
      transform.updateMatrix(); mesh.setMatrixAt(i, transform.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); mesh.renderOrder = 8
    return { geometry, material, mesh }
  }, [signal, night])
  useEffect(() => () => { resources.mesh.dispose(); resources.geometry.dispose(); resources.material.dispose() }, [resources])
  return <primitive object={resources.mesh} name="cloud-rivers-between-floating-islands" dispose={null}/>
}

export default function CloudfallArchipelago({ signal, rock, bark, foliage, flower, night }: {
  signal: TideSignal; rock: THREE.MeshStandardMaterial; bark: THREE.Material; foliage: THREE.Material; flower: THREE.Material; night: boolean
}) {
  const groups = useRef<(THREE.Group | null)[]>([])
  const resources = useMemo(() => {
    const branch = mirrorBranchGeometry(), crown = mirrorCrownGeometry(), arch = cloudfallArchGeometry()
    const cascade = new THREE.ShaderMaterial({
      uniforms: { time: signal.time, pulse: signal.pulse, tint: { value: new THREE.Color(night ? '#adcddd' : '#d7efeb') } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide, forceSinglePass: true, fog: false,
      vertexShader: `uniform float time;varying vec2 vUv;varying float height;void main(){vUv=uv;vec3 p=position;
      p.x+=sin(uv.y*9.+time*.65+position.z)*.10*(1.-uv.y);p.z+=sin(uv.y*12.-time*.7)*.07;
      height=p.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
      fragmentShader: `uniform float time,pulse;uniform vec3 tint;varying vec2 vUv;varying float height;${noiseGLSL}
      void main(){float sides=smoothstep(0.,.16,vUv.x)*(1.-smoothstep(.82,1.,vUv.x));
      float threads=fbm(vec2(vUv.x*28.,vUv.y*5.+time*.8));
      float ripples=.5+.5*sin(vUv.y*72.+time*5.+sin(vUv.x*12.)*3.);
      float bottom=smoothstep(0.,.24,vUv.y);float alpha=sides*bottom*(.16+threads*.54+ripples*.12);
      gl_FragColor=vec4(tint*(.75+threads*.33+pulse*.28),alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
    })
    const islands = CLOUD_ISLANDS.map(island => {
      const random = mirrorRandom(island.seed * 171)
      const trees = new THREE.InstancedMesh(branch, bark, 14)
      const crowns = new THREE.InstancedMesh(crown, foliage, 56)
      const blossoms = new THREE.InstancedMesh(crown, flower, 42)
      const transform = new THREE.Object3D(), color = new THREE.Color()
      for (let i = 0; i < 14; i++) {
        const a = random() * Math.PI * 2, r = .16 + Math.sqrt(random()) * .49, size = .78 + random() * .65
        const x = Math.cos(a) * island.width * r, z = Math.sin(a) * island.depth * r
        const y = 2.75 - r * 2.3
        transform.position.set(x, y, z); transform.scale.setScalar(size); transform.rotation.set(0, a, 0); transform.updateMatrix(); trees.setMatrixAt(i, transform.matrix)
        for (let j = 0; j < 7; j++) {
          const angle = j * 2.39996
          transform.position.set(x + Math.cos(angle) * size * 1.25, y + (3.05 + Math.sin(angle) * .32) * size, z + Math.sin(angle) * size)
          transform.rotation.set(.15, angle, .1); transform.scale.set(1.25 * size, 1.05 * size, 1.2 * size); transform.updateMatrix()
          const mesh = j < 4 ? crowns : blossoms, index = j < 4 ? i * 4 + j : i * 3 + j - 4
          mesh.setMatrixAt(index, transform.matrix)
          color.set(j < 4 ? (i % 2 ? '#788a69' : '#536f66') : (i % 3 ? '#c69edc' : '#e3c4e3')); mesh.setColorAt(index, color)
        }
      }
      for (const mesh of [trees, crowns, blossoms]) { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; mesh.computeBoundingSphere() }
      return { body: floatingIslandGeometry(island), roots: hangingRootsGeometry(island), falls: [cloudfallWaterGeometry(island, 0), cloudfallWaterGeometry(island, 1)], trees, crowns, blossoms }
    })
    return { branch, crown, arch, cascade, islands }
  }, [signal, bark, foliage, flower, night])
  useEffect(() => () => {
    resources.branch.dispose(); resources.crown.dispose(); resources.arch.dispose(); resources.cascade.dispose()
    for (const island of resources.islands) {
      island.body.dispose(); island.roots.dispose(); island.falls.forEach(f => f.dispose())
      island.trees.dispose(); island.crowns.dispose(); island.blossoms.dispose()
    }
  }, [resources])
  useFrame(() => groups.current.forEach((group, i) => {
    if (group) group.position.y = CLOUD_ISLANDS[i].y + Math.sin(signal.time.value * .09 + i * 1.9) * .25
  }))
  return <group name="cloudfall-archipelago" dispose={null}>
    {resources.islands.map((island, i) => <group key={i} ref={g => { groups.current[i] = g }} position={[CLOUD_ISLANDS[i].x, CLOUD_ISLANDS[i].y, CLOUD_ISLANDS[i].z]}>
      <mesh geometry={island.body} material={rock}/><mesh geometry={island.roots} material={bark}/>
      <primitive object={island.trees}/><primitive object={island.crowns}/><primitive object={island.blossoms}/>
      {island.falls.map((g, index) => <mesh key={index} geometry={g} material={resources.cascade} renderOrder={7}/>)}
    </group>)}
    <mesh name="broken-natural-sky-arch" geometry={resources.arch} material={rock} position={[30, 46, -139]} rotation={[0, -.28, -.28]}/>
    <CloudRivers signal={signal} night={night}/>
    <CloudRay signal={signal}/>
  </group>
}

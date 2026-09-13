import { useEffect, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { advanceUniform } from './animation'
import type { Point } from './Primitives'

export interface HaloPoint { position: Point; radius: number; color: string; star?: boolean }

function viewport(material: THREE.ShaderMaterial, height: number) { material.uniforms.viewportHeight.value = height }

/** One point draw for all fixture glows; the soft halo also works without Bloom. */
export default function GardenHalos({ points, reducedMotion }: { points: HaloPoint[]; reducedMotion: boolean }) {
  const { size, gl } = useThree()
  const resources = useMemo(() => {
    const geometry = new THREE.BufferGeometry(), positions: number[] = [], colors: number[] = [], params: number[] = []
    points.forEach(p => {
      positions.push(...p.position); colors.push(...new THREE.Color(p.color).toArray())
      params.push(p.radius, p.star ? 1 : 0)
    })
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geometry.setAttribute('halo', new THREE.Float32BufferAttribute(params, 2))
    const material = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, viewportHeight: { value: 1000 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      vertexShader: `attribute vec3 color; attribute vec2 halo; uniform float time; uniform float viewportHeight;
        varying vec3 tint; varying float twinkle; varying float star;
        void main(){vec4 mv=modelViewMatrix*vec4(position,1.); tint=color;star=halo.y;
          twinkle=.82+.18*sin(time*1.5+position.x*4.+position.y*3.);
          gl_PointSize=clamp(halo.x*viewportHeight*projectionMatrix[1][1]/max(.2,-mv.z),1.,160.);
          gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `varying vec3 tint; varying float twinkle; varying float star;
        void main(){vec2 p=gl_PointCoord-.5;float r=length(p);
          float halo=exp(-r*r*24.)*.18;
          float core=exp(-r*r*600.);
          float cross=(exp(-abs(p.x)*160.)*exp(-abs(p.y)*10.)+exp(-abs(p.y)*160.)*exp(-abs(p.x)*10.))*.32*star;
          float alpha=(halo+core*.8+cross)*smoothstep(.5,.32,r)*twinkle;
          gl_FragColor=vec4(tint*1.65,alpha);}`,
    })
    return { geometry, material }
  }, [points])
  useEffect(() => { viewport(resources.material, size.height * gl.getPixelRatio()) }, [resources, size.height, gl])
  useEffect(() => () => { resources.geometry.dispose(); resources.material.dispose() }, [resources])
  useFrame((_, delta) => { if (!reducedMotion) advanceUniform(resources.material.uniforms.time, delta) })
  return <points name="warm-fixture-halos" geometry={resources.geometry} material={resources.material} />
}

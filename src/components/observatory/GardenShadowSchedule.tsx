import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Mesh, MeshPhysicalMaterial, type WebGLRenderer } from 'three'

function updateShadowMap(gl: WebGLRenderer, autoUpdate?: boolean) {
  if (autoUpdate !== undefined) gl.shadowMap.autoUpdate = autoUpdate
  gl.shadowMap.needsUpdate = true
}

/** Slow furniture sway permits cached shadows; water and material lighting still render every frame. */
export default function GardenShadowSchedule({ smooth }: { smooth: boolean }) {
  const { gl, scene } = useThree()
  const elapsed = useRef(0)
  useEffect(() => {
    const previous = gl.shadowMap.autoUpdate
    updateShadowMap(gl, false)
    return () => updateShadowMap(gl, previous)
  }, [gl, smooth])
  useEffect(() => {
    // Imported lanterns include transmission on both glass and an opaque brass material.
    // Use their existing opacity and PBR reflections without a second full-scene pass.
    const originals = new Map<MeshPhysicalMaterial, number>()
    scene.traverse(object => {
      if (!(object instanceof Mesh)) return
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (material instanceof MeshPhysicalMaterial && material.transmission > 0) {
          originals.set(material, material.transmission)
          material.transmission = 0; material.needsUpdate = true
        }
      }
    })
    return () => originals.forEach((transmission, material) => { material.transmission = transmission; material.needsUpdate = true })
  }, [scene, smooth])
  useFrame((_, delta) => {
    elapsed.current += delta
    if (elapsed.current >= (smooth ? .25 : .1)) { elapsed.current = 0; updateShadowMap(gl) }
  })
  return null
}

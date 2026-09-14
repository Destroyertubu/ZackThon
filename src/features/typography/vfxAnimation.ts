import type { Material, ShaderMaterial, Texture } from 'three'

// Three.js owns these mutable GPU resources; React owns only their lifetime.
export function setUniform(material: ShaderMaterial, key: string, value: number) { material.uniforms[key].value = value }
export function advanceShader(material: ShaderMaterial, delta: number) { material.uniforms.time.value += Math.min(delta, .05) }
export function setAlpha(material: Material, value: number) { material.opacity = value }
export function uploadGlyphs(texture: Texture) { texture.needsUpdate = true }

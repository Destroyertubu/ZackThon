/** Three uniforms are imperative GPU state, advanced without a React render. */
export function advanceUniform(uniform: { value: number }, delta: number) {
  uniform.value += Math.min(delta, .05)
}

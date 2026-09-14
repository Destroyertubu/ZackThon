/** GPU uniforms are owned mutable render resources, never React state. */
export function advanceWorldUniform(uniform:{value:number},delta:number) { uniform.value+=Math.min(Math.max(delta,0),.05) }

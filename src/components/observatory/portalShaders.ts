export const portalVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/** Real Hubble dust lanes remain the structure; colour and motion are artistic portal effects. */
export const portalFragmentShader = `
  uniform float time;
  uniform sampler2D galaxy;
  varying vec2 vUv;
  mat2 turn(float a) { return mat2(cos(a), -sin(a), sin(a), cos(a)); }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.0),f.x),f.y);
  }
  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float radius = length(p), angle = atan(p.y, p.x);
    // The M51 nucleus is at (0.378,0.516) in the original wallpaper. Sampling keeps pixels square.
    vec2 source = turn(-0.42 + time * 0.073) * p;
    vec2 sampleUv = vec2(0.378, 0.516) + source * vec2(0.39, 0.52);
    vec3 photograph = texture2D(galaxy, clamp(sampleUv, 0.001, 0.999)).rgb;
    float light = dot(photograph, vec3(0.2126,0.7152,0.0722));
    float nucleus = exp(-radius * radius * 64.0);
    float outer = smoothstep(0.12, 0.55, radius);
    vec3 chromatic = photograph * mix(vec3(1.10,0.94,0.78),vec3(0.80,1.06,1.68),outer);
    // Preserve dark lanes: added nebula light is gated by the original photograph, not painted over it.
    float structure = smoothstep(0.025,0.38,light);
    float wave = 0.5 + 0.5 * sin(angle * 2.0 + radius * 12.0 - time * 0.72);
    vec3 dustColour = mix(vec3(0.29,0.10,0.48),vec3(0.52,0.18,0.32),wave);
    chromatic += dustColour * structure * outer * 0.24;
    chromatic *= 1.07 + 0.13 * sin(angle * 2.0 + radius * 9.0 - time * 0.90);
    float fade = 1.0 - smoothstep(0.64,0.97,radius);
    vec3 colour = vec3(0.004,0.008,0.024) + chromatic * fade * 1.65;
    colour += nucleus * vec3(0.38,0.21,0.055);
    float mist = noise(p * 5.0 + time * 0.023) * noise(p * 11.0 - time * 0.034);
    colour += vec3(0.012,0.027,0.068) * mist * smoothstep(0.4,0.85,radius);
    // Sparse distant stars stay distinct from the nearer three-dimensional star stream.
    vec2 grid = (turn(time * -0.012) * p) * 77.0;
    vec2 cell=floor(grid), local=fract(grid)-0.5;
    float star=step(0.967,hash(cell))*exp(-dot(local,local)*380.0);
    colour += star * (0.5+0.18*sin(time*1.4+hash(cell)*24.0))*vec3(0.50,0.67,1.0);
    gl_FragColor = vec4(colour, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export const portalHaloFragmentShader = `
  uniform float time;
  varying vec2 vUv;
  void main() {
    vec2 p=vUv*2.0-1.0;
    float r=length(p), a=atan(p.y,p.x);
    float ring=exp(-pow((r-0.875)*88.0,2.0));
    float veil=exp(-pow((r-0.875)*16.0,2.0));
    float flow=pow(0.5+0.5*sin(a*3.0-time*1.45),9.0);
    float alpha=(ring*(0.38+flow*0.46)+veil*0.075)*(1.0-smoothstep(0.95,1.0,r));
    if(alpha<0.002) discard;
    vec3 colour=mix(vec3(0.45,0.52,0.96),vec3(1.3,0.63,0.20),ring);
    gl_FragColor=vec4(colour,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

export const portalStarVertexShader = `
  uniform float time;
  attribute vec3 starColour;
  attribute float starSize;
  attribute float phase;
  attribute float orbit;
  varying vec3 vColour;
  varying float vTwinkle;
  void main() {
    float a=time*orbit;
    vec3 p=position;
    p.xy=mat2(cos(a),-sin(a),sin(a),cos(a))*p.xy;
    p.z+=sin(time*0.7+phase)*0.12;
    vec4 viewPosition=modelViewMatrix*vec4(p,1.0);
    gl_Position=projectionMatrix*viewPosition;
    gl_PointSize=clamp(starSize*(390.0/max(1.0,-viewPosition.z)),1.0,15.0);
    vColour=starColour;
    vTwinkle=0.56+0.38*sin(time*(1.15+orbit*2.0)+phase);
  }
`

export const portalStarFragmentShader = `
  varying vec3 vColour;
  varying float vTwinkle;
  void main() {
    vec2 p=gl_PointCoord-0.5;
    float d=dot(p,p);
    float core=exp(-d*200.0);
    float halo=exp(-d*23.0)*0.23;
    float cross=(exp(-abs(p.x)*100.0)*exp(-abs(p.y)*10.0)+exp(-abs(p.y)*100.0)*exp(-abs(p.x)*10.0))*0.12;
    float alpha=(core+halo+cross)*vTwinkle;
    if(alpha<0.008) discard;
    gl_FragColor=vec4(vColour,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`

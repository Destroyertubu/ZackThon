/** Sky and water evaluate identical horizon colours, cloud drift and celestial direction. */
export const MIRROR_SKY_GLSL = `
float mirrorHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float mirrorNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mirrorHash(i),mirrorHash(i+vec2(1,0)),f.x),mix(mirrorHash(i+vec2(0,1)),mirrorHash(i+1.),f.x),f.y);}
vec3 sampleMirrorSky(vec3 direction){
  vec3 d=normalize(direction);float h=max(d.y,0.);vec3 c=mix(bottom,top,smoothstep(0.,.72,h));
  float facing=pow(max(dot(normalize(d.xz+vec2(.00001)),normalize(sunDirection.xz)),0.),8.);
  c+=sunlight*exp(-pow((h-.09)*8.,2.))*facing*.22*(1.-night*.7);
  float disk=smoothstep(.9995,.9997,dot(d,sunDirection));c+=sunlight*disk*1.9*(1.-night);
  vec2 q=d.xz/(.18+h)*2.8+vec2(time*.009,time*.002);
  float cloud=mirrorNoise(q)*.55+mirrorNoise(q*2.1)*.28+mirrorNoise(q*4.2)*.12;
  float cloudMask=smoothstep(.48,.7,cloud)*smoothstep(.07,.16,h)*(1.-smoothstep(.4,.64,h));
  c=mix(c,mix(top*.85,vec3(.78,.57,.52),facing*.6),cloudMask*.48);
  c+=vec3(.11,.25,.30)*pulse*exp(-pow((h-.14)*7.,2.))*.08;
  return c;
}`

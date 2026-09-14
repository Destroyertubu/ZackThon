import * as THREE from 'three'
import { pbrMaps, SETS, stoneMaterial, timberMaterial, walnutMaterial } from '../scene/pbr'
import { DECK_LIGHT_POOLS } from './gardenLightLayout'
import { GARDEN_DECK_TEXTURE_SPAN } from './gardenDeckLayout'
import type { TideSignal } from '@/features/journeys/scene/atmosphereMotion'

function random(seed: number) {
  let value = seed
  return () => { value = (Math.imul(value, 1664525) + 1013904223) >>> 0; return value / 4294967296 }
}

/** An engraved decorative atlas, deliberately independent of the user's world seed. */
function atlasTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1024
  const ctx = canvas.getContext('2d')!
  const rng = random(701)
  ctx.fillStyle = '#102c32'
  ctx.fillRect(0, 0, 1024, 1024)
  for (let i = 0; i < 15000; i++) {
    ctx.fillStyle = `rgba(181,165,112,${rng() * 0.05})`
    ctx.fillRect(rng() * 1024, rng() * 1024, 2, 2)
  }
  ctx.translate(512, 512)
  const circle = (radius: number) => { ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke() }
  ctx.strokeStyle = '#b69960'
  ctx.lineWidth = 2
  ;[475, 468, 419, 413].forEach(circle)
  ctx.strokeStyle = 'rgba(167,180,165,.3)'
  ctx.lineWidth = 1
  ;[100, 200, 300, 400].forEach(circle)
  for (let i = 0; i < 360; i++) {
    const angle = i * Math.PI / 180
    const length = i % 30 === 0 ? 30 : i % 5 === 0 ? 18 : 6
    ctx.strokeStyle = i % 5 === 0 ? '#d7bf87' : '#786e50'
    ctx.beginPath()
    ctx.moveTo(Math.sin(angle) * 465, Math.cos(angle) * 465)
    ctx.lineTo(Math.sin(angle) * (465 - length), Math.cos(angle) * (465 - length))
    ctx.stroke()
    if (i % 30 === 0) {
      ctx.save(); ctx.rotate(-angle)
      ctx.fillStyle = '#c9b887'; ctx.textAlign = 'center'; ctx.font = '14px Georgia'
      ctx.fillText(String(i).padStart(3, '0'), 0, -423)
      ctx.restore()
    }
  }
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6
    ctx.strokeStyle = 'rgba(167,180,165,.2)'
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.sin(a) * 413, Math.cos(a) * 413); ctx.stroke()
  }
  const points = Array.from({ length: 54 }, () => {
    const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 380
    return [Math.cos(a) * r, Math.sin(a) * r]
  })
  points.forEach(([x, y], i) => {
    if (i % 5 !== 0 && i > 0) {
      const prev = points[i - 1]
      if (Math.hypot(x - prev[0], y - prev[1]) < 240) {
        ctx.strokeStyle = 'rgba(170,197,183,.5)'
        ctx.beginPath(); ctx.moveTo(...prev as [number, number]); ctx.lineTo(x, y); ctx.stroke()
      }
    }
    ctx.fillStyle = i % 4 === 0 ? '#ebd396' : '#a9c8c1'
    ctx.beginPath(); ctx.arc(x, y, i % 4 === 0 ? 3.5 : 1.6, 0, Math.PI * 2); ctx.fill()
  })
  ctx.font = '22px Georgia'; ctx.textAlign = 'center'; ctx.fillStyle = '#e4d3a4'
  ;[['N', 0, -487], ['S', 0, 502], ['W', -491, 8], ['E', 491, 8]].forEach(([label, x, y]) => ctx.fillText(label as string, x as number, y as number))
  ctx.font = '14px Georgia'; ctx.fillStyle = '#b9ae85'
  ctx.fillText('W A N D E R W I S E', 0, 345)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 8
  return texture
}

export function createObservatoryMaterials(signal?: TideSignal) {
  const chart = atlasTexture()
  const deck = new THREE.MeshStandardMaterial({
    ...pbrMaps(SETS.floorDeck, 1, 1), color: '#a6b4ba', roughness: .9,
    normalScale: new THREE.Vector2(0.45, 0.45), envMapIntensity: 0.75,
  })
  // The scan contains twelve boards. Its tile matches the physical board width,
  // independent of the instanced box's length; top faces share a continuous grain.
  deck.onBeforeCompile = (shader) => {
    shader.uniforms.tideTime = signal?.time ?? { value: 0 }
    shader.uniforms.tidePulse = signal?.pulse ?? { value: 0 }
    shader.uniforms.tideAccent = signal?.color ?? { value: new THREE.Color('#87d8d0') }
    shader.vertexShader = 'varying vec3 gardenFloorPosition;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <uv_vertex>', `
      #include <uv_vertex>
      #ifdef USE_INSTANCING
        gardenFloorPosition = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;
        if (abs(normal.y) > 0.5) {
          vec4 floorPosition = instanceMatrix * vec4(position, 1.0);
          vec2 floorUv = vec2(floorPosition.z, floorPosition.x) / ${GARDEN_DECK_TEXTURE_SPAN.toFixed(3)} + vec2(0.0, 0.04);
          vMapUv = floorUv;
          vNormalMapUv = floorUv;
          vRoughnessMapUv = floorUv;
        }
      #endif
    `)
    shader.fragmentShader = 'varying vec3 gardenFloorPosition;uniform float tideTime,tidePulse;uniform vec3 tideAccent;\n' + shader.fragmentShader
    const poolCode = DECK_LIGHT_POOLS.map(p => `{
      vec2 d = gardenFloorPosition.xz - vec2(${p.x.toFixed(3)}, ${p.z.toFixed(3)});
      gardenWarm += exp(-dot(d,d)*1.15)*${p.power.toFixed(3)};
      gardenSheen += exp(-dot(d*vec2(2.0,.48),d*vec2(2.0,.48))*2.5)*${(p.power * .18).toFixed(3)};
    }`).join('\n')
    shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_end>', `
      #include <lights_fragment_end>
      float gardenWarm=0.;float gardenSheen=0.;
      ${poolCode}
      float topSurface=smoothstep(-.03,.015,gardenFloorPosition.y);
      reflectedLight.indirectDiffuse += diffuseColor.rgb*vec3(1.,.49,.14)*gardenWarm*1.1*topSurface;
      reflectedLight.indirectSpecular += vec3(1.,.64,.25)*gardenSheen*.32*topSurface;
      vec2 tideFloor=gardenFloorPosition.xz-vec2(-2.,-2.);
      float tideBand=exp(-pow((length(tideFloor)-3.6)/.95,2.))*smoothstep(-.1,.8,tideFloor.y);
      float caustic=pow(max(0.,sin(gardenFloorPosition.x*13.+sin(gardenFloorPosition.z*8.+tideTime*.7)*1.4)
        *sin(gardenFloorPosition.z*12.-tideTime*.6)),5.);
      reflectedLight.indirectDiffuse += tideAccent*tideBand*(.035+caustic*.065+tidePulse*.13)*topSurface;
      reflectedLight.indirectSpecular += tideAccent*tideBand*caustic*.10*topSurface;
    `)
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      roughnessFactor=clamp(roughnessFactor,.3,.63);
    `)
  }
  deck.customProgramCacheKey = () => 'garden-deck-fixture-pools-v3-tide'
  const brass = new THREE.MeshStandardMaterial({
    ...pbrMaps({ nor: SETS.rock.nor }, 3, 2),
    color: '#bd9756', metalness: 0.83, roughness: 0.43,
    normalScale: new THREE.Vector2(0.075, 0.075), envMapIntensity: 1.25,
  })
  const brightBrass = brass.clone()
  brightBrass.color.set('#e1c088'); brightBrass.roughness = 0.28
  const inlay = new THREE.MeshStandardMaterial({ color: '#c6a261', metalness: .48, roughness: .4,
    emissive: '#956326', emissiveIntensity: .16, envMapIntensity: 1.2 })
  const iron = new THREE.MeshStandardMaterial({ color: '#25383a', metalness: 0.72, roughness: 0.52 })
  const slate = new THREE.MeshStandardMaterial({
    ...pbrMaps(SETS.rock, 4, 2), color: '#39464b', roughness: 0.85,
    normalScale: new THREE.Vector2(0.35, 0.35),
  })
  const wood = timberMaterial(.6, 2), walnut = walnutMaterial(2, 2, '#947050')
  // A varnished-table scan has roughness near .24. Keep its grain variation,
  // while giving garden beams and furniture the intended matte/satin finish.
  for (const [material, base, variation, name] of [[wood, .56, .4, 'wood'], [walnut, .34, .55, 'walnut']] as const) {
    material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
        #include <roughnessmap_fragment>
        roughnessFactor = ${base} + roughnessFactor * ${variation};
      `)
    }
    material.customProgramCacheKey = () => 'garden-satin-' + name
  }
  return {
    deck, brass, brightBrass, inlay, iron, slate,
    stone: stoneMaterial(5, 1),
    wood, walnut,
    atlas: new THREE.MeshStandardMaterial({ map: chart, roughness: 0.57, metalness: 0.38, envMapIntensity: 0.65 }),
    glass: new THREE.MeshPhysicalMaterial({ color: '#476d72', metalness: 0.55, roughness: 0.08, clearcoat: 1, envMapIntensity: 1.4 }),
    starGlass: new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, toneMapped: false,
      vertexShader: `varying vec3 sphereNormal;varying vec3 eyeDirection;
        void main(){vec4 mv=modelViewMatrix*vec4(position,1.);sphereNormal=normalize(normalMatrix*normal);eyeDirection=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `varying vec3 sphereNormal;varying vec3 eyeDirection;
        void main(){vec3 n=normalize(sphereNormal);float rim=pow(1.-max(0.,dot(n,normalize(eyeDirection))),3.5);
          float glint=pow(max(0.,dot(n,normalize(vec3(-.55,.7,.55)))),62.);
          vec3 tint=mix(vec3(.33,.48,.62),vec3(1.,.84,.58),glint);
          gl_FragColor=vec4(tint+glint*.8,.018+rim*.52+glint*.72);}`,
    }),
    glow: new THREE.MeshBasicMaterial({ color: '#ffd697', toneMapped: false }),
  }
}

export type ObservatoryMaterials = ReturnType<typeof createObservatoryMaterials>

/** Dispose only materials/textures owned by this scene; the asset registry stays cached. */
export function disposeObservatoryMaterials(materials: ObservatoryMaterials) {
  const textures = new Set<THREE.Texture>()
  Object.values(materials).forEach((material) => {
    Object.values(material).forEach((value) => { if (value instanceof THREE.Texture) textures.add(value) })
    material.dispose()
  })
  textures.forEach((texture) => texture.dispose())
}

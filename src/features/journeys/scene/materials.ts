import { useEffect, useMemo } from 'react'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import type { RealmPalette } from '../realmDefinitions'
import type { MaterialKey } from './geometry'
import pavingUrl from './assets/sandstone-blocks.jpg'
import pavingNormalUrl from './assets/sandstone-blocks-normal.jpg'
import pavingRoughUrl from './assets/sandstone-blocks-rough.jpg'
import monetUrl from './assets/monet-parliament.jpg'
import bridgeUrl from './assets/monet-waterloo.jpg'
import veniceUrl from './assets/turner-venice.jpg'

const URLS = [
  '/models/garden/journey-textures/wood_floor_deck_diff_1k.webp', '/models/garden/journey-textures/wood_floor_deck_nor_gl_1k.webp',
  '/models/garden/journey-textures/wood_table_001_diff_1k.webp', '/models/garden/journey-textures/wood_table_001_nor_gl_1k.webp',
  '/models/garden/journey-textures/rock_face_diff_1k.webp', '/models/garden/journey-textures/rock_face_nor_gl_1k.webp',
  '/models/garden/journey-textures/plastered_wall_04_diff_1k.webp', '/models/garden/journey-textures/jacaranda-bark.webp', '/models/garden/journey-textures/jacaranda-bark-normal.webp', '/models/garden/journey-textures/jacaranda-leaves.webp', pavingUrl,pavingNormalUrl,pavingRoughUrl,monetUrl,bridgeUrl,veniceUrl,
]
export function preloadJourneyAssets() { useTexture.preload(URLS) }
export function useWorldMaterials(palette: RealmPalette, time: {value:number}, realmId?: string) {
  const sunset=realmId==='sunset-boulevard'
  const urls=useMemo(()=>sunset?URLS.map((url,index)=>index===10?'/textures/sunset-boulevard/patterned_cobblestone_diff_2k.webp':index===11?'/textures/sunset-boulevard/patterned_cobblestone_nor_gl_2k.webp':index===12?'/textures/sunset-boulevard/patterned_cobblestone_rough_2k.webp':url):URLS,[sunset])
  const source = useTexture(urls)
  const bundle = useMemo(() => {
    const textures = source.map((item, i) => {
      const texture = item.clone()
      texture.colorSpace = [0, 2, 4, 6, 7, 9,10,13,14,15].includes(i) ? THREE.SRGBColorSpace : THREE.NoColorSpace
      texture.wrapS = texture.wrapT = THREE.RepeatWrapping
      texture.anisotropy = sunset ? 8 : 4
      texture.needsUpdate = true
      return texture
    })
    const [deck, deckNormal, walnut, walnutNormal, rock, rockNormal, plaster, bark, barkNormal, leaves,paving,pavingNormal,pavingRough,monet,bridge,venice] = textures
    const standard = (settings: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ envMapIntensity: .42, ...settings })
    const materials: Record<MaterialKey, THREE.Material> = {
      paving: standard({map:paving,normalMap:pavingNormal,roughnessMap:pavingRough,normalScale:new THREE.Vector2(sunset?.62:.45,sunset?.62:.45),color:sunset?'#e6d4b9':'#f4dec5',roughness:sunset?.84:.96}),
      artMonet: standard({map:monet,color:'#ffffff',roughness:.92,emissive:'#ffffff',emissiveMap:monet,emissiveIntensity:.24}),
      artBridge: standard({map:bridge,color:'#ffffff',roughness:.92,emissive:'#ffffff',emissiveMap:bridge,emissiveIntensity:.24}),
      artVenice: standard({map:venice,color:'#ffffff',roughness:.92,emissive:'#ffffff',emissiveMap:venice,emissiveIntensity:.24}),
      stone: standard({ map: rock, normalMap: rockNormal, normalScale: new THREE.Vector2(.38,.38), color: palette.stone, roughness: .88 }),
      wood: standard({ map: deck, normalMap: deckNormal, normalScale: new THREE.Vector2(.45,.45), color: sunset?'#bfa184':'#e1b680', roughness: sunset?.6:.76 }),
      darkWood: standard({ map: walnut, normalMap: walnutNormal, normalScale: new THREE.Vector2(.5,.5), color: sunset?'#8b6d59':'#be936a', roughness: sunset?.53:.74 }),
      brass: standard({ color: '#c5a26b', metalness: .74, roughness: sunset?.29:.43 }),
      iron: standard({ color: '#293e43', metalness: .7, roughness: .57 }),
      plaster: standard({ map: plaster, color: '#f2e6d7', roughness: .92 }),
      bark: standard({ map: bark, normalMap: barkNormal, color: '#b6a698', normalScale: new THREE.Vector2(.7,.7), roughness: .92 }),
      leaves: standard({ map: sunset?null:leaves, color: sunset?'#768669':palette.foliage, side: THREE.DoubleSide, alphaTest: sunset?0:.33, roughness: .9 }),
      petals: standard({ map: sunset?null:leaves, color: sunset?'#b694b8':'#ca92dd', emissive:'#8a53b2', emissiveIntensity:sunset?.018:.13, side: THREE.DoubleSide, alphaTest: sunset?0:.33, roughness: .9 }),
      glass: standard({ color: '#afd6dc', transparent: true, opacity: .09, roughness: .17, metalness: .14, side: THREE.DoubleSide, depthWrite: false }),
      glow: new THREE.MeshBasicMaterial({ color: '#f8cc8b', toneMapped: false }),
      leaf: standard({ color: '#8aab64', roughness: .84, side: THREE.DoubleSide }),
      ink: standard({ color: sunset?'#536f60':palette.accent, roughness: sunset?.87:.7 }),
      paper: standard({ color: '#ecdfc4', roughness: .96, side: THREE.DoubleSide }),
      rose: standard({ color: sunset?'#b79a80':'#ad6c8b', map:sunset?plaster:null, normalMap:sunset?rockNormal:null, normalScale:new THREE.Vector2(.12,.12), roughness:sunset?.95:.78 }),
    }
    // Neutralise the scanned rock's brown cast while retaining mineral structure.
    const stone = materials.stone as THREE.MeshStandardMaterial
    stone.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
        #ifdef USE_MAP
          vec4 mineral=texture2D(map,vMapUv);
          float luminance=dot(mineral.rgb,vec3(.2126,.7152,.0722));
          diffuseColor*=vec4(mix(vec3(luminance),mineral.rgb,.12)*1.5,mineral.a);
        #endif`)
    }
    stone.customProgramCacheKey = () => 'journey-pearl-stone-v1'
    for(const key of ['leaves','petals'] as const){
      const material=materials[key] as THREE.MeshStandardMaterial
      material.onBeforeCompile=shader=>{
        shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>', `
          #ifdef USE_MAP
            vec4 leafSample=texture2D(map,vMapUv);
            float leafLight=dot(leafSample.rgb,vec3(.2126,.7152,.0722));
            diffuseColor*=vec4(vec3(.38+.62*smoothstep(.015,.42,leafLight)),leafSample.a);
          #endif`)
        // Sunset planters contain world-baked vertices. Their z coordinate is
        // a location, not distance from a leaf stem; keep the complete plant static.
        if(!sunset){
          shader.uniforms.journeyWind=time
          shader.vertexShader='uniform float journeyWind;\n'+shader.vertexShader
          shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
          transformed.x+=sin(journeyWind*.62+position.x*.8+position.z)*.04*smoothstep(1.,6.,position.y);
          transformed.z+=cos(journeyWind*.48+position.z)*.026*smoothstep(1.,6.,position.y);`)
        }
        if(sunset)shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
          #if NUM_DIR_LIGHTS > 0
            float backLeaf=pow(max(dot(-normal,directionalLights[0].direction),0.),2.0);
            outgoingLight+=diffuseColor.rgb*directionalLights[0].color*backLeaf*.085;
          #endif
          #include <opaque_fragment>`)
      }
      material.customProgramCacheKey=()=>`journey-leaf-colour-v4-static-sunset-${key}-${sunset}`
    }
    const paved=materials.paving as THREE.MeshStandardMaterial
    paved.onBeforeCompile=shader=>{
      if(sunset){
        shader.vertexShader='varying vec3 sunsetPavingWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nsunsetPavingWorld=(modelMatrix*vec4(position,1.)).xyz;')
        shader.fragmentShader='varying vec3 sunsetPavingWorld;\n'+shader.fragmentShader
        shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
          float moist=.5+.24*sin(sunsetPavingWorld.x*.57+sin(sunsetPavingWorld.z*.22))+.18*cos(sunsetPavingWorld.z*.44-sunsetPavingWorld.x*.23);
          float wetness=smoothstep(.61,.85,moist)*.8;
          roughnessFactor=mix(clamp(roughnessFactor,.68,.94),.28,wetness);
          diffuseColor.rgb*=1.-wetness*.13;`)
      }else shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\nroughnessFactor=max(roughnessFactor,.65);')
    }
    paved.customProgramCacheKey=()=> `journey-paving-v2-${sunset}`
    return { materials, textures }
  }, [source, palette, time, sunset])
  useEffect(() => () => {
    Object.values(bundle.materials).forEach(material => material.dispose())
    bundle.textures.forEach(texture => texture.dispose())
  }, [bundle])
  return bundle.materials
}

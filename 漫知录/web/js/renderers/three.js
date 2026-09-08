import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildScene } from '../scene-data.js';
import { cameraBasis } from '../math.js';
const SKY_VERTEX = `varying vec3 vPosition;void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const SKY_FRAGMENT = `varying vec3 vPosition;void main(){vec3 d=normalize(vPosition);float h=clamp(d.y*.8+.13,0.,1.);vec3 low=vec3(.62,.76,.72),high=vec3(.13,.30,.37);vec3 c=mix(low,high,pow(h,.65));float sun=pow(max(0.,dot(d,normalize(vec3(-.45,.35,-.7)))),80.);c+=vec3(.40,.31,.17)*sun;gl_FragColor=vec4(c,1.);}`;
const WATER_VERTEX = `varying vec3 vWorld;void main(){vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`;
const WATER_FRAGMENT = `uniform float uTime;uniform vec3 uCamera;varying vec3 vWorld;
void main(){vec2 p=vWorld.xz;float t=uTime*.22;float a=sin(p.x*.17+p.y*.10+t),b=sin(p.y*.23-p.x*.08-t*.8);vec3 n=normalize(vec3(a*.055,1.,b*.06));vec3 v=normalize(uCamera-vWorld);float fres=pow(1.-max(0.,dot(v,n)),3.);float glitter=pow(max(0.,dot(reflect(-normalize(vec3(-.45,.35,-.7)),n),v)),95.);vec3 c=mix(vec3(.055,.22,.26),vec3(.47,.66,.63),fres);c+=vec3(.45,.39,.23)*glitter*.8;float streak=smoothstep(.98,1.,sin(p.y*.45+a*.6+t))*smoothstep(.8,1.,sin(p.x*.13));c+=streak*.025;float fog=1.-exp(-length(uCamera-vWorld)*.003);c=mix(c,vec3(.56,.72,.68),fog);gl_FragColor=vec4(c,1.);}`;
function geometry(mesh) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(mesh.positions, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(mesh.colors, 3)); g.computeVertexNormals(); return g; }
function disposeObject(object) { object.traverse(o => { if (o.geometry)
    o.geometry.dispose(); const materials = Array.isArray(o.material) ? o.material : [o.material]; for (const m of materials)
    if (m) {
        for (const v of Object.values(m))
            if (v?.isTexture)
                v.dispose();
        m.dispose();
    } }); }
export class ThreeRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.name = 'Three.js · WebGL2';
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2('#aac4bb', .0055);
        this.camera = new THREE.PerspectiveCamera(58, 1, .15, 1300);
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
        this.renderer.setClearColor('#8baaa6');
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.18;
        this.renderer.info.autoReset = false;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.scene.add(new THREE.HemisphereLight('#e1f4de', '#476a72', 2.2));
        const sun = new THREE.DirectionalLight('#ffddae', 2.5);
        sun.position.set(-55, 90, 40);
        sun.castShadow = true;
        sun.shadow.mapSize.set(1024, 1024);
        Object.assign(sun.shadow.camera, { left: -85, right: 85, top: 85, bottom: -85, near: 1, far: 220 });
        sun.shadow.bias = -.0006;
        this.scene.add(sun);
        this.sky = new THREE.Mesh(new THREE.SphereGeometry(650, 24, 16), new THREE.ShaderMaterial({ vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT, side: THREE.BackSide, depthWrite: false }));
        this.scene.add(this.sky);
        this.water = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.ShaderMaterial({ vertexShader: WATER_VERTEX, fragmentShader: WATER_FRAGMENT, uniforms: { uTime: { value: 0 }, uCamera: { value: new THREE.Vector3() } }, side: THREE.DoubleSide }));
        this.water.rotation.x = -Math.PI / 2;
        this.water.position.y = -11.7;
        this.scene.add(this.water);
        this.group = new THREE.Group();
        this.scene.add(this.group);
        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.bloom = new UnrealBloomPass(new THREE.Vector2(800, 600), .32, .5, 1.08);
        this.composer.addPass(this.bloom);
        this.outputPass = new OutputPass();
        this.composer.addPass(this.outputPass);
        this.quality = 'balanced';
        this.projectV = new THREE.Vector3();
    }
    resize(w, h, dpr = 1) { this.width = w; this.height = h; const ratio = Math.min(dpr, this.quality === 'low' ? 1 : 1.6); this.renderer.setPixelRatio(ratio); this.renderer.setSize(w, h, false); this.composer.setPixelRatio(ratio); this.composer.setSize(w, h); this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    setWorld(world) {
        disposeObject(this.group);
        this.group.clear();
        const scene = buildScene(world);
        const ground = new THREE.Mesh(geometry(scene.terrain), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .98, metalness: 0, flatShading: true, side: THREE.DoubleSide }));
        ground.receiveShadow = true;
        ground.castShadow = true;
        this.group.add(ground);
        const count = scene.trees.length, trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.07, .1, 2.8, 6), new THREE.MeshStandardMaterial({ color: '#69735e', roughness: 1 }), count), foliage = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 4.5, 8), new THREE.MeshStandardMaterial({ color: 'white', roughness: 1, flatShading: true }), count * 2), dummy = new THREE.Object3D();
        scene.trees.forEach((t, i) => { dummy.position.set(t.x, 1.4 * t.scale, t.z); dummy.scale.setScalar(t.scale); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix); for (let j = 0; j < 2; j++) {
            dummy.position.set(t.x, (2.9 + j * 1.25) * t.scale, t.z);
            dummy.scale.setScalar(t.scale * (j ? .68 : 1));
            dummy.updateMatrix();
            foliage.setMatrixAt(i * 2 + j, dummy.matrix);
            foliage.setColorAt(i * 2 + j, new THREE.Color(t.color));
        } });
        for (const mesh of [trunks, foliage]) {
            mesh.instanceMatrix.needsUpdate = true;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.computeBoundingSphere();
            this.group.add(mesh);
        }
        if (foliage.instanceColor)
            foliage.instanceColor.needsUpdate = true;
        for (const b of scene.beacons) {
            const material = new THREE.MeshStandardMaterial({ color: b.color, emissive: b.color, emissiveIntensity: 1.7, roughness: .3, metalness: .25 });
            const ring = new THREE.Mesh(new THREE.TorusGeometry(b.r, .028, 6, 60), material);
            ring.position.set(b.x, b.y, b.z + .24);
            this.group.add(ring);
        }
        for (const b of scene.lanterns) {
            const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(.19, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(b.color).multiplyScalar(2) }));
            orb.position.set(b.x, b.y, b.z);
            this.group.add(orb);
        }
        // Low-frequency drifting particles, one draw call. Generated locally, no image fetch.
        const countParticles = 180, positions = new Float32Array(countParticles * 3);
        for (let i = 0; i < countParticles; i++) {
            positions[i * 3] = Math.sin(i * 12.9898) * 85;
            positions[i * 3 + 1] = 2 + (Math.sin(i * 7.17) * .5 + .5) * 12;
            positions[i * 3 + 2] = Math.cos(i * 8.361) * 85;
        }
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        this.particles = new THREE.Points(g, new THREE.PointsMaterial({ color: '#ecddaf', size: .10, transparent: true, opacity: .55, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.group.add(this.particles);
    }
    render(camera, time, options = {}) {
        this.camera.position.set(camera.x, camera.y, camera.z);
        const { forward } = cameraBasis(camera);
        this.camera.lookAt(camera.x + forward[0], camera.y + forward[1], camera.z + forward[2]);
        this.camera.updateMatrixWorld();
        this.sky.position.copy(this.camera.position);
        this.water.material.uniforms.uTime.value = options.reduced ? 0 : time / 1000;
        this.water.material.uniforms.uCamera.value.copy(this.camera.position);
        if (this.particles)
            this.particles.rotation.y = options.reduced ? 0 : Math.sin(time * .00001) * .025;
        this.bloom.enabled = !options.reduced && options.quality !== 'low';
        this.renderer.shadowMap.enabled = options.quality !== 'low';
        this.renderer.info.reset();
        this.composer.render();
        this.stats = { drawCalls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles };
    }
    project(point) { this.projectV.set(...point); const depth = this.projectV.clone().applyMatrix4(this.camera.matrixWorldInverse).z * -1; this.projectV.project(this.camera); return { x: (this.projectV.x * .5 + .5) * this.width, y: (-.5 * this.projectV.y + .5) * this.height, depth }; }
    dispose() { disposeObject(this.scene); this.composer.dispose(); this.bloom.dispose(); this.outputPass.dispose(); this.renderer.dispose(); }
}

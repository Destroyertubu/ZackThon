import * as THREE from 'three'
import { Reflector } from 'three/addons/objects/Reflector.js'

/** One reflection target, throttled independently of the main animation clock. */
export class WaterReflection {
  readonly waterLevel: number
  readonly hz: number
  readonly reflector: Reflector
  readonly matrix = new THREE.Matrix4()
  readonly ready = { value: 0 }
  private elapsed = 1
  private cacheAge = 3
  private busy = false
  private disposed = false
  private stage = 0
  private lived = 0
  private windowTime = 0
  private windowFrames = 0
  private overBudgetWindows = 0
  private cooldown = 6
  private cpuMilliseconds = 0
  private captures = 0
  private sinceCapture = 0
  private baseWidth: number
  private baseHeight: number
  private excluded: { object: THREE.Object3D; visible: boolean }[] = []
  private readonly inverse = new THREE.Matrix4()
  private readonly viewport = new THREE.Vector4()
  private readonly direction = new THREE.Vector3()

  constructor(waterLevel: number, hz: number, width: number, height: number) {
    this.waterLevel = waterLevel; this.hz = hz
    this.baseWidth = width; this.baseHeight = height
    this.reflector = new Reflector(new THREE.PlaneGeometry(1, 1), { textureWidth: width, textureHeight: height, clipBias: .002, multisample: 0 })
    this.reflector.rotation.x = -Math.PI / 2; this.reflector.position.y = waterLevel
    this.reflector.updateMatrixWorld(true); this.inverse.copy(this.reflector.matrixWorld).invert()
    this.reflector.getRenderTarget().texture.name = 'water-planar-reflection'
  }

  get currentHz() { return this.stage >= 1 ? Math.max(7, Math.round(this.hz * .5)) : this.hz }
  get resolutionRatio() { return this.stage >= 2 ? .7 : 1 }
  get budgetStage() { return this.stage }
  get averageCpuMs() { return this.cpuMilliseconds }
  get captureCount() { return this.captures }

  /** Two sustained bad windows per step, plus cooldown; stages latch until scene/quality changes. */
  advance(delta: number) {
    const step = Math.max(0, Math.min(.1, delta))
    this.elapsed += step; this.cacheAge += step; this.lived += step; this.cooldown -= step; this.sinceCapture += step
    if (this.sinceCapture > 1) { this.windowTime = 0; this.windowFrames = 0; return }
    if (delta <= 0 || delta > .15 || this.lived < 6 || this.captures < 3 || this.stage >= 3) return
    this.windowTime += delta; this.windowFrames++
    if (this.windowTime < 3) return
    const meanFrame = this.windowTime / this.windowFrames
    if (meanFrame > .027 || this.cpuMilliseconds > 9) this.overBudgetWindows++
    else if (meanFrame < .022 && this.cpuMilliseconds < 6) this.overBudgetWindows = 0
    this.windowTime = 0; this.windowFrames = 0
    if (this.cooldown > 0 || this.overBudgetWindows < 2) return
    this.stage++; this.overBudgetWindows = 0; this.cooldown = 6; this.cacheAge = 3
    if (this.stage === 2) this.applySize()
  }
  private applySize() {
    const width = Math.max(64, Math.round(this.baseWidth * this.resolutionRatio)), height = Math.max(64, Math.round(this.baseHeight * this.resolutionRatio))
    const target = this.reflector.getRenderTarget()
    if (target.width !== width || target.height !== height) { target.setSize(width, height); this.ready.value = 0; this.elapsed = 1 }
  }
  resize(width: number, height: number) {
    this.baseWidth = Math.max(64, width); this.baseHeight = Math.max(64, height); this.applySize()
  }
  capture(gl: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, water: THREE.Object3D) {
    if (this.disposed || this.busy || this.hz <= 0 || this.elapsed < 1 / this.currentHz || scene.overrideMaterial || camera.position.y < this.waterLevel + .1) return
    if (camera.getWorldDirection(this.direction).y > .38) return
    this.elapsed = 0; this.busy = true
    if (this.cacheAge >= 2) {
      this.excluded.length = 0
      scene.traverse(object => {
        const skip = object === water || (object instanceof THREE.Points && object.userData.reflectInWater !== true) || object.userData.excludeWaterReflection === true
          || /moonwater-rill|cocktail-vision|star-glass-preview|cloud-rivers-between|island-water-reflections/.test(object.name)
          || (this.stage >= 3 && /mirror-sea-distant-landscape|cloudfall-archipelago|particle-floating-archipelago/.test(object.name))
          || (object instanceof THREE.Mesh && (object.geometry.index?.count ?? object.geometry.attributes.position?.count ?? 0) > 450_000)
        if (skip) this.excluded.push({ object, visible: object.visible })
      })
      this.cacheAge = 0
    }
    const target = gl.getRenderTarget(), shadow = gl.shadowMap.autoUpdate, xr = gl.xr.enabled
    gl.getViewport(this.viewport)
    for (const item of this.excluded) { item.visible = item.object.visible; item.object.visible = false }
    const started = performance.now()
    try {
      this.reflector.onBeforeRender(gl, scene, camera, this.reflector.geometry, this.reflector.material as THREE.ShaderMaterial, null as unknown as THREE.Group)
      this.matrix.copy((this.reflector.material as THREE.ShaderMaterial).uniforms.textureMatrix.value).multiply(this.inverse)
      this.ready.value = 1
      this.captures++
      this.sinceCapture = 0
    } finally {
      for (const item of this.excluded) item.object.visible = item.visible
      gl.xr.enabled = xr; gl.shadowMap.autoUpdate = shadow; gl.setRenderTarget(target); gl.setViewport(this.viewport)
      this.busy = false
      const cost = performance.now() - started
      this.cpuMilliseconds = this.cpuMilliseconds ? this.cpuMilliseconds * .9 + cost * .1 : cost
    }
  }
  dispose() {
    if (this.disposed) return
    this.disposed = true; this.ready.value = 0; this.excluded.length = 0
    this.reflector.geometry.dispose(); this.reflector.dispose()
  }
}

const DIAGNOSTIC_KEYS = ['waterReflectionHz', 'waterReflectionScale', 'waterReflectionStage', 'waterReflectionCpuMs', 'waterReflectionCaptures'] as const
export function publishWaterReflection(element: HTMLCanvasElement, reflection: WaterReflection | null, baseScale: number) {
  element.dataset.waterReflectionHz = String(reflection?.currentHz ?? 0)
  element.dataset.waterReflectionScale = (reflection ? baseScale * reflection.resolutionRatio : 0).toFixed(2)
  element.dataset.waterReflectionStage = String(reflection?.budgetStage ?? 0)
  element.dataset.waterReflectionCpuMs = (reflection?.averageCpuMs ?? 0).toFixed(2)
  element.dataset.waterReflectionCaptures = String(reflection?.captureCount ?? 0)
}
export function clearWaterReflectionDiagnostics(element: HTMLCanvasElement) { for (const key of DIAGNOSTIC_KEYS) delete element.dataset[key] }

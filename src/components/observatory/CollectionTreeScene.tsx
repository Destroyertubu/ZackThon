import { useEffect, useMemo, useRef, type CSSProperties, type KeyboardEvent, type SyntheticEvent } from 'react'
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { CollectionTreeTopic } from '../../features/personal/collectionTree'
import { GARDEN_TREE_ANCHORS, type GardenTreePoint } from './gardenTreeShape'
import { COLLECTION_TREE_CAMERA_POSITION, COLLECTION_TREE_LOOK_AT } from './collectionTreeCamera'
import GardenHalos, { type HaloPoint } from './GardenHalos'
import './collection-tree-scene.css'

export const TOPICS_PER_PAGE = 6
export const LEAVES_PER_PAGE = 4
export { COLLECTION_TREE_CAMERA_POSITION, COLLECTION_TREE_LOOK_AT } from './collectionTreeCamera'

export interface CollectionTreeSceneProps {
  open: boolean
  topics: CollectionTreeTopic[]
  selectedTopicId: string | null
  selectedLeafId: string | null
  /** Zero-based pages. The parent owns paging and selection changes. */
  topicPage: number
  leafPage: number
  onOpen: () => void
  onTopic: (id: string) => void
  onLeaf: (id: string) => void
  reducedMotion: boolean
}

type Point = GardenTreePoint
const FRONT_ANCHORS = [0, 2, 4, 1, 3, 5] as const
const ENTRY_ANCHOR = GARDEN_TREE_ANCHORS[3]
const ENTRY_POSITION: Point = [-1.0, 3.22, -.78]
const STOP = (event: SyntheticEvent) => event.stopPropagation()
const STOP_ACTIVATION = (event: KeyboardEvent) => {
  if (event.key === 'Enter' || event.key === ' ') event.stopPropagation()
}
const pageStart = (page: number, size: number) => Math.max(0, Math.floor(Number.isFinite(page) ? page : 0)) * size

/** A physical plane in front of the tree, viewed from the agreed reading camera.
 * Responsive spacing moves the hanging endpoints, never the tree or its real bark anchors.
 * Html stays attached to these world points; it is neither fullscreen nor a screen panel. */
function hangingLayout(width: number, height: number, fov: number) {
  const compact = width < 680, short = height < 620, landscape = height < 480 && width >= 540
  const eye = new THREE.Vector3(...COLLECTION_TREE_CAMERA_POSITION)
  const forward = new THREE.Vector3(...COLLECTION_TREE_LOOK_AT).sub(eye).normalize()
  const right = forward.clone().cross(new THREE.Vector3(0, 1, 0)).normalize()
  const up = right.clone().cross(forward).normalize()
  const distance = 7.1, center = eye.clone().addScaledVector(forward, distance)
  const halfHeight = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * distance
  const halfWidth = halfHeight * width / Math.max(height, 1)
  const at = (x: number, y: number): Point => center.clone()
    .addScaledVector(right, (x * 2 - 1) * halfWidth)
    .addScaledVector(up, (1 - y * 2) * halfHeight).toArray() as Point
  // Match the controls' reserved header/footer, including the touch pager and full topic name.
  const top = Math.min(122, height * .31), bottom = height - 152, usableHeight = Math.max(100, bottom - top)
  const columns = landscape ? 6 : compact ? 2 : 3, rows = Math.ceil(TOPICS_PER_PAGE / columns)
  const topicStep = compact ? THREE.MathUtils.clamp(usableHeight * .12, 39, 64) : THREE.MathUtils.clamp(usableHeight * .15, 47, 72)
  const topicTop = top + (landscape ? 17 : 22), topicBottom = topicTop + (rows - 1) * topicStep
  const topics = Array.from({ length: TOPICS_PER_PAGE }, (_, index) => {
    const column = index % columns, row = Math.floor(index / columns)
    const x = landscape ? (column + .5) / 6 : compact ? [.25, .75][column] : [.26, .5, .74][column]
    return at(x, (topicTop + row * topicStep) / height)
  })
  const firstLeaf = landscape ? top + usableHeight * .69 : topicBottom + (short ? 74 : 125)
  // Very tall viewports leave more room below the tree, rather than hanging words below the floor.
  const lastLeaf = Math.min(bottom - (short ? 29 : 55), height * .76)
  const leaves = Array.from({ length: LEAVES_PER_PAGE }, (_, index) =>
    at(landscape ? (index + .5) / 4 : compact ? [.25, .75][index % 2] : [.3, .7][index % 2],
      (landscape ? firstLeaf : [firstLeaf, Math.max(firstLeaf + (short ? 63 : 103), lastLeaf)][Math.floor(index / 2)]) / height))
  const orientation = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right, up, forward.clone().negate()))
  return { topics, leaves, compact, short, landscape, up, right, orientation,
    singleTopic: at(.5, topicTop / height),
    topicWidth: Math.max(68, Math.min(compact ? 156 : 244, width * (landscape ? .15 : compact ? .43 : .21))),
    leafWidth: Math.max(96, Math.min(compact ? 176 : 316, width * (landscape ? .22 : compact ? .43 : .31))),
    at,
  }
}

function leafGeometry() {
  const shape = new THREE.Shape()
  shape.moveTo(0, -.25)
  shape.bezierCurveTo(-.2, -.13, -.28, .17, .025, .49)
  shape.bezierCurveTo(.24, .18, .18, -.12, 0, -.25)
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: .012, bevelEnabled: true,
    bevelThickness: .006, bevelSize: .008, bevelSegments: 2, curveSegments: 12, steps: 1 })
  const positions = geometry.getAttribute('position')
  for (let i = 0; i < positions.count; i++) positions.setZ(i,
    positions.getZ(i) + Math.sin(positions.getY(i) * 4) * .047 + positions.getX(i) ** 2 * .25)
  geometry.computeVertexNormals()
  return geometry
}

function GoldBranch({ from, to, delay = 0, active = false, reducedMotion }: {
  from: Point; to: Point; delay?: number; active?: boolean; reducedMotion: boolean
}) {
  const elapsed = useRef(0)
  const resource = useMemo(() => {
    const start = new THREE.Vector3(...from), end = new THREE.Vector3(...to)
    const neck = start.clone().lerp(end, .33); neck.y -= .14
    const middle = start.clone().lerp(end, .72); middle.y -= .12
    const curve = new THREE.CatmullRomCurve3([start, neck, middle, end])
    const geometry = new THREE.TubeGeometry(curve, 32, active ? .011 : .007, 5, false)
    const material = new THREE.MeshStandardMaterial({ color: active ? '#f2d69a' : '#bba56c',
      metalness: .65, roughness: .36, emissive: active ? '#a2d9b3' : '#d4a46b', emissiveIntensity: active ? .6 : .28 })
    return { geometry, material, count: geometry.index!.count }
  }, [from, to, active])
  useEffect(() => {
    elapsed.current = 0
    resource.geometry.setDrawRange(0, reducedMotion ? resource.count : 0)
    resource.material.setValues({ emissiveIntensity: active ? .6 : .28 })
  }, [resource, reducedMotion, active])
  useEffect(() => () => { resource.geometry.dispose(); resource.material.dispose() }, [resource])
  useFrame((_, delta) => {
    if (reducedMotion) return
    elapsed.current += Math.min(delta, .05)
    const progress = THREE.MathUtils.clamp((elapsed.current - delay) / .95, 0, 1)
    resource.geometry.setDrawRange(0, Math.floor((1 - (1 - progress) ** 3) * resource.count / 30) * 30)
    resource.material.setValues({ emissiveIntensity: (active ? .58 : .27) + Math.sin(elapsed.current * .72 + delay) * .075 })
  })
  return <mesh name="collection-tree-connected-gold-shoot" geometry={resource.geometry} material={resource.material} dispose={null} />
}

function LeafLight({ position, orientation, geometry, selected, reducedMotion, onActivate, index }: {
  position: Point; orientation: THREE.Quaternion; geometry: THREE.BufferGeometry; selected: boolean
  reducedMotion: boolean; onActivate: () => void; index: number
}) {
  const group = useRef<THREE.Group>(null), time = useRef(0)
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#9fceb2',
    metalness: .26, roughness: .33, emissive: '#74cfae', emissiveIntensity: .48,
    transparent: true, opacity: .88, side: THREE.DoubleSide }), [])
  useEffect(() => () => material.dispose(), [material])
  useEffect(() => {
    material.color.set(selected ? '#ffe5ad' : '#9fceb2')
    material.emissive.set(selected ? '#f4c77b' : '#74cfae')
    material.setValues({ emissiveIntensity: selected ? .92 : .48 })
    time.current = 0
    group.current?.scale.setScalar(reducedMotion ? .44 : .28)
  }, [material, reducedMotion, selected])
  useFrame((_, delta) => {
    if (reducedMotion) return
    time.current += Math.min(delta, .05)
    const growth = THREE.MathUtils.smoothstep(time.current, 0, .85)
    group.current?.scale.setScalar(.28 + growth * .16)
    material.setValues({ emissiveIntensity: (selected ? .9 : .48) + Math.sin(time.current * .8 + index * 1.8) * .1 })
  })
  return <group ref={group} position={position} quaternion={orientation} dispose={null}>
    <mesh name="collection-tree-memory-leaf" geometry={geometry} material={material} rotation={[0, 0, index % 2 ? -.35 : .32]}
      onClick={event => { event.stopPropagation(); onActivate() }} />
  </group>
}

function wordsStyle(width: number, delay = 0): CSSProperties {
  return { '--collection-word-width': `${width}px`, '--collection-word-delay': `${delay}s` } as CSSProperties
}

/** Canvas child: personal collections become readable, connected branches of the existing tree. */
export default function CollectionTreeScene({ open, topics, selectedTopicId, selectedLeafId, topicPage, leafPage,
  onOpen, onTopic, onLeaf, reducedMotion }: CollectionTreeSceneProps) {
  const width = useThree(state => state.size.width), height = useThree(state => state.size.height)
  const camera = useThree(state => state.camera)
  const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 60
  const layout = useMemo(() => hangingLayout(width, height, fov), [width, height, fov])
  const geometry = useMemo(() => leafGeometry(), [])
  useEffect(() => () => geometry.dispose(), [geometry])
  const pageTopics = useMemo(() => topics.slice(pageStart(topicPage, TOPICS_PER_PAGE),
    pageStart(topicPage, TOPICS_PER_PAGE) + TOPICS_PER_PAGE), [topics, topicPage])
  const selectedTopic = topics.find(topic => topic.id === selectedTopicId)
  const selectedOutsidePage = !!selectedTopic && !pageTopics.some(topic => topic.id === selectedTopic.id)
  // A reordered collection may move the active topic to another page. Keep its branch and leaves
  // readable until the parent changes selection; closing it restores the requested topic page.
  const visibleTopics = useMemo(() => selectedOutsidePage && selectedTopic ? [selectedTopic] : pageTopics,
    [selectedOutsidePage, selectedTopic, pageTopics])
  const topicPositions = useMemo(() => selectedOutsidePage ? [layout.singleTopic] : layout.topics, [selectedOutsidePage, layout])
  const visibleLeaves = selectedTopic?.leaves.slice(pageStart(leafPage, LEAVES_PER_PAGE),
    pageStart(leafPage, LEAVES_PER_PAGE) + LEAVES_PER_PAGE) ?? []
  const selectedIndex = visibleTopics.findIndex(topic => topic.id === selectedTopicId)
  const topicRoot = topicPositions[Math.max(0, selectedIndex)]
  const buds = useMemo<HaloPoint[]>(() => {
    if (!open) return [2, 3, 4].map((anchor, i) => ({ position: [GARDEN_TREE_ANCHORS[anchor][0],
      GARDEN_TREE_ANCHORS[anchor][1] - .16, GARDEN_TREE_ANCHORS[anchor][2] + .045], radius: .17 + i * .025,
      color: '#dbd6a5', star: i === 1 }))
    return visibleTopics.map((_, index) => ({ position: topicPositions[index], radius: .13,
      color: index === selectedIndex ? '#c5f1d2' : '#e0ce9b', star: true }))
  }, [open, topicPositions, visibleTopics, selectedIndex])
  const leafPositions = useMemo(() => layout.leaves.map(point => new THREE.Vector3(...point)
    .addScaledVector(layout.up, layout.short ? .70 : .85).toArray() as Point), [layout])
  const className = `collection-tree-words${reducedMotion ? ' is-still' : ''}${layout.compact ? ' is-compact' : ''}${layout.short ? ' is-short' : ''}${layout.landscape ? ' is-landscape' : ''}`

  return <group name="collection-tree-personal-memories">
    <GardenHalos points={buds} reducedMotion={reducedMotion} />
    {!open ? <>
      <GoldBranch from={ENTRY_ANCHOR} to={ENTRY_POSITION} reducedMotion={reducedMotion} />
      <Html center position={ENTRY_POSITION} zIndexRange={[10, 1]} distanceFactor={9}>
        <div className={className} style={wordsStyle(158)}>
          <button type="button" className="collection-tree-entry" data-collection-tree-control="open"
            aria-label="打开我的星树，查看收藏" onPointerDown={STOP} onPointerUp={STOP} onKeyDown={STOP_ACTIVATION}
            onClick={event => { event.stopPropagation(); onOpen() }}>
            <span className="collection-tree-entry-star" aria-hidden="true">✧</span>
            <strong>我的星树</strong>
            <small>{topics.length ? '收藏在枝间生长' : '让一次心动在这里生根'}</small>
          </button>
        </div>
      </Html>
    </> : <>
      {visibleTopics.map((topic, index) => <group key={topic.id} name={`collection-tree-topic-${topic.id}`}>
        <GoldBranch from={GARDEN_TREE_ANCHORS[FRONT_ANCHORS[index]]} to={topicPositions[index]}
          delay={index * .055} active={topic.id === selectedTopicId} reducedMotion={reducedMotion} />
        <Html center position={topicPositions[index]} zIndexRange={[16, 9]}>
          <div className={className} style={wordsStyle(layout.topicWidth, index * .055)}>
            <button type="button" className="collection-tree-topic" data-collection-tree-control="topic" data-topic-id={topic.id}
              aria-pressed={topic.id === selectedTopicId} aria-label={`${topic.label}，${topic.leaves.length}片收藏叶`}
              onPointerDown={STOP} onPointerUp={STOP} onKeyDown={STOP_ACTIVATION} onWheel={STOP}
              onClick={event => { event.stopPropagation(); onTopic(topic.id) }} title={topic.label}>
              <strong>{topic.label}</strong><small>{topic.leaves.length} 片星叶</small>
            </button>
          </div>
        </Html>
      </group>)}
      {visibleLeaves.map((leaf, index) => <group key={leaf.id} name={`collection-tree-leaf-${leaf.id}`}>
        <GoldBranch from={topicRoot} to={leafPositions[index]} delay={.06 + index * .09} active={leaf.id === selectedLeafId}
          reducedMotion={reducedMotion} />
        <LeafLight position={leafPositions[index]} orientation={layout.orientation} geometry={geometry} selected={leaf.id === selectedLeafId}
          reducedMotion={reducedMotion} onActivate={() => onLeaf(leaf.id)} index={index} />
        <Html center position={layout.leaves[index]} zIndexRange={[18, 10]}>
          <div className={className} style={wordsStyle(layout.leafWidth, .16 + index * .09)}>
            <button type="button" className="collection-tree-leaf" data-collection-tree-control="leaf" data-leaf-id={leaf.id}
              aria-pressed={leaf.id === selectedLeafId} aria-label={`阅读收藏：${leaf.title}`}
              onPointerDown={STOP} onPointerUp={STOP} onKeyDown={STOP_ACTIVATION} onWheel={STOP}
              onClick={event => { event.stopPropagation(); onLeaf(leaf.id) }} title={leaf.title}>
              <strong>{leaf.title}</strong>
              <small className="collection-tree-leaf-kind">{leaf.excerptKind === 'excerpt' ? '我的摘录'
                : leaf.excerptKind === 'summary' ? leaf.source?.kind === 'curated' ? '精选导读' : leaf.source?.kind === 'excerpt' ? '来源节选' : '来源摘要'
                  : '收藏线索'}</small>
              {leaf.excerpt && <span className="collection-tree-leaf-excerpt">{leaf.excerpt}</span>}
            </button>
          </div>
        </Html>
      </group>)}
      {!topics.length && <Html center position={layout.at(.5, .5)} zIndexRange={[14, 9]}>
        <div className={`${className} collection-tree-empty`} style={wordsStyle(Math.min(width * .75, 360))}>
          <strong>这里会长出你的收藏</strong><span>在旅程里留下一段文字，<br />回来时，它就是枝间的一片星叶。</span>
        </div>
      </Html>}
    </>}
  </group>
}

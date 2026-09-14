import { decorObstacles } from './scene/collisionDecor'
import { KNOWLEDGE_INGREDIENTS, type KnowledgeId, type ThoughtRecipe } from '../../components/observatory/gardenRecipes'

export type WorldPoint = [number, number, number]
export interface WorldPose { position: WorldPoint; yaw: number; pitch: number }
export interface RealmStation { id: string; title: string; position: WorldPoint }
export type RealmId = 'sunset-boulevard' | 'unsent-answers' | 'moss-letters' | 'moonlight-andante' | 'beyond-the-frame' | 'dew-specimens' | 'blue-hour-shutter' | 'tree-time' | 'echo-paradox' | 'forest-lento'
export interface RealmPalette { skyTop: string; horizon: string; water: string; accent: string; stone: string; foliage: string; sun: string }
export type WalkSurface =
  | { kind: 'disc'; center: WorldPoint; radius: number; material?: 'stone' | 'wood' | 'leaf' }
  | { kind: 'rect'; center: WorldPoint; width: number; depth: number; material?: 'stone' | 'wood' | 'leaf' }
  | { kind: 'path'; points: WorldPoint[]; width: number; material?: 'stone' | 'wood' | 'leaf' }
export type WorldObstacle = { center: WorldPoint; radius: number } | { center: WorldPoint; width: number; depth: number }
export interface RealmDefinition {
  id: RealmId; pair: readonly [KnowledgeId, KnowledgeId]; title: string; description: string
  stations: readonly RealmStation[]; palette: RealmPalette; spawn: WorldPose
  surfaces: readonly WalkSurface[]; obstacles: readonly WorldObstacle[]
}
export interface LandDefinition extends Omit<RealmDefinition, 'id' | 'pair'> { id: 'mirror-sea'; pair?: never }
const palette = (accent: string, foliage: string, water = '#427f8c', skyTop = '#555f95', horizon = '#efb99b'): RealmPalette => ({ skyTop, horizon, water, accent, stone: '#d3c9bc', foliage, sun: '#ffcea0' })
const station = (id: string, title: string, x: number, z: number, y = 0): RealmStation => ({ id, title, position: [x, y, z] })
const disc = (x: number, z: number, radius: number, y = 0, material: 'stone' | 'wood' | 'leaf' = 'stone'): WalkSurface => ({ kind: 'disc', center: [x, y, z], radius, material })
const path = (points: WorldPoint[], width = 4, material: 'stone' | 'wood' | 'leaf' = 'wood'): WalkSurface => ({ kind: 'path', points, width, material })
const ring = (radius: number, y = 0): WorldPoint[] => Array.from({ length: 49 }, (_, i) => [Math.sin(i / 48 * Math.PI * 2) * radius, y, Math.cos(i / 48 * Math.PI * 2) * radius])
const spawn = (x = 0, z = 23, y = 0, yaw = 0): WorldPose => ({ position: [x, y + 1.7, z], yaw, pitch: 0 })

/** Scene identity comes from the canonical ingredient pair, never the translated title or ratio. */
const realmDefinitions: readonly RealmDefinition[] = [
  {
    id: 'sunset-boulevard', pair: ['literature', 'photography'], title: '落日大道',
    description: '杏金落日照过水岸画廊，书窗与取景框沿着一条弯曲长街交织。',
    palette: palette('#e6ac82', '#b98a9e', '#367d8d', '#606b9d', '#edaa7c'), spawn: spawn(),
    stations: [station('light', '看见一束光', -1, 16), station('outside', '画面之外', 1, 7), station('exception', '落日是否总是浪漫', -1, -2), station('sequence', '让时间发生', 1, -12), station('story', '大道尽头', 0, -23)],
    surfaces: [path([[0,0,26],[0,0,13],[1.5,0,2],[-1,0,-12],[0,0,-26]], 8, 'stone'), disc(0,-24,7)], obstacles: [],
  },
  {
    id: 'unsent-answers', pair: ['literature', 'philosophy'], title: '未寄出的答案',
    description: '一座架在暮海上的时差邮局，三条连桥通向昨日、今日与尚未发生的选择。',
    palette: palette('#d6ad71', '#a78dab'), spawn: spawn(0, 22),
    stations: [station('envelope', '一封尚未写完的信', 0, 13), station('yesterday', '昨天的房间', -16, 0), station('tomorrow', '明天的房间', 16, 0), station('choice', '两个相反的回答', 0, -13), station('send', '给未来留一个问题', 0, -22)],
    surfaces: [disc(0,11,7,0,'wood'), disc(-16,0,6,0,'wood'), disc(16,0,6,0,'wood'), disc(0,-17,8,0,'wood'), path([[0,0,25],[0,0,11],[-16,0,0]],4), path([[0,0,11],[16,0,0]],4), path([[-16,0,0],[0,0,-17],[16,0,0]],4)], obstacles: [{center:[0,0,8],radius:1.3}],
  },
  {
    id: 'moss-letters', pair: ['literature', 'nature'], title: '苔藓来信',
    description: '宽大的树根围出信林，低垂叶幕、树洞与苔藓间保留着另一种生命的时间。',
    palette: {...palette('#cad78f', '#5d8271', '#477b76', '#566d83', '#b6c6aa'),stone:'#93a48a'}, spawn: spawn(0,22),
    stations: [station('moss', '在苔藓的高度', -4, 15), station('leaf', '一片叶的来信', -13, 3), station('bark', '树皮记得什么', -7, -12), station('weather', '用天气代替时钟', 10, -10), station('voice', '另一种生命的口吻', 13, 8)],
    surfaces: [disc(0,0,25), path([[0,0,24],[-13,0,3],[-7,0,-12],[10,0,-10],[13,0,8],[0,0,24]],4)], obstacles: [{center:[0,0,0],radius:5.2},{center:[-19,0,-9],radius:1.6},{center:[19,0,0],radius:1.4}],
  },
  {
    id: 'moonlight-andante', pair: ['literature', 'music'], title: '月光行板',
    description: '五座圆舞台浮在月光水面上，以长短不同的连桥组织叙事、停顿与回声。',
    palette: palette('#b8bbf0', '#918bb2', '#354c74', '#16233e', '#6c7398'), spawn: spawn(0,24),
    stations: [station('prelude', '序曲：夜归的脚步', 0, 15), station('breath', '给句子一次呼吸', -14, 5), station('crescendo', '一句话的渐强', -9, -14), station('silence', '让停顿成为声音', 13, -13), station('finale', '写下三段月光', 15, 9)],
    surfaces: [disc(0,15,6,0,'wood'),disc(-14,5,6,0,'wood'),disc(-9,-14,7,0,'wood'),disc(13,-13,7,0,'wood'),disc(15,9,6,0,'wood'),path([[0,0,25],[0,0,15],[-14,0,5],[-9,0,-14],[13,0,-13],[15,0,9],[0,0,15]],3.2)], obstacles: [],
  },
  {
    id: 'beyond-the-frame', pair: ['photography', 'philosophy'], title: '镜外之问',
    description: '一方镜池与四组取景回廊，让同一座雕塑在不同窗口里呈现不同解释。',
    palette: palette('#b6d7d7', '#a28fac', '#536e82'), spawn: spawn(0,23),
    stations: [station('frame', '窗口里的世界', -10, 15), station('omit', '画面省略了什么', -17, 0), station('opposite', '相反的构图', 0, -17), station('position', '站在谁的位置', 17, 0), station('judgment', '给判断留一扇窗', 10, 15)],
    surfaces: [path(ring(17),7,'stone'),path([[0,0,25],[0,0,17]],6,'stone')], obstacles: [],
  },
  {
    id: 'dew-specimens', pair: ['photography', 'nature'], title: '露光标本',
    description: '尺度缩小之后，叶脉成为高架道路；露珠、绒毛与花蕊构成一座微观庭园。',
    palette: palette('#bbe8b5', '#73a16d', '#61a8a2', '#638c9c', '#d1e2b6'), spawn: spawn(0,22),
    stations: [station('scale', '从一平方米出发', 0, 15), station('vein', '叶脉里的道路', -12, 5,.8), station('drop', '露珠怎样取景', 11, 1,1.5), station('texture', '让纹理成为主角', -10, -12,1.1), station('specimen', '三幅微小的世界', 6, -22,2)],
    surfaces: [path([[0,0,25],[0,0,15],[-12,.8,5],[-10,1.1,-12],[6,2,-22]],5,'leaf'),path([[0,0,15],[11,1.5,1],[6,2,-22]],5,'leaf'),disc(-12,5,5,.8,'leaf'),disc(11,1,5,1.5,'leaf'),disc(-10,-12,5,1.1,'leaf'),disc(6,-22,5,2,'leaf')], obstacles: [],
  },
  {
    id: 'blue-hour-shutter', pair: ['photography', 'music'], title: '蓝调快门',
    description: '雨夜街巷在三个转角展开，橱窗、雨棚与小型演奏空间给影像不同的节拍。',
    palette: palette('#ca9fb7', '#7c749b', '#354e65', '#132033', '#59617c'), spawn: spawn(-15,23),
    stations: [station('rain', '雨落下的第一拍', -15, 15),station('motion', '在运动中选择一帧',-15,0),station('syncopation','转角里的切分音',0,-1),station('chorus','反复出现的光',14,-11),station('contact-sheet','编排你的三张影像',14,-23)],
    surfaces: [path([[-15,0,26],[-15,0,0],[14,0,0],[14,0,-26]],8,'stone'),disc(-15,0,6),disc(14,0,6)], obstacles: [],
  },
  {
    id: 'tree-time', pair: ['philosophy', 'nature'], title: '树的时间',
    description: '巨树周围的年轮路分向四季，生长、枯落与新芽可以在一次行走中相互对照。',
    palette: palette('#d9b886', '#8d9f7e', '#628993'), spawn: spawn(0,24),
    stations: [station('rings','年轮里的计量',0,17),station('spring','春：改变从哪里开始',-16,4),station('summer','夏：什么仍然延续',-8,-14),station('autumn','秋：失去也是改变吗',12,-12),station('winter','冬：比喻的边界',16,7)],
    surfaces: [path(ring(17),7,'stone'),path([[0,0,25],[0,0,17]],6),path([[0,0,17],[0,0,7]],3.5),disc(0,0,8)], obstacles:[{center:[0,0,0],radius:3.2}],
  },
  {
    id: 'echo-paradox', pair: ['philosophy', 'music'], title: '回声悖论',
    description: '回旋的石质殿堂围住一片静水，同一组弦在五个回廊里逐次改变。',
    palette: palette('#bca7d3', '#9292b4', '#485779', '#424969', '#afa5be'), spawn: spawn(2,22,0,Math.atan2(2,22)),
    stations: [station('theme','听见一个主题',0,17),station('first-change','只改变一个音',-16,6),station('repeat','再次相遇还是同一个吗',-10,-14),station('difference','给差异一个名字',10,-14),station('identity','你如何认出它',16,6)],
    surfaces:[path(ring(17),7,'stone'),path([[0,0,25],[0,0,17]],5,'stone')],obstacles:[],
  },
  {
    id:'forest-lento',pair:['nature','music'],title:'林间慢拍',
    description:'木栈道在荧光湿地中交错，水、芦苇、风铃与叶片构成可以慢慢辨认的声景。',
    palette:palette('#b9d79e','#638573','#3f777b','#31445c','#a3b5b4'),spawn:spawn(0,24),
    stations:[station('listen','先停下来听',0,16),station('water','水的节拍',-14,5),station('wind','风经过叶片',-8,-14),station('footsteps','把脚步放进来',13,-12),station('soundscape','组成一段森林序曲',14,9)],
    surfaces:[path([[0,0,26],[0,0,16],[-14,0,5],[-8,0,-14],[13,0,-12],[14,0,9],[0,0,16]],3.5),disc(0,16,5,0,'wood'),disc(-14,5,5,0,'wood'),disc(-8,-14,5,0,'wood'),disc(13,-12,5,0,'wood'),disc(14,9,5,0,'wood')],obstacles:[],
  },
]

export const REALM_DEFINITIONS: readonly RealmDefinition[] = realmDefinitions.map(world=>({...world,obstacles:[...world.obstacles,...decorObstacles(world.id)]}))

export const LAND_DEFINITION: LandDefinition = {
  id:'mirror-sea',title:'镜海群岛',description:'从家门走向分岔、对照、循序深入与陌生的岸。',palette:palette('#deb988','#a28bb4'),spawn:spawn(0,23),
  stations:[station('home','门口 · 带着问题出发',0,22),station('forest','花林分岔 · 换个视角',-16,4),station('lake','镜湖两岸 · 停下来想想',12,-3),station('mountain','山径 · 逐步深入',-10,-20,3.2),station('coast','海岸 · 走向新的领域',18,-21)],
  surfaces:[disc(0,18,10),disc(-16,4,8),disc(12,-3,7),disc(-10,-20,7,3.2),disc(18,-21,6),path([[0,0,18],[-12,0,12],[-16,0,4]],4),path([[0,0,18],[8,0,10],[12,0,-3]],4),path([[-16,0,4],[-22,1,-6],[-20,2.2,-14],[-17.5,3.2,-16],[-10,3.2,-20]],4),path([[12,0,-3],[21,0,-10],[18,0,-21]],4),path([[-16,0,4],[-6,0,0],[4,0,1],[12,0,-3]],3.5)],
  obstacles:[{center:[-20,0,5],radius:1.5},{center:[-12,0,0],radius:1.4},{center:[-13,3.2,-22],radius:1.1},...decorObstacles('mirror-sea')],
}

export function getRealmDefinition(id: string): RealmDefinition | undefined { return REALM_DEFINITIONS.find(realm => realm.id === id) }
export function getRealmForRecipe(recipe: Pick<ThoughtRecipe, 'first' | 'second'>): RealmDefinition {
  const order = KNOWLEDGE_INGREDIENTS.map(ingredient => ingredient.id)
  const pair = [recipe.first, recipe.second].sort((a,b) => order.indexOf(a)-order.indexOf(b))
  const realm = REALM_DEFINITIONS.find(item => item.pair[0]===pair[0] && item.pair[1]===pair[1])
  if (!realm) throw new Error('这组知识成分尚未有对应的旅程')
  return realm
}

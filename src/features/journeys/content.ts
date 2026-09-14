import raw from './curatedSources.json'
import { canonicalSource } from '../personal/persistence'
import type { ContentSource } from '../personal/types'
import type { RealmDefinition } from './realmDefinitions'
import type { ThoughtRecipe } from '../../components/observatory/gardenRecipes'

export const CURATED_SOURCES:ContentSource[]=raw.map(s=>canonicalSource(s as ContentSource))
const realmReading:Record<string,Record<string,string[]>>={
  'sunset-boulevard':{photography:['curated-natural-light','curated-depth','curated-wide']},
  'blue-hour-shutter':{photography:['curated-natural-light','curated-wide','curated-depth']},
  'beyond-the-frame':{photography:['curated-wide','curated-depth','curated-natural-light'],philosophy:['curated-environment','curated-identity','curated-time']},
  'tree-time':{philosophy:['curated-time','curated-identity','curated-environment']},
  'unsent-answers':{philosophy:['curated-time','curated-identity','curated-environment']},
}
export function realmSources(realm:RealmDefinition,recipe?:ThoughtRecipe):ContentSource[]{
  const leading=recipe?(recipe.firstPercent>=50?recipe.first:recipe.second):realm.pair[0]
  const pair=leading===realm.pair[1]?[realm.pair[1],realm.pair[0]]:realm.pair
  return pair.flatMap(tag=>{const ids=realmReading[realm.id]?.[tag];return ids?ids.map(id=>CURATED_SOURCES.find(s=>s.remoteId===id)!):CURATED_SOURCES.filter(s=>s.tags?.includes(tag)).slice(0,3)})
}
export interface ActivityDefinition { intro:string; steps:readonly [string,string,string,string,string]; outputTitle:string; mode:'storyboard'|'letters'|'fieldnotes'|'phrasing'|'framing'|'macro'|'beats'|'seasons'|'variation'|'soundscape' }
export const ACTIVITIES:Record<string,ActivityDefinition>={
  'sunset-boulevard':{intro:'把水岸的三处光影连成一个故事。让画面负责观察，让文字补上画面里没有的事。',steps:['寻找一个开场：画面里谁在等待？','改变观察距离，拍下故事中的细节。','选择一个让故事转向的光线或动作。','为结尾留出一处空白，再调整三幅画面的顺序。','为这组三联画写一个标题，带回小屋。'],outputTitle:'我的落日三联画',mode:'storyboard'},
  'unsent-answers':{intro:'邮局里的两条路径分别通向昨天与明天。围绕一个选择，保留不同时间的自己无法达成一致的地方。',steps:['写下你正在考虑的一个选择。','用昨天的自己的口吻写一封信。','从明天回信：补上昨天还不知道的事情。','选择寄出哪封信，并写下另一封的反对理由。','把两封信与最终的选择封存。'],outputTitle:'写给两个时间的信',mode:'letters'},
  'moss-letters':{intro:'这里的时间由叶片和光照记录。把判断暂时放下，从三个可见的细节开始。',steps:['给眼前的植物起一个观察代号。','记录叶面、边缘与根部的三个细节。','指出一处你无法仅凭观察确认的事情。','尝试用植物的口吻写一段短文。','分开保存观察记录与文学想象。'],outputTitle:'一株植物的来信',mode:'fieldnotes'},
  'moonlight-andante':{intro:'把文字看成可以行走的乐句。长句、短句与停顿，会改变同一段夜归的情绪。',steps:['写下一段夜归的开头。','为它安排四个节拍，留出一次休止。','用一个短句改变故事速度。','交换停顿的位置，再读一次。','保存你的文字乐谱。'],outputTitle:'夜归的文字乐谱',mode:'phrasing'},
  'beyond-the-frame':{intro:'同一个场景，可以被看成自由，也可以被看成受困。取景框边缘决定观众看不见什么。',steps:['挑选一个主体，写下最初判断。','选择一个较窄的取景框。','扩大画面，加入原先被省略的环境。','并置两个解释，标出你依赖的线索。','给这组对照写下尚未解决的问题。'],outputTitle:'画面内外的两种解释',mode:'framing'},
  'dew-specimens':{intro:'走进叶脉与露珠之间。尺度越小，细节越丰富，也越容易失去整体语境。',steps:['以远景记录植物所在的环境。','切换近景，选择一种纹理。','进入微距，标记最清晰的一处。','把三个尺度连起来，解释它们如何互相补充。','保存你的观察标本卡。'],outputTitle:'三种尺度的露光标本',mode:'macro'},
  'blue-hour-shutter':{intro:'雨夜不是静止的。用光线、颜色和运动为三段节奏分别安排一张画面。',steps:['选出开场画面的色温。','为脚步编排一组重复节拍。','用一个重拍对应画面的转折。','调整三幅画面的次序，比较情绪变化。','带回一段有节奏的影像脚本。'],outputTitle:'雨夜影像节奏',mode:'beats'},
  'tree-time':{intro:'沿着年轮行走，分别观察改变与延续。季节不是观点的答案，树也只是帮助你思考的例子。',steps:['记录新叶与旧枝各一个特征。','选择春夏秋冬中的一个观察时点。','说清哪些东西改变了，哪些仍然持续。','寻找“人生像树”的比喻失效之处。','写下你的时间判断与一个反例。'],outputTitle:'年轮与反例',mode:'seasons'},
  'echo-paradox':{intro:'每次回声都会改变一个音。你需要自己决定，什么时候它不再是原来的旋律。',steps:['观察或播放最初的四音动机。','改变一个音，比较两次排列。','再改变速度或顺序，记录判断。','提出同一性标准，再尝试推翻它。','保存你的标准、反例和最终旋律。'],outputTitle:'关于同一段旋律的判断',mode:'variation'},
  'forest-lento':{intro:'风、叶片与脚步一起组成声景。安排声音出现的时刻，也为安静留一个位置。',steps:['辨认天气、生物与人类活动的声音。','为叶片安排一条稀疏的节奏线。','加入水和脚步，听或看它们如何重叠。','留出一段所有声音都停止的时间。','保存这片湿地的八拍声景。'],outputTitle:'八拍森林序曲',mode:'soundscape'},
}

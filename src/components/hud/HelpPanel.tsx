/** 帮助面板：键位说明 + 玩法简介 */
import { CircleHelp } from 'lucide-react'
import PanelShell from './PanelShell'

const KEY_BINDINGS: Array<[string, string]> = [
  ['WASD', '移动'],
  ['Shift', '上升'],
  ['Ctrl', '下降'],
  ['鼠标', '视角'],
  ['滚轮', '速度'],
  ['E', '收纳'],
  ['F', '场域'],
  ['R', '锚点'],
  ['T', '共鸣'],
  ['B', '行囊'],
  ['V', '追踪'],
  ['Esc', '释放鼠标'],
]

const GAMEPLAY: Array<{ name: string; desc: string }> = [
  { name: '词云探索', desc: '以第一人称飞越由话题词云构成的大世界，靠近词与金句即可触发交互。' },
  { name: '知识行囊', desc: '将途中击中的金句与摘要收入行囊，随时翻阅、串联成新的想法。' },
  { name: '想法锚点', desc: '在任意话题词旁留下一盏灯，也会遇见同频漫行者留下的痕迹。' },
  { name: '家园系统', desc: '回到山间书房：收纳柜、合成台、日志与电话亭，安放一路所得。' },
]

export default function HelpPanel() {
  return (
    <PanelShell title="帮助" icon={<CircleHelp className="h-4 w-4" />}>
      <h3 className="mb-2 text-sm tracking-widest text-[#e8dcc0]">词云世界键位</h3>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
        {KEY_BINDINGS.map(([key, action]) => (
          <div key={key} className="flex items-center justify-between text-xs">
            <kbd className="inline-flex h-5 min-w-8 items-center justify-center rounded border border-[#c9973f]/30 bg-black/40 px-1.5 font-sans text-[11px] text-[#c9973f]">
              {key}
            </kbd>
            <span className="text-[#8a8f9c]">{action}</span>
          </div>
        ))}
      </div>

      <h3 className="mb-2 mt-5 text-sm tracking-widest text-[#e8dcc0]">小屋 · 第三人称</h3>
      <p className="text-xs leading-6 text-[#8a8f9c]">WASD / 方向键行走，Shift 快走；按住鼠标拖动环顾，滚轮调整镜头远近，C 归正镜头。靠近家具按 E 或点击金色标记打开功能，Esc 关闭面板。触屏可用左下角方向键行走、拖动场景环顾。</p>

      <h3 className="mb-2 mt-5 text-sm tracking-widest text-[#e8dcc0]">玩法</h3>
      <div className="space-y-2.5">
        {GAMEPLAY.map((g) => (
          <div key={g.name} className="rounded-md border border-[#c9973f]/15 bg-white/[0.03] px-3 py-2">
            <div className="font-serif text-sm tracking-widest text-[#c9973f]">{g.name}</div>
            <p className="mt-0.5 text-xs leading-relaxed text-[#8a8f9c]">{g.desc}</p>
          </div>
        ))}
      </div>
    </PanelShell>
  )
}

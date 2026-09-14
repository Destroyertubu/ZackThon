/** 帮助面板：键位说明 + 玩法简介 */
import { CircleHelp } from 'lucide-react'
import PanelShell from './PanelShell'

const KEY_BINDINGS: Array<[string, string]> = [
  ['WASD', '移动'],
  ['Shift', '快走'],
  ['空格', '跳跃'],
  ['鼠标', '视角'],
  ['E', '靠近后互动'],
  ['F', '恢复环顾'],
  ['C', '小屋归正 / 陆地回入口'],
  ['Esc', '释放鼠标'],
]

const GAMEPLAY: Array<{ name: string; desc: string }> = [
  { name: '镜海与旅程', desc: '在镜海群岛行走探索，或到观星台调好一杯酒，进入对应的旅程。' },
  { name: '知识行囊', desc: '将途中击中的金句与摘要收入行囊，随时翻阅、串联成新的想法。' },
  { name: '星系探索', desc: '通过观星台的星门展开问题、回答与来源，阅读后可带着收藏返回。' },
  { name: '家园系统', desc: '回到山间书房：收纳柜、合成台、日志与电话亭，安放一路所得。' },
]

export default function HelpPanel() {
  return (
    <PanelShell title="帮助" icon={<CircleHelp className="h-4 w-4" />}>
      <h3 className="mb-2 text-sm tracking-widest text-[#e8dcc0]">小屋、观星台与陆地键位</h3>
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

      <h3 className="mb-2 mt-5 text-sm tracking-widest text-[#e8dcc0]">小屋 · 第一人称</h3>
      <p className="text-xs leading-6 text-[#8a8f9c]">WASD / 方向键行走，Shift 快走，空格跳跃；落地后可再次起跳。进入场景后移动鼠标即可环顾，Esc 释放鼠标、F 恢复环顾，C 归正镜头。靠近家具按 E 或点击金色标记打开功能，Esc 关闭面板。触屏可用方向键行走、拖动场景环顾，点击向上箭头跳跃。打开功能面板时暂停移动和跳跃，输入文字时空格正常输入。</p>

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

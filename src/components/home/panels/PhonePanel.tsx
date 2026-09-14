/** 同频电话亭：本地漫行者叙事对话与统一服务提供的 AI 合成草稿。 */
import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { ArrowLeft, Loader2, Phone, Send, Signal, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { useGameStore, uid } from '@/state/gameStore'
import { api, type SynthesisResponse } from '@/features/personal/api'
import PanelShell from './PanelShell'

interface ChatMsg {
  id: string
  from: 'me' | 'them' | 'ai'
  text: string
}

export default function PhonePanel() {
  const companions = useGameStore((s) => s.companions)
  const visitedWords = useGameStore((s) => s.visitedWords)
  const openPanel = useGameStore((s) => s.openPanel)

  const sorted = useMemo(
    () => [...companions].sort((a, b) => b.resonance - a.resonance),
    [companions]
  )

  const [activeId, setActiveId] = useState<string | null>(null)
  const [threads, setThreads] = useState<Record<string, ChatMsg[]>>({})
  const [input, setInput] = useState('')
  const [aiInput, setAiInput] = useState('')
  const [typing, setTyping] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  /** 每位同频人的回应轮转指针（本地轮转，非真 AI） */
  const replyCursor = useRef<Record<string, number>>({})
  const replyTimer = useRef<number | null>(null)
  const aiRequest = useRef<AbortController | null>(null)
  const endRef = useRef<HTMLDivElement | null>(null)

  const active = sorted.find((c) => c.id === activeId) ?? null
  const messages = active ? threads[active.id] ?? [] : []

  useEffect(() => {
    return () => {
      if (replyTimer.current !== null) window.clearTimeout(replyTimer.current)
      aiRequest.current?.abort()
      aiRequest.current = null
    }
  }, [])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, typing])

  const pushMsg = (companionId: string, msg: Omit<ChatMsg, 'id'>) =>
    setThreads((t) => ({
      ...t,
      [companionId]: [...(t[companionId] ?? []), { ...msg, id: uid() }],
    }))

  const sendToCompanion = (e: FormEvent) => {
    e.preventDefault()
    if (!active || !input.trim() || typing) return
    const companionId = active.id
    pushMsg(companionId, { from: 'me', text: input.trim() })
    setInput('')
    // 对方回应池：其锚点文本 + 座右铭，按本地指针轮转
    const pool = [...active.anchors.map((a) => a.text), active.motto]
    const cursor = replyCursor.current[companionId] ?? 0
    replyCursor.current[companionId] = cursor + 1
    const reply = pool.length > 0 ? pool[cursor % pool.length] : '信号不太好，改天再聊。'
    setTyping(true)
    replyTimer.current = window.setTimeout(() => {
      pushMsg(companionId, { from: 'them', text: reply })
      setTyping(false)
    }, 600 + Math.random() * 700)
  }

  const askAi = async (e: FormEvent) => {
    e.preventDefault()
    if (!active) return
    const q = aiInput.trim()
    if (!q || aiRequest.current) return
    const companionId = active.id
    const controller = new AbortController()
    aiRequest.current = controller
    if (messages.at(-1)?.from !== 'me' || messages.at(-1)?.text !== q) {
      pushMsg(companionId, { from: 'me', text: q })
    }
    setAiLoading(true)
    setAiError('')
    try {
      // Only the player's submitted question is sent; NPC lines are fictional, not sources.
      const response = await api<SynthesisResponse>('/api/synthesis', {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({ mode: 'idea', prompt: q }),
      })
      if (controller.signal.aborted) return
      if (typeof response.draft?.text !== 'string' || !response.draft.text.trim()) {
        throw new Error('没有收到合成草稿，请重试。')
      }
      pushMsg(companionId, { from: 'ai', text: response.draft.text })
      setAiInput('')
    } catch (reason: unknown) {
      if (!controller.signal.aborted) setAiError(reason instanceof Error ? reason.message : '暂时无法合成草稿，请重试。')
    } finally {
      if (aiRequest.current === controller) {
        aiRequest.current = null
        setAiLoading(false)
      }
    }
  }

  const hangUp = () => {
    aiRequest.current?.abort()
    aiRequest.current = null
    if (replyTimer.current !== null) window.clearTimeout(replyTimer.current)
    replyTimer.current = null
    setTyping(false)
    setAiLoading(false)
    setAiError('')
    setAiInput('')
    setInput('')
    setActiveId(null)
  }

  return (
    <PanelShell
      icon={Phone}
      title="同频电话亭"
      subtitle={active ? `正在与 ${active.name} 通话` : '拾起话筒，拨给与你路过相同词语的人'}
      widthClass="sm:max-w-2xl"
    >
      {!active ? (
        /* ---------- 同频人列表 ---------- */
        <div className="flex flex-col gap-3">
          {sorted.map((c) => {
            const shared = c.visitedWords.filter((w) => visitedWords.includes(w))
            return (
              <article
                key={c.id}
                className="flex flex-col gap-3 rounded-lg border border-[#c9973f]/20 bg-[#0a0c10]/60 p-4 transition-colors hover:border-[#c9973f]/40"
              >
                <div className="flex items-center gap-3">
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full border border-[#c9973f]/40 bg-[#c9973f]/10 text-xl">
                    {c.avatar}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-serif tracking-[0.1em] text-[#e8dcc0]">{c.name}</p>
                    <p className="truncate text-xs italic text-[#8a8f9c]">「{c.motto}」</p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-[#c9973f]/50 bg-[#c9973f]/15 text-[#c9973f] hover:bg-[#c9973f]/25 hover:text-[#e8dcc0]"
                    onClick={() => setActiveId(c.id)}
                  >
                    <Phone className="size-3.5" />
                    拨通电话
                  </Button>
                </div>
                <div className="flex items-center gap-2">
                  <Signal className="size-3.5 shrink-0 text-[#c9973f]" />
                  <Progress
                    value={c.resonance}
                    className="h-1.5 flex-1 bg-[#c9973f]/15 [&>div]:bg-[#c9973f]"
                  />
                  <span className="w-14 shrink-0 text-right text-xs text-[#c9973f]">
                    同频 {c.resonance}%
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {shared.length === 0 ? (
                    <span className="text-xs text-[#8a8f9c]">暂无同路的话题词，去世界里多走几步再来看</span>
                  ) : (
                    <>
                      <span className="mr-1 text-xs text-[#8a8f9c]">同路词</span>
                      {shared.map((w) => (
                        <Badge
                          key={w}
                          variant="outline"
                          className="border-[#c9973f]/30 font-normal text-[#e8dcc0]/80"
                        >
                          {w}
                        </Badge>
                      ))}
                    </>
                  )}
                </div>
              </article>
            )
          })}
          <p className="pt-1 text-center text-xs leading-relaxed text-[#8a8f9c]">
            漫行者是故事中的角色，对话来自预设叙事。AI 合成可在小屋合成台用访问码解锁。
          </p>
        </div>
      ) : (
        /* ---------- 模拟对话窗 ---------- */
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs text-[#8a8f9c] hover:bg-[#c9973f]/10 hover:text-[#e8dcc0]"
              onClick={hangUp}
            >
              <ArrowLeft className="size-3.5" />
              挂断
            </Button>
            <span className="flex size-8 items-center justify-center rounded-full border border-[#c9973f]/40 bg-[#c9973f]/10 text-base">
              {active.avatar}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-serif text-sm tracking-[0.1em] text-[#e8dcc0]">{active.name}</p>
              <p className="truncate text-xs text-[#8a8f9c]">同频 {active.resonance}% · 故事角色</p>
            </div>
          </div>

          <div className="flex max-h-72 min-h-48 flex-col gap-2 overflow-y-auto rounded-lg border border-[#c9973f]/20 bg-black/40 p-3">
            {messages.length === 0 && !typing && (
              <p className="py-10 text-center text-xs text-[#8a8f9c]">
                电话接通了，说声你好吧
              </p>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={
                  m.from === 'me'
                    ? 'max-w-[80%] self-end rounded-lg rounded-br-none border border-[#c9973f]/40 bg-[#c9973f]/15 px-3 py-2 text-sm text-[#e8dcc0]'
                    : 'max-w-[80%] self-start rounded-lg rounded-bl-none border border-[#c9973f]/15 bg-[#0a0c10]/80 px-3 py-2 text-sm text-[#e8dcc0]/90'
                }
              >
                {m.from === 'ai' && (
                  <p className="mb-0.5 flex items-center gap-1 text-xs text-[#c9973f]">
                    <Sparkles className="size-3" />
                    AI 合成草稿 · 可编辑
                  </p>
                )}
                {m.from === 'ai' ? (
                  <textarea
                    aria-label="编辑 AI 合成草稿"
                    value={m.text}
                    rows={6}
                    maxLength={10000}
                    onChange={(event) => {
                      const value = event.target.value
                      setThreads((current) => ({
                        ...current,
                        [active.id]: (current[active.id] ?? []).map((message) => message.id === m.id ? { ...message, text: value } : message),
                      }))
                    }}
                    className="min-w-0 w-full resize-y rounded border border-[#c9973f]/20 bg-black/20 p-2 text-sm leading-relaxed text-[#e8dcc0] outline-none focus:border-[#c9973f]/60"
                  />
                ) : <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>}
              </div>
            ))}
            {typing && (
              <div className="self-start rounded-lg border border-[#c9973f]/15 bg-[#0a0c10]/80 px-3 py-2 text-xs text-[#8a8f9c]">
                对方正在输入…
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={sendToCompanion} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`对 ${active.name} 说点什么…`}
              className="border-[#c9973f]/30 bg-black/40 text-sm text-[#e8dcc0] placeholder:text-[#8a8f9c]/60 focus-visible:border-[#c9973f]/60 focus-visible:ring-[#c9973f]/20"
            />
            <Button
              type="submit"
              size="icon"
              variant="outline"
              disabled={!input.trim() || typing}
              aria-label="发送"
              className="shrink-0 border-[#c9973f]/50 bg-[#c9973f]/15 text-[#c9973f] hover:bg-[#c9973f]/25 hover:text-[#e8dcc0]"
            >
              <Send className="size-4" />
            </Button>
          </form>

          <Separator className="bg-[#c9973f]/15" />
            <form onSubmit={askAi} className="flex flex-col gap-1.5">
              <p className="flex items-center gap-1.5 text-xs tracking-[0.2em] text-[#c9973f]">
                <Sparkles className="size-3" />
                转接思维合成
              </p>
              <p className="text-xs leading-relaxed text-[#8a8f9c]">仅发送下方的问题，生成可修改的想法草稿。需要结合真实材料或保存作品时，请前往合成台。</p>
              <div className="flex gap-2">
                <Input
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  placeholder="问一个此刻最困扰你的问题…"
                  aria-label="提交给 AI 合成的问题"
                  maxLength={2000}
                  disabled={aiLoading}
                  className="border-[#c9973f]/30 bg-black/40 text-sm text-[#e8dcc0] placeholder:text-[#8a8f9c]/60 focus-visible:border-[#c9973f]/60 focus-visible:ring-[#c9973f]/20"
                />
                <Button
                  type="submit"
                  variant="outline"
                  disabled={!aiInput.trim() || aiLoading}
                  className="shrink-0 border-[#c9973f]/50 bg-[#c9973f]/15 text-[#c9973f] hover:bg-[#c9973f]/25 hover:text-[#e8dcc0]"
                >
                  {aiLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Sparkles className="size-4" />
                  )}
                  {aiLoading ? '合成中' : aiError ? '重试' : '合成'}
                </Button>
              </div>
              {aiError && <p role="alert" className="text-xs leading-relaxed text-red-400/90">{aiError}</p>}
              <Button
                type="button"
                variant="ghost"
                onClick={() => openPanel('synth')}
                disabled={aiLoading}
                className="min-h-11 self-start px-2 text-xs text-[#c9973f] hover:bg-[#c9973f]/10 hover:text-[#e8dcc0]"
              >
                <Sparkles className="size-3.5" />
                前往思维合成台 · 用访问码解锁 AI
              </Button>
            </form>
        </div>
      )}
    </PanelShell>
  )
}

/** 想法锚点面板（T/R 打开）：围绕当前语境词撰写锚点，浏览自己与同频人的锚点 */
import { useState } from 'react'
import { Anchor, Feather, Heart, MessageCircle, Send } from 'lucide-react'
import type { AnchorComment, IdeaAnchor } from '@/types/game'
import { useGameStore } from '@/state/gameStore'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import PanelShell, { formatTime } from './PanelShell'

interface AnchorRow {
  anchor: IdeaAnchor
  /** true = 来自 store.anchors（like/comment 可持久化）；false = 同频人锚点，互动仅面板内本地生效 */
  own: boolean
}

export default function AnchorsPanel() {
  const contextWord = useGameStore((s) => s.contextWord)
  const anchors = useGameStore((s) => s.anchors)
  const companions = useGameStore((s) => s.companions)
  const addAnchor = useGameStore((s) => s.addAnchor)
  const likeAnchor = useGameStore((s) => s.likeAnchor)
  const commentAnchor = useGameStore((s) => s.commentAnchor)

  const [draft, setDraft] = useState('')
  const [commentOpenId, setCommentOpenId] = useState<string | null>(null)
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({})
  // store.likeAnchor/commentAnchor 只作用于 store.anchors；同频人锚点的互动在面板内本地维护
  const [localLikes, setLocalLikes] = useState<Record<string, boolean>>({})
  const [localComments, setLocalComments] = useState<Record<string, AnchorComment[]>>({})

  const inContext = (a: IdeaAnchor) => (contextWord ? a.topicWord === contextWord : !a.topicWord)

  const likesOf = (r: AnchorRow) =>
    r.anchor.likes + (!r.own && localLikes[r.anchor.id] ? 1 : 0)
  const likedOf = (r: AnchorRow) => (r.own ? r.anchor.likedByMe : !!localLikes[r.anchor.id])
  const commentsOf = (r: AnchorRow) =>
    r.own ? r.anchor.comments : [...r.anchor.comments, ...(localComments[r.anchor.id] ?? [])]

  const rows: AnchorRow[] = [
    ...anchors.filter(inContext).map((a) => ({ anchor: a, own: true as const })),
    ...companions.flatMap((c) =>
      c.anchors.filter(inContext).map((a) => ({ anchor: a, own: false as const }))
    ),
  ].sort((x, y) => likesOf(y) - likesOf(x))

  const submitAnchor = () => {
    const text = draft.trim()
    if (!text) return
    addAnchor({ topicWord: contextWord ?? undefined, text })
    setDraft('')
  }

  const toggleLike = (r: AnchorRow) => {
    if (r.own) likeAnchor(r.anchor.id)
    else setLocalLikes((s) => ({ ...s, [r.anchor.id]: !s[r.anchor.id] }))
  }

  const submitComment = (r: AnchorRow) => {
    const text = (commentDrafts[r.anchor.id] ?? '').trim()
    if (!text) return
    if (r.own) {
      commentAnchor(r.anchor.id, text)
    } else {
      setLocalComments((s) => ({
        ...s,
        [r.anchor.id]: [
          ...(s[r.anchor.id] ?? []),
          { id: `local-${Date.now()}`, author: '我', text, createdAt: Date.now() },
        ],
      }))
    }
    setCommentDrafts((s) => ({ ...s, [r.anchor.id]: '' }))
  }

  return (
    <PanelShell
      title="想法锚点"
      icon={Anchor}
      subtitle={contextWord ? `当前语境 · ${contextWord}` : '漫步中，暂无锚点语境'}
      className="max-w-2xl"
    >
      <div className="border-b border-[#c9973f]/10 px-5 py-4">
        {contextWord ? (
          <Badge variant="outline" className="mb-2 border-[#c9973f]/40 text-[#c9973f]">
            语境 · {contextWord}
          </Badge>
        ) : (
          <p className="mb-2 text-xs text-[#8a8f9c]">
            漫步中，暂无锚点语境 —— 这枚锚点将不系于任何话题词
          </p>
        )}
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Escape') e.stopPropagation()
          }}
          placeholder="在此立下一枚想法锚点，留给后来的漫行者……"
          className="min-h-20 resize-none border-[#c9973f]/25 bg-[#0a0c10]/60 text-sm text-[#e8dcc0] placeholder:text-[#8a8f9c]/60 focus-visible:border-[#c9973f]/50 focus-visible:ring-[#c9973f]/30"
        />
        <div className="mt-2 flex justify-end">
          <Button
            size="sm"
            disabled={!draft.trim()}
            onClick={submitAnchor}
            className="bg-[#c9973f] text-[#0a0c10] hover:bg-[#e8dcc0]"
          >
            <Feather className="size-3.5" />
            立下锚点
          </Button>
        </div>
      </div>
      <ScrollArea className="min-h-0 flex-1">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
            <Anchor className="size-8 text-[#c9973f]/50" />
            <p className="text-sm text-[#8a8f9c]">此语境下还没有锚点，写下第一枚吧。</p>
          </div>
        ) : (
          <ul className="space-y-3 p-5">
            {rows.map((r) => {
              const a = r.anchor
              const liked = likedOf(r)
              const comments = commentsOf(r)
              const commentOpen = commentOpenId === a.id
              const commentDraft = commentDrafts[a.id] ?? ''
              return (
                <li
                  key={`${r.own ? 'me' : 'cp'}-${a.id}`}
                  className="rounded-lg border border-[#c9973f]/15 bg-[#0a0c10]/60 p-4"
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span className={a.mine ? 'text-[#c9973f]' : 'text-[#e8dcc0]'}>{a.author}</span>
                    {a.mine ? (
                      <Badge className="border-transparent bg-[#c9973f]/20 text-[#c9973f]">我</Badge>
                    ) : null}
                    <time className="ml-auto text-[11px] text-[#8a8f9c]/70">
                      {formatTime(a.createdAt)}
                    </time>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-[#e8dcc0]/90">{a.text}</p>
                  <div className="mt-3 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => toggleLike(r)}
                      aria-label="点赞"
                      className={cn(
                        'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors',
                        liked
                          ? 'text-[#c9973f]'
                          : 'text-[#8a8f9c] hover:bg-[#c9973f]/10 hover:text-[#e8dcc0]'
                      )}
                    >
                      <Heart className={cn('size-3.5', liked && 'fill-current')} />
                      {likesOf(r)}
                    </button>
                    <button
                      type="button"
                      onClick={() => setCommentOpenId(commentOpen ? null : a.id)}
                      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-[#8a8f9c] transition-colors hover:bg-[#c9973f]/10 hover:text-[#e8dcc0]"
                    >
                      <MessageCircle className="size-3.5" />
                      {comments.length > 0 ? comments.length : '评论'}
                    </button>
                  </div>
                  {comments.length > 0 ? (
                    <ul className="mt-3 space-y-2 border-t border-[#c9973f]/10 pt-3">
                      {comments.map((c) => (
                        <li key={c.id} className="text-xs leading-relaxed text-[#8a8f9c]">
                          <span className="text-[#e8dcc0]/80">{c.author}：</span>
                          {c.text}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {commentOpen ? (
                    <div className="mt-3 flex items-end gap-2">
                      <Textarea
                        value={commentDraft}
                        onChange={(e) =>
                          setCommentDrafts((s) => ({ ...s, [a.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault()
                            submitComment(r)
                          }
                          if (e.key !== 'Escape') e.stopPropagation()
                        }}
                        placeholder="写下你的回应……"
                        className="min-h-9 flex-1 resize-none border-[#c9973f]/25 bg-[#0a0c10]/60 text-xs text-[#e8dcc0] placeholder:text-[#8a8f9c]/60 focus-visible:border-[#c9973f]/50 focus-visible:ring-[#c9973f]/30"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={!commentDraft.trim()}
                        onClick={() => submitComment(r)}
                        className="h-8 px-2 text-[#c9973f] hover:bg-[#c9973f]/10 hover:text-[#e8dcc0]"
                      >
                        <Send className="size-3.5" />
                      </Button>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </ScrollArea>
    </PanelShell>
  )
}

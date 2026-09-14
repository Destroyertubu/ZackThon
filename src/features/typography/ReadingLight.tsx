import { useEffect, useRef, useState } from 'react'
import { Bookmark, Check, ChevronDown, ExternalLink, X } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import LivingWords from './LivingWords'
import { useReducedMotion } from './useReducedMotion'

interface Props {
  id: string; title: string; author: string; provenance: string; paragraphs: string[]
  url?: string; saved: boolean; onSave: () => void; onClose: () => void; saveDisabled?: boolean
}

/** A reading pose uses DOM glyphs without a backing surface; the live world stays visible. */
export default function ReadingLight({ id, title, author, provenance, paragraphs, url, saved, onSave, onClose, saveDisabled = false }: Props) {
  const [scrollArea, setScrollArea] = useState<HTMLDivElement | null>(null)
  const [opener] = useState(() => document.activeElement)
  const reduced = useReducedMotion()
  const [active, setActive] = useState(0)
  const activeRef = useRef(0)
  useEffect(() => {
    const area = scrollArea
    if (!area) return
    let initial = 0
    try { initial = Number(localStorage.getItem(`wanderwise-reading:${id}`)) || 0 } catch { /* Reading works with storage disabled. */ }
    const nodes = Array.from(area.querySelectorAll<HTMLElement>('[data-reading-paragraph]'))
    initial = Math.max(0, Math.min(nodes.length - 1, initial))
    activeRef.current = initial
    const frame = requestAnimationFrame(() => { setActive(initial); if (initial > 0) nodes[initial]?.scrollIntoView({ block: 'start' }) })
    const update = () => {
      const edge = area.getBoundingClientRect().top + area.clientHeight * .23
      const next = nodes.reduce((best, node, index) => Math.abs(node.getBoundingClientRect().top - edge) < Math.abs(nodes[best].getBoundingClientRect().top - edge) ? index : best, 0)
      activeRef.current = next; setActive(next)
    }
    area.addEventListener('scroll', update, { passive: true })
    return () => {
      cancelAnimationFrame(frame); area.removeEventListener('scroll', update)
      try { localStorage.setItem(`wanderwise-reading:${id}`, String(activeRef.current)) } catch { /* Text and collection are independent of reading-position storage. */ }
    }
  }, [id, scrollArea])
  const next = () => {
    const nodes = scrollArea?.querySelectorAll<HTMLElement>('[data-reading-paragraph]')
    nodes?.[Math.min(active + 1, nodes.length - 1)]?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' })
  }
  return <Dialog open onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent className="ww-reading-light" showCloseButton={false} onEscapeKeyDown={event => { event.preventDefault(); event.stopPropagation(); onClose() }} onCloseAutoFocus={event => { event.preventDefault(); if (opener instanceof HTMLElement && opener.isConnected) opener.focus() }}>
      <header><div><p className="ww-reading-eyebrow">静读 · 世界仍在呼吸</p><DialogTitle><LivingWords text={title}/></DialogTitle><DialogDescription>{author || '作者未提供'} · {provenance}</DialogDescription></div><button type="button" onClick={onClose} aria-label="结束静读"><X size={22}/></button></header>
      <div className="ww-reading-scroll" ref={setScrollArea} tabIndex={0} aria-label="阅读内容，滚动继续阅读">
        {paragraphs.filter(Boolean).map((paragraph, index) => <p key={index} data-reading-paragraph={index} className={active === index ? 'is-reading' : ''}>{paragraph}</p>)}
        {!paragraphs.some(Boolean) && <p>暂未取得可阅读的内容，请通过来源链接查看。</p>}
        {url && <a className="ww-reading-original" href={url} target="_blank" rel="noreferrer">前往原始来源 <ExternalLink size={15}/></a>}
      </div>
      <footer><span>{paragraphs.length ? `${active + 1} / ${paragraphs.length}` : '来源阅读'}</span><button type="button" aria-pressed={saved} disabled={saveDisabled} onClick={onSave}>{saved ? <Check size={16}/> : <Bookmark size={16}/>} {saved ? '已收藏' : '收藏'}</button><button type="button" onClick={next} disabled={active >= paragraphs.length - 1}>继续 <ChevronDown size={17}/></button><button type="button" onClick={onClose}>回到风景</button></footer>
    </DialogContent>
  </Dialog>
}

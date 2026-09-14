import type { ContentSource } from './types'
import { safeSourceUrl } from './persistence'
import type { QuestionResponse } from '../galaxy/types'

export interface EchoQuestion { id: string; title: string; query: string; answers: ContentSource[] }
/** Only a real question/answer URL establishes parentage, never matching titles. */
export function questionIdentity(source: ContentSource): string | null {
  const url = safeSourceUrl(source.url)
  if (!url || source.kind === 'curated') return null
  const parsed = new URL(url)
  if (!['www.zhihu.com','zhihu.com'].includes(parsed.hostname)) return null
  const match = parsed.pathname.match(/^\/question\/(\d+)(?:\/answer\/(\d+))?\/?$/)
  if (match) return `question-${match[1]}`
  if (/^\/answer\/\d+\/?$/.test(parsed.pathname) && /^question-\d+$/.test(source.galaxy?.questionId ?? '')) return source.galaxy!.questionId
  return null
}
export function groupEchoQuestions(sources: ContentSource[]): EchoQuestion[] {
  const groups = new Map<string,EchoQuestion>()
  for (const source of sources) {
    const id = questionIdentity(source)
    if (!id) continue
    const group = groups.get(id) ?? { id, title: source.title.replace(/\s*-\s*知乎$/, ''), query: source.galaxy?.query || source.title, answers: [] }
    const isAnswer = /\/answer\/\d+/.test(source.url)
    if (isAnswer && !group.answers.some(a => a.id===source.id || a.url===source.url)) group.answers.push(source)
    groups.set(id,group)
  }
  return [...groups.values()].sort((a,b)=>new Set(b.answers.map(s=>s.author)).size-new Set(a.answers.map(s=>s.author)).size)
}
export function expandedEchoSources(result: QuestionResponse, group: EchoQuestion): ContentSource[] {
  if(result.question.id !== group.id || result.question.kind === 'article' || result.question.kind === 'topic') return []
  return result.question.answers.filter(a=>!a.curated).map(answer=>({
    id:`galaxy:answer:${answer.id}`, remoteId:answer.id, title:result.question.title, author:answer.author,
    summary:answer.excerpt || answer.paragraphs.join('\n\n'), url:answer.url, source:answer.sourceName || '知乎', kind:'summary' as const,
    contentType:'answer' as const, fetchedAt:new Date().toISOString(),
    galaxy:{id:answer.id,type:'answer' as const,questionId:group.id,answerId:answer.id,query:group.query},
  })).filter(source=>questionIdentity(source)===group.id)
}

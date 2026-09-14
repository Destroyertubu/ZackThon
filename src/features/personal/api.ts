import type { ContentSource } from './types'
export async function api<T>(url:string, options:RequestInit={}):Promise<T>{
  const usesMascot = url.startsWith('/api/search') || url === '/api/synthesis'
  if (usesMascot) window.dispatchEvent(new CustomEvent('wanderwise:mascot-state', {detail:'searching'}))
  try {
  const response=await fetch(url,{...options,headers:{'Content-Type':'application/json',...options.headers},credentials:'same-origin'})
  const data=await response.json().catch(()=>({message:'服务返回了无法读取的结果'}))
  if(!response.ok)throw new Error(data.message??'服务暂时不可用')
  return data as T
  } finally { if (usesMascot) window.dispatchEvent(new CustomEvent('wanderwise:mascot-state', {detail:'idle'})) }
}
export interface SearchResponse { items:ContentSource[]; cached:boolean; fetchedAt:string; notice?:string }
export function normalizeSearchSource(source:ContentSource):ContentSource {
  return {...source,remoteId:source.remoteId??source.id,source:source.source==='zhihu'?'知乎':source.source==='global'?'全网来源':source.source,kind:source.kind==='question'?'question':'summary'}
}
export interface SynthesisResponse {draft:{id:string;mode:'idea'|'journey';text:string;sources:unknown[];generatedAt:string;realmId?:string};provider:string}

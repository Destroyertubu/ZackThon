import assert from 'node:assert/strict'
import test from 'node:test'
import {groupEchoQuestions,questionIdentity,expandedEchoSources} from './echoes'
import {applyCollectionSeed} from './collectionSeed'
import {emptyPersonalData,validatePersonalData} from './persistence'
import type {ContentSource} from './types'
import type {QuestionResponse} from '../galaxy/types'
const source=(patch:Partial<ContentSource>={}):ContentSource=>({id:'a',title:'同一个标题',author:'作者甲',summary:'公开摘要',url:'https://www.zhihu.com/question/123/answer/456',source:'知乎',kind:'summary',fetchedAt:'2026-09-14T00:00:00.000Z',...patch})
test('equal titles never establish a question or answer relationship',()=>{
  const grouped=groupEchoQuestions([source(),source({id:'b',author:'作者乙',url:'https://www.zhihu.com/question/123/answer/789'}),source({id:'c',url:'https://zhuanlan.zhihu.com/p/123'}),source({id:'d',url:'https://www.zhihu.com/question/999/answer/111'})])
  assert.equal(grouped.length,2);assert.equal(grouped[0].id,'question-123');assert.equal(grouped[0].answers.length,2)
  assert.equal(questionIdentity(source({url:'https://zhihu.com.evil.test/question/123/answer/456'})),null)
  assert.equal(questionIdentity(source({kind:'curated'})),null)
})
test('public seed opens the phone with two real authors, without a new request',()=>{
  const seeded=applyCollectionSeed(emptyPersonalData()), groups=groupEchoQuestions(Object.values(seeded.sources))
  assert.equal(groups[0].id,'question-13321437232')
  assert.deepEqual(new Set(groups[0].answers.map(s=>s.author)),new Set(['解磊','心理这点事儿']))
})
test('question expansion rejects an unrelated response and curated pretend answers',()=>{
  const group=groupEchoQuestions([source()])[0]
  const response:QuestionResponse={question:{id:'question-123',title:'真实问题',excerpt:'',keywords:[],relevance:1,color:'#fff',answers:[{id:'answer-456',title:'回答',author:'作者甲',excerpt:'摘要',paragraphs:[],url:source().url,relevance:1,isExcerpt:true},{id:'fake',title:'AI 示例',author:'示例',excerpt:'示例',paragraphs:[],url:'https://www.zhihu.com/question/123/answer/999',relevance:1,isExcerpt:true,curated:true}]}}
  assert.equal(expandedEchoSources(response,group).length,1)
  assert.deepEqual(expandedEchoSources({...response,question:{...response.question,id:'question-999'}},group),[])
})
test('reading progress survives personal export validation; old profiles stay valid',()=>{
  const old=emptyPersonalData();assert.equal(validatePersonalData(old).reading,undefined)
  const seeded=applyCollectionSeed(old),id=Object.keys(seeded.sources)[0]
  const restored=validatePersonalData(JSON.parse(JSON.stringify({...seeded,reading:{[id]:{paragraph:3,updatedAt:'2026-09-14T00:00:00.000Z'}}})))
  assert.equal(restored.reading?.[id]?.paragraph,3)
  assert.throws(()=>validatePersonalData({...seeded,reading:{[id]:{paragraph:-1,updatedAt:'2026-09-14T00:00:00.000Z'}}}))
  assert.deepEqual(validatePersonalData({...seeded,reading:{orphan:{paragraph:3,updatedAt:'2026-09-14T00:00:00.000Z'}}}).reading,{})
})

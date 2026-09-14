import LivingWords from '@/features/typography/LivingWords'
import '@/features/personal/workspaces.css'
import { useReducedMotion } from '@/features/typography/useReducedMotion'
import type { CocktailPreview } from '@/features/typography/CocktailVision'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router'
import { usePersonalStore } from '@/features/personal/store'
import { getRealmForRecipe } from '@/features/journeys/realmDefinitions'
import { realmSources } from '@/features/journeys/content'
import { Bookmark, Check, Sparkles, X } from 'lucide-react'
import { getKnowledgeIngredient, KNOWLEDGE_INGREDIENTS, mixThoughtRecipe, readGardenRecipes, writeGardenRecipes } from './gardenRecipes'
import type { KnowledgeId, ThoughtRecipe } from './gardenRecipes'

export default function GardenWorkshop({ onClose, initialPair, onMixStart, onPreview }: { onClose: () => void; initialPair?: readonly [KnowledgeId,KnowledgeId]; onMixStart?: (recipe: ThoughtRecipe) => void; onPreview?: (preview: CocktailPreview) => void }) {
  const navigate = useNavigate()
  const reducedMotion = useReducedMotion()
  const finishAnimation = useRef<(() => void) | null>(null)
  const [stage, setStage] = useState(0)
  const personal = usePersonalStore(s => s.data)
  const [personalText, setPersonalText] = useState('')
  const [materialIds, setMaterialIds] = useState<string[]>([])
  const [mixing, setMixing] = useState(false)
  const attempt = useRef(0)
  const mixingRef = useRef(false)
  useEffect(() => () => { attempt.current += 1; finishAnimation.current?.() }, [])
  useEffect(() => {
    if (!mixing) return
    setStage(0)
    const pour = setTimeout(() => setStage(1), reducedMotion ? 100 : 1600)
    const reveal = setTimeout(() => setStage(2), reducedMotion ? 300 : 3200)
    return () => { clearTimeout(pour); clearTimeout(reveal) }
  }, [mixing, reducedMotion])
  const dialog = useRef<HTMLElement>(null)
  const [first, setFirst] = useState<KnowledgeId>(initialPair?.[0] ?? 'literature')
  const [second, setSecond] = useState<KnowledgeId>(initialPair?.[1] ?? 'photography')
  const [firstPercent, setFirstPercent] = useState(60)
  const [bottleSlot,setBottleSlot] = useState<'first'|'second'>('first')
  const [blended, setBlended] = useState(false)
  const [recipes, setRecipes] = useState(() => personal.recipes.length ? personal.recipes : readGardenRecipes())
  const [notice, setNotice] = useState('')
  const recipe = useMemo(() => mixThoughtRecipe(first, second, firstPercent), [first, second, firstPercent])
  const ingredientA = getKnowledgeIngredient(first), ingredientB = getKnowledgeIngredient(second)
  useEffect(() => { onPreview?.({recipe,mixing}) }, [recipe,mixing,onPreview])
  const saved = recipes.some(item => item.id === recipe.id)

  useEffect(() => {
    const previous = document.activeElement
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.code === 'Escape') { event.preventDefault(); onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus({ preventScroll: true })
    }
  }, [onClose])

  const changeIngredient = (slot: 'first' | 'second', id: KnowledgeId) => {
    if (slot === 'first') { setFirst(id); if (id === second) setSecond(first) }
    else { setSecond(id); if (id === first) setFirst(second) }
    setBlended(false); setNotice('')
  }
  const launch = async (value: ThoughtRecipe) => {
    if (mixingRef.current) return
    mixingRef.current = true
    const token = ++attempt.current
    setMixing(true); setBlended(true); setNotice('杯中的风景正在展开，片刻后自动抵达……')
    onMixStart?.(value)
    try {
      await Promise.all([import('@/features/journeys/JourneyPage'), new Promise<void>(resolve => {
        const timer = setTimeout(() => { finishAnimation.current = null; resolve() }, reducedMotion ? 600 : 4800)
        finishAnimation.current = () => { clearTimeout(timer); finishAnimation.current = null; resolve() }
      })])
      if (token !== attempt.current) return
      const realm = getRealmForRecipe(value)
      if (!realm) throw new Error('这杯酒暂时没有找到对应的风景')
      const sourceIds = realmSources(realm,value).map(source => usePersonalStore.getState().putSource(source))
      const materials = [...personal.notes, ...personal.works].filter(item => materialIds.includes(item.id)).map(item => `${item.title}：${item.text}`).join('\n\n')
      const journey = usePersonalStore.getState().createJourney({realmId:realm.id,title:realm.title,recipe:value,personalText:[personalText,materials].filter(Boolean).join('\n\n'),sourceIds})
      writeGardenRecipes([value, ...recipes.filter(item => item.id !== value.id)])
      navigate(`/journey/${realm.id}?trip=${journey.id}`)
    } catch (error) {
      if (token !== attempt.current) return
      finishAnimation.current?.()
      setMixing(false); mixingRef.current = false; setNotice(error instanceof Error ? error.message : '风景暂时没有准备好，请重试。')
    }
  }
  const cancelLaunch = () => {
    attempt.current += 1
    finishAnimation.current?.()
    mixingRef.current = false
    setMixing(false)
    setNotice('已取消出发，配方和文字仍在，可以调整后重新调制。')
  }
  const recall = (value: ThoughtRecipe) => {
    setFirst(value.first); setSecond(value.second); setFirstPercent(value.firstPercent)
    void launch(value)
  }
  const save = () => {
    const next = [recipe, ...recipes.filter(item => item.id !== recipe.id)].slice(0, 12)
    usePersonalStore.getState().saveRecipe(recipe)
    const persisted = writeGardenRecipes(next)
    setRecipes(next)
    setNotice(persisted ? '配方已收入这台设备的配方册' : '浏览器暂不允许保存，配方仅保留在本次调制中')
  }

  return <div className="observatory-dialog-backdrop garden-workshop-backdrop" onClick={onClose}>
    <section ref={dialog} className="garden-workshop" role="dialog" aria-modal="true" aria-labelledby="garden-workshop-title" aria-describedby="garden-workshop-description"
      onClick={event => event.stopPropagation()} onKeyDown={event => {
        if (event.key !== 'Tab') return
        const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), input:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]')
        const firstControl = controls[0], lastControl = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === firstControl) { event.preventDefault(); lastControl?.focus() }
        else if (!event.shiftKey && document.activeElement === lastControl) { event.preventDefault(); firstControl?.focus() }
      }}>
      <button type="button" className="observatory-icon-button garden-workshop-close" aria-label="关闭思想调酒，继续漫步" onClick={onClose}><X size={18} /></button>
      <p className="observatory-eyebrow">THE THOUGHT BAR <span>/</span> 星树下的一杯灵感</p>
      <h2 id="garden-workshop-title"><LivingWords text="思想调酒"/></h2>
      <p id="garden-workshop-description" className="garden-workshop-intro">选两种知识，留一点意外。让不同的视角，在同一只杯中相遇。</p>
      <p className="garden-workshop-example">十种相遇，十片风景 · 调好后自动出发</p>

      <div className="garden-workshop-body">
        <div className="garden-workshop-controls">
          <div className="atelier-bottle-shelf" role="group" aria-label="从瓶架选择两种原料">
            {KNOWLEDGE_INGREDIENTS.map((ingredient,i)=><button key={ingredient.id} type="button" disabled={mixing} aria-label={`选取${ingredient.name}原料`} aria-pressed={first===ingredient.id||second===ingredient.id} onClick={()=>{
              if(first===ingredient.id){setBottleSlot('first');return}
              if(second===ingredient.id){setBottleSlot('second');return}
              changeIngredient(bottleSlot,ingredient.id);setBottleSlot(bottleSlot==='first'?'second':'first')
            }}>
              <svg viewBox="0 0 44 80" aria-hidden="true"><defs><linearGradient id={`decanter-${i}`} x1="0" x2="1"><stop offset="0" stopColor={ingredient.color} stopOpacity=".15"/><stop offset=".38" stopColor={ingredient.color} stopOpacity=".65"/><stop offset="1" stopColor={ingredient.color} stopOpacity=".22"/></linearGradient></defs>
                <path d={['M17 16H27V29C27 34 36 34 36 42V72Q36 77 31 77H13Q8 77 8 72V42C8 34 17 34 17 29Z','M18 16H26V29L37 40V72L32 77H12L7 72V40L18 29Z','M18 16H26V31C41 40 32 47 31 54C28 65 38 72 34 77H10C6 72 16 65 13 54C12 47 3 40 18 31Z','M18 16H26V31C45 43 38 74 31 77H13C6 74 -1 43 18 31Z','M19 10H25V29C29 34 32 44 33 71Q33 77 29 77H15Q11 77 11 71C12 44 15 34 19 29Z'][i]} fill={`url(#decanter-${i})`} stroke="#d5ddcf" strokeWidth=".65"/>
                <path d="M17 15H27M16 18H28M13 70L13 45" stroke="#ecd2a0" strokeWidth="1.1" fill="none"/><circle cx="22" cy="9" r="4.5" fill="#bba578"/><circle cx="22" cy="52" r="6" stroke="#d6c298" strokeWidth=".6" fill="none"/>
              </svg><span>{ingredient.name}</span><small>{first===ingredient.id?'第一种':second===ingredient.id?'第二种':'轻触选入'}</small>
            </button>)}
          </div>
          <div className="garden-ingredient-pair">
            {(['first', 'second'] as const).map((slot, index) => {
              const ingredient = slot === 'first' ? ingredientA : ingredientB
              return <label key={slot} className="garden-ingredient" style={{ '--ingredient-color': ingredient.color } as CSSProperties}>
                <span className={`garden-bottle ingredient-${ingredient.id}`} aria-hidden="true"><i /><b /></span>
                <span className="garden-ingredient-label">{index === 0 ? '第一种成分' : '第二种成分'}</span>
                <select disabled={mixing} value={ingredient.id} onChange={event => changeIngredient(slot, event.target.value as KnowledgeId)} aria-label={index === 0 ? '第一种知识成分' : '第二种知识成分'}>
                  {KNOWLEDGE_INGREDIENTS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <small>{ingredient.note}</small>
              </label>
            })}
          </div>
          <label className="garden-ratio" htmlFor="garden-ratio">
            <span><span style={{ color: ingredientA.color }}>{ingredientA.name} {firstPercent}%</span><span style={{ color: ingredientB.color }}>{ingredientB.name} {100 - firstPercent}%</span></span>
            <input id="garden-ratio" disabled={mixing} type="range" min="10" max="90" step="10" value={firstPercent}
              aria-label={`${ingredientA.name}占比`} aria-valuetext={`${ingredientA.name} ${firstPercent}%，${ingredientB.name} ${100 - firstPercent}%`}
              style={{ background: `linear-gradient(90deg, ${ingredientA.color} ${firstPercent}%, ${ingredientB.color} ${firstPercent}%)` }}
              onChange={event => { setFirstPercent(Number(event.target.value)); setBlended(false); setNotice('') }} />
          </label>
          <label className="garden-personal-input">想带进风景的一句话<textarea disabled={mixing} maxLength={2000} value={personalText} onChange={e => setPersonalText(e.target.value)} placeholder="例如：用光影讲述一次离别……" /></label>
          {(personal.notes.length > 0 || personal.works.length > 0) && <details className="garden-personal-materials"><summary>选入自己的笔记或作品（可选）</summary>{[...personal.notes,...personal.works].slice(0,20).map(item => <label key={item.id}><input type="checkbox" disabled={mixing} checked={materialIds.includes(item.id)} onChange={e => setMaterialIds(ids => e.target.checked ? [...ids,item.id] : ids.filter(id => id !== item.id))}/>{item.title}</label>)}</details>}
          <button type="button" className="observatory-button garden-mix-button" disabled={mixing} onClick={() => void launch(recipe)}><Sparkles size={16} />{mixing ? ['正在量取与倾倒…','正在混合与装饰…','杯中风景正在展开…'][stage] : '调制这一杯 · 自动出发'}</button>
          {mixing && <button type="button" className="observatory-button" onClick={() => { setStage(2); finishAnimation.current?.() }}>跳过调制动画</button>}
          {mixing && <button type="button" className="observatory-button" onClick={cancelLaunch}><X size={16} />取消出发 · 留在观星台</button>}
        </div>

        <div className={`garden-recipe-card ${blended ? 'is-blended' : ''}`} style={{ '--blend-a': ingredientA.color, '--blend-b': ingredientB.color } as CSSProperties}>
          <p className="atelier-vessel-note">手工酒具 · 杯中有一片世界</p>
          <div className="garden-blend-result" aria-live="polite">
            {blended ? <>
              <p className="observatory-eyebrow">本次灵感配方</p>
              <h3><LivingWords text={recipe.name}/></h3>
              <p className="garden-recipe-source">{ingredientA.name} {firstPercent}% <span>×</span> {ingredientB.name} {100 - firstPercent}%</p>
              <p className="garden-recipe-prompt">{recipe.prompt}</p>
              <button type="button" className="observatory-button garden-save-button" disabled={mixing} onClick={save}>{saved ? <Check size={15} /> : <Bookmark size={15} />}{saved ? '已在配方册 · 再次保存' : '保存这份配方'}</button>
            </> : <><p className="observatory-eyebrow">等待一次相遇</p><h3><LivingWords text={recipe.name}/></h3><p className="garden-recipe-prompt">调整成分和比例，调好后直接走进这杯酒对应的世界。可以带上自己的问题和材料。</p></>}
          </div>
        </div>
      </div>
      <button type="button" className="observatory-button atelier-save-recipe" disabled={mixing} onClick={save}><Bookmark size={15}/>{saved ? '配方已收藏' : '先收下这份配方'}</button>
      <p className="garden-workshop-notice" role="status">{notice || '配方保存在当前浏览器；每本配方册最多收录 12 杯。'}</p>
      {recipes.length > 0 && <div className="garden-recipe-shelf"><span>我的配方册</span><div>{recipes.map(item => <button type="button" key={item.id} disabled={mixing} onClick={() => recall(item)} title={`${getKnowledgeIngredient(item.first).name} ${item.firstPercent}% × ${getKnowledgeIngredient(item.second).name} ${100 - item.firstPercent}%`}>
        <Bookmark size={12} />{item.name}<small>{item.firstPercent} / {100 - item.firstPercent}</small></button>)}</div></div>}
    </section>
  </div>
}

import LivingWords from '@/features/typography/LivingWords'
import type { CocktailPreview } from '@/features/typography/CocktailVision'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router'
import { usePersonalStore } from '@/features/personal/store'
import { getRealmForRecipe } from '@/features/journeys/realmDefinitions'
import { realmSources } from '@/features/journeys/content'
import { Bookmark, Check, Sparkles, Wine, X } from 'lucide-react'
import { getKnowledgeIngredient, KNOWLEDGE_INGREDIENTS, mixThoughtRecipe, readGardenRecipes, writeGardenRecipes } from './gardenRecipes'
import type { KnowledgeId, ThoughtRecipe } from './gardenRecipes'

export default function GardenWorkshop({ onClose, initialPair, onMixStart, onPreview }: { onClose: () => void; initialPair?: readonly [KnowledgeId,KnowledgeId]; onMixStart?: (recipe: ThoughtRecipe) => void; onPreview?: (preview: CocktailPreview) => void }) {
  const navigate = useNavigate()
  const personal = usePersonalStore(s => s.data)
  const [personalText, setPersonalText] = useState('')
  const [materialIds, setMaterialIds] = useState<string[]>([])
  const [mixing, setMixing] = useState(false)
  const attempt = useRef(0)
  const mixingRef = useRef(false)
  useEffect(() => () => { attempt.current += 1 }, [])
  const dialog = useRef<HTMLElement>(null)
  const [first, setFirst] = useState<KnowledgeId>(initialPair?.[0] ?? 'literature')
  const [second, setSecond] = useState<KnowledgeId>(initialPair?.[1] ?? 'photography')
  const [firstPercent, setFirstPercent] = useState(60)
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
      await Promise.all([import('@/features/journeys/JourneyPage'), new Promise(resolve => setTimeout(resolve, 1800))])
      if (token !== attempt.current) return
      const realm = getRealmForRecipe(value)
      if (!realm) throw new Error('这杯酒暂时没有找到对应的风景')
      const sourceIds = realmSources(realm,value).map(source => usePersonalStore.getState().putSource(source))
      const materials = [...personal.notes, ...personal.works].filter(item => materialIds.includes(item.id)).map(item => `${item.title}：${item.text}`).join('\n\n')
      const journey = usePersonalStore.getState().createJourney({realmId:realm.id,title:realm.title,recipe:value,personalText:[personalText,materials].filter(Boolean).join('\n\n'),sourceIds})
      writeGardenRecipes([value, ...recipes.filter(item => item.id !== value.id)])
      navigate(`/journey/${realm.id}?trip=${journey.id}`)
    } catch (error) {
      if (token === attempt.current) { setMixing(false); mixingRef.current = false; setNotice(error instanceof Error ? error.message : '风景暂时没有准备好，请重试。') }
    }
  }
  const cancelLaunch = () => {
    attempt.current += 1
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
          <div className="garden-ingredient-pair">
            {(['first', 'second'] as const).map((slot, index) => {
              const ingredient = slot === 'first' ? ingredientA : ingredientB
              return <label key={slot} className="garden-ingredient" style={{ '--ingredient-color': ingredient.color } as CSSProperties}>
                <span className="garden-bottle" aria-hidden="true"><i /><b /></span>
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
          <button type="button" className="observatory-button garden-mix-button" disabled={mixing} onClick={() => void launch(recipe)}><Sparkles size={16} />{mixing ? '风景正在展开…' : '调制这一杯 · 自动出发'}</button>
          {mixing && <button type="button" className="observatory-button" onClick={cancelLaunch}><X size={16} />取消出发 · 留在观星台</button>}
        </div>

        <div className={`garden-recipe-card ${blended ? 'is-blended' : ''}`} style={{ '--blend-a': ingredientA.color, '--blend-b': ingredientB.color } as CSSProperties}>
          <div className="garden-coupe" aria-hidden="true"><Wine size={62} strokeWidth={.8} /><span /></div>
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
      <p className="garden-workshop-notice" role="status">{notice || '配方保存在当前浏览器；每本配方册最多收录 12 杯。'}</p>
      {recipes.length > 0 && <div className="garden-recipe-shelf"><span>我的配方册</span><div>{recipes.map(item => <button type="button" key={item.id} disabled={mixing} onClick={() => recall(item)} title={`${getKnowledgeIngredient(item.first).name} ${item.firstPercent}% × ${getKnowledgeIngredient(item.second).name} ${100 - item.firstPercent}%`}>
        <Bookmark size={12} />{item.name}<small>{item.firstPercent} / {100 - item.firstPercent}</small></button>)}</div></div>}
    </section>
  </div>
}

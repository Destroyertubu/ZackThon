import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Bookmark, Check, Sparkles, Wine, X } from 'lucide-react'
import { getKnowledgeIngredient, KNOWLEDGE_INGREDIENTS, mixThoughtRecipe, readGardenRecipes, writeGardenRecipes } from './gardenRecipes'
import type { KnowledgeId, ThoughtRecipe } from './gardenRecipes'

export default function GardenWorkshop({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLElement>(null)
  const [first, setFirst] = useState<KnowledgeId>('literature')
  const [second, setSecond] = useState<KnowledgeId>('photography')
  const [firstPercent, setFirstPercent] = useState(60)
  const [blended, setBlended] = useState(false)
  const [recipes, setRecipes] = useState(readGardenRecipes)
  const [notice, setNotice] = useState('')
  const recipe = useMemo(() => mixThoughtRecipe(first, second, firstPercent), [first, second, firstPercent])
  const ingredientA = getKnowledgeIngredient(first), ingredientB = getKnowledgeIngredient(second)
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
  const recall = (value: ThoughtRecipe) => {
    setFirst(value.first); setSecond(value.second); setFirstPercent(value.firstPercent)
    setBlended(true); setNotice('已重新调制这份配方')
  }
  const save = () => {
    const next = [recipe, ...recipes.filter(item => item.id !== recipe.id)].slice(0, 12)
    const persisted = writeGardenRecipes(next)
    setRecipes(next)
    setNotice(persisted ? '配方已收入这台设备的配方册' : '浏览器暂不允许保存，配方仅保留在本次调制中')
  }

  return <div className="observatory-dialog-backdrop garden-workshop-backdrop" onClick={onClose}>
    <section ref={dialog} className="garden-workshop" role="dialog" aria-modal="true" aria-labelledby="garden-workshop-title" aria-describedby="garden-workshop-description"
      onClick={event => event.stopPropagation()} onKeyDown={event => {
        if (event.key !== 'Tab') return
        const controls = event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), select, input, [tabindex="0"]')
        const firstControl = controls[0], lastControl = controls[controls.length - 1]
        if (event.shiftKey && document.activeElement === firstControl) { event.preventDefault(); lastControl?.focus() }
        else if (!event.shiftKey && document.activeElement === lastControl) { event.preventDefault(); firstControl?.focus() }
      }}>
      <button type="button" className="observatory-icon-button garden-workshop-close" aria-label="关闭思想调酒，继续漫步" onClick={onClose}><X size={18} /></button>
      <p className="observatory-eyebrow">THE THOUGHT BAR <span>/</span> 星树下的一杯灵感</p>
      <h2 id="garden-workshop-title">思想调酒</h2>
      <p id="garden-workshop-description" className="garden-workshop-intro">选两种知识，留一点意外。让不同的视角，在同一只杯中相遇。</p>
      <p className="garden-workshop-example">示例成分体验 · 从这里试一份创作配方</p>

      <div className="garden-workshop-body">
        <div className="garden-workshop-controls">
          <div className="garden-ingredient-pair">
            {(['first', 'second'] as const).map((slot, index) => {
              const ingredient = slot === 'first' ? ingredientA : ingredientB
              return <label key={slot} className="garden-ingredient" style={{ '--ingredient-color': ingredient.color } as CSSProperties}>
                <span className="garden-bottle" aria-hidden="true"><i /><b /></span>
                <span className="garden-ingredient-label">{index === 0 ? '第一种成分' : '第二种成分'}</span>
                <select value={ingredient.id} onChange={event => changeIngredient(slot, event.target.value as KnowledgeId)} aria-label={index === 0 ? '第一种知识成分' : '第二种知识成分'}>
                  {KNOWLEDGE_INGREDIENTS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <small>{ingredient.note}</small>
              </label>
            })}
          </div>
          <label className="garden-ratio" htmlFor="garden-ratio">
            <span><span style={{ color: ingredientA.color }}>{ingredientA.name} {firstPercent}%</span><span style={{ color: ingredientB.color }}>{ingredientB.name} {100 - firstPercent}%</span></span>
            <input id="garden-ratio" type="range" min="10" max="90" step="10" value={firstPercent}
              aria-label={`${ingredientA.name}占比`} aria-valuetext={`${ingredientA.name} ${firstPercent}%，${ingredientB.name} ${100 - firstPercent}%`}
              style={{ background: `linear-gradient(90deg, ${ingredientA.color} ${firstPercent}%, ${ingredientB.color} ${firstPercent}%)` }}
              onChange={event => { setFirstPercent(Number(event.target.value)); setBlended(false); setNotice('') }} />
          </label>
          <button type="button" className="observatory-button garden-mix-button" onClick={() => { setBlended(true); setNotice('') }}><Sparkles size={16} />调制这一杯</button>
        </div>

        <div className={`garden-recipe-card ${blended ? 'is-blended' : ''}`} style={{ '--blend-a': ingredientA.color, '--blend-b': ingredientB.color } as CSSProperties}>
          <div className="garden-coupe" aria-hidden="true"><Wine size={62} strokeWidth={.8} /><span /></div>
          <div className="garden-blend-result" aria-live="polite">
            {blended ? <>
              <p className="observatory-eyebrow">本次灵感配方</p>
              <h3>{recipe.name}</h3>
              <p className="garden-recipe-source">{ingredientA.name} {firstPercent}% <span>×</span> {ingredientB.name} {100 - firstPercent}%</p>
              <p className="garden-recipe-prompt">{recipe.prompt}</p>
              <button type="button" className="observatory-button garden-save-button" onClick={save}>{saved ? <Check size={15} /> : <Bookmark size={15} />}{saved ? '已在配方册 · 再次保存' : '保存这份配方'}</button>
            </> : <><p className="observatory-eyebrow">等待一次相遇</p><h3>这一杯，会想到什么？</h3><p className="garden-recipe-prompt">调整左侧比例，调制后会得到一个名字和一条可以动手尝试的创作提示。</p></>}
          </div>
        </div>
      </div>
      <p className="garden-workshop-notice" role="status">{notice || '配方保存在当前浏览器；每本配方册最多收录 12 杯。'}</p>
      {recipes.length > 0 && <div className="garden-recipe-shelf"><span>我的配方册</span><div>{recipes.map(item => <button type="button" key={item.id} onClick={() => recall(item)} title={`${getKnowledgeIngredient(item.first).name} ${item.firstPercent}% × ${getKnowledgeIngredient(item.second).name} ${100 - item.firstPercent}%`}>
        <Bookmark size={12} />{item.name}<small>{item.firstPercent} / {100 - item.firstPercent}</small></button>)}</div></div>}
    </section>
  </div>
}

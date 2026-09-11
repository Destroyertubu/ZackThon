"""Offline Chromium regression: synthetic data + memory journal + explicitly mocked AI.
Not an authenticated Zhihu/API or Chrome extension-service-worker end-to-end test.
Run: python tests/browser_regression.py (requires playwright and Chromium).
"""
import asyncio, json, os, statistics
from pathlib import Path
from playwright.async_api import async_playwright
BASE=Path(__file__).resolve().parent.parent
OUT=BASE/'tests/results'
APP="document.querySelector('#zg-root').__zgApp"
async def main():
 OUT.mkdir(exist_ok=True)
 report={'environment':'offline Chromium; synthetic answers; memory journal; mocked AI responses; no paid API calls','checks':[],'views500':[],'errors':[]}
 async with async_playwright() as p:
  browser=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
  page=await browser.new_page(viewport={'width':1440,'height':960},device_scale_factor=1,accept_downloads=True)
  page.on('pageerror',lambda e:report['errors'].append(str(e)))
  await page.set_content('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"></head><body style="margin:0"></body></html>')
  await page.add_style_tag(content=(BASE/'content.css').read_text())
  for name in ['core.js','trail-store.js','spatial.js','ai-semantic.js','engine.js','experience.js','galaxy3d.js','ai-client.js']:
   await page.add_script_tag(content=(BASE/name).read_text())
  await page.evaluate("""()=>{let state=ZGCore.freshState(); ZGJournal.client=()=>({isExtension:false,subscribe:()=>()=>{},dispatch:async action=>state=action.type==='read'?state:ZGCore.reduce(state,action)});} """)
  await page.add_script_tag(content=(BASE/'demo.js').read_text())
  await page.wait_for_timeout(2000)
  async def ev(body,arg=None): return await page.evaluate('(arg)=>{const a='+APP+';'+body+'}',arg)
  def check(name,value):
   if not value: raise AssertionError(name)
   report['checks'].append(name)
  check('120 answer nodes retained',await ev('return a.graph.satellites.length===120'))
  check('default AI disabled',await ev('return !a.aiConfig.enabled'))
  await ev('a.physics.settle(300);a.physics.stop();a.dirty=true;')
  await page.wait_for_timeout(300)
  check('raw XYZ projection used, no screen repulsion',await ev('a.prepareProjection();return a.screen.every(p=>{const raw=a.project(p.node.pos);return Math.abs(raw.x-p.x)<1e-6&&Math.abs(raw.y-p.y)<1e-6})'))
  check('1..8 world-anchored holograms visible',await ev("return a.visibleHolograms.length>0&&a.visibleHolograms.length<=8&&[...a.root.querySelectorAll('.zg-hologram')].every(el=>el.style.transform.startsWith('matrix3d('))"))
  await page.screenshot(path=str(OUT/'tech-overview.png'))
  # Real pointer drag and adjustable speed. Use empty lower-left sky.
  async def drag(speed,pan=False):
   await ev('a.settings.rotationSpeed=arg;a.settings.layoutFrozen=true;a.applyAppearance();a.theta=.55;a.phi=1.12;a.look={x:0,y:0,z:0};a.dirty=true;',speed)
   if pan: await page.keyboard.down('Shift')
   await page.mouse.move(130,800);await page.mouse.down();await page.mouse.move(240,810,steps=8);await page.mouse.up()
   if pan: await page.keyboard.up('Shift')
   return await ev('return {theta:a.theta,look:a.look}')
  slow=await drag(.4);fast=await drag(2)
  check('drag rotation sensitivity responds to user setting',abs(fast['theta']-.55)>abs(slow['theta']-.55)*4)
  pan=await drag(1,True)
  check('Shift-drag pans instead of rotating',abs(pan['theta']-.55)<1e-8 and abs(pan['look']['x'])+abs(pan['look']['z'])>1)
  await ev('a.home();a.physics.stop();')
  before=await ev('return a.radius')
  await page.mouse.move(100,650);await page.mouse.wheel(0,-100);await page.wait_for_timeout(500)
  check('wheel moves camera inward with perspective',await ev('return a.radius<arg',before))
  check('camera range maps slider consistently',await ev('a.radius=a.targetRadius=26;a.syncSlider();const near=Number(a.slider.value);a.radius=a.targetRadius=240;a.syncSlider();const far=Number(a.slider.value);a.home();return near===100&&far===0;'))
  # User-facing settings, cancel and persist.
  await page.get_by_role('button',name='设置',exact=True).click()
  await page.screenshot(path=str(OUT/'settings-space.png'))
  await page.locator('[data-setting="repulsion"]').evaluate('(el)=>{el.value=3.25;el.dispatchEvent(new Event("input",{bubbles:true}))}')
  check('sliders preview force coefficient live',await ev('return a.settings.repulsion===3.25'))
  await page.get_by_role('button',name='关闭设置',exact=True).click();await page.wait_for_timeout(100)
  check('closing settings discards unsaved preview',await ev('return a.settings.repulsion===1.35'))
  for theme in ['saturated','morandi']:
   await page.get_by_role('button',name='设置',exact=True).click()
   await page.get_by_role('button',name='配色',exact=True).click()
   await page.locator(f'[data-action="theme"][data-value="{theme}"]').click()
   await page.get_by_role('button',name='应用并保存',exact=True).click();await page.wait_for_timeout(350)
   check(f'{theme} theme applied and stored',await ev('return a.settings.theme===arg&&a.state.settings.theme===arg',theme))
   await page.screenshot(path=str(OUT/f'{theme}-overview.png'))
  await page.get_by_role('button',name='设置',exact=True).click();await page.get_by_role('button',name='配色',exact=True).click()
  await page.locator('[data-color="bg"]').evaluate('(el)=>{el.value="#e2dfdc";el.dispatchEvent(new Event("input",{bubbles:true}))}')
  await page.locator('[data-color="ink"]').evaluate('(el)=>{el.value="#e2dfdc";el.dispatchEvent(new Event("input",{bubbles:true}))}')
  check('custom palette enters custom mode and protects contrast',await ev("return a.settings.theme==='custom'&&ZGSpatial.contrast(a.palette.bg,a.palette.ink)>=4.5"))
  async with page.expect_download() as info: await page.locator('[data-action="theme-export"]').click()
  download=await info.value;temp=await download.path();palette=json.loads(Path(temp).read_text())
  check('palette exports typed JSON without API keys',palette['schemaVersion']==1 and palette['palette']['bg']=='#e2dfdc' and 'apiKey' not in palette)
  await page.locator('[data-action="theme"][data-value="tech"]').click()
  await page.get_by_role('button',name='应用并保存',exact=True).click();await page.wait_for_timeout(200)
  # Reading, bookmarks and trajectory remain functional.
  await ev("a.focus(a.graph.satellites[0],{source:'regression'});")
  await page.wait_for_timeout(150)
  check('click opens real source body without automatic rotation',await page.locator('.zg-original').count()==1)
  selected=await page.locator('.zg-original').evaluate("""el=>{const t=el.firstChild,range=document.createRange();range.setStart(t,0);range.setEnd(t,Math.min(16,t.length));getSelection().removeAllRanges();getSelection().addRange(range);return range.toString();}""")
  await page.wait_for_timeout(100)
  await page.locator('[data-action="clip"]').click();await page.wait_for_timeout(200)
  check('selected literal excerpt saved to knowledge journal',await ev('return a.state.bookmarks.some(b=>b.selector.exact===arg)',selected))
  await ev("a.focus(a.graph.satellites[16],{source:'regression'});a.focus(a.graph.satellites[32],{source:'regression'});")
  await page.wait_for_timeout(200)
  check('semantic visits, not mouse motion, populate trajectory',await ev("return a.state.events.filter(e=>e.kind==='visit').length>=3"))
  await ev("a.reviewTab='bookmarks';a.showReview();")
  await page.screenshot(path=str(OUT/'knowledge-review.png'))
  await ev("a.reviewTab='trail';a.showReview();")
  check('trajectory has clickable SVG map',await page.locator('.zg-panel svg').count()>0)
  await page.screenshot(path=str(OUT/'trail-review.png'))
  await ev('a.closePanel();a.home();a.physics.stop();')
  # Mock AI produces a real two-stage repair and checks exact original evidence.
  ai=await ev("""return (async()=>{
   const node=a.graph.keywords.find(n=>n.label==='个人财务');window.testNode=node;node.label='src';
   a.aiConfig={enabled:true,consent:true,auto:false,provider:'test-fixture',model:'synthetic-model',revision:99,threshold:.1,candidateLimit:12};
   window.testRequests=[];a.aiSend=async(type,payload)=>{if(type==='RUN'){testRequests.push(JSON.parse(JSON.stringify(payload)));if(payload.task==='scan')return {result:{repairs:[{id:node.id,label:'预算规划',terms:['预算','支出','应急储备'],reason:'网页元数据不是主题；支持句讨论支出与储备。'}]}};return {result:{groups:payload.data.groups.map(g=>({id:g.id,accepted:[...g.candidates].reverse().map(c=>({id:c.id,snippet:0}))}))}};}return true;};
   const before={count:a.graph.satellites.length,ids:a.nodes.map(n=>n.id),saved:a.state.bookmarks.length};await a.runAI();
   return {label:node.label,accepted:node.aiEvidenceIds.length,requests:testRequests.length,quotes:a.graph.satellites.filter(n=>n.aiQuote).every(n=>a.graph.byAnswer.get(n.answerId).text.includes(n.aiQuote)),kept:a.nodes.map(n=>n.id).join(',')===before.ids.join(',')&&a.state.bookmarks.length===before.saved,telemetry:a.aiTelemetry,audit:a.aiAudit};})();""")
  report['aiMock']=ai
  check('AI performs exactly two batched calls',ai['requests']==2)
  check('AI repairs bad keyword, caps at eight, preserves IDs/bookmarks',ai['label']=='预算规划' and 1<=ai['accepted']<=8 and ai['kept'])
  check('AI-picked quote is an exact source substring',ai['quotes'])
  await ev('a.refreshAIUI();')
  # Avoid production config refresh overwriting the test fixture when opening dialog.
  await ev('a.loadAIConfig=async()=>a.refreshAIUI();')
  await page.get_by_role('button',name='设置',exact=True).click();await page.get_by_role('button',name='AI 校对',exact=True).click()
  await page.screenshot(path=str(OUT/'ai-audit-mock.png'))
  await page.get_by_role('button',name='关闭设置',exact=True).click();await page.wait_for_timeout(100)
  check('manual AI undo restores old labels and preserves all answers',await ev("a.undoAI();return testNode.label==='src'&&a.graph.satellites.length===120"))
  failure=await ev("""return (async()=>{const old=a.nodes.map(n=>({id:n.id,label:n.label,parent:n.parent}));a.aiSend=async(type,payload)=>{if(payload.task==='scan')return {result:{repairs:[{id:testNode.id,label:'预算规划',terms:['预算'],reason:'test'}]}};throw new Error('mock timeout');};await a.runAI();return old.every((n,i)=>n.label===a.nodes[i].label&&n.parent===a.nodes[i].parent)&&a.aiMessage.includes('本轮未提交');})();""")
  check('failed second pass does not partially rename or relink graph',failure)
  stale=await ev("""return (async()=>{a.aiSend=async()=>{a.graphEpoch++;return {result:{repairs:[{id:testNode.id,label:'预算规划',terms:['预算']}]}};};await a.runAI();return testNode.label==='src';})();""")
  check('obsolete answer-pool generation discards late AI result',stale)
  # Incremental loading and twelve 3D views on 500 synthetic answers.
  await ev("a.aiConfig={enabled:false};a.replaceQuestion(ZGDemo.createQuestion(500));a.settings=ZGSpatial.cleanSettings({...a.settings,theme:'tech',layoutFrozen:false,cardCount:8,motion:'comfort'});a.applyAppearance();a.physics.settle(300);a.physics.stop();a.home();a.closePanel();")
  check('incremental loading keeps all 500 answer nodes',await ev('return a.graph.satellites.length===500&&new Set(a.nodes.map(n=>n.id)).size===a.nodes.length'))
  for i in range(12):
   metrics=await ev("""a.theta=arg*.5235987756;a.phi=.55+(arg%3)*.7;a.radius=a.targetRadius=145;a.cardsIds=[];a.lastPreviewRefresh=0;a.dirty=true;const start=performance.now();a.draw(start);return {view:arg,answers:a.graph.satellites.length,visible:a.screen.length,cards:a.visibleHolograms.length,overlaps:a.metrics.cardOverlaps,projectionShift:a.metrics.projectionShift,drawMs:performance.now()-start,finite:a.nodes.every(n=>Object.values(n.pos).every(Number.isFinite))};""",i)
   report['views500'].append(metrics)
  check('all twelve 500-answer views have finite coordinates and exact projection',all(x['finite'] and x['projectionShift']==0 for x in report['views500']))
  check('all twelve views honor eight-hologram budget',all(x['cards']<=8 for x in report['views500']))
  await page.screenshot(path=str(OUT/'overview-500.png'))
  await page.emulate_media(reduced_motion='reduce');await page.wait_for_timeout(100)
  check('system reduced-motion preference is respected',await ev('return a.reduced===true'))
  await page.set_viewport_size({'width':1024,'height':768});await page.wait_for_timeout(200)
  check('resized viewport remains operable',await ev('return a.w===1024&&a.h===768&&Number.isFinite(a.metrics.frameMs)'))
  check('no uncaught browser JavaScript exceptions',not report['errors'])
  report['draw500MedianMs']=statistics.median(x['drawMs'] for x in report['views500'])
  (OUT/'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
  print(json.dumps({'checks':len(report['checks']),'errors':report['errors'],'draw500MedianMs':report['draw500MedianMs']},ensure_ascii=False))
  await browser.close()
asyncio.run(main())

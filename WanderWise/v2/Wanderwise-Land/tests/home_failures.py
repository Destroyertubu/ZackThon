# Historical v1.1.0-home.1 browser script; expects the retired 2D interface.
# Current regression: tests/roaming_browser.py and tests/roaming_worker_browser.py.
"""Fault injection and rendering lifecycle tests in isolated browser contexts.
Fault responses and fixture world are test-only. Normal business HTTP is not replaced.
"""
import asyncio,json,struct
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/home-upgrade/evidence';BASE='http://127.0.0.1:18091'
checks=[];details={}
async def check(s):checks.append(s);print('PASS',s,flush=True)
async def main():
 async with async_playwright() as pw:
  b=await pw.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
  try:
   ctx=await b.new_context(viewport={'width':1440,'height':1000});p=await ctx.new_page()
   await p.route('**/home-full.glb',lambda r:r.abort('failed'))
   await p.goto(BASE+'/home');await p.wait_for_function('()=>wanderwiseDiagnostics().sceneState==="error"')
   before=await p.evaluate('wanderwiseDiagnostics().position');await p.keyboard.press('w');assert await p.evaluate('wanderwiseDiagnostics().position')==before
   await p.screenshot(path=str(OUT/'failure-recovery-ui.png'));await check('GLB failure gives bounded error and blocks movement')
   await p.unroute('**/home-full.glb');await p.locator('[data-action="retry-scene"]').click();await p.wait_for_function('()=>wanderwiseDiagnostics().sceneState==="ready"');await check('retry loads real model and reaches ready');await ctx.close()
   raw=(ROOT/'frontend/assets/home/home-full.glb').read_bytes();n=struct.unpack_from('<I',raw,12)[0];j=json.loads(raw[20:20+n]);j['images'][0].pop('bufferView',None);j['images'][0]['uri']='missing-qa-texture.png';encoded=json.dumps(j,separators=(',',':')).encode();encoded+=b' '*((-len(encoded))%4);tail=raw[20+n:];broken=struct.pack('<III',0x46546c67,2,20+len(encoded)+len(tail))+struct.pack('<II',len(encoded),0x4e4f534a)+encoded+tail
   ctx=await b.new_context(viewport={'width':1440,'height':1000});p=await ctx.new_page();await p.route('**/home-full.glb',lambda r:r.fulfill(status=200,body=broken,content_type='model/gltf-binary'))
   await p.goto(BASE+'/home');await p.wait_for_function('()=>wanderwiseDiagnostics().sceneState==="error"');assert '贴图' in await p.locator('#scene-load').inner_text();await p.locator('[data-action="fallback-2d"]').click();await p.locator('.two-d-home').wait_for();assert await p.evaluate('wanderwiseDiagnostics().renderer')=='2d';await check('missing texture is an error; 2D escape retains real UI');await ctx.close()
   ctx=await b.new_context(viewport={'width':1440,'height':1000});p=await ctx.new_page();await p.goto(BASE+'/home?mode=2d');await p.locator('.two-d-home').wait_for();urls=await p.evaluate('performance.getEntriesByType("resource").map(r=>r.name)');assert not any('/vendor/three/' in u or u.endswith('.glb') for u in urls);await check('2D cold boot downloads no renderer or models');await ctx.close()
   ctx=await b.new_context(viewport={'width':1440,'height':1000});p=await ctx.new_page();await p.goto(BASE+'/?renderer=legacy');await p.locator('[data-action="enter-home"]').click();await p.wait_for_function('()=>wanderwiseDiagnostics().page==="home"');assert await p.evaluate('wanderwiseDiagnostics().renderer')=='native-webgl2';assert 'renderer=legacy' in p.url;await p.reload();await p.wait_for_function('()=>wanderwiseDiagnostics().page==="home"');assert await p.evaluate('wanderwiseDiagnostics().renderer')=='native-webgl2';urls=await p.evaluate('performance.getEntriesByType("resource").map(r=>r.name)');assert not any('/vendor/three/' in u for u in urls);await check('legacy rollback stays exclusive through navigation and refresh');await ctx.close()
   # A dedicated engine fixture, not an application acceptance screenshot.
   ctx=await b.new_context(viewport={'width':1280,'height':720});p=await ctx.new_page();fixture_errors=[];p.on('pageerror',lambda e:fixture_errors.append(str(e)))
   await p.add_init_script('''(()=>{const old=requestAnimationFrame, cancel=cancelAnimationFrame;window.rafQA={pending:new Set(),max:0};window.requestAnimationFrame=cb=>{let id=old(t=>{rafQA.pending.delete(id);cb(t)});rafQA.pending.add(id);rafQA.max=Math.max(rafQA.max,rafQA.pending.size);return id};window.cancelAnimationFrame=id=>{rafQA.pending.delete(id);cancel(id)}})()''')
   await p.route('**/qa-lifecycle',lambda r:r.fulfill(content_type='text/html',body='<html><body style="margin:0"><canvas id="world" style="width:100vw;height:100vh"></canvas></body></html>'))
   await p.goto(BASE+'/qa-lifecycle')
   await p.evaluate('''async()=>{const {Engine}=await import('/static/engine/engine.js');window.e=new Engine(document.querySelector('canvas'));window.fixture={nodes:[{id:'qa-node',topicId:'qa-topic',title:'生命周期夹具',biome:'meadow',position:{x:0,y:0,z:-5},contentIds:[],excerptIds:[],expansionState:'expanded'}],walkableLinks:[],layoutSeed:731,spawn:{position:{x:0,y:0,z:3}}};await e.ready}''')
   async def delayed(route):
    await asyncio.sleep(.8)
    try:await route.continue_()
    except Exception:pass
   await p.route('**/home-full.glb',delayed)
   race=await p.evaluate('''async()=>{const home=e.setScene('home');await new Promise(r=>setTimeout(r,40));const world=e.setScene('world',fixture);return {home:await home,world:await world,kind:e.kind}}''');assert race=={'home':False,'world':True,'kind':'world'},race
   await p.wait_for_timeout(1100);assert await p.evaluate('e.kind')=='world';await check('cancelled late home load cannot replace newer world')
   await p.unroute('**/home-full.glb');await p.evaluate("e.setScene('home')")
   # Check raw frame time with a real main-thread stall, not simulated dt.
   await p.evaluate('()=>{const end=performance.now()+180;while(performance.now()<end){}}');await p.wait_for_timeout(100);assert await p.evaluate('e.frameTrace.some(x=>x[1]>150)');await check('performance trace retains slow frames above the physics dt cap')
   memories=[]
   for i in range(10):
    await p.evaluate("e.setScene('world',fixture)");await p.evaluate("e.setScene('home')");await p.wait_for_timeout(100);memories.append(await p.evaluate('({...e.renderer.webgl.info.memory,programs:e.renderer.webgl.info.programs.length})'))
   assert all(x==memories[1] for x in memories[1:]),memories
   assert await p.evaluate('rafQA.max')==1;details.update(resourceRoundTrips=memories,maxPendingRAF=await p.evaluate('rafQA.max'));await check('10 engine round trips keep GPU resources stable and one RAF')
   await p.route('**/home-full.glb',delayed);disposed=await p.evaluate('''async()=>{const load=e.setScene('home');e.dispose();return await load}''');assert disposed is False;await p.wait_for_timeout(1200);assert await p.evaluate('rafQA.pending.size')==0;assert not fixture_errors,fixture_errors;await check('dispose during load aborts work, releases RAF and causes no late exceptions');await ctx.close()
   # Rapid repeated Apply clicks: lazy engine construction remains single-flight.
   ctx=await b.new_context(viewport={'width':1440,'height':1000});p=await ctx.new_page();await p.goto(BASE+'/home?mode=2d');await p.locator('.two-d-home').wait_for();await p.locator('[data-action="settings"]').first.click();await p.locator('#setting-2d').uncheck();await p.locator('[data-action="apply-settings"]').click();await p.wait_for_function('()=>wanderwiseDiagnostics().renderer==="three-webgl2" && wanderwiseDiagnostics().sceneState==="ready"');assert await p.locator('canvas').count()==1;await check('2D to 3D lazy initialization restores a single renderer');await ctx.close()
   result={'status':'passed','checks':checks,'details':details,'browser':b.version,'note':'Fault responses and lifecycle fixture are isolated tests; the separate acceptance report covers real business flows.'}
  except Exception as e:result={'status':'failed','checks':checks,'details':details,'error':str(e)};print('FAIL',str(e),flush=True)
  finally:
   (OUT/'home-failures.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False),flush=True);await b.close()
asyncio.run(main())

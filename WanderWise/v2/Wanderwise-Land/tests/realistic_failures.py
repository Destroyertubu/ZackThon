"""Fault injection in the real app plus isolated engine lifecycle checks."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
OUT=Path('docs/realistic-home/evidence');checks=[];errors=[];details={};BASE='http://127.0.0.1:18093'
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
 ctx=b.new_context();page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/home-realistic-full.glb',lambda r:r.fulfill(status=503,body='controlled GLB failure'))
 page.goto(BASE+'/home');page.locator('[data-action="retry-scene"]').wait_for();assert page.locator('canvas').count()==1;assert page.locator('[data-action="fallback-2d"]').count()==0
 page.unroute('**/home-realistic-full.glb');page.locator('[data-action="retry-scene"]').click();page.wait_for_function('()=>wanderwiseDiagnostics().sceneState==="ready"');checks.append('GLB failure exposes bounded error and actual retry, no 2D fallback')
 page.evaluate("document.querySelector('canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()");page.locator('[data-action="retry-scene"]').wait_for();page.locator('[data-action="retry-scene"]').click();page.wait_for_function('()=>wanderwiseDiagnostics().sceneState==="ready"');assert page.locator('canvas').count()==1;checks.append('Actual WebGL context loss restores home and Rapier with one canvas');ctx.close()
 ctx=b.new_context();ctx.add_init_script("const original=HTMLImageElement.prototype.decode;const d=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');Object.defineProperty(HTMLImageElement.prototype,'src',{...d,set(v){d.set.call(this,v.startsWith('blob:')?'/missing-embedded-texture.jpg':v)}})")
 page=ctx.new_page();page.goto(BASE+'/home');page.locator('[data-action="retry-scene"]').wait_for(timeout=30000);assert page.evaluate('wanderwiseDiagnostics().sceneState')=='error';checks.append('Embedded texture failure becomes explicit load error, no silent textureless room');ctx.close()
 ctx=b.new_context();page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.route('**/lifecycle-fixture',lambda r:r.fulfill(content_type='text/html',body='<canvas style="width:1280px;height:720px"></canvas>'));page.goto(BASE+'/lifecycle-fixture')
 result=page.evaluate('''async()=>{const {Engine}=await import('/static/engine/engine.js');const world={nodes:[],walkableLinks:[],layoutSeed:1,spawn:{position:{x:0,y:0,z:0}}};const e=new Engine(document.querySelector('canvas'));await e.ready;const pending=e.setScene('home');await e.setScene('world',world);const late=await pending;if(late!==false||e.kind!=='world')throw Error('late scene won');await e.setScene('home',null,null,{position:{x:-.95,y:0,z:-4.23}});const safe={...e.player};const records=[];for(let i=0;i<10;i++){await e.setScene('world',world);await e.setScene('home');records.push({...e.renderer.webgl.info.memory});}const inFlight=e.setScene('home');e.dispose();const disposed=await inFlight;return {late,kind:'world before return',safe,records,disposed}}''')
 assert result['late']==False and result['disposed']==False;assert abs(result['safe']['x'])<.1;assert len({json.dumps(r,sort_keys=True) for r in result['records']})==1,result;checks.extend(['Rapid scene changes reject late GLB/physics installation','Restoring a checkpoint inside relocated furniture uses safe spawn','10 isolated home/world cycles keep GPU resource counts stable; disposal cancels pending home'])
 details['lifecycle']=result;assert not errors,errors;b.close()
 (OUT/'failure-checks.json').write_text(json.dumps({'status':'passed','checks':checks,'errors':errors,'details':details},ensure_ascii=False,indent=2));print(checks)

"""Worker lifecycle fault checks in a dedicated engine fixture, not business acceptance."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/roaming-update/evidence'
fixture={'nodes':[{'id':'one','topicId':'one','title':'生命周期测试','biome':'meadow','position':{'x':0,'y':0,'z':-5},'contentIds':[],'excerptIds':[],'expansionState':'expanded'}],'walkableLinks':[],'layoutSeed':731,'spawn':{'position':{'x':0,'y':0,'z':3}}}
checks=[];errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');ctx=b.new_context();page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('**/worker-fixture',lambda route:route.fulfill(content_type='text/html',body='<canvas style="width:1280px;height:720px"></canvas>'))
 page.goto('http://127.0.0.1:18091/worker-fixture')
 page.evaluate('''async world=>{window.fixture=world;window.audit={live:0,total:0};const Native=Worker;window.Worker=class extends Native{constructor(...a){super(...a);audit.live++;audit.total++}terminate(){if(!this.done){this.done=true;audit.live--}return super.terminate()}};const {Engine}=await import('/static/engine/engine.js');window.e=new Engine(document.querySelector('canvas'));await e.ready;await e.setScene('world',world)}''',fixture)
 # A slow fetch is allowed to finish after cancellation, but may not resurrect its scene.
 page.route('**/world-worker.js',lambda route:route.fulfill(status=503,body='worker unavailable'))
 bad=page.evaluate('''async()=>{const old=e.scene;e.active=true;try{await e.updateWorld(fixture);return {unexpected:true}}catch(error){return {same:old===e.scene,active:e.active,busy:e.busy,status:e.status,live:audit.live}}}''')
 assert bad=={'same':True,'active':True,'busy':False,'status':'ready','live':0},bad;checks.append('Failed worker keeps prior scene and movement, then terminates')
 page.unroute('**/world-worker.js')
 race=page.evaluate('''async()=>{const pending=e.updateWorld(fixture);const home=e.setScene('home');return {update:await pending,home:await home,kind:e.kind,workers:audit.live}}''')
 assert race=={'update':False,'home':True,'kind':'home','workers':0},race;checks.append('Rapid scene switch cancels expansion; late result cannot overwrite home')
 page.evaluate("e.setScene('world',fixture)")
 repeated=page.evaluate('''async()=>{const resources=[];e.active=true;e.camera={yaw:.43,pitch:.2,distance:4};e.keys.add('KeyQ');e.nearId='one';e.visited=true;e.visitedSeconds=7;for(let i=0;i<10;i++){if(!await e.updateWorld(fixture))throw Error('update cancelled');resources.push({...e.renderer.webgl.info.memory});}return {active:e.active,camera:e.camera,keys:[...e.keys],visited:e.visitedSeconds,resources,workers:audit.live}}''')
 assert repeated['active'];assert repeated['camera']=={'yaw':.43,'pitch':.2,'distance':4};assert repeated['keys']==['KeyQ'];assert repeated['visited']>=7;assert repeated['workers']==0;assert len({json.dumps(r,sort_keys=True) for r in repeated['resources']})==1,repeated;checks.append('10 worker updates preserve controls/visit state and stable GPU resource counts')
 disposed=page.evaluate('''async()=>{const pending=e.updateWorld(fixture);e.dispose();return {updated:await pending,workers:audit.live}}''');assert disposed=={'updated':False,'workers':0};checks.append('Disposal aborts in-flight worker without a late update')
 assert not errors,errors;b.close()
 result={'status':'passed','checks':checks,'errors':errors,'details':{'failure':bad,'race':race,'repeated':repeated,'disposed':disposed},'scope':'Dedicated engine fixture; separate roaming_browser.py exercises actual application and backend'};(OUT/'worker-checks.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False))

"""Options form UI against mocked Chrome APIs, not real permission/storage E2E."""
import asyncio,json,os,re
from pathlib import Path
from playwright.async_api import async_playwright
BASE=Path(__file__).resolve().parent.parent
async def main():
 async with async_playwright() as p:
  b=await p.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
  page=await b.new_page(viewport={'width':1080,'height':1000});errors=[]
  page.on('pageerror',lambda e:errors.append(str(e)))
  html=(BASE/'ai-settings.html').read_text();html=re.sub(r'<script.*?</script>','',html);html=re.sub(r'<link[^>]+>','',html)
  await page.set_content(html);await page.add_style_tag(content=(BASE/'ai-settings.css').read_text())
  await page.evaluate("""()=>{window.savedCalls=[];const presets={deepseek:{baseUrl:'https://api.deepseek.com',model:'deepseek-flash'},qwen:{baseUrl:'',model:'qwen-plus'},openai:{baseUrl:'https://api.openai.com/v1',model:''},custom:{baseUrl:'',model:''}};let c={provider:'deepseek',baseUrl:presets.deepseek.baseUrl,model:presets.deepseek.model,enabled:false,consent:false,auto:false,remember:false,jsonMode:true,threshold:.1,candidateLimit:12,timeout:22,hasKey:false,presets};window.chrome={permissions:{request:async r=>{savedCalls.push({kind:'permission',data:r});return true;}},runtime:{sendMessage:async m=>{savedCalls.push(m);if(m.type.endsWith('_SAVE')){const {apiKey,...rest}=m.data;c={...c,...rest,hasKey:!!apiKey};}if(m.type.endsWith('_RUN'))return {ok:true,data:{result:{ok:true},meta:{model:c.model,latencyMs:1}}};return {ok:true,data:c};}}};}""")
  await page.add_script_tag(content=(BASE/'ai-settings.js').read_text());await page.wait_for_timeout(100)
  assert await page.locator('[name="provider"]').input_value()=='deepseek'
  assert not await page.locator('[name="enabled"]').is_checked()
  await page.locator('[name="provider"]').select_option('qwen');assert await page.locator('[name="baseUrl"]').input_value()==''
  await page.locator('[name="provider"]').select_option('custom')
  await page.locator('[name="baseUrl"]').fill('https://fixture.invalid/v1');await page.locator('[name="model"]').fill('fixture-model')
  await page.locator('[name="apiKey"]').fill('FAKE-UI-TEST-NOT-A-CREDENTIAL');await page.locator('[name="consent"]').check();await page.locator('[name="enabled"]').check()
  await page.locator('#save').click();await page.wait_for_timeout(100)
  assert await page.locator('[name="apiKey"]').input_value()==''
  assert '已保存' in await page.locator('#status').inner_text()
  order=await page.evaluate("savedCalls.map(x=>x.kind||x.type)");assert order.index('permission')<order.index('ZH_GALAXY_AI_SAVE')
  await page.locator('#test').click();await page.wait_for_timeout(100)
  assert '连接成功' in await page.locator('#status').inner_text()
  assert not errors
  await page.screenshot(path=str(BASE/'tests/results/ai-settings-mock.png'),full_page=True)
  (BASE/'tests/results/options-report.json').write_text(json.dumps({'environment':'mock Chrome APIs; no real key or API used','checks':['defaults off','provider presets change base/model','Qwen asks for account endpoint','permission before save','key field cleared after save','test-connection button','no JS exceptions'],'errors':errors},ensure_ascii=False,indent=2))
  print('Options UI: 7 checks PASS (mock Chrome)');await b.close()
asyncio.run(main())

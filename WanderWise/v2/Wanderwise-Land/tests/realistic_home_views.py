"""Actual local Chrome screenshots. No mock business API, no offline renders."""
import json,sys,time
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'docs/realistic-home/evidence';stage=sys.argv[1] if len(sys.argv)>1 else 'corner';errors=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless=True)
 page=b.new_page(viewport={'width':1920,'height':1080},device_scale_factor=1);page.on('pageerror',lambda e:errors.append(str(e)));page.on('console',lambda msg:errors.append(msg.text) if msg.type=='error' else None)
 page.goto('http://127.0.0.1:18093/home?qa=1');page.wait_for_function('()=>window.wanderwiseDiagnostics?.().sceneState!=="loading"',timeout=30000)
 state=page.evaluate('wanderwiseDiagnostics()');print(json.dumps(state,ensure_ascii=False));
 if state['sceneState']!='ready':
  print(page.locator('body').inner_text());print(errors);page.screenshot(path=str(OUT/(stage+'-error.png')));sys.exit(1)
 views={'spawn':{'position':{'x':0,'y':0,'z':.65},'yaw':0,'pitch':.20,'distance':3.8},'diagonal':{'position':{'x':.3,'y':0,'z':.1},'yaw':.64,'pitch':.28,'distance':5.5},'reading':{'position':{'x':2.4,'y':0,'z':-1.0},'yaw':.55,'pitch':.05,'distance':2.3},'cabinet':{'position':{'x':-.7,'y':0,'z':-2.1},'yaw':-.08,'pitch':.10,'distance':2.6},'synthesis':{'position':{'x':-3.7,'y':0,'z':1.7},'yaw':.25,'pitch':.14,'distance':2.5},'phone':{'position':{'x':3.7,'y':0,'z':1.6},'yaw':-2.5,'pitch':.13,'distance':2.4},'hearth':{'position':{'x':2.5,'y':0,'z':.4},'yaw':-1.4,'pitch':.05,'distance':2.6}}
 for name,view in views.items():
  if stage=='corner' and name in ['synthesis','phone','hearth']:continue
  page.evaluate('v=>wanderwiseRenderQA.setView(v)',view);page.wait_for_timeout(650);page.screenshot(path=str(OUT/(stage+'-'+name+'.png')))
 report={'state':state,'inspection':page.evaluate('wanderwiseRenderQA.inspect()'),'browser':b.version,'errors':errors,'views':views};(OUT/(stage+'-views.json')).write_text(json.dumps(report,ensure_ascii=False,indent=2));print('ERRORS',errors);b.close()

import {cp, mkdir, rm, readFile, writeFile} from 'node:fs/promises';
await rm('dist', {recursive: true, force: true});
await mkdir('dist/static', {recursive: true});
await cp('frontend', 'dist/static', {recursive: true});
await cp('frontend/index.html', 'dist/index.html');
// Cloud wording is applied to the cloud artifact only; local Python distribution stays usable.
let app = await readFile('dist/static/app.js', 'utf8');
app = app.replaceAll('本地运行版 · 自带内容明确标记为演示', 'Netlify 云端版 · 自带内容明确标记为演示')
  .replaceAll('已保存到本机服务', '已保存到云端')
  .replaceAll('FastAPI / SQLite 后端', 'Netlify Functions / Blobs 后端')
  .replaceAll('第三方 Python 依赖按各自许可证使用', '第三方运行依赖按各自许可证使用');
await writeFile('dist/static/app.js', app);
await writeFile('dist/deploy-info.json', JSON.stringify({version: (await readFile('VERSION', 'utf8')).trim() + '-netlify-prepared', builtAt: new Date().toISOString(), persistence: 'Netlify Blobs'}, null, 2));
console.log('Netlify public artifact prepared (frontend assets only).');

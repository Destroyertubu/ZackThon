/** Same-origin only. An app secret never appears in this module or localStorage. */
export async function api(path, options = {}) {
    if (!path.startsWith('/api/'))
        throw new Error('只允许同源 API');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 28000);
    try {
        const res = await fetch(path, { credentials: 'same-origin', ...options, headers: { 'Content-Type': 'application/json', ...options.headers }, signal: controller.signal });
        const data = await res.json().catch(() => ({ detail: '服务器返回了无法识别的响应。' }));
        if (!res.ok) {
            const err = new Error(typeof data.detail === 'string' ? data.detail : '输入未通过校验。');
            err.status = res.status;
            throw err;
        }
        return data;
    }
    catch (e) {
        if (e.name === 'AbortError')
            throw new Error('请求超时。旅程仍保留在本地。');
        throw e;
    }
    finally {
        clearTimeout(timer);
    }
}
export const post = (p, v = {}) => api(p, { method: 'POST', body: JSON.stringify(v) });
export const put = (p, v) => api(p, { method: 'PUT', body: JSON.stringify(v) });
export const del = p => api(p, { method: 'DELETE' });
let dbPromise;
function database() {
    return dbPromise ??= new Promise((resolve, reject) => {
        const request = indexedDB.open('zhiye-local-v1', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('backups');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
export async function localSave(value) {
    const db = await database();
    return new Promise((resolve, reject) => { const tx = db.transaction('backups', 'readwrite'); tx.objectStore('backups').put(value, 'latest'); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
}
export async function localLoad() {
    const db = await database();
    return new Promise((resolve, reject) => { const r = db.transaction('backups').objectStore('backups').get('latest'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
}
export async function localErase() {
    const db = await database();
    return new Promise((resolve, reject) => { const tx = db.transaction('backups', 'readwrite'); tx.objectStore('backups').clear(); tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); });
}
export function download(name, data, type = 'text/plain;charset=utf-8') {
    const url = URL.createObjectURL(new Blob([data], { type }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

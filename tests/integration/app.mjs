// Εκκίνηση όλης της εφαρμογής (index.html, scripts, main.js) σε jsdom. Επιστρέφει { w, errors, tick }.
import { JSDOM } from 'jsdom';
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
export async function bootApp(dir) {
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  const dom = new JSDOM(html.replace(/<script[\s\S]*?<\/script>/g, ''), { pretendToBeVisual: true, url: 'http://localhost/' });
  const w = dom.window;
  for (const k of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'localStorage', 'File', 'FileReader', 'Blob', 'Event', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle', 'URL'])
    try { globalThis[k] = k === 'window' ? w : w[k]; } catch {}
  globalThis.alert = w.alert = () => {}; globalThis.prompt = w.prompt = (_, d) => d ?? ''; globalThis.confirm = w.confirm = () => true;
  globalThis.requestAnimationFrame = w.requestAnimationFrame = f => setTimeout(f, 16);
  w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {};
  w.HTMLAnchorElement.prototype.click = function () {};
  globalThis.fetch = w.fetch = async (u) => {
    const p = path.join(dir, String(u));
    if (!fs.existsSync(p)) return { ok: false, status: 404, json: async () => ({}) };
    return { ok: true, json: async () => JSON.parse(fs.readFileSync(p, 'utf8')) };
  };
  const errors = [];
  const quiet = () => {};
  console.log = quiet; console.warn = quiet; console.info = quiet; console.trace = quiet; console.debug = quiet; console.group = quiet; console.groupEnd = quiet; console.table = quiet;
  console.error = (...a) => { const m = a.map(x => x?.stack ?? String(x)).join(' '); if (!m.includes('[DEBUG] initializeEventListeners')) errors.push(m.slice(0, 400)); };
  process.removeAllListeners('uncaughtException'); process.removeAllListeners('unhandledRejection');
  process.on('uncaughtException', e => errors.push('UNCAUGHT ' + (e.stack ?? e).toString().slice(0, 400)));
  process.on('unhandledRejection', e => errors.push('REJECTION ' + (e?.stack ?? e).toString().slice(0, 400)));
  // Το δικό του DOMContentLoaded το jsdom το στέλνει πρώτα. Τα scripts τρέχουν μετά και η εφαρμογή
  // παίρνει ένα μόνο DOMContentLoaded (το δικό μας), όπως στον browser.
  if (w.document.readyState === 'loading') await new Promise(r => w.document.addEventListener('DOMContentLoaded', r));
  const inline = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  // classic scripts in order
  for (const src of [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(m => m[1])) {
    new Function('window', 'document', fs.readFileSync(path.join(dir, src), 'utf8') + ';' +
      (src.includes('workspace-manager') ? 'window.WorkspaceManager=WorkspaceManager;' : ''))(w, w.document);
  }
  for (const code of inline) { try { new Function('window', 'document', code)(w, w.document); } catch (e) { errors.push('INLINE ' + e.message); } }
  for (const src of [...html.matchAll(/<script type="module" src="([^"]+)"><\/script>/g)].map(m => m[1]))
    await import(pathToFileURL(path.join(dir, src)).href);
  w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
  const tick = (ms = 50) => new Promise(r => setTimeout(r, ms));
  await tick(2500);
  return { w, errors, tick };
}

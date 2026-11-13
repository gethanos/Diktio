// Εκτέλεση: node tests/integration/smoke.mjs [repo-dir]   (εκκινεί όλη την εφαρμογή σε jsdom)

import { JSDOM } from 'jsdom';
import fs from 'node:fs'; import path from 'node:path'; import { pathToFileURL } from 'node:url';
const dir = process.argv[2] ?? '.';
const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8').replace(/<script[\s\S]*?<\/script>/g, '');
const dom = new JSDOM(html, { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
for (const k of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'localStorage', 'File', 'FileReader', 'Blob', 'Event', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle'])
  try { globalThis[k] = k === 'window' ? w : w[k]; } catch {}
globalThis.alert = w.alert = () => {}; globalThis.prompt = w.prompt = (_, d) => d; globalThis.confirm = w.confirm = () => true;
globalThis.requestAnimationFrame = w.requestAnimationFrame = f => setTimeout(f, 16);
globalThis.fetch = w.fetch = async (u) => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(dir, String(u)), 'utf8')) });
const errors = [];
const origErr = console.error; console.log = () => {}; console.warn = () => {}; console.info = () => {}; console.trace = () => {};
console.error = (...a) => errors.push(a.map(String).join(' ').slice(0, 200));
process.on('uncaughtException', e => errors.push('UNCAUGHT ' + e.message));
// inline CONFIG script from index.html
const cfg = fs.readFileSync(path.join(dir, 'index.html'), 'utf8').match(/<script>\s*(\/\/[^\n]*\n)?\s*window\.CONFIG[\s\S]*?<\/script>/);
if (cfg) new Function('window', cfg[0].replace(/<\/?script>/g, ''))(w);
new Function('window', 'document', fs.readFileSync(path.join(dir, 'assets/js/workspace-manager.js'), 'utf8') + ';window.WorkspaceManager=WorkspaceManager;')(w, w.document);
await import(pathToFileURL(path.join(dir, 'assets/js/main.js')).href);
w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
await new Promise(r => setTimeout(r, 2500));
const sim = w.simulator;
const dm = w.deviceManager;
const out = { devices: dm?.devices.length, errors };
if (sim && dm) {
  const by = t => dm.devices.find(d => d.type === t);
  const pc = by('computer'), srv = by('server'), dns = by('dns');
  try { out.pingPcServer = sim.simulationManager.testPing(pc, srv)?.success; } catch (e) { out.pingPcServer = 'THROW ' + e.message; }
  try { out.autoDNS = typeof sim.testAutoDNS === 'function' ? (sim.testAutoDNS(), 'ran') : 'missing'; } catch (e) { out.autoDNS = 'THROW ' + e.message; }
  try {
    const ui = sim.uiManager;
    const recs = sim.dnsManager.globalDnsRecords;
    const domain = Object.keys(recs).find(k => dm.getDeviceByIP(recs[k]));
    globalThis.prompt = w.prompt = () => domain;
    ui.manualDNSMode = true; ui.dnsSourceDevice = null;
    ui.handleManualDNSModeClick(pc); ui.handleManualDNSModeClick(dns);
    out.manualDNSDomain = domain;
  } catch (e) { out.manualDNS = 'THROW ' + e.message; }
  try { out.autoRoutes = typeof sim.autoConfigureRouting; } catch {}
}
await new Promise(r => setTimeout(r, 3000));
origErr(JSON.stringify(out, null, 1));
process.exit(0);

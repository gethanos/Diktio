// Συμβατότητα αρχείων: εξάγει workspace με τον κώδικα του <old-dir> και φορτώνει όλα τα data/models σε <old-dir> και <new-dir>.
// Εκτέλεση: node tests/integration/compat.mjs <old-dir> <new-dir>

import { loadBranch } from './env.mjs';
import fs from 'node:fs'; import path from 'node:path';
const [mainDir, propDir] = process.argv.slice(2);
async function wsEnv(dir) {
  const env = await loadBranch(dir);
  const { w, dm, cm } = env;
  for (const k of ['FileReader', 'File', 'Blob']) globalThis[k] = w[k];
  const WM = new Function(fs.readFileSync(path.join(dir, 'assets/js/workspace-manager.js'), 'utf8') + ';return WorkspaceManager;')();
  const ws = w.document.getElementById('workspace');
  const notes = [];
  const sim = { deviceManager: dm, connectionManager: cm, dnsManager: { globalDnsRecords: {} },
    uiManager: { workspace: ws, buttons: {}, addLog: (m, t) => notes.push(`${t}: ${m}`), setModeText() {}, updateDeviceInfo() {}, updateNetworkStats() {},
      addDeviceToWorkspace: (t, c) => dm.addDevice(t, c, 0, 0, ws) },
    clearWorkspace() { dm.devices.forEach(d => d.element.remove()); dm.devices = []; dm.deviceCounter = 1; cm.clearAllConnections(); } };
  const wm = new WM(sim); wm.showNotification = (m, t) => notes.push(`notify ${t}: ${m}`);
  const load = async json => { const r = await wm.loadFromFile({ target: { files: [new w.File([JSON.stringify(json)], 'x.json')] } }); await new Promise(r => setTimeout(r, 1500)); return r; };
  return { ...env, wm, load, notes };
}
// 1) Export a workspace with OLD main code (user-saved file format)
const old = await wsEnv(mainDir);
{
  const { router, add, host, link, fix, cm } = old;
  const r = router(); const s1 = add('switch'), s2 = add('switch');
  const cloud = add('cloud', { ip: '203.0.113.1' });
  const a = host('192.168.1.10', '255.255.255.0', '192.168.1.1'), b = host('192.168.2.20', '255.255.255.0', '192.168.2.1');
  link(r, s1, 'lan'); link(r, s2, 'lan2'); link(r, cloud, 'wan'); link(a, s1); link(b, s2);
  fix(a, { ip: '192.168.1.10', gateway: '192.168.1.1' }); fix(b, { ip: '192.168.2.20', gateway: '192.168.2.1' });
  Object.assign(r.interfaces.wan, { ip: '203.0.113.10', gateway: '203.0.113.1' });
  cm.autoGenerateRoutesForRouter(r);
  old.dm.removeDevice?.(old.dm.devices.find(d => d.type === 'switch' && d !== s1 && d !== s2) ?? { connections: [], element: { remove() {} } });
}
const exported = JSON.parse(JSON.stringify(old.wm.exportWorkspace('old-export')));
const pings = (env, pairs) => pairs.map(([x, y]) => {
  const f = n => env.dm.devices.find(d => d.name === n || d.ip === n);
  const X = f(x), Y = f(y);
  if (!X || !Y) return `${x}->${y}: device missing`;
  const r = env.sm.testPing(X, Y);
  return `${x}->${y}: ${r.success ? 'ok' : 'fail ' + (r.reason ?? '')}`;
});
const cases = [['old main export', exported, [['192.168.1.10', '192.168.2.20'], ['192.168.2.20', '203.0.113.1']]]];
const explicit = {
  'Office_with_2_Subnets_a_Router_Internet.json': [['Server 9', 'Υπολογιστής 7'], ['Υπολογιστής 7', 'Cloud (WAN) 2'], ['Υπολογιστής 7', 'Υπολογιστής 8'], ['DNS Server 11', 'Εκτυπωτής 12']],
  'predefined-wan.json': [['Υπολογιστής 4', 'Cloud (WAN) 1'], ['Υπολογιστής 4', 'Server 5']],
  'simple-wan.json': [['Υπολογιστής', 'Internet']],
};
for (const f of fs.readdirSync(path.join(mainDir, 'data/models')).filter(f => f !== 'list.json'))
  cases.push([f, JSON.parse(fs.readFileSync(path.join(mainDir, 'data/models', f), 'utf8')), explicit[f] ?? null]);
for (const [name, json, pairs] of cases) {
  for (const [label, dir] of [['main', mainDir], ['proposed', propDir]]) {
    const env = await wsEnv(dir);
    let ok; try { ok = await env.load(json); } catch (e) { ok = 'THROW ' + e.message; }
    const hosts = env.dm.devices.filter(d => d.type !== 'switch' && d.type !== 'router');
    const routerPorts = env.dm.devices.filter(d => d.type === 'router').map(r => Object.values(r.connectionInterfaces || {}).join('/')).join(' ');
    const auto = pairs ?? hosts.slice(0, 4).flatMap((h, i, arr) => arr.slice(i + 1).map(o => [h.name, o.name])).slice(0, 4);
    process.stdout.write(`\n[${name}] ${label}: devices=${env.dm.devices.length} conns=${env.cm.connections.length} routerPorts=${routerPorts || '-'}\n  ${pings(env, auto).join('\n  ')}\n  ${env.notes.filter(n => /warning|error/.test(n)).join('\n  ')}\n`);
  }
}
process.exit(0);

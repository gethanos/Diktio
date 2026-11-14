// Εκτέλεση: node tests/integration/scenarios.mjs [repo-dir] [label]   (απαιτεί: npm install)

import { loadBranch } from './env.mjs';

const dir = process.argv[2] ?? '.';
const label = process.argv[3] ?? 'current';
const results = [];
const out = (name, expected, actual) => results.push({ name, expected, actual, ok: expected === actual });
const M24 = '255.255.255.0';

async function scenario(name, build) {
  const env = await loadBranch(dir);
  try { await build(env, (n, e, a) => out(`${name}: ${n}`, e, a)); }
  catch (e) { out(`${name}: (setup)`, 'no throw', 'THROW ' + e.message.split('\n')[0]); }
}

// ---------- pure network-core ----------
await scenario('core', async ({ core }, t) => {
  t('getNetworkInfo /24 usableHosts', 254, core.getNetworkInfo('192.168.1.10', M24).usableHosts);
  t('getNetworkInfo /24 broadcast', '192.168.1.255', core.getNetworkInfo('192.168.1.10', M24).broadcast);
  t('getNetworkInfo 10.0.0.0/8 usableHosts', 16777214, core.getNetworkInfo('10.1.2.3', '255.0.0.0').usableHosts);
  t('areInSameNetwork order-independent (/16 vs /24)', true,
    core.areInSameNetwork('192.168.1.10', '192.168.2.20', '255.255.0.0', M24) ===
    core.areInSameNetwork('192.168.2.20', '192.168.1.10', M24, '255.255.0.0'));
  t('getNetworkInfo /31 usableHosts (RFC 3021)', 2, core.getNetworkInfo('10.0.0.0', '255.255.255.254')?.usableHosts);
  t('isValidIP rejects "1.2.3.4x"', false, core.isValidIP('1.2.3.4x'));
  t('isValidSubnetMask rejects 255.0.255.0', false, core.isValidSubnetMask('255.0.255.0'));
  t('subnetMaskToCIDR 255.255.255.192', 26, core.subnetMaskToCIDR('255.255.255.192'));
  t('generateRandomIP never returns network/broadcast (/30)', true,
    Array.from({ length: 200 }, () => core.generateRandomIP('10.0.0.0', '255.255.255.252'))
      .every(ip => ip === '10.0.0.1' || ip === '10.0.0.2'));
});

// ---------- L2 ----------
await scenario('S1 same subnet, one switch', async ({ host, add, link, ping }, t) => {
  const a = host('192.168.1.10'), b = host('192.168.1.20'), sw = add('switch');
  link(a, sw); link(b, sw);
  t('a->b', true, ping(a, b));
});
await scenario('S2 same subnet, two cascaded switches', async ({ host, add, link, ping }, t) => {
  const a = host('192.168.1.10'), b = host('192.168.1.20'), s1 = add('switch'), s2 = add('switch');
  link(a, s1); link(s1, s2); link(s2, b);
  t('a->b', true, ping(a, b));
});
await scenario('S3 different subnets, same switch, no gateway', async ({ host, add, link, ping }, t) => {
  const a = host('192.168.1.10'), b = host('192.168.2.20'), sw = add('switch');
  link(a, sw); link(b, sw);
  t('a->b', false, ping(a, b));
});
await scenario('S4 mismatched masks on one switch, no gateways', async ({ host, add, link, ping }, t) => {
  // A thinks B is on-link (/16) but B (/24) cannot reply without a gateway.
  const a = host('192.168.1.10', '255.255.0.0'), b = host('192.168.2.20', M24), sw = add('switch');
  link(a, sw); link(b, sw);
  t('a->b', false, ping(a, b));
  t('b->a', false, ping(b, a));
});
await scenario('S5 host directly cabled to host', async ({ host, link, ping }, t) => {
  const a = host('192.168.1.10'), b = host('192.168.1.20');
  link(a, b);
  t('a->b', true, ping(a, b));
});

// ---------- one router, two LANs ----------
async function twoLans(env, gwB = '192.168.2.1') {
  const { host, add, router, link, fix } = env;
  const r = router();
  const s1 = add('switch'), s2 = add('switch');
  const a = host('192.168.1.10', M24, '192.168.1.1');
  const b = host('192.168.2.20', M24, gwB);
  link(r, s1, 'lan'); link(r, s2, 'lan2'); link(a, s1); link(b, s2);
  fix(a, { ip: '192.168.1.10', subnetMask: M24, gateway: '192.168.1.1' });
  fix(b, { ip: '192.168.2.20', subnetMask: M24, gateway: gwB });
  return { r, s1, s2, a, b };
}
await scenario('S6 inter-LAN via router', async (env, t) => {
  const { r, a, b } = await twoLans(env);
  t('a->b', true, env.ping(a, b));
  t('b->a', true, env.ping(b, a));
  t('router->b (LAN2 host)', true, env.ping(r, b));
  t('b->router (its gateway)', true, env.ping(b, r));
  t('router.ip not mutated', undefined, r.ip);
});
await scenario('S7 inter-LAN, B has no gateway (no return path)', async (env, t) => {
  const { a, b } = await twoLans(env, '0.0.0.0');
  t('a->b', false, env.ping(a, b));
});
await scenario('S8 gateway not on-link', async (env, t) => {
  const { a, b } = await twoLans(env);
  env.fix(a, { gateway: '192.168.2.1' }); // router LAN2 address, not on A's subnet
  t('a->b', false, env.ping(a, b));
});
await scenario('S9 same subnet split across router interfaces', async (env, t) => {
  const { a, s2 } = await twoLans(env);
  const c = env.host('192.168.1.30', M24, '192.168.1.1');
  env.link(c, s2);
  env.fix(c, { ip: '192.168.1.30', subnetMask: M24, gateway: '192.168.1.1' });
  t('a->c (routers do not bridge)', false, env.ping(a, c));
});
await scenario('S10 LAN2 disabled', async (env, t) => {
  const { r, a, b } = await twoLans(env);
  r.interfaces.lan2.enabled = false;
  t('a->b', false, env.ping(a, b));
});

// ---------- two routers ----------
async function twoRouters(env, withRoutes) {
  const { host, add, router, link, fix } = env;
  const r1 = router({ lan: { ip: '192.168.1.1', subnetMask: M24 }, wan: { ip: '10.0.0.1', subnetMask: '255.255.255.252', gateway: '0.0.0.0' } });
  const r2 = router({ lan: { ip: '192.168.3.1', subnetMask: M24 }, wan: { ip: '10.0.0.2', subnetMask: '255.255.255.252', gateway: '0.0.0.0' } });
  const s1 = add('switch'), s3 = add('switch');
  const a = host('192.168.1.10', M24, '192.168.1.1');
  const c = host('192.168.3.30', M24, '192.168.3.1');
  link(r1, s1, 'lan'); link(r2, s3, 'lan'); link(a, s1); link(c, s3);
  env.cm.createRouterToRouterConnectionWithInterfaces?.(r1, r2, 'wan', 'wan');
  // re-apply addressing
  Object.assign(r1.interfaces.wan, { ip: '10.0.0.1', subnetMask: '255.255.255.252', gateway: '0.0.0.0' });
  Object.assign(r2.interfaces.wan, { ip: '10.0.0.2', subnetMask: '255.255.255.252', gateway: '0.0.0.0' });
  fix(a, { ip: '192.168.1.10', subnetMask: M24, gateway: '192.168.1.1' });
  fix(c, { ip: '192.168.3.30', subnetMask: M24, gateway: '192.168.3.1' });
  r1.routingTable = withRoutes ? [{ network: '192.168.3.0', mask: M24, gateway: '10.0.0.2', interface: 'wan', metric: 1 }] : [];
  r2.routingTable = withRoutes ? [{ network: '192.168.1.0', mask: M24, gateway: '10.0.0.1', interface: 'wan', metric: 1 }] : [];
  return { r1, r2, a, c };
}
await scenario('S11 two routers, NO routes', async (env, t) => {
  const { a, c } = await twoRouters(env, false);
  t('a->c', false, env.ping(a, c));
});
await scenario('S12 two routers, static routes both ways', async (env, t) => {
  const { a, c } = await twoRouters(env, true);
  t('a->c', true, env.ping(a, c));
  t('c->a', true, env.ping(c, a));
});

// ---------- device manager ----------
await scenario('D1 duplicate IP: router LAN IP reused by a host on the same LAN', async ({ dm, cm, router, host, add, link, fix }, t) => {
  const r = router(); const sw = add('switch'); const h = host('192.168.1.1');
  link(r, sw, 'lan'); link(h, sw); fix(h, { ip: '192.168.1.1', subnetMask: M24 });
  const flagged = cm.findIPConflicts ? cm.findIPConflicts().has(r) : dm.checkForDuplicateIP('192.168.1.1', M24, null).hasDuplicate;
  t('flagged', true, flagged);
});
await scenario('D1b same IP in two isolated LANs is NOT a conflict', async ({ dm, cm, host, add, link }, t) => {
  const a = host('192.168.1.10'), b = host('192.168.1.10'), s1 = add('switch'), s2 = add('switch');
  link(a, s1); link(b, s2);
  const flagged = cm.findIPConflicts ? cm.findIPConflicts().size > 0 : dm.checkForDuplicateIP('192.168.1.10', M24, null).hasDuplicate;
  t('not flagged', false, flagged);
});
await scenario('D1c same IP on one switch: ping fails', async ({ host, add, link, ping }, t) => {
  const a = host('192.168.1.10'), b = host('192.168.1.20'), c = host('192.168.1.20'), sw = add('switch');
  link(a, sw); link(b, sw); link(c, sw);
  t('a->b', false, ping(a, b));
});
await scenario('D2 getDeviceByIP has no side effects', async ({ dm, router }, t) => {
  const r = router();
  dm.getDeviceByIP('192.168.2.1');
  t('router.ip still undefined', undefined, r.ip);
});
await scenario('D3 mask validation in config', async ({ dm, host }, t) => {
  const a = host('192.168.1.10');
  const r = dm.updateDeviceConfig(a, { ip: '192.168.1.10', subnet: '255.0.255.0' });
  t('255.0.255.0 rejected', false, r.success);
});
await scenario('D4 new host does not take router IP', async ({ router, add }, t) => {
  const r = router({ lan: { ip: '10.0.0.1', subnetMask: '255.255.255.252' } });
  const ips = Array.from({ length: 30 }, () => add('computer').ip);
  t('no host gets 10.0.0.1 or net/broadcast', true, ips.every(ip => ip === '10.0.0.2' || ip === 'N/A'));
  t('the one free address is used once', 1, ips.filter(ip => ip === '10.0.0.2').length);
  t('host mask follows router mask', '255.255.255.252', add('computer').subnetMask);
});


// ---------- Internet / NAT ----------
async function internet(env) {
  const { host, add, router, link, fix } = env;
  const r = router({ wan: { ip: '203.0.113.10', subnetMask: M24, gateway: '203.0.113.1' } });
  const cloud = add('cloud', { ip: '203.0.113.1', subnetMask: M24, gateway: '0.0.0.0' });
  const sw = add('switch'); const a = host('192.168.1.10', M24, '192.168.1.1');
  link(r, cloud, 'wan'); link(r, sw, 'lan'); link(a, sw);
  fix(cloud, { ip: '203.0.113.1', subnetMask: M24, gateway: '0.0.0.0' });
  fix(a, { ip: '192.168.1.10', subnetMask: M24, gateway: '192.168.1.1' });
  Object.assign(r.interfaces.wan, { ip: '203.0.113.10', subnetMask: M24, gateway: '203.0.113.1' });
  return { r, cloud, a };
}
await scenario('S13 LAN host to Internet (NAT)', async (env, t) => {
  const { a, cloud } = await internet(env);
  t('a->cloud', true, env.ping(a, cloud));
  t('cloud->a (private, no inbound route)', false, env.ping(cloud, a));
});
await scenario('S14 routing loop terminates', async (env, t) => {
  const { r1, r2, a } = await twoRouters(env, false);
  r1.routingTable = [{ network: '172.16.0.0', mask: M24, gateway: '10.0.0.2', interface: 'wan', metric: 1 }];
  r2.routingTable = [{ network: '172.16.0.0', mask: M24, gateway: '10.0.0.1', interface: 'wan', metric: 1 }];
  const ghost = env.host('172.16.0.5', M24, '0.0.0.0');
  t('a->ghost fails without hanging', false, env.ping(a, ghost));
});
await scenario('S15 auto-generated routes, router behind router', async (env, t) => {
  const { host, add, router, link, fix, cm } = env;
  const r1 = router({ wan: { ip: 'N/A' } });
  const r2 = router({ wan: { ip: '192.168.1.2', subnetMask: M24, gateway: '192.168.1.1' }, lan: { ip: '192.168.3.1', subnetMask: M24 } });
  r2.interfaces.lan2.enabled = false;
  const s1 = add('switch'), s3 = add('switch');
  const a = host('192.168.1.10', M24, '192.168.1.1'), c = host('192.168.3.30', M24, '192.168.3.1');
  link(r1, s1, 'lan'); link(r2, s1, 'wan'); link(r2, s3, 'lan'); link(a, s1); link(c, s3);
  fix(a, { ip: '192.168.1.10', subnetMask: M24, gateway: '192.168.1.1' });
  fix(c, { ip: '192.168.3.30', subnetMask: M24, gateway: '192.168.3.1' });
  Object.assign(r2.interfaces.wan, { ip: '192.168.1.2', subnetMask: M24, gateway: '192.168.1.1' });
  r1.routingTable = []; r2.routingTable = [];
  const added = cm.autoGenerateRoutesForRouter(r1); cm.autoGenerateRoutesForRouter(r2);
  t('returns an array', true, Array.isArray(added));
  t('no route uses a host as next hop', true, [...r1.routingTable, ...r2.routingTable]
    .every(rt => rt.gateway === '0.0.0.0' || ['192.168.1.1', '192.168.1.2'].includes(rt.gateway)));
  t('a->c', true, env.ping(a, c));
  t('c->a', true, env.ping(c, a));
});

// ---------- workspace ----------
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
async function workspaceEnv(env) {
  const { w, dm, cm } = env;
  for (const k of ['FileReader', 'File', 'Blob']) globalThis[k] = w[k];
  const src = fs.readFileSync(path.join(dir, 'assets/js/workspace-manager.js'), 'utf8');
  const WorkspaceManager = new Function(src + '; return WorkspaceManager;')();
  const ws = w.document.getElementById('workspace');
  const simulator = {
    deviceManager: dm, connectionManager: cm, dnsManager: new (await import(pathToFileURL(path.join(dir, 'assets/js/dns.js')).href)).default(),
    uiManager: { workspace: ws, buttons: {}, addLog() {}, setModeText() {}, updateDeviceInfo() {}, updateNetworkStats() {},
      addDeviceToWorkspace: (type, color) => dm.addDevice(type, color, 0, 0, ws) },
    clearWorkspace() { dm.devices.forEach(d => d.element.remove()); dm.devices = []; dm.deviceCounter = 1; cm.clearAllConnections(); }
  };
  const wm = new WorkspaceManager(simulator);
  wm.showNotification = () => {};
  const load = async (json) => wm.loadFromFile({ target: { files: [new w.File([JSON.stringify(json)], 'x.json')] } });
  return { wm, load };
}
const model = f => JSON.parse(fs.readFileSync(path.join(dir, 'data/models', f), 'utf8'));
const byName = (dm, name) => dm.devices.find(d => d.name === name);

await scenario('W1 loadFromFile completes before resolving', async (env, t) => {
  const { load } = await workspaceEnv(env);
  await load(model('Office_with_2_Subnets_a_Router_Internet.json'));
  t('10 devices restored when await returns', 10, env.dm.devices.length);
});
await scenario('W2 no device id collision after load', async (env, t) => {
  const { load } = await workspaceEnv(env);
  await load(model('Office_with_2_Subnets_a_Router_Internet.json'));
  await new Promise(r => setTimeout(r, 1500));
  for (let i = 0; i < 6; i++) env.add('computer');
  t('ids unique', env.dm.devices.length, new Set(env.dm.devices.map(d => d.id)).size);
});
await scenario('W3 invalid file keeps current workspace', async (env, t) => {
  const { load } = await workspaceEnv(env);
  env.host('192.168.1.10'); env.host('192.168.1.20');
  await load({ devices: [{ id: 'device-1', type: 'toaster' }] });
  await new Promise(r => setTimeout(r, 500));
  t('2 devices still present', 2, env.dm.devices.length);
});
await scenario('W4 Office model behaves per theory', async (env, t) => {
  const { load } = await workspaceEnv(env);
  await load(model('Office_with_2_Subnets_a_Router_Internet.json'));
  await new Promise(r => setTimeout(r, 1500));
  const dm = env.dm, p = n => byName(dm, n);
  t('Server 9 (LAN) -> PC 7 (LAN2)', true, env.ping(p('Server 9'), p('Υπολογιστής 7')));
  t('PC 7 (LAN2) -> Cloud', true, env.ping(p('Υπολογιστής 7'), p('Cloud (WAN) 2')));
  t('PC 7 -> PC 8 (same LAN2 switch)', true, env.ping(p('Υπολογιστής 7'), p('Υπολογιστής 8')));
});
await scenario('W5 2_subnets_switch model', async (env, t) => {
  const { load } = await workspaceEnv(env);
  await load(model('2_subnets_switch.json'));
  await new Promise(r => setTimeout(r, 1500));
  const p = n => byName(env.dm, n);
  t('PC2 -> PC3 (same subnet)', true, env.ping(p('Υπολογιστής 2'), p('Υπολογιστής 3')));
  t('PC2 -> PC5 (other subnet, no router)', false, env.ping(p('Υπολογιστής 2'), p('Υπολογιστής 5')));
});
await scenario('W6 simple-wan model (no stored router ports)', async (env, t) => {
  const { load } = await workspaceEnv(env);
  await load(model('simple-wan.json'));
  await new Promise(r => setTimeout(r, 1500));
  const p = n => byName(env.dm, n);
  t('PC -> Internet', true, env.ping(p('Υπολογιστής'), p('Internet')));
});

await scenario('W7 Firewall_Protected_Server model', async (env, t) => {
  const { load } = await workspaceEnv(env);
  await load(model('Firewall_Protected_Server.json'));
  await new Promise(r => setTimeout(r, 1500));
  const p = n => byName(env.dm, n);
  const service = (a, b, protocol, port) => env.cm.canDevicesCommunicateWithPath(p(a), p(b), { protocol, port }).canCommunicate;
  t('PC1 -> Web Server ping (inbound ICMP denied)', false, env.ping(p('Υπολογιστής 1'), p('Web Server')));
  t('PC1 -> Web Server tcp/80 (rule allows)', true, service('Υπολογιστής 1', 'Web Server', 'tcp', 80));
  t('PC1 -> Web Server tcp/22 (policy denies)', false, service('Υπολογιστής 1', 'Web Server', 'tcp', 22));
  t('PC1 -> DNS Server udp/53 (rule allows)', true, service('Υπολογιστής 1', 'DNS Server', 'udp', 53));
  t('Web Server -> PC1 ping (outbound + reply)', true, env.ping(p('Web Server'), p('Υπολογιστής 1')));
  t('Web Server -> Internet ping', true, env.ping(p('Web Server'), p('Internet')));
  t('PC1 -> Internet ping (NAT)', true, env.ping(p('Υπολογιστής 1'), p('Internet')));
});
await scenario('W8 Two_Offices_Static_Routing model', async (env, t) => {
  const { load } = await workspaceEnv(env);
  await load(model('Two_Offices_Static_Routing.json'));
  await new Promise(r => setTimeout(r, 1500));
  const p = n => byName(env.dm, n);
  t('A1 -> B1', true, env.ping(p('Υπολογιστής Α1'), p('Υπολογιστής Β1')));
  t('Server B -> Printer A', true, env.ping(p('Server Β'), p('Εκτυπωτής Α')));
  p('Router Θεσσαλονίκη').routingTable = [];
  t('A1 -> B1 without the return route', false, env.ping(p('Υπολογιστής Α1'), p('Υπολογιστής Β1')));
});

await scenario('W9 predefined LAN and LAN+Internet models', async (env, t) => {
  const { load } = await workspaceEnv(env);
  await load(model('predefined-lan.json'));
  await new Promise(r => setTimeout(r, 1500));
  const p = n => byName(env.dm, n);
  t('LAN: PC -> DNS Server', true, env.ping(p('Υπολογιστής 3'), p('DNS Server 5')));
  await load(model('predefined-wan.json'));
  await new Promise(r => setTimeout(r, 1500));
  t('WAN: PC -> Cloud (NAT)', true, env.ping(p('Υπολογιστής 4'), p('Cloud (WAN) 1')));
  t('WAN: Cloud -> PC (no inbound)', false, env.ping(p('Cloud (WAN) 1'), p('Υπολογιστής 4')));
});

// ---------- έλεγχος αρχείων workspace (review PR #1) ----------
const routerData = (extra = {}) => ({ id: 'device-1', type: 'router', name: 'R', x: 0, y: 0,
  interfaces: { wan: { ip: 'N/A', subnetMask: '255.255.255.0', gateway: '0.0.0.0', dns: [] },
                lan: { ip: '192.168.1.1', subnetMask: '255.255.255.0', gateway: '0.0.0.0', dns: [] } },
  routingTable: [], connectionInterfaces: {}, connections: [], ...extra });
const pcData = (extra = {}) => ({ id: 'device-2', type: 'computer', name: 'PC', x: 200, y: 0,
  ip: '192.168.1.10', subnetMask: '255.255.255.0', gateway: '192.168.1.1', dns: [], connections: [], ...extra });

await scenario('V1 invalid nested data is rejected before the workspace is cleared', async (env, t) => {
  const { load } = await workspaceEnv(env);
  env.host('192.168.1.10'); env.host('192.168.1.20');
  const attempts = {
    'route with markup': { devices: [routerData({ routingTable: [{ network: '<img src=x onerror=alert(1)>', mask: '255.255.255.0', gateway: '0.0.0.0', interface: 'lan' }] })] },
    'device name with markup': { devices: [pcData({ name: '<img src=x onerror=alert(1)>' })] },
    'firewall rule with markup': { devices: [{ ...pcData({ type: 'firewall', name: 'FW' }), firewall: { policy: { outbound: 'allow', inbound: 'deny' }, rules: [{ action: 'allow', direction: 'any', protocol: 'any', port: null, source: '<b>', destination: 'any' }] } }] },
    'DNS record with markup': { devices: [pcData()], dnsRecords: { '<script>': '1.2.3.4' } },
    'interface IP not an address': { devices: [routerData({ interfaces: { wan: { ip: 'x' }, lan: { ip: '192.168.1.1', subnetMask: '255.255.255.0' } } })] },
    'mask with markup on an interface without IP': { devices: [routerData({ interfaces: { wan: { ip: 'N/A', subnetMask: '"><img src=x onerror=alert(1)>' }, lan: { ip: '192.168.1.1', subnetMask: '255.255.255.0' } } })] },
    'mask with markup on a device without IP': { devices: [pcData({ ip: 'N/A', subnetMask: '"><img src=x onerror=alert(1)>' })] },
    'connection id with markup': { devices: [pcData({ connections: ['"><b>'] }), pcData({ id: 'device-3', connections: ['"><b>'] })], connections: [{ id: '"><b>', device1Id: 'device-2', device2Id: 'device-3' }] }
  };
  for (const [name, file] of Object.entries(attempts)) {
    t(`${name}: rejected`, false, await load(file));
    t(`${name}: current workspace kept`, 2, env.dm.devices.length);
  }
});
await scenario('V2 legacy lan1 files: interface, ports and routes are renamed together', async (env, t) => {
  const { load } = await workspaceEnv(env);
  const router = routerData({ connections: ['c1'], connectionInterfaces: { c1: 'lan1' },
    routingTable: [{ network: '10.0.0.0', mask: '255.0.0.0', gateway: '192.168.1.254', interface: 'lan1', metric: 1 }] });
  router.interfaces = { wan: router.interfaces.wan, lan1: router.interfaces.lan };
  t('loads', true, await load({ devices: [router, pcData({ connections: ['c1'] })], connections: [{ id: 'c1', device1Id: 'device-1', device2Id: 'device-2', interface1: 'lan1' }] }));
  await new Promise(r => setTimeout(r, 300));
  const r = env.dm.devices.find(d => d.type === 'router');
  t('port renamed', 'lan', r.connectionInterfaces.c1);
  t('route interface renamed', 'lan', r.routingTable[0].interface);
  t('PC -> router works', true, env.ping(env.dm.devices.find(d => d.type === 'computer'), r));
});
await scenario('V3 duplicate-IP warnings follow connection changes', async ({ host, add, link, cm, dm }, t) => {
  const a = host('192.168.1.10'), b = host('192.168.1.10'), s1 = add('switch'), s2 = add('switch');
  link(a, s1); link(b, s2);
  t('separate segments: no warning', false, b.hasDuplicateIP);
  const bridge = link(s1, s2);
  t('connected: warning shown', true, b.hasDuplicateIP);
  cm.removeConnection(bridge);
  t('disconnected: warning cleared', false, b.hasDuplicateIP);
});
await scenario('V4 typed IP must belong to an active L3 interface', async ({ host, add, link, fix, sm, dm }, t) => {
  const a = host('192.168.1.10'), b = host('192.168.1.20'), sw = add('switch');
  link(a, sw); link(b, sw);
  fix(b, { subnetMask: 'not-a-mask' });
  globalThis.prompt = window.prompt = () => '192.168.1.20';
  t('ping to an IP without a valid interface fails', false, Boolean(sm.testPingFromDeviceWithPrompt(a, dm)?.success));
});

await scenario('V5 a refused domain name is not kept on the device', async ({ host, dm }, t) => {
  const pc = host('192.168.1.10');
  const result = dm.updateDeviceConfig(pc, { ip: '192.168.1.10', subnet: '255.255.255.0', domainName: 'bad name<>' });
  t('config rejected', false, result.success);
  t('domain not stored', true, pc.domainName == null);
});

// ---------- firewall: συσκευή με IP διαχείρισης ----------
await scenario('F1 firewall behaves as a host on its LAN', async (env, t) => {
  const { host, add, link, fix } = env;
  const sw = add('switch'), fw = add('firewall'), a = host('192.168.1.10');
  link(a, sw); link(fw, sw);
  fix(fw, { ip: '192.168.1.254', subnetMask: M24, gateway: '0.0.0.0' });
  t('a->firewall', true, env.ping(a, fw));
});

const pass = results.filter(r => r.ok).length;
process.stdout.write(`\n=== ${label}: ${pass}/${results.length} pass\n`);
for (const r of results) process.stdout.write(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}  (expected ${r.expected}, got ${r.actual})\n`);
process.exit(results.every(r => r.ok) ? 0 : 1);

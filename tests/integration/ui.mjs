// Δοκιμές UI σε jsdom: όλη η εφαρμογή, κλικ σε όλα τα βασικά στοιχεία και έλεγχος αποτελεσμάτων.
// Εκτέλεση: node tests/integration/ui.mjs [repo-dir]   (απαιτεί: npm install)
import fs from 'node:fs';
import path from 'node:path';
import { bootApp } from './app.mjs';

const dir = process.argv[2] ?? '.';
const { w, errors, tick } = await bootApp(dir);
const d = w.document;
const dm = w.deviceManager;
const ui = w.uiManager;
const results = [];
const check = (name, expected, actual) => results.push({ name, ok: expected === actual, expected, actual });
const click = id => d.getElementById(id).click();
const setValue = (id, value) => { d.getElementById(id).value = value; };
const byType = type => dm.devices.filter(x => x.type === type).at(-1);
const open = async device => { device.element.click(); await tick(100); };
const escape = () => d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape' }));

// 1. Click-through: κάθε συσκευή της παλέτας, κάθε panel, γρήγορη δοκιμή και κουμπί
d.querySelectorAll('.device-card').forEach(card => card.click());
for (const type of ['router', 'switch', 'computer', 'server', 'cloud', 'printer', 'dns', 'firewall']) {
  const device = byType(type);
  await open(device);
  check(`${type}: panel shows its type`, true, (d.querySelector('.device-type-value')?.textContent.trim() ?? '') !== '');
  for (const id of ['updateRouterBtn', 'updateSwitchBtn', 'updateDnsBtn', 'updateDeviceBtn', 'quickPingBtn', 'quickServiceBtn', 'quickDNSBtn']) {
    if (d.getElementById(id)) { d.getElementById(id).click(); await tick(50); escape(); }
  }
  await open(device); click('testDeviceBtn'); await tick(50); click('menuCancelBtn');
}
for (const id of ['testPingBtn', 'testDNSBtn', 'autoRouteBtn', 'simulateBtn', 'simulateBtn', 'debugBtn', 'saveWorkspaceBtn']) { click(id); await tick(100); escape(); }
check('simulate button keeps the compact label', 'Έναρξη', d.getElementById('simulateBtn').textContent.trim());

// 2. Μετακίνηση προβολής με σύρσιμο στο κενό
const view = ui.workspace.parentElement;
view.scrollLeft = 0; view.scrollTop = 0;
ui.workspace.dispatchEvent(new w.MouseEvent('mousedown', { button: 0, clientX: 300, clientY: 300, bubbles: true }));
d.dispatchEvent(new w.MouseEvent('mousemove', { clientX: 200, clientY: 250, bubbles: true }));
d.dispatchEvent(new w.MouseEvent('mouseup', { bubbles: true }));
check('panning scrolls the view horizontally', 100, view.scrollLeft);
check('panning scrolls the view vertically', 50, view.scrollTop);
const selected = byType('computer'); await open(selected);
ui.workspace.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
check('click right after a pan keeps the selection', selected, dm.selectedDevice);

// 3. Ping με πληκτρολόγηση IP (συγκεκριμένη διεπαφή router)
w.simulator.clearWorkspace?.();
await tick(100);
const router = dm.addDevice('router', '#3498db', 300, 200, ui.workspace);
const pc = dm.addDevice('computer', '#e74c3c', 100, 200, ui.workspace);
w.connectionManager.createRouterToDeviceConnectionWithInterface(router, pc, 'lan');
Object.assign(pc, { ip: '192.168.1.10', subnetMask: '255.255.255.0', gateway: '192.168.1.1' });
w.prompt = globalThis.prompt = () => '192.168.2.1';
const typed = w.simulator.simulationManager.testPingFromDeviceWithPrompt(pc, dm);
check('ping to a typed router LAN2 IP', true, typed?.success);
w.prompt = globalThis.prompt = () => '1';
const listed = w.simulator.simulationManager.testPingFromDeviceWithPrompt(pc, dm);
check('router is offered in the ping list', true, listed?.success);

// 4. Router: συνδέσεις ανά διεπαφή και πίνακας δρομολόγησης
await open(router);
check('router panel groups the PC under LAN', true, d.getElementById('deviceConfigContent').textContent.includes('LAN Interface'));
setValue('routeNetwork', '10.20.0.0'); setValue('routeMask', '255.255.0.0'); setValue('routeGateway', '192.168.1.254'); setValue('routeInterface', 'lan');
click('addRouteBtn'); await tick(100);
check('route added from the panel', 1, router.routingTable.length);
d.querySelector('[data-route-index="0"]').click(); await tick(100);
check('route deleted from the panel', 0, router.routingTable.length);
setValue('routeNetwork', '10.20.0.0'); setValue('routeGateway', '172.16.0.1'); setValue('routeInterface', 'lan');
click('addRouteBtn'); await tick(100);
check('gateway outside the interface subnet is rejected', 0, router.routingTable.length);

// 5. Καθαρισμός gateway από τη φόρμα
await open(pc);
setValue('deviceGateway', ''); click('updateDeviceBtn'); await tick(100);
check('empty gateway field clears the gateway', '0.0.0.0', pc.gateway);

// 6. Firewall: θύρες, κανόνες, πολιτική
w.prompt = globalThis.prompt = () => '2';
const fw = dm.addDevice('firewall', '#e74c3c', 500, 200, ui.workspace);
w.connectionManager.createRouterToDeviceConnectionWithInterface(router, fw, 'lan2');
check('firewall port chosen when connecting', 'outside', Object.values(fw.connectionInterfaces)[0]);
await open(fw);
setValue('fwRuleAction', 'allow'); setValue('fwRuleDirection', 'inbound'); setValue('fwRuleProtocol', 'tcp');
setValue('fwRulePort', '443'); setValue('fwRuleDestination', '192.168.2.0/24');
click('addFirewallRuleBtn'); await tick(100);
check('firewall rule added from the panel', 1, fw.firewall.rules.length);
setValue('fwRulePort', '70000'); click('addFirewallRuleBtn'); await tick(100);
check('invalid firewall rule rejected', 1, fw.firewall.rules.length);
const policy = d.getElementById('fwPolicyOutbound'); policy.value = 'deny'; policy.dispatchEvent(new w.Event('change'));
check('firewall policy changed from the panel', 'deny', fw.firewall.policy.outbound);

// 7. Διαγραφή DNS record από το panel
const dns = dm.addDevice('dns', '#9b59b6', 700, 200, ui.workspace);
w.dnsManager.globalDnsRecords['test.local'] = '192.168.1.99';
await open(dns); await tick(150);
d.querySelector('.dns-record-delete-btn[data-domain="test.local"]').click(); await tick(100);
check('DNS record delete button removes the record', undefined, w.dnsManager.globalDnsRecords['test.local']);

// 8. Μοντέλα από το μενού
click('loadModelBtn'); await tick(300);
const models = new Set([...d.querySelectorAll('.model-item[data-file]')].map(item => item.dataset.file));
const catalogue = JSON.parse(fs.readFileSync(path.join(dir, 'data/models/list.json'), 'utf8'));
check('models menu lists every entry of list.json', catalogue.length, models.size);
check('models menu shows descriptions', catalogue.length, d.querySelectorAll('.model-description').length);

check('no uncaught errors or console.error', '', errors.join('\n'));

const failed = results.filter(r => !r.ok);
process.stdout.write(`\n=== UI: ${results.length - failed.length}/${results.length} pass\n`);
for (const r of results) process.stdout.write(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `  (expected ${JSON.stringify(r.expected)}, got ${JSON.stringify(r.actual)})`}\n`);
process.exit(failed.length ? 1 : 0);

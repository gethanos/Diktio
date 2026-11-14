// Εκτέλεση: node tests/integration/smoke.mjs [repo-dir]   (εκκινεί όλη την εφαρμογή σε jsdom)
// Αποτυγχάνει (exit 1) αν η εκκίνηση βγάλει σφάλμα ή αν δεν περάσει κάποιος από τους βασικούς ελέγχους.
import { bootApp } from './app.mjs';

const dir = process.argv[2] ?? '.';
const { w, errors, tick } = await bootApp(dir);
const checks = [];
const check = (name, ok) => checks.push({ name, ok: Boolean(ok) });

const dm = w.deviceManager;
const sim = w.simulator;
check('simulator, device manager and workspace manager exist', sim && dm && w.workspaceManager);
check('demo network has 5 devices', dm?.devices.length === 5);

const byType = type => dm?.devices.find(d => d.type === type);
try {
  check('ping from demo PC to demo server succeeds', sim.simulationManager.testPing(byType('computer'), byType('server'))?.success);
} catch (error) {
  check(`ping threw: ${error.message}`, false);
}
try {
  const domain = Object.keys(w.dnsManager.globalDnsRecords).find(k => dm.getDeviceByIP(w.dnsManager.globalDnsRecords[k]));
  check('DNS query from demo PC resolves a local name', sim.testDNSQuery(byType('computer'), byType('dns'), domain)?.ip);
} catch (error) {
  check(`DNS query threw: ${error.message}`, false);
}
await tick(1500);
check('no uncaught errors or console.error', errors.length === 0);

for (const { name, ok } of checks) process.stdout.write(`${ok ? 'PASS' : 'FAIL'}  ${name}\n`);
for (const error of errors) process.stdout.write(`      ${error}\n`);
const failed = checks.filter(c => !c.ok).length;
process.stdout.write(`=== smoke: ${checks.length - failed}/${checks.length} pass\n`);
process.exit(failed ? 1 : 0);

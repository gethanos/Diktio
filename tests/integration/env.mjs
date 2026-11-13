import { JSDOM } from 'jsdom';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export async function loadBranch(dir, { quiet = true } = {}) {
  const dom = new JSDOM('<!doctype html><div id="workspace"></div><div id="console" style="display:none"></div><div id="consoleLog"></div><div id="logs"></div>', { pretendToBeVisual: true });
  const w = dom.window;
  globalThis.window = w;
  globalThis.document = w.document;
  globalThis.alert = w.alert = () => {};
  globalThis.prompt = w.prompt = (_, d) => d;
  globalThis.confirm = w.confirm = () => true;
  globalThis.requestAnimationFrame = w.requestAnimationFrame = (f) => setTimeout(f, 0);
  w.CONFIG = {
    DEVICE_TYPES: {
      router: { icon: '', name: 'Router', color: '#3498db' }, switch: { icon: '', name: 'Switch', color: '#2ecc71' },
      computer: { icon: '', name: 'PC', color: '#e74c3c' }, server: { icon: '', name: 'Server', color: '#9b59b6' },
      cloud: { icon: '', name: 'Cloud', color: '#f39c12' }, printer: { icon: '', name: 'Printer', color: '#34495e' },
      dns: { icon: '', name: 'DNS', color: '#9b59b6' }, firewall: { icon: '', name: 'Firewall', color: '#e74c3c' },
    },
  };
  if (quiet) { console.log = () => {}; console.warn = () => {}; console.trace = () => {}; console.info = () => {}; }
  const js = path.join(dir, 'assets/js');
  const imp = (f) => import(pathToFileURL(path.join(js, f)).href);
  const core = await imp('network-core.js');
  const DeviceManager = (await imp('devices.js')).default;
  const ConnectionManager = (await imp('connections.js')).default;
  const SimulationManager = (await imp('simulation.js')).default;
  const dm = new DeviceManager();
  const cm = new ConnectionManager();
  const sm = new SimulationManager(cm);
  sm.createPingPacket = () => {};           // no animation in tests
  w.deviceManager = dm; w.connectionManager = cm; w.simulationManager = sm;
  w.addLog = () => {};
  const ws = w.document.getElementById('workspace');

  const add = (type, cfg = {}) => {
    const d = dm.addDevice(type, '#336699', 0, 0, ws);
    Object.assign(d, cfg);
    return d;
  };
  const router = (ifs = {}) => {
    const r = add('router');
    for (const [k, v] of Object.entries(ifs)) Object.assign(r.interfaces[k], v);
    return r;
  };
  const link = (a, b, ifaceA) => ifaceA
    ? cm.createRouterToDeviceConnectionWithInterface(a, b, ifaceA)
    : cm.createBasicConnection(a, b);
  const host = (ip, mask = '255.255.255.0', gateway = '0.0.0.0') => add('computer', { ip, subnetMask: mask, gateway });
  // Re-apply addressing after links (connection code may rewrite IPs)
  const fix = (d, cfg) => Object.assign(d, cfg);
  const ping = (a, b) => { try { return !!sm.testPing(a, b)?.success; } catch (e) { return 'THROW:' + e.message; } };
  return { w, core, dm, cm, sm, add, router, link, host, fix, ping };
}

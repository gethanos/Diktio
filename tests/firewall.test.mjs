// Εκτέλεση από τη ρίζα του repo: node --test
// Firewall (transparent, stateful): κανόνες, πολιτική, συνεδρίες και διέλευση μέσα από τη δρομολόγηση.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFirewallConfig, createRule, validateRule, inspectPacket } from '../assets/js/firewall.js';
import { buildTopology, ping } from '../assets/js/routing.js';

const M24 = '255.255.255.0';
const firewallWith = (rules = [], policy = {}) => ({
    id: 'fw', type: 'firewall',
    firewall: { ...createFirewallConfig(), rules: rules.map(createRule), policy: { outbound: 'allow', inbound: 'deny', ...policy } }
});
const packet = (sourceIP, destinationIP, protocol = 'icmp', port = null) => ({ sourceIP, destinationIP, protocol, port });

test('default policy: outbound allowed, inbound denied', () => {
    const fw = firewallWith();
    assert.equal(inspectPacket(fw, 'inside', 'outside', packet('192.168.2.10', '8.8.8.8'), new Set()).allowed, true);
    assert.equal(inspectPacket(fw, 'outside', 'inside', packet('8.8.8.8', '192.168.2.10'), new Set()).allowed, false);
});

test('stateful: the reply to an allowed request passes inbound', () => {
    const fw = firewallWith();
    const sessions = new Set();
    inspectPacket(fw, 'inside', 'outside', packet('192.168.2.10', '8.8.8.8'), sessions);
    assert.equal(inspectPacket(fw, 'outside', 'inside', packet('8.8.8.8', '192.168.2.10'), sessions).allowed, true);
});

test('first matching rule wins, port and CIDR are matched', () => {
    const fw = firewallWith([
        { action: 'deny', direction: 'inbound', protocol: 'tcp', port: '80', source: '192.168.1.66' },
        { action: 'allow', direction: 'inbound', protocol: 'tcp', port: '80', destination: '192.168.2.0/24' }
    ]);
    const inbound = p => inspectPacket(fw, 'outside', 'inside', p, new Set()).allowed;
    assert.equal(inbound(packet('192.168.1.10', '192.168.2.10', 'tcp', 80)), true);
    assert.equal(inbound(packet('192.168.1.66', '192.168.2.10', 'tcp', 80)), false);
    assert.equal(inbound(packet('192.168.1.10', '192.168.2.10', 'tcp', 22)), false);
    assert.equal(inbound(packet('192.168.1.10', '192.168.3.10', 'tcp', 80)), false);
});

test('unassigned port blocks traffic', () => {
    assert.equal(inspectPacket(firewallWith(), undefined, 'outside', packet('1.1.1.1', '2.2.2.2'), new Set()).allowed, false);
});

test('rule validation', () => {
    assert.equal(validateRule(createRule({ action: 'allow', protocol: 'tcp', port: '443' })), null);
    assert.match(validateRule(createRule({ protocol: 'icmp', port: '80' })), /TCP ή UDP/);
    assert.match(validateRule(createRule({ protocol: 'tcp', port: '70000' })), /1-65535/);
    assert.match(validateRule(createRule({ source: '10.0.0.0/33' })), /πηγή/);
    assert.deepEqual(createRule({}), { action: 'allow', direction: 'any', protocol: 'any', port: null, source: 'any', destination: 'any' });
});

// PC — switch — router(LAN) ... router(LAN2) — outside[FW]inside — switch — server
function protectedServer(rules) {
    const devices = [];
    const connections = [];
    let n = 0;
    const add = props => { const d = { id: `d${++n}`, name: `${props.type}${n}`, connections: [], connectionInterfaces: {}, ...props }; devices.push(d); return d; };
    const link = (a, b, portA, portB) => {
        const id = `c${connections.length + 1}`;
        connections.push({ id, device1Id: a.id, device2Id: b.id });
        if (portA) a.connectionInterfaces[id] = portA;
        if (portB) b.connectionInterfaces[id] = portB;
    };
    const router = add({ type: 'router', interfaces: {
        wan: { ip: 'N/A', subnetMask: M24, gateway: '0.0.0.0' },
        lan: { ip: '192.168.1.1', subnetMask: M24, gateway: '0.0.0.0' },
        lan2: { ip: '192.168.2.1', subnetMask: M24, gateway: '0.0.0.0', enabled: true } }, routingTable: [] });
    const pc = add({ type: 'computer', ip: '192.168.1.10', subnetMask: M24, gateway: '192.168.1.1' });
    const server = add({ type: 'server', ip: '192.168.2.10', subnetMask: M24, gateway: '192.168.2.1' });
    const fw = add({ type: 'firewall', ip: '192.168.2.254', subnetMask: M24, gateway: '192.168.2.1', firewall: firewallWith(rules).firewall });
    const s1 = add({ type: 'switch', ip: 'N/A', subnetMask: M24 });
    const s2 = add({ type: 'switch', ip: 'N/A', subnetMask: M24 });
    link(pc, s1); link(router, s1, 'lan'); link(router, fw, 'lan2', 'outside'); link(fw, s2, 'inside'); link(s2, server);
    const run = (a, b, service) => ping(buildTopology(devices, connections), a, b, service);
    return { pc, server, fw, run };
}

test('routed traffic through the firewall: rules, policy and replies', () => {
    const { pc, server, fw, run } = protectedServer([{ action: 'allow', direction: 'inbound', protocol: 'tcp', port: '80', destination: '192.168.2.10' }]);
    const blocked = run(pc, server);
    assert.equal(blocked.ok, false);
    assert.equal(blocked.reason, 'firewall-blocked');
    assert.equal(blocked.at, fw);
    assert.equal(run(pc, server, { protocol: 'tcp', port: 80 }).ok, true);
    assert.equal(run(pc, server, { protocol: 'tcp', port: 22 }).ok, false);
    assert.equal(run(server, pc).ok, true);
    assert.equal(run(pc, fw).ok, true, 'management IP is reachable');
});

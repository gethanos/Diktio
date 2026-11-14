// Εκτέλεση από τη ρίζα του repo: node --test
// Χωρίς DOM: ελέγχει μόνο network-core.js και routing.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as core from '../assets/js/network-core.js';
import { buildTopology, ping, selectRoute, findIPConflicts } from '../assets/js/routing.js';

const M24 = '255.255.255.0';

// ---------- βοηθητικά τοπολογίας ----------
function lab() {
    const devices = [];
    const connections = [];
    let n = 0;
    const add = (type, props = {}) => {
        const device = { id: `d${++n}`, name: `${type}${n}`, type, connections: [], ...props };
        devices.push(device);
        return device;
    };
    const host = (ip, gateway = '0.0.0.0', mask = M24) => add('computer', { ip, subnetMask: mask, gateway });
    const sw = () => add('switch', { ip: 'N/A', subnetMask: M24 });
    const router = (interfaces, routingTable = []) => add('router', {
        interfaces: {
            wan: { ip: 'N/A', subnetMask: M24, gateway: '0.0.0.0', ...interfaces.wan },
            lan: { ip: 'N/A', subnetMask: M24, gateway: '0.0.0.0', ...interfaces.lan },
            lan2: { ip: 'N/A', subnetMask: M24, gateway: '0.0.0.0', enabled: true, ...interfaces.lan2 }
        },
        connectionInterfaces: {},
        routingTable
    });
    const link = (a, b, ifaceA, ifaceB) => {
        const id = `c${connections.length + 1}`;
        connections.push({ id, device1Id: a.id, device2Id: b.id });
        if (ifaceA) a.connectionInterfaces[id] = ifaceA;
        if (ifaceB) b.connectionInterfaces[id] = ifaceB;
    };
    const canPing = (a, b) => ping(buildTopology(devices, connections), a, b);
    return { add, host, sw, router, link, canPing, devices, connections };
}

// ---------- network-core ----------
test('getNetworkInfo: unsigned arithmetic and RFC 3021', () => {
    assert.equal(core.getNetworkInfo('192.168.1.10', M24).usableHosts, 254);
    assert.equal(core.getNetworkInfo('192.168.1.10', M24).broadcast, '192.168.1.255');
    assert.equal(core.getNetworkInfo('10.0.0.0', '255.255.255.254').usableHosts, 2);
    assert.equal(core.getNetworkInfo('10.0.0.1', '255.255.255.255').usableHosts, 1);
    assert.equal(core.getNetworkInfo('10.0.0.1', '255.0.255.0'), null);
});

test('validation is strict', () => {
    for (const bad of ['1.2.3', '1.2.3.4x', '256.1.1.1', '01.2.3.4', '', null]) assert.equal(core.isValidIP(bad), false, String(bad));
    assert.equal(core.isValidSubnetMask('255.0.255.0'), false);
    assert.equal(core.isValidSubnetMask('255.255.255.192'), true);
    assert.equal(core.isValidSubnetMask('0.0.0.0'), false);
    assert.equal(core.isValidSubnetMask('0.0.0.0', { allowZero: true }), true);
    assert.equal(core.subnetMaskToCIDR('255.255.255.192'), 26);
});

test('areInSameNetwork is symmetric', () => {
    const pairs = [['192.168.1.10', '255.255.0.0', '192.168.2.20', M24], ['10.0.0.1', M24, '10.0.0.2', M24]];
    for (const [a, ma, b, mb] of pairs) {
        assert.equal(core.areInSameNetwork(a, b, ma, mb), core.areInSameNetwork(b, a, mb, ma));
    }
    assert.equal(core.areInSameNetwork('192.168.1.10', '192.168.2.20', '255.255.0.0', M24), false);
});

test('host address allocation skips network, broadcast and used addresses', () => {
    assert.equal(core.isUsableHostAddress('192.168.1.0', M24), false);
    assert.equal(core.isUsableHostAddress('192.168.1.255', M24), false);
    for (let i = 0; i < 200; i++) {
        assert.equal(core.generateRandomIP('10.0.0.0', '255.255.255.252', ['10.0.0.1']), '10.0.0.2');
    }
    assert.equal(core.getAvailableIP('10.0.0.0', '255.255.255.252', ['10.0.0.1', '10.0.0.2']), null);
    assert.equal(core.getNextAvailableIP('192.168.1.254', M24, ['192.168.1.1']), '192.168.1.2');
});

// ---------- Layer 2 ----------
test('same subnet across cascaded switches', () => {
    const l = lab();
    const a = l.host('192.168.1.10'), b = l.host('192.168.1.20'), s1 = l.sw(), s2 = l.sw();
    l.link(a, s1); l.link(s1, s2); l.link(s2, b);
    assert.equal(l.canPing(a, b).ok, true);
});

test('mismatched masks: request may arrive, reply cannot', () => {
    const l = lab();
    const a = l.host('192.168.1.10', '0.0.0.0', '255.255.0.0'), b = l.host('192.168.2.20'), s = l.sw();
    l.link(a, s); l.link(b, s);
    const result = l.canPing(a, b);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'reply-no-route');
});

test('duplicate IP on one segment breaks ARP; isolated duplicates are legal', () => {
    const l = lab();
    const a = l.host('192.168.1.10'), b = l.host('192.168.1.20'), c = l.host('192.168.1.20'), s1 = l.sw();
    const x = l.host('192.168.1.10'), s2 = l.sw();
    l.link(a, s1); l.link(b, s1); l.link(c, s1); l.link(x, s2);
    assert.equal(l.canPing(a, b).reason, 'ip-conflict');
    const conflicts = findIPConflicts(buildTopology(l.devices, l.connections));
    assert.deepEqual([...conflicts].sort((p, q) => p.id.localeCompare(q.id)), [b, c]);
});

// ---------- Layer 3 ----------
function twoLans(gatewayB = '192.168.2.1') {
    const l = lab();
    const r = l.router({ lan: { ip: '192.168.1.1' }, lan2: { ip: '192.168.2.1' } });
    const s1 = l.sw(), s2 = l.sw();
    const a = l.host('192.168.1.10', '192.168.1.1'), b = l.host('192.168.2.20', gatewayB);
    l.link(r, s1, 'lan'); l.link(r, s2, 'lan2'); l.link(a, s1); l.link(b, s2);
    return { ...l, r, s1, s2, a, b };
}

test('inter-LAN routing through one router', () => {
    const { canPing, a, b, r, s1, s2 } = twoLans();
    const result = canPing(a, b);
    assert.equal(result.ok, true);
    assert.deepEqual(result.path, [a, s1, r, s2, b]);
    assert.equal(canPing(r, b).ok, true);
    assert.equal(canPing(b, r).targetIP, '192.168.2.1');
});

test('no gateway on the target means no reply', () => {
    const { canPing, a, b } = twoLans('0.0.0.0');
    assert.equal(canPing(a, b).reason, 'reply-no-route');
});

test('gateway must be on-link', () => {
    const { canPing, a, b } = twoLans();
    a.gateway = '192.168.2.1';
    assert.equal(canPing(a, b).reason, 'no-route');
});

test('routers do not bridge: same subnet on two router ports', () => {
    const { canPing, host, link, a, s2 } = twoLans();
    const c = host('192.168.1.30', '192.168.1.1');
    link(c, s2);
    assert.equal(canPing(a, c).ok, false);
});

test('disabled LAN2 is not an interface', () => {
    const { canPing, r, a, b } = twoLans();
    r.interfaces.lan2.enabled = false;
    assert.equal(canPing(a, b).ok, false);
});

test('longest prefix match beats the default route', () => {
    const r = { type: 'router', interfaces: {
        wan: { ip: '203.0.113.10', subnetMask: M24, gateway: '203.0.113.1' },
        lan: { ip: '192.168.1.1', subnetMask: M24 },
        lan2: { ip: 'N/A', subnetMask: M24, enabled: true } },
        routingTable: [{ network: '10.0.0.0', mask: '255.0.0.0', gateway: '192.168.1.254', interface: 'lan', metric: 1 }] };
    assert.equal(selectRoute(r, '10.1.2.3').nextHop, '192.168.1.254');
    assert.equal(selectRoute(r, '8.8.8.8').nextHop, '203.0.113.1');
    assert.equal(selectRoute(r, '192.168.1.50').nextHop, '192.168.1.50');
});

function twoRouters(routes) {
    const l = lab();
    const P30 = '255.255.255.252';
    const r1 = l.router({ lan: { ip: '192.168.1.1' }, wan: { ip: '10.0.0.1', subnetMask: P30 }, lan2: { enabled: false } }, routes ? [{ network: '192.168.3.0', mask: M24, gateway: '10.0.0.2', interface: 'wan', metric: 1 }] : []);
    const r2 = l.router({ lan: { ip: '192.168.3.1' }, wan: { ip: '10.0.0.2', subnetMask: P30 }, lan2: { enabled: false } }, routes ? [{ network: '192.168.1.0', mask: M24, gateway: '10.0.0.1', interface: 'wan', metric: 1 }] : []);
    const a = l.host('192.168.1.10', '192.168.1.1'), c = l.host('192.168.3.30', '192.168.3.1');
    l.link(r1, a, 'lan'); l.link(r2, c, 'lan'); l.link(r1, r2, 'wan', 'wan');
    return { ...l, r1, r2, a, c };
}

test('two routers need routes in both directions', () => {
    assert.equal(twoRouters(false).canPing(twoRouters(false).a, twoRouters(false).c).ok, false);
    const t = twoRouters(true);
    assert.equal(t.canPing(t.a, t.c).ok, true);
    assert.equal(t.canPing(t.c, t.a).ok, true);
});

test('routing loop ends with TTL expiry', () => {
    const t = twoRouters(false);
    t.r1.routingTable = [{ network: '172.16.0.0', mask: M24, gateway: '10.0.0.2', interface: 'wan' }];
    t.r2.routingTable = [{ network: '172.16.0.0', mask: M24, gateway: '10.0.0.1', interface: 'wan' }];
    const ghost = t.host('172.16.0.5');
    assert.equal(t.canPing(t.a, ghost).reason, 'ttl-expired');
});

test('NAT: private LAN reaches the Internet, the Internet cannot reach the LAN', () => {
    const l = lab();
    const r = l.router({ wan: { ip: '203.0.113.10', gateway: '203.0.113.1' }, lan: { ip: '192.168.1.1' }, lan2: { enabled: false } });
    const cloud = l.add('cloud', { ip: '203.0.113.1', subnetMask: M24, gateway: '0.0.0.0' });
    const a = l.host('192.168.1.10', '192.168.1.1');
    l.link(r, cloud, 'wan'); l.link(r, a, 'lan');
    const out = l.canPing(a, cloud);
    assert.equal(out.ok, true);
    assert.equal(out.translations[0].outsideIP, '203.0.113.10');
    assert.equal(l.canPing(cloud, a).ok, false);
});

test('no NAT on a private WAN link: the far side needs a return route', () => {
    const t = twoRouters(false);
    t.r1.routingTable = [{ network: '192.168.3.0', mask: M24, gateway: '10.0.0.2', interface: 'wan', metric: 1 }];
    const result = t.canPing(t.a, t.c);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'reply-no-route');
});

test('ping reaches the chosen device, not another device with the same IP', () => {
    const { canPing, host, a, b } = twoLans();
    const twin = host('192.168.2.20', '192.168.2.1');          // ίδια IP με τον b, χωρίς σύνδεση
    const result = canPing(a, twin);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'other-host');
    assert.equal(result.at, b);
});

test('a static route leaves through its configured interface', () => {
    const r = { type: 'router', routingTable: [], interfaces: {
        wan: { ip: '10.0.0.1', subnetMask: '255.255.0.0', gateway: '0.0.0.0' },
        lan: { ip: '10.0.1.1', subnetMask: M24 },
        lan2: { ip: 'N/A', subnetMask: M24 } } };
    r.routingTable = [{ network: '172.16.0.0', mask: M24, gateway: '10.0.1.254', interface: 'lan', metric: 1 }];
    assert.equal(selectRoute(r, '172.16.0.5').iface.name, 'lan');
    r.routingTable = [{ network: '172.16.0.0', mask: M24, gateway: '10.0.1.254', interface: 'lan2', metric: 1 }];
    assert.equal(selectRoute(r, '172.16.0.5'), null, 'gateway not on-link on the configured interface');
});

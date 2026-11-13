/**
 * MIT License
 * 
 * Copyright (c) 2025 Georgalas Athanasios-Antonios (Thanos), CITEd.gr VLE
 * 
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * 
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */
// Μοντέλο προώθησης πακέτων (Layer 2 / Layer 3)
//
// Κανόνες που ακολουθεί, όπως στη θεωρία:
//  - Τα switches προωθούν frames μέσα σε ένα broadcast domain. Κάθε άλλη συσκευή τερματίζει το domain.
//  - Το firewall είναι transparent (bridge): περνά τα frames μεταξύ inside/outside αφού ελέγξει
//    το πακέτο με τους κανόνες του (firewall.js). Η IP του είναι μόνο για διαχείριση.
//  - Ένας host στέλνει απευθείας (ARP) μόνο σε διεύθυνση on-link με τη δική του μάσκα, αλλιώς στο gateway.
//  - Το gateway πρέπει να είναι on-link και να απαντά σε ARP στο ίδιο broadcast domain.
//  - Μόνο οι routers προωθούν πακέτα: longest prefix match σε connected routes, routing table, default route.
//  - Το ping πετυχαίνει μόνο αν πετύχουν και το echo request και το echo reply.
//  - Ιδιωτική διεύθυνση που βγαίνει από WAN με δημόσια IP μεταφράζεται στη WAN IP (NAT/masquerade).
//    Σε WAN με ιδιωτική IP (π.χ. σύνδεση δύο γραφείων 10.0.0.0/30) δεν γίνεται NAT: χρειάζονται διαδρομές.

import { ipToInt, isValidIP, isValidSubnetMask, isOnLink, subnetMaskToCIDR, isPrivateIP } from './network-core.js';
import { inspectPacket } from './firewall.js';

const MAX_HOPS = 16;
const hasAddress = ip => isValidIP(ip) && ip !== '0.0.0.0';
const isBridge = device => device.type === 'switch' || device.type === 'firewall';

// Διεπαφές Layer 3 μιας συσκευής: [{ name, ip, mask }]
function getL3Interfaces(device) {
    if (device.type === 'router') {
        return Object.entries(device.interfaces || {})
            .filter(([, iface]) => hasAddress(iface.ip) && isValidSubnetMask(iface.subnetMask) && iface.enabled !== false)
            .map(([name, iface]) => ({ name, ip: iface.ip, mask: iface.subnetMask }));
    }
    if (!hasAddress(device.ip) || !isValidSubnetMask(device.subnetMask)) return [];
    return [{ name: isBridge(device) ? 'mgmt' : 'eth0', ip: device.ip, mask: device.subnetMask }];
}

// Η διεπαφή μιας συσκευής στην οποία καταλήγει ένα καλώδιο
// (router: wan/lan/lan2, firewall: inside/outside, switch: όλες οι θύρες ίδιες, host: eth0)
function portName(device, connectionId) {
    if (device.type === 'router' || device.type === 'firewall') return device.connectionInterfaces?.[connectionId] ?? null;
    return device.type === 'switch' ? 'mgmt' : 'eth0';
}

function ownsIP(device, ip) {
    return getL3Interfaces(device).some(iface => iface.ip === ip);
}

// Ευρετήριο τοπολογίας: deviceId → [{ connectionId, peer }]
function buildTopology(devices, connections) {
    const byId = new Map(devices.map(device => [device.id, device]));
    const links = new Map(devices.map(device => [device.id, []]));
    for (const connection of connections) {
        const a = byId.get(connection.device1Id);
        const b = byId.get(connection.device2Id);
        if (!a || !b) continue;
        links.get(a.id).push({ connectionId: connection.id, peer: b });
        links.get(b.id).push({ connectionId: connection.id, peer: a });
    }
    return { devices, links };
}

// Όλα τα L3 endpoints στο ίδιο broadcast domain με τη διεπαφή ifaceName της συσκευής.
// Επιστρέφει [{ device, iface, path, crossings }]: path οι συσκευές από την πηγή ως το endpoint,
// crossings τα firewalls που διασχίζονται, με θύρα εισόδου και εξόδου ({ firewall, from, to }).
function getSegmentEndpoints(topology, device, ifaceName) {
    const startLinks = topology.links.get(device.id)
        .filter(link => isBridge(device) || portName(device, link.connectionId) === ifaceName);
    const visitedBridges = new Set(isBridge(device) ? [device.id] : []);
    const queue = startLinks.map(link => ({ link, path: [device], crossings: [] }));
    const endpoints = [];

    while (queue.length > 0) {
        const { link, path, crossings } = queue.shift();
        const peer = link.peer;
        const peerPath = [...path, peer];

        if (isBridge(peer)) {
            if (visitedBridges.has(peer.id)) continue;
            visitedBridges.add(peer.id);
            getL3Interfaces(peer).forEach(iface => endpoints.push({ device: peer, iface, path: peerPath, crossings }));
            topology.links.get(peer.id)
                .filter(next => next.connectionId !== link.connectionId)
                .forEach(next => queue.push({
                    link: next,
                    path: peerPath,
                    crossings: peer.type === 'firewall'
                        ? [...crossings, { firewall: peer, from: portName(peer, link.connectionId), to: portName(peer, next.connectionId) }]
                        : crossings
                }));
            continue;
        }

        if (peer.id === device.id) continue;
        const iface = getL3Interfaces(peer).find(candidate => candidate.name === portName(peer, link.connectionId));
        if (iface) endpoints.push({ device: peer, iface, path: peerPath, crossings });
    }
    return endpoints;
}

// ARP: ποιο endpoint του segment έχει την ip;
function resolveARP(topology, device, ifaceName, ip) {
    const matches = getSegmentEndpoints(topology, device, ifaceName).filter(endpoint => endpoint.iface.ip === ip);
    if (matches.length === 0) return { error: 'arp-failed' };
    if (matches.length > 1) return { error: 'ip-conflict' };
    return matches[0];
}

// Επιλογή διαδρομής: longest prefix match, μετά μικρότερο metric.
// Επιστρέφει { iface, nextHop } ή null.
function selectRoute(device, destinationIP) {
    const interfaces = getL3Interfaces(device);
    const destination = ipToInt(destinationIP);
    const candidates = [];

    const addRoute = (network, mask, gateway, metric, ifaceName) => {
        if (!isValidIP(network) || !isValidSubnetMask(mask, { allowZero: true })) return;
        const maskInt = ipToInt(mask);
        if (((destination & maskInt) >>> 0) !== ((ipToInt(network) & maskInt) >>> 0)) return;

        const directlyConnected = !hasAddress(gateway);
        const iface = directlyConnected
            ? interfaces.find(candidate => candidate.name === ifaceName)
            : interfaces.find(candidate => isOnLink(gateway, candidate.ip, candidate.mask));
        if (!iface) return;

        candidates.push({
            iface,
            nextHop: directlyConnected ? destinationIP : gateway,
            prefix: subnetMaskToCIDR(mask),
            metric: Number(metric) || 0
        });
    };

    interfaces.forEach(iface => addRoute(iface.ip, iface.mask, '0.0.0.0', 0, iface.name));

    if (device.type === 'router') {
        (device.routingTable || []).forEach(route =>
            addRoute(route.network, route.mask, route.gateway, route.metric, route.interface));
        addRoute('0.0.0.0', '0.0.0.0', device.interfaces?.wan?.gateway, 100);
    } else {
        addRoute('0.0.0.0', '0.0.0.0', device.gateway, 100);
    }

    candidates.sort((a, b) => b.prefix - a.prefix || a.metric - b.metric);
    return candidates[0] ?? null;
}

// Προσομοίωση ενός πακέτου από τη source προς destinationIP.
// natReverse: μεταφράσεις από το request, ώστε το reply να επιστρέψει στην εσωτερική διεύθυνση.
// protocol/port: η υπηρεσία (για τους κανόνες firewall). sessions: κοινές με το reply (stateful).
function tracePacket(topology, source, destinationIP, { sourceIP = null, natReverse = [], protocol = 'icmp', port = null, sessions = new Set() } = {}) {
    const path = [source];
    const translations = [];
    let current = source;
    let ingress = null;
    let destination = destinationIP;
    let srcIP = sourceIP;

    for (let hop = 0; hop < MAX_HOPS; hop++) {
        if (ownsIP(current, destination)) {
            const nat = natReverse.find(entry => entry.router === current && entry.outsideIP === destination);
            if (!nat) return { ok: true, path, sourceIP: srcIP, destinationIP, translations };
            destination = nat.insideIP;
        }

        if (current !== source && current.type !== 'router') {
            return { ok: false, reason: 'not-a-router', at: current, path };
        }

        const route = selectRoute(current, destination);
        if (!route) return { ok: false, reason: 'no-route', at: current, path };

        srcIP ??= route.iface.ip;
        if (current.type === 'router' && route.iface.name === 'wan' && ingress !== 'wan' && isPrivateIP(srcIP) && !isPrivateIP(route.iface.ip)) {
            translations.push({ router: current, insideIP: srcIP, outsideIP: route.iface.ip });
            srcIP = route.iface.ip;
        }

        const neighbor = resolveARP(topology, current, route.iface.name, route.nextHop);
        if (neighbor.error) return { ok: false, reason: neighbor.error, at: current, path };

        for (const { firewall, from, to } of neighbor.crossings) {
            const packet = { sourceIP: srcIP, destinationIP: destination, protocol, port };
            const verdict = inspectPacket(firewall, from, to, packet, sessions);
            if (!verdict.allowed) {
                const blockedPath = [...path, ...neighbor.path.slice(1, neighbor.path.indexOf(firewall) + 1)];
                return { ok: false, reason: 'firewall-blocked', detail: verdict.reason, at: firewall, path: blockedPath };
            }
        }

        path.push(...neighbor.path.slice(1));
        ingress = neighbor.iface.name;
        current = neighbor.device;
    }
    return { ok: false, reason: 'ttl-expired', at: current, path };
}

// Διεύθυνση-στόχος όταν ο χρήστης επιλέγει συσκευή: προτιμάται διεπαφή on-link με την πηγή.
function pickTargetIP(source, target) {
    const targetInterfaces = getL3Interfaces(target);
    const onLink = targetInterfaces.find(targetIface =>
        getL3Interfaces(source).some(sourceIface => isOnLink(targetIface.ip, sourceIface.ip, sourceIface.mask)));
    return (onLink ?? targetInterfaces[0])?.ip ?? null;
}

// Ping (ICMP) ή άλλη υπηρεσία ({ protocol: 'tcp', port: 80 }): αίτημα και απάντηση.
// targetIP: συγκεκριμένη διεύθυνση του στόχου (π.χ. η LAN2 IP ενός router), αλλιώς επιλέγεται αυτόματα.
function ping(topology, source, target, { protocol = 'icmp', port = null, targetIP: requestedIP = null } = {}) {
    if (source === target) return { ok: true, path: [source] };
    if (getL3Interfaces(source).length === 0) return { ok: false, reason: 'no-source-ip', path: [source] };

    const targetIP = requestedIP ?? pickTargetIP(source, target);
    if (!targetIP) return { ok: false, reason: 'no-target-ip', path: [source] };

    const sessions = new Set();
    const request = tracePacket(topology, source, targetIP, { protocol, port, sessions });
    if (!request.ok) return { ...request, targetIP };

    const reply = tracePacket(topology, target, request.sourceIP, {
        sourceIP: targetIP,
        natReverse: request.translations,
        protocol,
        port,
        sessions
    });
    if (!reply.ok) return { ...reply, ok: false, reason: `reply-${reply.reason}`, targetIP, path: request.path };

    return { ok: true, path: request.path, sourceIP: request.sourceIP, targetIP, translations: request.translations };
}

// Διπλότυπες IP: ίδια διεύθυνση σε δύο διεπαφές του ίδιου broadcast domain.
// Η ίδια IP σε απομονωμένα δίκτυα (π.χ. δύο LAN πίσω από NAT) δεν είναι σύγκρουση.
function findIPConflicts(topology) {
    const conflicting = new Set();
    for (const device of topology.devices) {
        for (const iface of getL3Interfaces(device)) {
            getSegmentEndpoints(topology, device, iface.name)
                .filter(endpoint => endpoint.iface.ip === iface.ip && endpoint.device !== device)
                .forEach(endpoint => conflicting.add(device).add(endpoint.device));
        }
    }
    return conflicting;
}

export {
    getL3Interfaces,
    buildTopology,
    getSegmentEndpoints,
    selectRoute,
    tracePacket,
    ping,
    findIPConflicts
};

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
// Βασικό stateful firewall σε transparent (bridge) λειτουργία
//
//  - Δύο θύρες: inside (προστατευόμενο δίκτυο) και outside (εξωτερικό).
//  - Κίνηση inside → outside είναι «εξερχόμενη», outside → inside «εισερχόμενη».
//  - Οι κανόνες ελέγχονται με τη σειρά. Ο πρώτος που ταιριάζει αποφασίζει.
//    Αν κανένας δεν ταιριάζει, ισχύει η προεπιλεγμένη πολιτική της κατεύθυνσης.
//  - Stateful: η απάντηση μιας κίνησης που επιτράπηκε περνά πάντα (established).
//  - Το ARP περνά πάντα (όπως σε κάθε transparent firewall). Η IP του firewall είναι μόνο για διαχείριση.

import { isValidIP, isOnLink, intToIp } from './network-core.js';

const FIREWALL_PORTS = ['inside', 'outside'];
const PROTOCOLS = ['any', 'icmp', 'tcp', 'udp'];
const DIRECTIONS = ['any', 'outbound', 'inbound'];

function createFirewallConfig() {
    return { policy: { outbound: 'allow', inbound: 'deny' }, rules: [] };
}

function prefixToMask(prefix) {
    return intToIp(prefix === 0 ? 0 : (0xFFFFFFFF << (32 - prefix)) >>> 0);
}

// 'any', μία IP ή δίκτυο σε μορφή CIDR (π.χ. 192.168.1.0/24)
function isValidAddressMatch(value) {
    if (value === 'any') return true;
    const [ip, prefix] = value.split('/');
    if (!isValidIP(ip)) return false;
    return prefix === undefined || (/^\d+$/.test(prefix) && Number(prefix) <= 32);
}

function addressMatches(ip, value) {
    if (value === 'any') return true;
    const [network, prefix = '32'] = value.split('/');
    if (Number(prefix) === 0) return true;
    return isOnLink(ip, network, prefixToMask(Number(prefix)));
}

// Κανονικοποίηση τιμών φόρμας σε κανόνα: κενά πεδία → 'any', θύρα → αριθμός ή null
function createRule({ action, direction, protocol, port, source, destination }) {
    const text = value => String(value ?? '').trim();
    return {
        action: text(action) || 'allow',
        direction: text(direction) || 'any',
        protocol: text(protocol) || 'any',
        port: text(port) === '' ? null : Number(text(port)),
        source: text(source) || 'any',
        destination: text(destination) || 'any'
    };
}

// Επιστρέφει μήνυμα σφάλματος ή null
function validateRule(rule) {
    if (!['allow', 'deny'].includes(rule.action)) return 'Η ενέργεια πρέπει να είναι allow ή deny';
    if (!DIRECTIONS.includes(rule.direction)) return 'Μη έγκυρη κατεύθυνση';
    if (!PROTOCOLS.includes(rule.protocol)) return 'Μη έγκυρο πρωτόκολλο';
    if (!isValidAddressMatch(rule.source)) return `Μη έγκυρη πηγή: ${rule.source} (π.χ. any, 192.168.1.10, 192.168.1.0/24)`;
    if (!isValidAddressMatch(rule.destination)) return `Μη έγκυρος προορισμός: ${rule.destination}`;
    if (rule.port !== null) {
        if (!['tcp', 'udp'].includes(rule.protocol)) return 'Θύρα ορίζεται μόνο για TCP ή UDP';
        if (!Number.isInteger(rule.port) || rule.port < 1 || rule.port > 65535) return 'Η θύρα πρέπει να είναι 1-65535';
    }
    return null;
}

function describeRule(rule) {
    const service = rule.protocol === 'any' ? 'κάθε κίνηση' : `${rule.protocol.toUpperCase()}${rule.port ? `/${rule.port}` : ''}`;
    const direction = { any: 'όλες οι κατευθύνσεις', outbound: 'εξερχόμενη', inbound: 'εισερχόμενη' }[rule.direction];
    return `${rule.action === 'allow' ? 'ΕΠΙΤΡΕΠΕΙΤΑΙ' : 'ΑΠΑΓΟΡΕΥΕΤΑΙ'} ${service}, ${direction}, ${rule.source} → ${rule.destination}`;
}

function sessionKey(firewall, packet) {
    return [firewall.id, packet.sourceIP, packet.destinationIP, packet.protocol, packet.port ?? ''].join('|');
}

function replyKey(firewall, packet) {
    return [firewall.id, packet.destinationIP, packet.sourceIP, packet.protocol, packet.port ?? ''].join('|');
}

// Απόφαση για ένα πακέτο που διασχίζει το firewall από τη θύρα from στη θύρα to.
// packet: { sourceIP, destinationIP, protocol, port }. sessions: Set με τις ενεργές συνεδρίες.
// Επιστρέφει { allowed, reason } και καταγράφει τη συνεδρία όταν επιτρέπεται.
function inspectPacket(firewall, from, to, packet, sessions) {
    if (!FIREWALL_PORTS.includes(from) || !FIREWALL_PORTS.includes(to) || from === to) {
        return { allowed: false, reason: 'η θύρα του firewall δεν έχει ρυθμιστεί' };
    }
    if (sessions.has(replyKey(firewall, packet))) {
        return { allowed: true, reason: 'απάντηση σε επιτρεπόμενη σύνδεση (established)' };
    }

    const direction = from === 'inside' ? 'outbound' : 'inbound';
    const config = firewall.firewall ?? createFirewallConfig();
    const rule = config.rules.find(r =>
        (r.direction === 'any' || r.direction === direction) &&
        (r.protocol === 'any' || r.protocol === packet.protocol) &&
        (r.port === null || r.port === packet.port) &&
        addressMatches(packet.sourceIP, r.source) &&
        addressMatches(packet.destinationIP, r.destination));

    const allowed = (rule ? rule.action : config.policy[direction]) === 'allow';
    if (allowed) sessions.add(sessionKey(firewall, packet));
    return {
        allowed,
        reason: rule ? describeRule(rule) : `προεπιλεγμένη πολιτική ${direction === 'outbound' ? 'εξερχόμενης' : 'εισερχόμενης'} κίνησης`
    };
}

export {
    FIREWALL_PORTS,
    createFirewallConfig,
    createRule,
    validateRule,
    describeRule,
    inspectPacket
};

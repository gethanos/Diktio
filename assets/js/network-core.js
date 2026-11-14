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
// Βασικές συναρτήσεις δικτύου (IPv4)

const IPV4_PATTERN = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

// Έλεγχος εγκυρότητας IP (αυστηρά τέσσερα δεκαδικά octets 0-255)
function isValidIP(ip) {
    return typeof ip === 'string' && IPV4_PATTERN.test(ip);
}

// Μετατροπή IP σε unsigned 32-bit integer (0 για μη έγκυρη τιμή)
function ipToInt(ip) {
    if (!isValidIP(ip)) return 0;
    return ip.split('.').reduce((acc, octet) => ((acc << 8) | Number(octet)) >>> 0, 0);
}

// Μετατροπή integer σε IP
function intToIp(int) {
    return [24, 16, 8, 0].map(shift => (int >>> shift) & 255).join('.');
}

// Μάσκα: συνεχόμενα 1 από αριστερά. Η 0.0.0.0 (/0) είναι έγκυρη μόνο για routes.
function isValidSubnetMask(subnetMask, { allowZero = false } = {}) {
    if (!isValidIP(subnetMask)) return false;
    const mask = ipToInt(subnetMask);
    if (mask === 0) return allowZero;
    const inverted = ~mask >>> 0;
    return (inverted & (inverted + 1)) === 0;
}

// Μάσκα → μήκος prefix (CIDR)
function subnetMaskToCIDR(subnetMask) {
    let mask = ipToInt(subnetMask);
    let cidr = 0;
    while (mask & 0x80000000) {
        cidr++;
        mask = (mask << 1) >>> 0;
    }
    return cidr;
}

// Διεύθυνση δικτύου
function getNetworkAddress(ip, subnetMask = '255.255.255.0') {
    if (!isValidIP(ip)) return null;
    return intToIp((ipToInt(ip) & ipToInt(subnetMask)) >>> 0);
}

// Το targetIP ανήκει στο δίκτυο της διεπαφής ifaceIP/ifaceMask;
// Αυτή είναι η απόφαση που παίρνει ένας host πριν στείλει: ARP (on-link) ή gateway.
function isOnLink(targetIP, ifaceIP, ifaceMask) {
    if (!isValidIP(targetIP) || !isValidIP(ifaceIP) || !isValidSubnetMask(ifaceMask)) return false;
    const mask = ipToInt(ifaceMask);
    return ((ipToInt(targetIP) & mask) >>> 0) === ((ipToInt(ifaceIP) & mask) >>> 0);
}

// Δύο διευθύνσεις είναι στο ίδιο δίκτυο μόνο αν η καθεμία θεωρεί την άλλη on-link
// με τη δική της μάσκα. Η σχέση είναι συμμετρική, ανεξάρτητα από τη σειρά ορισμάτων.
function areInSameNetwork(ip1, ip2, subnetMask1 = '255.255.255.0', subnetMask2 = '255.255.255.0') {
    return isOnLink(ip2, ip1, subnetMask1) && isOnLink(ip1, ip2, subnetMask2);
}

function isIPInNetwork(ip, network, subnetMask) {
    return isOnLink(ip, network, subnetMask);
}

// Πληροφορίες δικτύου (RFC 3021: τα /31 έχουν 2 χρήσιμες διευθύνσεις, τα /32 μία)
function getNetworkInfo(ip, subnetMask) {
    if (!isValidIP(ip) || !isValidSubnetMask(subnetMask)) return null;
    const mask = ipToInt(subnetMask);
    const networkInt = (ipToInt(ip) & mask) >>> 0;
    const broadcastInt = (networkInt | ~mask) >>> 0;
    const prefix = subnetMaskToCIDR(subnetMask);
    const [firstInt, lastInt] = prefix >= 31
        ? [networkInt, broadcastInt]
        : [networkInt + 1, broadcastInt - 1];

    return {
        network: intToIp(networkInt),
        broadcast: intToIp(broadcastInt),
        firstUsable: intToIp(firstInt),
        lastUsable: intToIp(lastInt),
        usableHosts: lastInt - firstInt + 1
    };
}

// Μπορεί η ip να δοθεί σε host; (όχι διεύθυνση δικτύου ή broadcast)
function isUsableHostAddress(ip, subnetMask) {
    const info = getNetworkInfo(ip, subnetMask);
    if (!info) return false;
    const value = ipToInt(ip);
    return value >= ipToInt(info.firstUsable) && value <= ipToInt(info.lastUsable);
}

// Ελεύθερη διεύθυνση host στο δίκτυο, ξεκινώντας μετά το startIP (κυκλικά)
function getNextAvailableIP(startIP, subnetMask, usedIPs = []) {
    const info = getNetworkInfo(startIP, subnetMask);
    if (!info) return null;
    const used = new Set(usedIPs);
    const first = ipToInt(info.firstUsable);
    const size = info.usableHosts;
    const offset = Math.max(0, ipToInt(startIP) - first + 1);

    for (let i = 0; i < size; i++) {
        const candidate = intToIp(first + ((offset + i) % size));
        if (!used.has(candidate)) return candidate;
    }
    return null;
}

// Πρώτη ελεύθερη διεύθυνση host στο δίκτυο
function getAvailableIP(baseIP, subnetMask, usedIPs = []) {
    const info = getNetworkInfo(baseIP, subnetMask);
    if (!info) return null;
    const used = new Set(usedIPs);
    for (let value = ipToInt(info.firstUsable); value <= ipToInt(info.lastUsable); value++) {
        const candidate = intToIp(value);
        if (!used.has(candidate)) return candidate;
    }
    return null;
}

// Τυχαία ελεύθερη διεύθυνση host στο δίκτυο
function generateRandomIP(network, subnetMask, usedIPs = []) {
    const info = getNetworkInfo(network, subnetMask);
    if (!info) return null;
    const randomStart = intToIp(ipToInt(info.firstUsable) + Math.floor(Math.random() * info.usableHosts));
    return usedIPs.includes(randomStart)
        ? getNextAvailableIP(randomStart, subnetMask, usedIPs)
        : randomStart;
}

function generateRandomSubnetMask() {
    const prefixes = [8, 16, 24, 25, 26, 27, 28, 29];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    return intToIp((0xFFFFFFFF << (32 - prefix)) >>> 0);
}

// Όνομα host/domain (RFC 1123): ετικέτες από γράμματα, ψηφία και '-', χωρισμένες με '.'
function isValidHostname(name) {
    return typeof name === 'string' && name.length <= 253 &&
        /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/i.test(name);
}

// RFC 1918 ιδιωτικές, loopback και link-local διευθύνσεις
function isPrivateIP(ip) {
    return ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '127.0.0.0/8', '169.254.0.0/16']
        .some(cidr => {
            const [network, prefix] = cidr.split('/');
            return isOnLink(ip, network, intToIp((0xFFFFFFFF << (32 - Number(prefix))) >>> 0));
        });
}

export {
    ipToInt,
    intToIp,
    getNetworkAddress,
    areInSameNetwork,
    isOnLink,
    isValidIP,
    isValidHostname,
    isValidSubnetMask,
    getNetworkInfo,
    isUsableHostAddress,
    generateRandomIP,
    subnetMaskToCIDR,
    isIPInNetwork,
    generateRandomSubnetMask,
    isPrivateIP,
    getAvailableIP,
    getNextAvailableIP
};

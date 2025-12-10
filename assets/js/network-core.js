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
// Βασικές συναρτήσεις δικτύου - ΔΙΟΡΘΩΜΕΝΕΣ ΚΑΙ ΕΚΤΕΤΑΜΕΝΕΣ

// Μετατροπή IP σε integer
function ipToInt(ip) {
    if (!ip || ip === 'N/A') return 0;
    return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

// Μετατροπή integer σε IP
function intToIp(int) {
    return [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
}

// Υπολογισμός διεύθυνσης δικτύου - ΔΙΟΡΘΩΜΕΝΗ
function getNetworkAddress(ip, subnetMask = '255.255.255.0') {
    if (!ip || ip === 'N/A') return null;
    const ipInt = ipToInt(ip);
    const maskInt = ipToInt(subnetMask);
    const networkInt = ipInt & maskInt;
    return intToIp(networkInt);
}

// Έλεγχος αν δύο IP είναι στο ίδιο δίκτυο - ΔΙΟΡΘΩΜΕΝΗ
function areInSameNetwork(ip1, ip2, subnetMask1 = '255.255.255.0', subnetMask2 = '255.255.255.0') {
    console.log(`[NETWORK CORE] Checking: ${ip1}/${subnetMask1} vs ${ip2}/${subnetMask2}`);
    
    if (!ip1 || !ip2 || ip1 === 'N/A' || ip2 === 'N/A') {
        console.log(`[NETWORK CORE] Invalid IPs`);
        return false;
    }
    
    if (subnetMask1 === '0.0.0.0' || subnetMask2 === '0.0.0.0') {
        console.log(`[NETWORK CORE] Invalid subnet masks`);
        return false;
    }
    
    // Χρησιμοποιούμε την ίδια μάσκα για και τις δύο IP
    const effectiveMask = subnetMask1;
    
    const network1 = getNetworkAddress(ip1, effectiveMask);
    const network2 = getNetworkAddress(ip2, effectiveMask);
    
    console.log(`[NETWORK CORE] ${ip1} -> ${network1}`);
    console.log(`[NETWORK CORE] ${ip2} -> ${network2}`);
    console.log(`[NETWORK CORE] Same? ${network1 === network2}`);
    
    return network1 === network2;
}

// Έλεγχος εγκυρότητας IP
function isValidIP(ip) {
    if (!ip || ip === 'N/A') return false;
    const ipPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    if (!ipPattern.test(ip)) return false;
    
    const parts = ip.split('.');
    return parts.every(part => {
        const num = parseInt(part, 10);
        return num >= 0 && num <= 255;
    });
}

// Έλεγχος εγκυρότητας μάσκας υποδικτύου
function isValidSubnetMask(subnetMask) {
    if (!subnetMask || subnetMask === '0.0.0.0') return false;
    
    const validMasks = [
        '255.255.255.0', '255.255.0.0', '255.0.0.0',
        '255.255.255.128', '255.255.255.192', '255.255.255.224',
        '255.255.255.240', '255.255.255.248', '255.255.255.252',
        '255.255.255.254', '255.255.255.255'
    ];
    
    if (validMasks.includes(subnetMask)) return true;
    
    const maskInt = ipToInt(subnetMask);
    if (maskInt === 0) return false;
    
    let foundZero = false;
    for (let i = 31; i >= 0; i--) {
        const bit = (maskInt >> i) & 1;
        if (bit === 0) {
            foundZero = true;
        } else if (foundZero) {
            return false;
        }
    }
    
    return true;
}

// Υπολογισμός διαθέσιμων διευθύνσεων σε δίκτυο
function getNetworkInfo(ip, subnetMask) {
    const network = getNetworkAddress(ip, subnetMask);
    const networkInt = ipToInt(network);
    const maskInt = ipToInt(subnetMask);
    
    // Υπολογισμός broadcast address
    const wildcard = ~maskInt >>> 0;
    const broadcastInt = networkInt | wildcard;
    const broadcast = intToIp(broadcastInt);
    
    // Υπολογισμός πρώτης και τελευταίας χρήσιμης διεύθυνσης
    const firstUsableInt = networkInt + 1;
    const lastUsableInt = broadcastInt - 1;
    
    return {
        network: network,
        broadcast: broadcast,
        firstUsable: intToIp(firstUsableInt),
        lastUsable: intToIp(lastUsableInt),
        usableHosts: lastUsableInt - firstUsableInt + 1
    };
}

// Δημιουργία τυχαίας IP εντός δικτύου
function generateRandomIP(network, subnetMask) {
    const netInfo = getNetworkInfo(network, subnetMask);
    const firstInt = ipToInt(netInfo.firstUsable);
    const lastInt = ipToInt(netInfo.lastUsable);
    
    if (firstInt >= lastInt) return network;
    
    const randomInt = Math.floor(Math.random() * (lastInt - firstInt + 1)) + firstInt;
    return intToIp(randomInt);
}

// Εξαγωγή CIDR από μάσκα υποδικτύου
function subnetMaskToCIDR(subnetMask) {
    const maskInt = ipToInt(subnetMask);
    let cidr = 0;
    
    for (let i = 31; i >= 0; i--) {
        if ((maskInt >> i) & 1) {
            cidr++;
        } else {
            break;
        }
    }
    
    return cidr;
}

// Έλεγχος αν το IP βρίσκεται εντός δικτύου
function isIPInNetwork(ip, network, subnetMask) {
    const ipNetwork = getNetworkAddress(ip, subnetMask);
    return ipNetwork === network;
}

// Δημιουργία τυχαίας μάσκας υποδικτύου
function generateRandomSubnetMask() {
    const masks = [
        '255.255.255.0',
        '255.255.0.0',
        '255.0.0.0',
        '255.255.255.128',
        '255.255.255.192',
        '255.255.255.224',
        '255.255.255.240',
        '255.255.255.248'
    ];
    
    return masks[Math.floor(Math.random() * masks.length)];
}

// ΝΕΕΣ ΣΥΝΑΡΤΗΣΕΙΣ - Προστέθηκαν από τη δεύτερη έκδοση

// Έλεγχος αν η IP είναι private
function isPrivateIP(ip) {
    if (!ip || ip === 'N/A') return false;
    
    const ipInt = ipToInt(ip);
    
    // 10.0.0.0/8
    if (ipInt >= ipToInt('10.0.0.0') && ipInt <= ipToInt('10.255.255.255')) {
        return true;
    }
    
    // 172.16.0.0/12
    if (ipInt >= ipToInt('172.16.0.0') && ipInt <= ipToInt('172.31.255.255')) {
        return true;
    }
    
    // 192.168.0.0/16
    if (ipInt >= ipToInt('192.168.0.0') && ipInt <= ipToInt('192.168.255.255')) {
        return true;
    }
    
    // 127.0.0.0/8 (Loopback)
    if (ipInt >= ipToInt('127.0.0.0') && ipInt <= ipToInt('127.255.255.255')) {
        return true;
    }
    
    // 169.254.0.0/16 (Link-local)
    if (ipInt >= ipToInt('169.254.0.0') && ipInt <= ipToInt('169.254.255.255')) {
        return true;
    }
    
    return false;
}

// Βρίσκει ελεύθερη διεύθυνση IP
function getAvailableIP(baseIP, subnetMask, usedIPs = []) {
    if (!isValidIP(baseIP) || !isValidSubnetMask(subnetMask)) {
        return null;
    }
    
    const netInfo = getNetworkInfo(baseIP, subnetMask);
    const firstInt = ipToInt(netInfo.firstUsable);
    const lastInt = ipToInt(netInfo.lastUsable);
    
    for (let ipInt = firstInt; ipInt <= lastInt; ipInt++) {
        const potentialIP = intToIp(ipInt);
        
        if (!usedIPs.includes(potentialIP)) {
            return potentialIP;
        }
    }
    
    return null;
}

// Λήψη επόμενης διαθέσιμης IP
function getNextAvailableIP(startIP, subnetMask, usedIPs = []) {
    if (!isValidIP(startIP) || !isValidSubnetMask(subnetMask)) {
        return null;
    }
    
    const startInt = ipToInt(startIP);
    const netInfo = getNetworkInfo(startIP, subnetMask);
    const firstInt = ipToInt(netInfo.firstUsable);
    const lastInt = ipToInt(netInfo.lastUsable);
    
    // Ξεκινάμε από την επόμενη IP από τη startIP
    for (let ipInt = startInt + 1; ipInt <= lastInt; ipInt++) {
        const potentialIP = intToIp(ipInt);
        
        if (!usedIPs.includes(potentialIP)) {
            return potentialIP;
        }
    }
    
    // Αν δεν βρει από εκεί και μετά, δοκιμάζει από την αρχή
    for (let ipInt = firstInt; ipInt < startInt; ipInt++) {
        const potentialIP = intToIp(ipInt);
        
        if (!usedIPs.includes(potentialIP)) {
            return potentialIP;
        }
    }
    
    return null;
}

// Έκδοση όλων των συναρτήσεων
export {
    ipToInt,
    intToIp,
    getNetworkAddress,
    areInSameNetwork,
    isValidIP,
    isValidSubnetMask,
    getNetworkInfo,
    generateRandomIP,
    subnetMaskToCIDR,
    isIPInNetwork,
    generateRandomSubnetMask,
    // Νέες συναρτήσεις
    isPrivateIP,
    getAvailableIP,
    getNextAvailableIP
};

// Εκτέλεση από τη ρίζα του repo: node --test
// Ακεραιότητα των μοντέλων: ο κατάλογος list.json και τα αρχεία του data/models.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const dir = new URL('../data/models/', import.meta.url);
const read = file => JSON.parse(fs.readFileSync(new URL(file, dir), 'utf8'));
const catalogue = read('list.json');

test('list.json: every entry points to an existing model with the stated size', () => {
    assert.equal(new Set(catalogue.map(m => m.file)).size, catalogue.length, 'duplicate file');
    assert.equal(new Set(catalogue.map(m => m.name)).size, catalogue.length, 'duplicate name');
    for (const entry of catalogue) {
        for (const key of ['name', 'file', 'description', 'icon', 'color']) assert.ok(entry[key], `${entry.file}: missing ${key}`);
        const model = read(entry.file);
        assert.equal(model.devices.length, entry.devices, `${entry.file}: devices`);
        assert.equal(model.connections.length, entry.connections, `${entry.file}: connections`);
    }
});

test('every model file in data/models is listed in list.json', () => {
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'list.json');
    assert.deepEqual(files.sort(), catalogue.map(m => m.file).sort());
});

test('model files: connections and ports refer to existing devices and connections', () => {
    for (const { file } of catalogue) {
        const model = read(file);
        const devices = new Set(model.devices.map(d => d.id));
        const connections = new Set(model.connections.map(c => c.id));
        assert.equal(devices.size, model.devices.length, `${file}: duplicate device id`);
        for (const c of model.connections) {
            assert.ok(devices.has(c.device1Id) && devices.has(c.device2Id), `${file}: ${c.id} refers to a missing device`);
        }
        for (const d of model.devices) {
            for (const id of [...(d.connections || []), ...Object.keys(d.connectionInterfaces || {})]) {
                assert.ok(connections.has(id), `${file}: ${d.name} refers to missing connection ${id}`);
            }
        }
    }
});

test('model files: a DNS setting that points to a device in the model points to a DNS server', () => {
    for (const { file } of catalogue) {
        const model = read(file);
        const owner = ip => model.devices.find(d => d.ip === ip ||
            Object.values(d.interfaces || {}).some(iface => iface.ip === ip && iface.enabled !== false));
        for (const d of model.devices.filter(d => d.type !== 'router')) {
            const target = d.dns?.[0] && owner(d.dns[0]);
            if (target) assert.equal(target.type, 'dns', `${file}: ${d.name} uses ${target.name} (${target.type}) as DNS server`);
        }
    }
});

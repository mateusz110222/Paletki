import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { copyText } from '../src/lib/clipboard.ts';

function mockGlobal(t: TestContext, name: string, value: unknown) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, value });
    t.after(() => {
        if (descriptor) Object.defineProperty(globalThis, name, descriptor);
        else Reflect.deleteProperty(globalThis, name);
    });
}

test('copies the exact identifier with the Clipboard API', async t => {
    const copied: string[] = [];
    mockGlobal(t, 'navigator', { clipboard: { writeText: async (text: string) => { copied.push(text); } } });
    mockGlobal(t, 'document', undefined);

    assert.equal(await copyText('ATSGH001'), true);
    assert.deepEqual(copied, ['ATSGH001']);
});

test('handles denied clipboard permission without an unhandled rejection or fallback', async t => {
    mockGlobal(t, 'navigator', { clipboard: { writeText: async () => { throw new Error('NotAllowedError'); } } });
    mockGlobal(t, 'document', { createElement: () => assert.fail('Should not bypass denied permission') });

    assert.equal(await copyText('ATSGH001'), false);
});

for (const outcome of ['success', 'failure', 'exception'] as const) {
    test(`HTTP clipboard fallback: ${outcome}, removes temporary field and restores focus`, async t => {
        const events: string[] = [];
        const textarea = {
            value: '', readOnly: false, style: { cssText: '' },
            focus: () => { events.push('focus'); },
            select: () => { events.push('select'); },
            remove: () => { events.push('remove'); },
        };
        mockGlobal(t, 'navigator', {});
        mockGlobal(t, 'document', {
            activeElement: { focus: () => { events.push('restore'); } },
            createElement: (tag: string) => { assert.equal(tag, 'textarea'); return textarea; },
            body: { appendChild: (element: unknown) => { assert.equal(element, textarea); events.push('append'); } },
            execCommand: (command: string) => {
                assert.equal(command, 'copy');
                assert.equal(textarea.value, 'ATSGH001');
                assert.equal(textarea.readOnly, true);
                assert.deepEqual(events, ['append', 'focus', 'select']);
                events.push('copy');
                if (outcome === 'exception') throw new Error('Copy unavailable');
                return outcome === 'success';
            },
        });

        assert.equal(await copyText('ATSGH001'), outcome === 'success');
        assert.deepEqual(events, ['append', 'focus', 'select', 'copy', 'remove', 'restore']);
    });
}

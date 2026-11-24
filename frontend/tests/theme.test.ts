import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';

test('the initial theme honors saved preferences before the app renders', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    assert.ok(script);

    for (const [saved, systemDark, preference, theme] of [
        [null, false, 'dark', 'dark'],
        ['light', true, 'light', 'light'],
        ['dark', false, 'dark', 'dark'],
        ['system', false, 'system', 'light'],
        ['system', true, 'system', 'dark'],
    ] as const) {
        const dataset = {};
        const meta = {content: '#090d16'};
        runInNewContext(script, {
            document: {documentElement: {dataset}, querySelector: () => meta},
            localStorage: {getItem: () => saved},
            matchMedia: () => ({matches: systemDark}),
        });
        assert.deepEqual(dataset, {themePreference: preference, theme});
        assert.equal(meta.content, theme === 'light' ? '#f3f5fa' : '#090d16');
    }
});

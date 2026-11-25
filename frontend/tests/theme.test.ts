import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import {runInNewContext} from 'node:vm';

test('the initial theme honors saved preferences before the app renders and matches the Nginx CSP hash', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const nginx = readFileSync(new URL('../../nginx.conf', import.meta.url), 'utf8');
    assert.doesNotMatch(html, /theme-init\.js|select-picker-scrollbar\.css/);

    const match = html.match(/<script>([^<]+)<\/script>/);
    assert.ok(match, 'Missing inline theme initialization script in index.html');
    const script = match[1];
    assert.doesNotMatch(script, /[\r\n]/, 'Inline theme script must stay single-line so line endings never alter its CSP hash');

    const hash = createHash('sha256').update(script, 'utf8').digest('base64');
    assert.ok(nginx.includes(`'sha256-${hash}'`), `nginx.conf CSP script-src must include 'sha256-${hash}'`);

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

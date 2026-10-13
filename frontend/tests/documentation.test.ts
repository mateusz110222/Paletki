import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync, statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {Script} from 'node:vm';
import {
    canOpenDocumentationLink, getDocumentation, searchDocumentation, type DocSection,
} from '../src/documentation/content';
import {getViewAccess} from '../src/auth/view-access';
import {renderOfflineDocumentation, serializeForHtml} from '../scripts/build-documentation.mjs';

test('search covers paragraphs, steps, table cells and API examples with accent-insensitive AND matching', () => {
    const sections = getDocumentation('pl');
    assert.ok(searchDocumentation(sections, 'ZGLOSZENIE   uszkodzenia').some(section => section.id === 'getting-started'));
    assert.ok(searchDocumentation(sections, 'licznik laczny').some(section => section.id === 'status-counters'));
    assert.ok(searchDocumentation(sections, 'mycie naprawy').some(section => section.id === 'maintenance'));
    assert.ok(searchDocumentation(sections, 'POST soldering SOLDER11').some(section => section.id === 'api'));
    assert.equal(searchDocumentation(sections, '  ').length, sections.length);
    assert.deepEqual(searchDocumentation(sections, 'mycie never-mentioned-term'), []);
});

test('both languages have complete matching chapters, unique identifiers and valid quick links', () => {
    const polish = getDocumentation('pl');
    const english = getDocumentation('en');
    assert.deepEqual(polish.map(section => section.id), english.map(section => section.id));
    assert.equal(new Set(polish.map(section => section.id)).size, polish.length);
    assert.ok(polish.length >= 18);
    for (const sections of [polish, english]) {
        for (const section of sections) {
            assert.ok(section.title && section.description && section.blocks.length);
            for (const block of section.blocks) {
                if ('text' in block) assert.ok(block.text.trim());
                else if ('items' in block) assert.ok(block.items.length && block.items.every(item => item.trim()));
                else assert.ok(block.rows.length && block.rows.every(row => row.length === block.headers.length));
            }
        }
        for (const id of ['getting-started', 'status-counters', 'architecture']) assert.ok(sections.some(section => section.id === id));
    }
    assert.deepEqual(searchDocumentation(english, 'pierwsze kroki'), []);
    assert.ok(searchDocumentation(english, 'cycle acknowledgement').some(section => section.id === 'soldering-encore'));
});

test('documentation panel links follow operator, UR, ME and IT view permissions', () => {
    const roles = [
        {it: false, ur: false, me: false, expected: [true, false, false, true, false]},
        {it: false, ur: true, me: false, expected: [true, false, true, false, false]},
        {it: false, ur: false, me: true, expected: [true, true, true, true, false]},
        {it: true, ur: true, me: false, expected: [true, true, true, true, true]},
    ];
    for (const role of roles) {
        const access = getViewAccess({has_it_department_access: role.it, has_ur_department_access: role.ur, has_me_department_access: role.me});
        assert.deepEqual((['all', 'manage', 'maintenance', 'operator', 'it'] as const).map(rule => canOpenDocumentationLink(rule, access)), role.expected);
    }
});

test('standalone HTML is current, embeds both languages and a valid script, and uses no external resources', () => {
    const target = new URL('../../docs/Paletki.html', import.meta.url);
    const before = statSync(target).mtimeMs;
    execFileSync(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('../scripts/build-documentation.mjs', import.meta.url)), '--check']);
    assert.equal(statSync(target).mtimeMs, before, '--check must not rewrite the file');
    const html = readFileSync(target, 'utf8');
    assert.equal(html, renderOfflineDocumentation());
    const payload = html.match(/<script id="offline-content" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
    assert.ok(payload);
    assert.deepEqual(JSON.parse(payload), {pl: getDocumentation('pl'), en: getDocumentation('en')});
    const script = html.match(/<script id="offline-app">([\s\S]*?)<\/script>/)?.[1];
    assert.ok(script);
    assert.doesNotThrow(() => new Script(script));
    assert.doesNotMatch(html, /<(?:script|img|iframe)[^>]+src\s*=|<link\b[^>]+href\s*=|@import\b|url\(\s*['"]?https?:/i);
    assert.ok(html.includes('@media print'));
    assert.ok(html.includes('soldering.php') && html.includes('soldering-encore.php'));
    assert.ok(html.includes('6_production_tracking.up.sql'));
});

test('offline rendering escapes HTML and script terminators while preserving searchable content', () => {
    const dangerous = '</script><script>alert("x")</script><img src=x onerror=alert(1)> & \u2028 \u2029';
    const section: DocSection = {id: 'getting-started', group: 'guide', title: dangerous, description: dangerous,
        blocks: [{kind: 'paragraph', text: dangerous}, {kind: 'table', headers: [dangerous], rows: [[dangerous]]}, {kind: 'code', text: dangerous}]};
    const html = renderOfflineDocumentation({pl: [section], en: [section]});
    assert.ok(html.includes('&lt;/script&gt;'));
    assert.ok(!html.includes(dangerous));
    assert.deepEqual(JSON.parse(serializeForHtml({value: dangerous})), {value: dangerous});
    assert.equal((html.match(/<script\b/g) ?? []).length, 3);
    assert.doesNotMatch(serializeForHtml({value: dangerous}), /[<>&\u2028\u2029]/);
});

import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {
    documentationText, getDocumentation, normalizeDocumentationText, searchDocumentation,
} from '../src/documentation/content.ts';

const target = new URL('../../docs/Paletki.html', import.meta.url);
const css = readFileSync(new URL('../src/documentation/documentation.css', import.meta.url), 'utf8');
const labels = {
    pl: {title: 'Dokumentacja', search: 'Szukaj instrukcji, operacji, endpointu…', clear: 'Wyczyść wyszukiwanie',
        contents: 'W tym przewodniku', guide: 'Przewodnik użytkownika', technical: 'Dla zespołu IT',
        note: 'Warto wiedzieć', chapter: 'Rozdział', results: 'Znalezione rozdziały:', empty: 'Brak wyników. Spróbuj „mycie”, „FIS” albo „cykle”.',
        panel: 'Panel w aplikacji (wymaga odpowiednich uprawnień):', previous: 'Poprzedni rozdział', next: 'Następny rozdział',
        quick: [['getting-started', 'Zacznij tutaj', 'Dostęp, role i pierwsze kroki'], ['status-counters', 'Statusy i liczniki', 'Paletka, limit i powrót do produkcji'], ['architecture', 'Poznaj integrację', 'FIS, API i przepływ danych']]},
    en: {title: 'Documentation', search: 'Search guides, operations, endpoints…', clear: 'Clear search',
        contents: 'In this guide', guide: 'User guide', technical: 'For the IT team',
        note: 'Good to know', chapter: 'Chapter', results: 'Matching chapters:', empty: 'No results. Try “washing”, “FIS” or “cycles”.',
        panel: 'Application panel (appropriate permissions required):', previous: 'Previous chapter', next: 'Next chapter',
        quick: [['getting-started', 'Start here', 'Access, roles and first steps'], ['status-counters', 'Statuses and counters', 'Pallets, limits and return to production'], ['architecture', 'Explore integration', 'FIS, APIs and data flow']]},
};

export function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[char]));
}
export function serializeForHtml(value) {
    return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}
function renderBlock(block, language) {
    if (block.kind === 'heading') return `<h3 class="doc-subheading">${escapeHtml(block.text)}</h3>`;
    if (block.kind === 'paragraph') return `<p class="doc-paragraph">${escapeHtml(block.text)}</p>`;
    if (block.kind === 'note') return `<aside class="doc-note"><div><strong>${labels[language].note}</strong><p>${escapeHtml(block.text)}</p></div></aside>`;
    if (block.kind === 'code') return `<pre class="doc-code" tabindex="0"><code>${escapeHtml(block.text)}</code></pre>`;
    if (block.kind === 'steps' || block.kind === 'flow') return `<ol class="doc-${block.kind}">${block.items.map((item, index) => `<li><span${block.kind === 'flow' ? ' class="doc-flow-index"' : ''} aria-hidden="true">${String(index + 1).padStart(2, '0')}</span>${block.kind === 'steps' ? `<p>${escapeHtml(item)}</p>` : `<span>${escapeHtml(item)}</span>`}</li>`).join('')}</ol>`;
    return `<div class="doc-table-scroll" role="region" aria-label="${escapeHtml(block.headers.join(' / '))}" tabindex="0"><table class="doc-table"><thead><tr>${block.headers.map(header => `<th scope="col">${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${block.rows.map(row => `<tr>${row.map((cell, index) => index ? `<td>${escapeHtml(cell)}</td>` : `<th scope="row">${escapeHtml(cell)}</th>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function chapterLink(id, title, language, className = '') {
    return `<a class="${className}" href="#lang=${language}&amp;section=${escapeHtml(id)}" data-section="${escapeHtml(id)}">${escapeHtml(title)}</a>`;
}
function renderLanguage(sections, language) {
    const ui = labels[language];
    return `<div id="language-${language}" class="offline-language" lang="${language}"${language === 'en' ? ' hidden' : ''}>
<div class="doc-shortcuts">${ui.quick.map(([id, title, description]) => `<a class="doc-shortcut" href="#lang=${language}&amp;section=${id}" data-section="${id}"><span class="doc-shortcut-copy"><strong>${title}</strong><span>${description}</span></span><span aria-hidden="true">→</span></a>`).join('')}</div>
<div class="doc-layout"><aside class="doc-desktop-toc"><div class="doc-toc-sticky"><details class="offline-toc" open><summary>${ui.contents}</summary><nav aria-label="${ui.contents}">${['guide', 'technical'].map(group => `<div class="doc-toc-group"><p>${ui[group]}</p>${sections.filter(section => section.group === group).map(section => chapterLink(section.id, section.title, language, 'doc-toc-link')).join('')}</div>`).join('')}</nav></details></div></aside>
<div class="doc-content"><p class="offline-result-count" role="status" aria-live="polite"></p><p class="offline-empty" hidden>${ui.empty}</p>${sections.map((section, index) => `<article id="${language}-${section.id}" class="doc-article" data-chapter="${section.id}" tabindex="-1" aria-labelledby="${language}-${section.id}-title"><header class="doc-article-header"><p class="doc-eyebrow">${ui[section.group]}<span class="doc-chapter-number">${ui.chapter} ${String(index + 1).padStart(2, '0')} / ${sections.length}</span></p><h2 id="${language}-${section.id}-title">${escapeHtml(section.title)}</h2><p>${escapeHtml(section.description)}</p></header><div class="doc-article-body">${section.blocks.map(block => renderBlock(block, language)).join('')}</div>${section.link ? `<footer class="doc-article-action"><p>${ui.panel} ${escapeHtml(section.link.label)} <code>${escapeHtml(section.link.to)}</code></p></footer>` : ''}<nav class="offline-pagination" aria-label="${ui.contents}">${index ? chapterLink(sections[index - 1].id, `← ${ui.previous}: ${sections[index - 1].title}`, language) : '<span></span>'}${index < sections.length - 1 ? chapterLink(sections[index + 1].id, `${ui.next}: ${sections[index + 1].title} →`, language) : ''}</nav></article>`).join('')}</div></div></div>`;
}

export function renderOfflineDocumentation(data = {pl: getDocumentation('pl'), en: getDocumentation('en')}) {
    return `<!DOCTYPE html>
<!-- Generated from frontend/src/documentation/content.ts. Run pnpm docs:build. -->
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="dark"><title>Paletki / PalletX — dokumentacja / documentation</title><style>
:root { --font-sans: 'Plus Jakarta Sans', 'Segoe UI', sans-serif; --font-mono: Consolas, monospace; }
* { box-sizing: border-box; } body { margin: 0; background: #090d16; color: #f9fafb; font-family: var(--font-sans); }
h1,h2,h3,h4,p,ol { margin: 0; } button,input { font: inherit; border: 0; } button { background: transparent; color: inherit; } a { color: inherit; text-decoration: none; } [hidden] { display: none !important; }
.documentation { padding: 24px; } .offline-toolbar { display: flex; align-items: center; gap: 12px; padding: 14px 18px; border: 1px solid #263348; border-radius: 12px; background: #111827; }
.offline-toolbar h1 { font-size: 14px; font-weight: 600; white-space: nowrap; } .offline-toolbar .doc-search-wrap { flex: 1; }
.offline-languages { display: flex; gap: 5px; } .offline-languages button { padding: 10px; border: 1px solid #374151; border-radius: 7px; font-size: 12px; cursor: pointer; } .offline-languages button[aria-pressed="true"] { color: #c7d2fe; background: #6366f125; border-color: #818cf8; }
.offline-toc summary { padding: 12px; cursor: pointer; font-size: 12px; margin-bottom: 18px; color: #dbe4f3; }
.offline-result-count,.offline-empty { font-size: 13px; color: #a6b4c8; margin-bottom: 18px; } .offline-pagination { display: flex; justify-content: space-between; gap: 24px; padding: 22px 36px; border-top: 1px solid #263348; font-size: 12px; color: #b8c3ff; }
.doc-article + .doc-article { margin-top: 20px; } .doc-article-header h2 { font-size: clamp(23px, 2.3vw, 30px); font-weight: 650; line-height: 1.3; letter-spacing: -.035em; margin-top: 15px; }
.doc-article-action p { flex-wrap: wrap; } .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
${css}
@media (max-width: 767px) { .documentation { padding: 14px; } .offline-toolbar { flex-wrap: wrap; padding: 14px; } .offline-toolbar .doc-search-wrap { order: 3; flex-basis: 100%; } .offline-languages { margin-left: auto; } .offline-language .doc-desktop-toc { display: block; margin-bottom: 18px; } .offline-language .doc-toc-sticky { position: static; max-height: none; } .offline-toc { border: 1px solid #263348; border-radius: 9px; background: #111827; } .offline-toc summary { margin-bottom: 0; padding: 16px; } .offline-toc nav { padding: 0 10px 15px; } .offline-pagination { padding: 20px; flex-wrap: wrap; } }
@media print {
  body { color: #111; background: white; } .documentation { max-width: none; padding: 0; }
  .offline-toolbar, .doc-shortcuts, .doc-desktop-toc, .offline-result-count, .offline-empty, .offline-pagination { display: none !important; }
  .doc-layout { display: block; } .offline-language:not([hidden]) .doc-article[hidden] { display: block !important; }
  .doc-article { background: white; border-color: #ccc; margin: 0 0 18px; }
  .doc-article-header, .doc-article-body, .doc-article-action { padding: 16px; border-color: #ccc; }
  .documentation :is(p,td,th,h2,h3,strong,span,code) { color: #111 !important; }
  .doc-note,.doc-code,.doc-flow li,.doc-table thead { background: #f5f5f5; border-color: #ccc; }
  .doc-table-scroll { overflow: visible; border-color: #ccc; } .doc-table { table-layout: fixed; } .doc-table th,.doc-table td { min-width: 0; white-space: normal; border-color: #ccc; padding: 8px; }
  .doc-code { white-space: pre-wrap; overflow-wrap: anywhere; } .doc-flow { display: block; } .doc-flow li { margin-bottom: 6px; }
  .doc-article-header, .doc-note, tr { break-inside: avoid; } h2,h3 { break-after: avoid; }
}
</style></head><body><main class="documentation"><header class="offline-toolbar"><h1 id="offline-title">Paletki · Dokumentacja</h1><div class="doc-search-wrap"><label class="sr-only" for="offline-search">Szukaj instrukcji, operacji, endpointu…</label><input id="offline-search" type="search" placeholder="Szukaj instrukcji, operacji, endpointu…" autocomplete="off"><button id="offline-clear" type="button" aria-label="Wyczyść wyszukiwanie">×</button></div><div class="offline-languages" aria-label="Language"><button id="lang-pl" type="button" aria-pressed="true">PL</button><button id="lang-en" type="button" aria-pressed="false">EN</button></div></header>${renderLanguage(data.pl, 'pl')}${renderLanguage(data.en, 'en')}</main>
<script id="offline-content" type="application/json">${serializeForHtml(data)}</script><script id="offline-ui" type="application/json">${serializeForHtml(labels)}</script><script id="offline-app">
(() => {
  const normalizeDocumentationText = ${normalizeDocumentationText.toString()};
  const documentationText = ${documentationText.toString()};
  const searchDocumentation = ${searchDocumentation.toString()};
  const content = JSON.parse(document.getElementById('offline-content').textContent);
  const labels = JSON.parse(document.getElementById('offline-ui').textContent);
  const input = document.getElementById('offline-search');
  let language = 'pl', selected = content.pl[0].id;
  function render() {
    const searching = Boolean(input.value.trim());
    const matches = searchDocumentation(content[language], input.value).map(section => section.id);
    document.documentElement.lang = language;
    document.getElementById('offline-title').textContent = 'Paletki · ' + labels[language].title;
    for (const lang of ['pl', 'en']) {
      const panel = document.getElementById('language-' + lang);
      panel.hidden = lang !== language;
      document.getElementById('lang-' + lang).setAttribute('aria-pressed', String(lang === language));
      for (const article of panel.querySelectorAll('[data-chapter]')) article.hidden = searching ? !matches.includes(article.dataset.chapter) : article.dataset.chapter !== selected;
      for (const link of panel.querySelectorAll('.doc-toc-link')) {
        link.classList.toggle('is-active', !searching && link.dataset.section === selected);
        if (!searching && link.dataset.section === selected) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
      }
      panel.querySelector('.offline-result-count').textContent = searching ? labels[language].results + ' ' + matches.length : '';
      panel.querySelector('.offline-empty').hidden = !searching || matches.length > 0;
    }
    input.placeholder = labels[language].search;
    document.querySelector('label[for="offline-search"]').textContent = labels[language].search;
    document.getElementById('offline-clear').setAttribute('aria-label', labels[language].clear);
  }
  function readAddress() {
    const params = new URLSearchParams(location.hash.slice(1));
    language = params.get('lang') === 'en' ? 'en' : 'pl';
    selected = content[language].some(section => section.id === params.get('section')) ? params.get('section') : content[language][0].id;
    render();
  }
  function address() { location.hash = new URLSearchParams({lang: language, section: selected}).toString(); }
  for (const lang of ['pl', 'en']) document.getElementById('lang-' + lang).addEventListener('click', () => { language = lang; render(); address(); });
  document.querySelectorAll('[data-section]').forEach(link => link.addEventListener('click', event => {
    event.preventDefault(); selected = link.dataset.section; input.value = ''; render(); address();
    const article = document.getElementById(language + '-' + selected);
    article.focus({preventScroll: true}); article.scrollIntoView({block: 'start', behavior: 'instant'});
    if (matchMedia('(max-width:767px)').matches) document.getElementById('language-' + language).querySelector('details').open = false;
  }));
  input.addEventListener('input', render);
  document.getElementById('offline-clear').addEventListener('click', () => { input.value = ''; render(); input.focus(); });
  addEventListener('hashchange', readAddress);
  readAddress();
  if (matchMedia('(max-width:767px)').matches) document.querySelectorAll('.offline-toc').forEach(toc => { toc.open = false; });
})();
</script></body></html>
`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const html = renderOfflineDocumentation();
    if (process.argv.includes('--check')) {
        if (readFileSync(target, 'utf8') !== html) throw new Error('Offline documentation is outdated. Run pnpm docs:build.');
        console.log('Offline documentation is up to date.');
    } else {
        mkdirSync(new URL('../../docs/', import.meta.url), {recursive: true});
        writeFileSync(target, html, 'utf8');
        console.log(`Generated ${fileURLToPath(target)}`);
    }
}

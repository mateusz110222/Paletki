import assert from 'node:assert/strict';
import {test} from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router';
import {LanguageProvider} from '../src/i18n/LanguageContext';

test('LAB opens with the pallet table first and the scanner second', async context => {
    Object.defineProperty(globalThis, 'window', {configurable: true, value: {location: {origin: 'http://qa.test'}}});
    context.after(() => {Reflect.deleteProperty(globalThis, 'window');});
    const {LabView} = await import('../src/views/LabView');
    const html = renderToStaticMarkup(<LanguageProvider><MemoryRouter><LabView/></MemoryRouter></LanguageProvider>);
    assert.deepEqual(Array.from(html.matchAll(/href="([^"]+)"/g), match => match[1]), ['/lab/table', '/lab/scan']);
});

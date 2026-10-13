import assert from 'node:assert/strict';
import {test} from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router';
import {LanguageProvider} from '../src/i18n/LanguageContext';
import {MaintenanceHubView} from '../src/views/MaintenanceHubView';

test('maintenance offers four destinations in a two-column grid including shared history lookup', () => {
    const html = renderToStaticMarkup(<LanguageProvider><MemoryRouter><MaintenanceHubView/></MemoryRouter></LanguageProvider>);
    const destinations = Array.from(html.matchAll(/href="([^"]+)"/g), match => match[1]);
    assert.deepEqual(destinations, ['/maintenance/service', '/maintenance/washing', '/maintenance/defects', '/maintenance/history']);
    assert.match(html, /md:grid-cols-2/);
    assert.doesNotMatch(html, /grid-cols-3/);
    assert.match(html, /Historia paletki/);
});

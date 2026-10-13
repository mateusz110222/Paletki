import assert from 'node:assert/strict';
import {test} from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {LanguageProvider} from '../src/i18n/LanguageContext';
import {ViewLoading, ViewLoadError} from '../src/components/ViewBoundary';

test('view loading and failure expose localized accessible feedback', () => {
    const loading = renderToStaticMarkup(<LanguageProvider><ViewLoading/></LanguageProvider>);
    assert.match(loading, /role="status"/);
    assert.match(loading, /Ładowanie widoku/);
    const failure = renderToStaticMarkup(<LanguageProvider><ViewLoadError/></LanguageProvider>);
    assert.match(failure, /role="alert"/);
    assert.match(failure, /Nie udało się otworzyć widoku/);
    assert.match(failure, /<button type="button"/);
    assert.match(failure, /Odśwież stronę/);
});

import assert from 'node:assert/strict';
import {test} from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {ModalFormActions} from '../src/components/ModalFormActions';
import {LanguageProvider} from '../src/i18n/LanguageContext';

test('fault confirmation can place submit before back while ordinary forms keep cancel first', () => {
    for (const submitFirst of [false, true]) {
        const html = renderToStaticMarkup(<LanguageProvider>
            <ModalFormActions onCancel={() => {}} cancelLabel="Back" submitLabel="Confirm" submitFirst={submitFirst}/>
        </LanguageProvider>);
        assert.deepEqual(html.match(/Back|Confirm/g), submitFirst ? ['Confirm', 'Back'] : ['Back', 'Confirm']);
    }
});

test('washing confirmation uses a yellow button with dark text', () => {
    const html = renderToStaticMarkup(<LanguageProvider>
        <ModalFormActions onCancel={() => {}} submitLabel="Report washing" variant="warning"/>
    </LanguageProvider>);
    assert.match(html, /<button\b[^>]*type="submit"[^>]*bg-yellow-300 text-yellow-950[^>]*><span>Report washing<\/span>/);
});

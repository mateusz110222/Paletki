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

import assert from 'node:assert/strict';
import {test} from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {LanguageProvider, useTranslation} from '../src/i18n/LanguageContext';

test('washing confirmation displays the pallet ID instead of an untranslated placeholder', () => {
    function Confirmation() {
        const {t} = useTranslation();
        return <p>{t('washing_success', {palletId: 'PAL-QA-01'})}</p>;
    }
    const html = renderToStaticMarkup(<LanguageProvider><Confirmation/></LanguageProvider>);
    assert.equal(html, '<p>Paletka PAL-QA-01: potwierdzono mycie, cykle wyzerowane.</p>');
});

import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {PalletStatusSpan} from '../src/components/PalletStatusSpan';
import {LanguageProvider} from '../src/i18n/LanguageContext';

test('blocked badges provide a reason tooltip or a message for legacy records', () => {
    const render = (status: 'Blocked' | 'Damaged' | 'Active', reason?: string, emphasis = false) => renderToStaticMarkup(
        <LanguageProvider><PalletStatusSpan status={status} block_reason={reason} emphasis={emphasis}/></LanguageProvider>,
    );
    const blocked = render('Blocked', ' Kontrola jakości ');
    const describedBy = blocked.match(/aria-describedby="([^"]+)"/)?.[1];
    assert.ok(describedBy);
    assert.ok(blocked.includes(`id="${describedBy}" role="tooltip" popover="auto"`));
    assert.match(blocked, />Kontrola jakości</);
    assert.match(render('Blocked', 'Kontrola jakości', true), />Kontrola jakości</);
    assert.match(render('Blocked'), />Brak zapisanego powodu</);
    assert.doesNotMatch(blocked, /title=/);
    assert.doesNotMatch(render('Active', 'Kontrola jakości'), /role="tooltip"/);
    assert.match(render('Damaged', 'Pęknięty zatrzask'), /aria-label="Uszkodzona"[\s\S]*role="tooltip"[\s\S]*Opis uszkodzenia[\s\S]*Pęknięty zatrzask/);
    assert.match(render('Damaged'), />Brak zapisanego opisu uszkodzenia</);
});

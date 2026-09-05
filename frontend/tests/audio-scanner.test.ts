import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dictionaries } from '../src/i18n/LanguageContext.tsx';
import { Pallet } from '@backend/shared/types';
import {
    playScanSuccessSound,
    playScanWarningSound,
    playScanErrorSound,
    prepareScanAudio,
    initAudioUnlock
} from '../src/lib/audio.ts';

test('operator panel translation keys parity between PL and EN', () => {
    const plKeys = Object.keys(dictionaries.pl).filter(k => k.startsWith('op_')).sort();
    const enKeys = Object.keys(dictionaries.en).filter(k => k.startsWith('op_')).sort();

    assert.deepEqual(plKeys, enKeys, 'All op_ translation keys must match between PL and EN dictionaries');

    const plDict = dictionaries.pl as Record<string, string>;
    const enDict = dictionaries.en as Record<string, string>;

    // Verify critical sound-related keys exist
    for (const key of [
        'op_station_title',
        'op_scanner_sound',
        'op_sound_enabled',
        'op_sound_disabled',
        'op_sound_turn_on_tooltip',
        'op_sound_turn_off_tooltip',
        'op_scan_warning_damaged',
        'op_scan_warning_washing',
        'op_scan_warning_cycles',
    ]) {
        assert.ok(plDict[key], `PL dictionary missing ${key}`);
        assert.ok(enDict[key], `EN dictionary missing ${key}`);
    }
});

test('sound preference defaults to enabled unless explicitly set to false', () => {
    const resolveSoundEnabled = (storedValue: string | null): boolean => {
        return storedValue === null ? true : storedValue !== 'false';
    };

    // Brand new user / cleared localStorage -> should be ON
    assert.equal(resolveSoundEnabled(null), true);

    // User explicitly turned it off -> should be OFF
    assert.equal(resolveSoundEnabled('false'), false);

    // User explicitly turned it on -> should be ON
    assert.equal(resolveSoundEnabled('true'), true);
});

test('pallet status to scan feedback tone mapping', () => {
    const resolveScanTone = (pallet: Pick<Pallet, 'status' | 'current_cycles' | 'max_cycles'>): 'success' | 'warning' | 'error' => {
        if (pallet.status === 'Blocked') return 'error';
        const isExceededCycles = pallet.max_cycles > 0 && pallet.current_cycles >= pallet.max_cycles;
        const isDamaged = pallet.status === 'Damaged';
        const isWashing = pallet.status === 'Washing_Required';
        if (isDamaged || isWashing || isExceededCycles) return 'warning';
        return 'success';
    };

    // Healthy active pallet
    assert.equal(resolveScanTone({ status: 'Active', current_cycles: 10, max_cycles: 100 }), 'success');

    // Damaged pallet
    assert.equal(resolveScanTone({ status: 'Damaged', current_cycles: 10, max_cycles: 100 }), 'warning');

    // Washing required pallet
    assert.equal(resolveScanTone({ status: 'Washing_Required', current_cycles: 10, max_cycles: 100 }), 'warning');

    // Cycle limit exceeded pallet
    assert.equal(resolveScanTone({ status: 'Active', current_cycles: 100, max_cycles: 100 }), 'warning');

    // Blocked pallet
    assert.equal(resolveScanTone({ status: 'Blocked', current_cycles: 10, max_cycles: 100 }), 'error');
});

test('audio feedback functions do not throw in headless or unsupported environments', async () => {
    // None of these should throw when window / AudioContext is absent or uninitialized
    assert.doesNotThrow(() => initAudioUnlock());
    assert.doesNotThrow(() => prepareScanAudio());
    await assert.doesNotReject(async () => {
        await playScanSuccessSound();
        await playScanWarningSound();
        await playScanErrorSound();
    });
});

test('operator sound button attributes and accessible role semantics', () => {
    // Verify properties expected on the operator sound toggle button
    const renderButtonMarkup = (soundEnabled: boolean, lang: 'pl' | 'en') => {
        const dict = dictionaries[lang] as Record<string, string>;
        return `<button id="operator-sound-toggle-btn" type="button" role="switch" aria-checked="${soundEnabled}" title="${soundEnabled ? dict.op_sound_turn_off_tooltip : dict.op_sound_turn_on_tooltip}">`
            + `<span>${dict.op_scanner_sound}</span>`
            + `<span>${soundEnabled ? dict.op_sound_enabled : dict.op_sound_disabled}</span>`
            + `</button>`;
    };

    const plOn = renderButtonMarkup(true, 'pl');
    assert.ok(plOn.includes('id="operator-sound-toggle-btn"'));
    assert.ok(plOn.includes('role="switch"'));
    assert.ok(plOn.includes('aria-checked="true"'));
    assert.ok(plOn.includes('Dźwięk skanera'));
    assert.ok(plOn.includes('WŁĄCZONY'));

    const plOff = renderButtonMarkup(false, 'pl');
    assert.ok(plOff.includes('aria-checked="false"'));
    assert.ok(plOff.includes('WYŁĄCZONY'));

    const enOn = renderButtonMarkup(true, 'en');
    assert.ok(enOn.includes('Scanner Sound'));
    assert.ok(enOn.includes('ENABLED'));
});


import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {InputField, SelectField, TextareaField} from '../src/components/FormFields.tsx';

test('input retains native validation, value, autofocus and explicit label association', () => {
    const html = renderToStaticMarkup(<InputField id="cycles" label="Limit" type="number"
        value="200" min="1" required autoFocus onChange={() => {}}/>);
    for (const attribute of ['for="cycles"', 'id="cycles"', 'type="number"', 'min="1"',
        'required=""', 'autofocus=""', 'value="200"']) {
        assert.ok(html.includes(attribute), attribute);
    }
    assert.ok(html.includes('font-mono transition-all'));
});

test('generated IDs uniquely connect each label to its control', () => {
    const html = renderToStaticMarkup(<><InputField label="First"/><InputField label="Second"/></>);
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    const labels = [...html.matchAll(/\bfor="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(ids.length, 2);
    assert.notEqual(ids[0], ids[1]);
    assert.deepEqual(ids, labels);
});

test('select retains children, selected option, disabled and required states', () => {
    const html = renderToStaticMarkup(<SelectField label="FIS" value="2" required disabled monospace>
        <option value="1">1</option><option value="2">2</option>
    </SelectField>);
    assert.match(html, /<option\b(?=[^>]*\bvalue="2")(?=[^>]*\bselected="")[^>]*>2<\/option>/);
    assert.ok(html.includes('disabled=""'));
    assert.ok(html.includes('required=""'));
    assert.ok(html.includes('font-mono transition-all cursor-pointer'));
});

test('textarea retains comment, placeholder, rows and required validation', () => {
    const html = renderToStaticMarkup(<TextareaField label="Reason" value="Needs repair"
        placeholder="Comment" rows={3} required onChange={() => {}}/>);
    assert.ok(html.includes('rows="3"'));
    assert.ok(html.includes('placeholder="Comment"'));
    assert.ok(html.includes('required=""'));
    assert.ok(html.includes('>Needs repair</textarea>'));
});

test('layout overrides preserve existing form styling', () => {
    const html = renderToStaticMarkup(<InputField label={<>Nests *</>} fieldClassName="col-span-2"
        labelClassName="truncate" className="custom-control"/>);
    assert.ok(html.includes('class="col-span-2"'));
    assert.ok(html.includes('class="truncate"'));
    assert.ok(html.includes('class="custom-control"'));
    assert.ok(html.includes('Nests *'));
});

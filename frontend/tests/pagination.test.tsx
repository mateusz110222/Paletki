import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Pagination} from '../src/components/Pagination.tsx';
import {LanguageProvider} from '../src/i18n/LanguageContext.tsx';

test('Pagination renders nothing when totalPages <= 1', () => {
    const html = renderToStaticMarkup(
        <LanguageProvider>
            <Pagination currentPage={1} totalPages={1} onPageChange={() => {}} />
        </LanguageProvider>
    );
    assert.equal(html, '');
});

test('Pagination renders navigation buttons and pages when totalPages > 1', () => {
    const html = renderToStaticMarkup(
        <LanguageProvider>
            <Pagination currentPage={2} totalPages={5} onPageChange={() => {}} />
        </LanguageProvider>
    );
    assert.ok(html.includes('aria-label="Pagination"'));
    assert.ok(html.includes('2'));
    assert.ok(html.includes('5'));
});

test('Pagination disables previous button on first page and next button on last page', () => {
    const htmlFirst = renderToStaticMarkup(
        <LanguageProvider>
            <Pagination currentPage={1} totalPages={3} onPageChange={() => {}} />
        </LanguageProvider>
    );
    assert.ok(htmlFirst.includes('disabled=""'));

    const htmlLast = renderToStaticMarkup(
        <LanguageProvider>
            <Pagination currentPage={3} totalPages={3} onPageChange={() => {}} />
        </LanguageProvider>
    );
    assert.ok(htmlLast.includes('disabled=""'));
});

test('Pagination shows total items range info when provided', () => {
    const html = renderToStaticMarkup(
        <LanguageProvider>
            <Pagination currentPage={1} totalPages={4} totalItems={85} pageSize={25} onPageChange={() => {}} />
        </LanguageProvider>
    );
    assert.ok(html.includes('85'));
    assert.ok(html.includes('1'));
    assert.ok(html.includes('25'));
});

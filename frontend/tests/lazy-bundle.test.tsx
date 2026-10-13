import assert from 'node:assert/strict';
import {test} from 'node:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {createBundleResource, lazyBundle} from '../src/lib/lazyBundle';

test('all area readers share one request and read synchronously once loaded', async () => {
    let calls = 0;
    const module = {hub: 'hub', washing: 'washing'};
    const resource = createBundleResource(async () => {calls++; return module;});
    let pending: unknown;
    try {resource.read();} catch (value) {pending = value;}
    assert.ok(pending instanceof Promise);
    assert.throws(() => resource.read(), value => value === pending);
    await pending;
    assert.equal(resource.read(), module);
    assert.equal(resource.read().washing, 'washing');
    assert.equal(calls, 1);
});

test('first visit to another view of a loaded area does not suspend', async () => {
    let resolve!: (value: {Hub: () => React.JSX.Element; Washing: () => React.JSX.Element}) => void;
    const pending = new Promise<{Hub: () => React.JSX.Element; Washing: () => React.JSX.Element}>(done => {resolve = done;});
    const bundle = lazyBundle(() => pending);
    const Hub = bundle.view('Hub');
    const Washing = bundle.view('Washing');
    assert.throws(() => renderToStaticMarkup(<Hub/>));
    resolve({Hub: () => <p>UR</p>, Washing: () => <p>Mycie</p>});
    await pending;
    assert.equal(renderToStaticMarkup(<Hub/>), '<p>UR</p>');
    assert.equal(renderToStaticMarkup(<Washing/>), '<p>Mycie</p>');
    assert.equal(renderToStaticMarkup(<Washing/>), '<p>Mycie</p>');
});

test('failed area loads surface the original error without retry loops', async () => {
    let calls = 0;
    const failure = new Error('Unavailable chunk');
    const resource = createBundleResource(async () => {calls++; throw failure;});
    let pending: unknown;
    try {resource.read();} catch (value) {pending = value;}
    await pending;
    assert.throws(() => resource.read(), value => value === failure);
    assert.throws(() => resource.read(), value => value === failure);
    assert.equal(calls, 1);
});

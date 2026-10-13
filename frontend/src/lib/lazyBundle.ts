import {createElement, type ComponentType} from 'react';

/** One suspense resource per area, shared by every exported view. */
export function createBundleResource<Module>(load: () => Promise<Module>) {
    let state: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
    let module: Module;
    let failure: unknown;
    let pending: Promise<void>;
    return {
        read(): Module {
            if (state === 'ready') return module;
            if (state === 'failed') throw failure;
            if (state === 'idle') {
                state = 'loading';
                pending = load().then(value => {module = value; state = 'ready';},
                    error => {failure = error; state = 'failed';});
            }
            throw pending;
        },
    };
}

export function lazyBundle<Module>(load: () => Promise<Module>) {
    const resource = createBundleResource(load);
    return {
        view<Key extends keyof Module>(key: Key): Module[Key] {
            // Area modules export only components. Preserve their original prop
            // types for callers while sharing a synchronous read after loading.
            const BundleView = (props: Record<string, unknown>) => {
                const View = resource.read()[key] as ComponentType<Record<string, unknown>>;
                return createElement(View, props);
            };
            return BundleView as unknown as Module[Key];
        },
    };
}

import {createContext, createElement, use, type ComponentType} from 'react';

export const BundleLoadScope = createContext<object | undefined>(undefined);

function retryChunk<Module>(load: () => Promise<Module>, failure: unknown): Promise<Module> {
    // Browsers can cache failed module fetches for their original URL.
    const source = failure instanceof TypeError ? failure.message.match(/https?:\/\/\S+/)?.[0] : undefined;
    if (source && typeof window !== 'undefined') {
        try {
            const url = new URL(source.replace(/[)'".,;]+$/, ''));
            if (url.origin === window.location.origin && /\/assets\/[\w.-]+\.m?js$/.test(url.pathname)) {
                url.searchParams.set('retry', Date.now().toString());
                return import(/* @vite-ignore */ url.href) as Promise<Module>;
            }
        } catch {
            // Fall back to the original loader when the browser message has no parseable URL.
        }
    }
    return load();
}

/** One suspense resource per area, shared by every exported view. */
export function createBundleResource<Module>(load: () => Promise<Module>, retry: (failure: unknown) => Promise<Module> = load) {
    let state: 'idle' | 'loading' | 'ready' | 'failed' = 'idle';
    let module: Module;
    let failure: unknown;
    let pending: Promise<void>;
    let attempt: object | undefined;
    return {
        read(scope?: object): Module {
            if (state === 'ready') return module;
            if (state === 'failed' && attempt === scope) throw failure;
            if (state === 'idle' || state === 'failed') {
                const request = state === 'failed' ? retry(failure) : load();
                attempt = scope;
                state = 'loading';
                pending = request.then(value => {module = value; state = 'ready';},
                    error => {failure = error; state = 'failed';});
            }
            throw pending;
        },
    };
}

export function lazyBundle<Module extends object>(load: () => Promise<Module>) {
    const keys = new Set<PropertyKey>();
    const resource = createBundleResource(load, async failure => {
        const retried = await retryChunk(load, failure);
        return retried && typeof retried === 'object' && [...keys].every(key => key in retried) ? retried : load();
    });
    return {
        view<Key extends keyof Module>(key: Key): Module[Key] {
            keys.add(key);
            // Area modules export only components. Preserve their original prop
            // types for callers while sharing a synchronous read after loading.
            const BundleView = (props: Record<string, unknown>) => {
                const View = resource.read(use(BundleLoadScope))[key] as ComponentType<Record<string, unknown>>;
                return createElement(View, props);
            };
            return BundleView as unknown as Module[Key];
        },
    };
}

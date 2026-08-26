import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router-dom';
import {getViewAccess} from '../src/auth/view-access.ts';
import {Sidebar} from '../src/layout/Sidebar.tsx';
import {dictionaries, LanguageProvider} from '../src/i18n/LanguageContext.tsx';

for (const [it, ur, me, landing, paths] of [
    [true, false, false, '/admin', ['/admin', '/operator', '/maintenance', '/live', '/directory']],
    [false, true, false, '/maintenance', ['/maintenance']],
    [true, true, false, '/admin', ['/admin', '/operator', '/maintenance', '/live', '/directory']],
    [false, false, false, '/operator', ['/operator', '/live']],
    [false, false, true, '/admin', ['/admin', '/operator', '/maintenance', '/live']],
    [false, true, true, '/admin', ['/admin', '/operator', '/maintenance', '/live']],
    [true, false, true, '/admin', ['/admin', '/operator', '/maintenance', '/live', '/directory']],
    [true, true, true, '/admin', ['/admin', '/operator', '/maintenance', '/live', '/directory']],
] as const) {
    test(`view access and sidebar: IT=${it}, UR=${ur}, ME=${me}`, () => {
        const access = getViewAccess({has_it_department_access: it, has_ur_department_access: ur, has_me_department_access: me});
        assert.equal(access.defaultPath, landing);
        assert.equal(access.hasITDepartmentAccess, it);
        assert.equal(access.canManagePallets, it || me);
        assert.equal(access.isMaintenanceOnly, ur && !it && !me);
        assert.equal(access.canAccessMaintenance, it || ur || me);
        const html = renderToStaticMarkup(<LanguageProvider><MemoryRouter>
            <Sidebar {...access} onLogout={() => {}}/>
        </MemoryRouter></LanguageProvider>);
        const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
        assert.deepEqual(hrefs, paths);
    });
}

test('anonymous sessions do not get privileged access', () => {
    assert.equal(getViewAccess(null).hasITDepartmentAccess, false);
    assert.equal(getViewAccess(null).canAccessMaintenance, false);
});

test('new directory translations are complete in both languages', () => {
    const keys = (dictionary: Record<string, string>) => Object.keys(dictionary).filter(key => key.startsWith('directory_') || key === 'nav_directory').sort();
    assert.deepEqual(keys(dictionaries.pl), keys(dictionaries.en));
});

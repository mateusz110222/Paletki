import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router';
import {getViewAccess} from '../src/auth/view-access.ts';
import {Sidebar} from '../src/layout/Sidebar.tsx';
import {dictionaries, LanguageProvider} from '../src/i18n/LanguageContext.tsx';

for (const [it, ur, me, landing, paths] of [
    [true, false, false, '/admin', ['/catalog', '/admin', '/operator', '/maintenance', '/dashboards', '/directory']],
    [false, true, false, '/maintenance', ['/maintenance', '/dashboards']],
    [true, true, false, '/admin', ['/catalog', '/admin', '/operator', '/maintenance', '/dashboards', '/directory']],
    [false, false, false, '/operator', ['/operator', '/dashboards']],
    [false, false, true, '/admin', ['/catalog', '/admin', '/operator', '/maintenance', '/dashboards']],
    [false, true, true, '/admin', ['/catalog', '/admin', '/operator', '/maintenance', '/dashboards']],
    [true, false, true, '/admin', ['/catalog', '/admin', '/operator', '/maintenance', '/dashboards', '/directory']],
    [true, true, true, '/admin', ['/catalog', '/admin', '/operator', '/maintenance', '/dashboards', '/directory']],
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
        const expected = [...paths] as string[];
        if (it || ur || me) expected.splice(expected.indexOf('/dashboards'), 0, '/reports');
        assert.deepEqual(hrefs, [...expected, '/documentation']);
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

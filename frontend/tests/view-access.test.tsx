import assert from 'node:assert/strict';
import {test} from 'node:test';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {MemoryRouter} from 'react-router';
import {getViewAccess} from '../src/auth/view-access.ts';
import {Sidebar} from '../src/layout/Sidebar.tsx';
import {LanguageProvider} from '../src/i18n/LanguageContext.tsx';

for (const [it, ur, me, landing, paths] of [
    [true, false, false, '/admin', ['/catalog', '/admin', '/operator', '/maintenance', '/dashboards']],
    [false, true, false, '/maintenance', ['/maintenance', '/dashboards']],
    [true, true, false, '/admin', ['/catalog', '/admin', '/operator', '/maintenance', '/dashboards']],
    [false, false, false, '/operator', ['/operator', '/dashboards']],
    [false, false, true, '/admin', ['/catalog', '/admin', '/operator', '/maintenance', '/dashboards']],
    [false, true, true, '/admin', ['/catalog', '/admin', '/operator', '/maintenance', '/dashboards']],
    [true, false, true, '/admin', ['/catalog', '/admin', '/operator', '/maintenance', '/dashboards']],
    [true, true, true, '/admin', ['/catalog', '/admin', '/operator', '/maintenance', '/dashboards']],
] as const) {
    test(`view access and sidebar: IT=${it}, UR=${ur}, ME=${me}`, () => {
        const access = getViewAccess({has_it_department_access: it, has_ur_department_access: ur, has_me_department_access: me});
        assert.equal(access.defaultPath, landing);
        assert.equal(access.hasITDepartmentAccess, it);
        assert.equal(access.canManagePallets, it || me);
        assert.equal(access.isMaintenanceOnly, ur && !it && !me);
        assert.equal(access.canAccessMaintenance, it || ur || me);
        assert.deepEqual(access.accessGroups, it ? ['ADMIN', 'LAB', 'UR']
            : me ? ['ADMIN', 'UR'] : ur ? ['UR'] : ['OPERATOR']);
        const html = renderToStaticMarkup(<LanguageProvider><MemoryRouter>
            <Sidebar {...access}/>
        </MemoryRouter></LanguageProvider>);
        const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
        const expected = [...paths] as string[];
        if (it || ur || me) expected.splice(expected.indexOf('/dashboards'), 0, '/reports');
        if (it) expected.splice(expected.indexOf('/reports'), 0, '/lab');
        assert.deepEqual(hrefs, [...expected, '/documentation']);
        assert.doesNotMatch(html, /Wyloguj/);
    });
}

test('anonymous sessions do not get privileged access', () => {
    assert.equal(getViewAccess(null).hasITDepartmentAccess, false);
    assert.equal(getViewAccess(null).canAccessMaintenance, false);
    assert.deepEqual(getViewAccess(null).accessGroups, []);
});

test('places LAB directly after maintenance for a FIS cpe member', () => {
    const member = {has_it_department_access: false, has_me_department_access: false, has_lab_access: true};
    const labOnly = getViewAccess({...member, has_ur_department_access: false});
    assert.equal(labOnly.defaultPath, '/lab');
    assert.deepEqual(labOnly.accessGroups, ['LAB']);
    const access = getViewAccess({...member, has_ur_department_access: true});
    assert.deepEqual(access.accessGroups, ['LAB', 'UR']);
    const html = renderToStaticMarkup(<LanguageProvider><MemoryRouter>
        <Sidebar {...access}/>
    </MemoryRouter></LanguageProvider>);
    const links = [...html.matchAll(/href="([^"]+)"/g)].map(match => match[1]);
    assert.equal(links[links.indexOf('/maintenance') + 1], '/lab');
});

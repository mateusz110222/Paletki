import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
// Run after npm run build; all API requests use fixtures.
const server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://localhost').pathname;
    const file = new URL('../dist/' + (pathname.startsWith('/assets/') ? pathname.slice(1) : 'index.html'), import.meta.url);
    try {res.setHeader('Content-Type', file.pathname.endsWith('.js') ? 'text/javascript' : file.pathname.endsWith('.css') ? 'text/css' : 'text/html'); res.end(await readFile(file));}
    catch {res.writeHead(404).end();}
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
let browser;
try {
    browser = await chromium.launch({headless: true});
    const page = await browser.newPage();
    await page.addInitScript(() => localStorage.setItem('paletki_user_session', JSON.stringify({token: 'fixture', expiresAt: new Date(Date.now()+3600000).toISOString(), user: {FullName:'Test',username:'test',role:'staff',has_it_department_access:true,has_ur_department_access:false,has_me_department_access:false,is_guest:false}})));
    const projects = [{id:1,name:'PROJECT-A'}], models = [{id:1,project_id:1,project:'PROJECT-A',name:'MODEL-A'}], operations = [];
    await page.route('**/*', async route => {
        const req = route.request();
        if (!['fetch','xhr'].includes(req.resourceType())) return route.continue();
        const url = new URL(req.url()).pathname, body = req.postDataJSON(); let data = {};
        if (url.endsWith('/catalog/manage')) {operations.push(body); const rows = body.kind === 'project' ? projects : models; const i=rows.findIndex(row=>row.id===body.id); if(body.newName) rows[i].name=body.newName; else rows.splice(i,1);}
        else if (url.endsWith('/projects')) {if(req.method()==='POST')projects.push({id:2,name:body.name});data={projects};}
        else if (url.endsWith('/models')) {if(req.method()==='POST')models.push({id:2,project_id:1,project:body.project,name:body.name});data={models};}
        else if (url.endsWith('/pallets')) data={pallets:Array.from({length:120},(_,index)=>({id:index+1,pallet_id:'TEST-'+String(index+1).padStart(3,'0'),project:'PROJECT-A',model:'MODEL-A',max_cycles:200,current_cycles:0,total_cycles:0,nests:1,status:'Active',fis:1,created_at:'2026-09-08T10:00:00Z',created_by:'Test',updated_at:'2026-09-08T10:00:00Z'}))};
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
    });
    const base=`http://127.0.0.1:${server.address().port}`;
    const dialog=page.getByRole('dialog');
    const submit=async()=>{await dialog.getByRole('button',{name:/Zapisz w Bazie/i}).click();await dialog.waitFor({state:'hidden'});};
    await page.goto(base+'/catalog');
    await page.getByRole('button', {name: /Edytuj nazwę:.*PROJECT-A/}).waitFor();
    if (process.env.CATALOG_SCREENSHOT_DIR) {
        await page.setViewportSize({width: 1440, height: 950});
        await page.screenshot({path: process.env.CATALOG_SCREENSHOT_DIR + '/catalog-desktop.png', fullPage: true, animations: 'disabled'});
        await page.setViewportSize({width: 390, height: 844});
        await page.screenshot({path: process.env.CATALOG_SCREENSHOT_DIR + '/catalog-mobile.png', fullPage: true, animations: 'disabled'});
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
        await page.setViewportSize({width: 1440, height: 950});
    }
    await page.getByRole('button',{name:/Dodaj Nowy Projekt/i}).click();await dialog.locator('input').fill('PROJECT-B');await submit();assert.equal(projects[1].name,'PROJECT-B');
    await page.getByRole('button',{name:/Dodaj Nowy Model/i}).click();await dialog.locator('select').selectOption('PROJECT-A');await dialog.locator('input').fill('MODEL-B');await submit();
    await page.getByRole('button',{name:'Modele',exact:true}).click();
    await page.getByRole('button',{name:/Edytuj nazwę: PROJECT-A MODEL-B/}).click();await dialog.locator('input').fill('MODEL-C');await submit();assert.deepEqual(operations[0],{kind:'model',id:2,newName:'MODEL-C'});
    await page.getByRole('button',{name:/Usuń wpis: PROJECT-A MODEL-C/}).click();await dialog.getByRole('button',{name:/Anuluj/i}).last().click();await dialog.waitFor({state:'hidden'});assert.equal(operations.length,1);
    await page.getByRole('button',{name:/Usuń wpis: PROJECT-A MODEL-C/}).click();await dialog.getByRole('button',{name:'Usuń wpis',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.deepEqual(operations[1],{kind:'model',id:2});
    await page.goto(base+'/admin');await page.getByRole('button',{name:/Dodaj Nową Paletę/i}).waitFor();assert.equal(await page.getByRole('button',{name:/Dodaj Nowy (Projekt|Model)/i}).count(),0);
    const table = page.locator('.admin-table-scroll');
    await table.locator('tbody tr').first().waitFor();
    await table.evaluate(element => {element.scrollLeft = element.scrollWidth; element.scrollTop = 500;});
    if (process.env.CATALOG_SCREENSHOT_DIR) {
        await page.locator('.admin-table-frame').screenshot({path: process.env.CATALOG_SCREENSHOT_DIR + '/admin-scrollbar.png', animations: 'disabled'});
    }
    const geometry = await table.evaluate(element => ({
        header: element.querySelector('thead').getBoundingClientRect().height,
        track: parseFloat(getComputedStyle(element, '::-webkit-scrollbar-track:vertical').marginTop),
        gutter: parseFloat(getComputedStyle(element.parentElement, '::after').width),
        expectedGutter: element.offsetWidth - element.clientWidth,
    }));
    assert.ok(Math.abs(geometry.header - geometry.track) < 1);
    assert.equal(geometry.gutter, geometry.expectedGutter);
    for (const target of [2, 3, 2]) {
        const before = await table.locator('tbody tr').first().textContent();
        await table.evaluate(element => {element.scrollTop = element.scrollHeight;});
        assert.ok(await table.evaluate(element => element.scrollTop > 0));
        await page.getByRole('navigation', {name: 'Pagination'}).getByRole('button', {name: 'Strona ' + target, exact: true}).click();
        await page.waitForFunction(() => document.querySelector('.admin-table-scroll').scrollTop === 0);
        assert.notEqual(await table.locator('tbody tr').first().textContent(), before);
        assert.ok(await table.locator('tbody tr').first().evaluate(element => {const rect = element.getBoundingClientRect(); return rect.top >= 0 && rect.bottom <= window.innerHeight;}));
    }
    console.log('PASS: pagination resets table and viewport on next, last and previous pages.');
    console.log('PASS: add project/model, edit by ID, delete/cancel modals, and relocated admin actions.');
} finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}

import {afterEach, expect, it, vi} from 'vitest';
import {resolve} from 'node:path';

const mocks = vi.hoisted(() => ({load: vi.fn()}));
vi.mock('dotenv', () => ({default: {config: mocks.load}}));

afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
    vi.resetModules();
});

function environment(mode: string) {
    for (const [name, value] of Object.entries({
        ENCORE_ENV: mode, LDAP_URL: 'ldaps://ldap.example.com:636',
        LDAP_LOGIN_DOMAIN: 'example.com', LDAP_SEARCH_BASE: 'DC=example,DC=com',
        LDAP_TIMEOUT_MS: '5000', LDAP_CONNECT_TIMEOUT_MS: '3000',
        LDAP_TLS_REJECT_UNAUTHORIZED: 'true', LDAP_TLS_ALLOW_LEGACY_SERVER_CERT: 'false',
        LDAP_CA_CERT_PATH: '', FIS1_ROUTER_URL: 'http://fis1.test/router.php',
        FIS2_ROUTER_URL: 'http://fis2.test/router.php', FIS_DB_HOST: 'fis.test',
        FIS_DB_PORT: '3306', FIS_DB_USER: 'reader',
    })) vi.stubEnv(name, value);
}

it('loads development configuration before the legacy .env fallback', async () => {
    environment('development');
    await import('./config');
    const options = mocks.load.mock.calls[0][0];
    expect(options.path[0]).toBe(resolve(process.cwd(), '.env.development'));
    expect(options.path.indexOf(resolve(process.cwd(), '.env.development')))
        .toBeLessThan(options.path.indexOf(resolve(process.cwd(), '.env')));
});

it('never reads local environment files in production', async () => {
    environment('production');
    await import('./config');
    expect(mocks.load).not.toHaveBeenCalled();
});

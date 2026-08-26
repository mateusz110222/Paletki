import {api, APIError, Header} from 'encore.dev/api';
import {config} from '../config';
import type {DirectoryUser} from '../shared/types';
import {t} from '../pallet/i18n';
import {requireITDepartmentUser} from './authorization';
import {createLdapClient} from './ldap-client';
import {isValidDirectoryNetId, LdapProfileNotFoundError, lookupLdapUser, withLdapClient} from './ldap';
import {departmentAccess} from './permissions';

interface DirectoryLookupRequest {
    net_id: string;
    acceptLanguage?: Header<'Accept-Language'>;
}

export const LookupDirectoryUser = api(
    {method: 'POST', path: '/auth/directory/lookup', expose: true, auth: true, sensitive: true},
    async (params: DirectoryLookupRequest): Promise<DirectoryUser> => {
        requireITDepartmentUser();
        const netId = params.net_id.trim();
        if (!isValidDirectoryNetId(netId)) {
            throw APIError.invalidArgument(t('directory_invalid_netid', params.acceptLanguage));
        }
        if (!config.ldap.lookupBindUser || !config.ldap.lookupBindPassword) {
            throw APIError.unavailable(t('directory_not_configured', params.acceptLanguage));
        }
        try {
            const client = createLdapClient();
            const user = await withLdapClient(client, async () => {
                await client.bind(config.ldap.lookupBindUser, config.ldap.lookupBindPassword);
                return lookupLdapUser(client, netId, config.ldap.searchBase, config.ldap.timeoutMs);
            });
            return {...user, ...departmentAccess(user.department, config.ldap.itDepartments, config.ldap.urDepartments, config.ldap.meDepartments)};
        } catch (error) {
            if (error instanceof LdapProfileNotFoundError) {
                throw APIError.notFound(t('directory_not_found', params.acceptLanguage));
            }
            // A service-account bind failure is not an expired session of the IT user.
            // Do not expose LDAP diagnostics, credentials or directory internals.
            throw APIError.unavailable(t('directory_lookup_failed', params.acceptLanguage));
        }
    },
);

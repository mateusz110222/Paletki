import {api, APIError, Header} from 'encore.dev/api';
import {config} from '../config';
import type {DirectoryUser} from '../shared/types';
import {t} from '../shared/i18n';
import {requireITDepartmentUser} from './authorization';
import {createLdapClient} from './ldap-client';
import {classifyLdapError, isValidDirectoryNetId, LdapProfileNotFoundError, lookupLdapUser, withLdapClient} from './ldap';
import {departmentAccess} from './permissions';
import {ldapLookupBindPassword} from "./secrets";

interface DirectoryLookupRequest {
    net_id: string;
    acceptLanguage?: Header<'Accept-Language'>;
}

export const LookupDirectoryUser = api(
    {method: 'POST', path: '/auth/directory/lookup', expose: true, auth: true, sensitive: true},
    async (params: DirectoryLookupRequest): Promise<DirectoryUser> => {
        requireITDepartmentUser();
        const netId = params.net_id.trim();
        const lookupBindPassword = ldapLookupBindPassword();
        if (!isValidDirectoryNetId(netId)) {
            throw APIError.invalidArgument(t('directory_invalid_netid', params.acceptLanguage));
        }
        if (!config.ldap.lookupBindUser || !lookupBindPassword) {
            throw APIError.unavailable(t('directory_not_configured', params.acceptLanguage));
        }
        let stage: 'create_client' | 'bind' | 'search' = 'create_client';
        try {
            const client = createLdapClient();
            const user = await withLdapClient(client, async () => {
                stage = 'bind';
                await client.bind(config.ldap.lookupBindUser, lookupBindPassword);
                stage = 'search';
                return lookupLdapUser(client, netId, config.ldap.searchBase, config.ldap.timeoutMs);
            });
            return {...user, ...departmentAccess(user.department, config.ldap.itDepartments, config.ldap.urDepartments, config.ldap.meDepartments)};
        } catch (error) {
            if (error instanceof LdapProfileNotFoundError) {
                throw APIError.notFound(t('directory_not_found', params.acceptLanguage));
            }
            console.error('LDAP directory lookup failed', {stage, kind: classifyLdapError(error)});
            throw APIError.unavailable(t('directory_lookup_failed', params.acceptLanguage));
        }
    },
);

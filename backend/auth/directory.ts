import {api, APIError, Header} from 'encore.dev/api';
import {config} from '../config';
import type {DirectoryUser} from '../shared/types';
import {t} from '../shared/i18n';
import {requireITDepartmentUser} from './authorization';
import {createLdapClient} from './ldap-client';
import {classifyLdapError, isValidDirectoryNetId, LdapProfileNotFoundError, lookupLdapUser, withLdapClient} from './ldap';
import {fisGroupAccess} from './permissions';
import {getFisGroups} from './fis-groups';
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
        let stage: 'create_client' | 'bind' | 'search' | 'fis' = 'create_client';
        try {
            const client = createLdapClient();
            const user = await withLdapClient(client, async () => {
                stage = 'bind';
                await client.bind(config.ldap.lookupBindUser, lookupBindPassword);
                stage = 'search';
                return lookupLdapUser(client, netId, config.ldap.searchBase, config.ldap.timeoutMs);
            });
            stage = 'fis';
            const fisGroups = await getFisGroups(user.net_id);
            return {...user, fis_groups: fisGroups, ...fisGroupAccess(fisGroups, config.fisGroups.itGroups, config.fisGroups.urGroup, config.fisGroups.meGroup)};
        } catch (error) {
            if (error instanceof LdapProfileNotFoundError) {
                throw APIError.notFound(t('directory_not_found', params.acceptLanguage));
            }
            console.error('Directory lookup failed', {stage, kind: stage === 'fis' ? 'unavailable' : classifyLdapError(error)});
            if (stage === 'fis') throw APIError.unavailable(t('fis_groups_unavailable', params.acceptLanguage));
            throw APIError.unavailable(t('directory_lookup_failed', params.acceptLanguage));
        }
    },
);

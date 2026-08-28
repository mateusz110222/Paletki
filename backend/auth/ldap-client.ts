import {Client} from 'ldapts';
import {config} from '../config';
import {ldapCompatibilityTlsOptions} from './ldap-tls-options';

export function createLdapClient(): Client {
    return new Client({
        url: config.ldap.url,
        tlsOptions: {
            rejectUnauthorized: config.ldap.rejectUnauthorized,
            ...(config.ldap.ca ? {ca: config.ldap.ca} : {}),
            ...ldapCompatibilityTlsOptions(
                config.ldap.allowLegacyServerCertificate,
                config.ldap.skipHostnameVerification,
            ),
        },
        timeout: config.ldap.timeoutMs,
        connectTimeout: config.ldap.connectTimeoutMs,
    });
}

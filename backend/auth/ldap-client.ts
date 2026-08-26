import {Client} from 'ldapts';
import {config} from '../config';

export function createLdapClient(): Client {
    return new Client({
        url: config.ldap.url,
        tlsOptions: {
            rejectUnauthorized: config.ldap.rejectUnauthorized,
            ...(config.ldap.ca ? {ca: config.ldap.ca} : {}),
            ...(config.ldap.allowLegacyServerCertificate ? {ciphers: 'DEFAULT@SECLEVEL=1'} : {}),
        },
        timeout: config.ldap.timeoutMs,
        connectTimeout: config.ldap.connectTimeoutMs,
    });
}

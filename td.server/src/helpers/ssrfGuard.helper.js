import dns from 'dns';
import dnsP from 'dns/promises';
import net from 'net';

/**
 * Shared SSRF guard used by any feature that fetches a user/admin-supplied URL
 * (integration webhooks, the OSV git/container scanners, etc.).
 *
 * Two layers of defence are provided:
 *   1. assertPublicUrl(rawUrl) — pre-flight protocol + DNS validation.
 *   2. safeLookup — a drop-in dns.lookup replacement for an HTTP(S) agent that
 *      re-validates the resolved address at *connect* time, closing the
 *      DNS-rebinding TOCTOU window between pre-flight validation and the
 *      socket connection.
 */

export function isPrivateIp(ip) {
    if (!ip) {return true;}
    if (net.isIP(ip) === 0) {return true;} // not an IP — suspicious
    if (ip.startsWith('127.') || ip === '::1') {return true;}
    if (ip.startsWith('10.')) {return true;}
    if (ip.startsWith('192.168.')) {return true;}
    if (ip.startsWith('169.254.')) {return true;} // link-local (AWS/GCP/Azure metadata)
    if ((/^172\.(1[6-9]|2\d|3[01])\./).test(ip)) {return true;}
    if ((/^f[cd][0-9a-f]{2}:/i).test(ip)) {return true;} // IPv6 ULA
    if ((/^fe80:/i).test(ip)) {return true;} // IPv6 link-local
    if ((/^::ffff:/i).test(ip)) { // IPv4-mapped IPv6 — validate the embedded v4
        return isPrivateIp(ip.replace(/^::ffff:/i, ''));
    }
    if (ip === '0.0.0.0' || ip === '::') {return true;}
    return false;
}

/**
 * Validate that a URL uses http(s) and that neither its literal IP nor any of
 * its resolved addresses point at internal / loopback / metadata space.
 * Returns the parsed URL on success; throws on any violation.
 *
 * @param {string} rawUrl
 * @param {string} [label] — used in error messages (defaults to 'URL')
 * @returns {Promise<URL>}
 */
export async function assertPublicUrl(rawUrl, label = 'URL') {
    let url;
    try {
        url = new URL(rawUrl);
    } catch {
        throw new Error(`${label} is not a valid URL`);
    }
    if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error(`${label} uses unsupported protocol: ${url.protocol}`);
    }
    const hostname = url.hostname;
    if (!hostname) {throw new Error(`${label} has no hostname`);}

    if (net.isIP(hostname) !== 0) {
        if (isPrivateIp(hostname)) {
            throw new Error(`${label} targets a non-public address: ${hostname}`);
        }
        return url;
    }

    let addrs;
    try {
        addrs = await dnsP.lookup(hostname, { all: true });
    } catch {
        throw new Error(`${label} hostname could not be resolved: ${hostname}`);
    }
    for (const { address } of addrs) {
        if (isPrivateIp(address)) {
            throw new Error(`${label} resolves to a non-public address: ${hostname} → ${address}`);
        }
    }
    return url;
}

/**
 * A dns.lookup-compatible function for use as an HTTP(S) agent's `lookup`
 * option. It performs the real resolution and then rejects the connection if
 * the chosen address is private — so a rebinding DNS that passed assertPublicUrl
 * cannot return an internal IP at connect time.
 */
export function safeLookup(hostname, options, callback) {
    const cb = typeof options === 'function' ? options : callback;
    const opts = typeof options === 'function' ? {} : options;
    dns.lookup(hostname, opts, (err, address, family) => {
        if (err) {return cb(err);}
        const addresses = Array.isArray(address)
            ? address
            : [{ address, family }];
        for (const a of addresses) {
            if (isPrivateIp(a.address)) {
                return cb(new Error(`Blocked connection to non-public address: ${hostname} → ${a.address}`));
            }
        }
        return Array.isArray(address)
            ? cb(null, address)
            : cb(null, address, family);
    });
}

export default {
    isPrivateIp,
    assertPublicUrl,
    safeLookup,
};

/**
 * Restricts Postgres hosts reachable during enterprise setup wizard
 * (mitigates SSRF-like abuse during `/api/config/test-db` and external DB setup).
 *
 * Allowed: loopback (127/8), RFC1918 private nets, localhost literals,
 * `host.docker.internal`. Blocked: public IPs, 169.254/16 link-local,
 * ambiguous IPv6 (except loopback (::1)).
 */

import dns from 'node:dns/promises';
import net from 'node:net';

const LITERAL_HOSTS = new Set([
  'localhost',
  '[::1]',
  'host.docker.internal',
]);

/**
 * @param {number[]} parts
 * @returns {number|null}
 */
function ipv4ToInt(parts) {
  if (!parts.every((n) => n >= 0 && n <= 255)) return null;
  return ((parts[0] << 24) >>> 0) +
    ((parts[1] << 16) | (parts[2] << 8) | parts[3]);
}

/**
 * @param {string} ipv4Literal
 * @returns {boolean}
 */
function isPermittedIpv4(ipv4Literal) {
  const parts = ipv4Literal.split('.').map(Number);
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return false;

  const addr = ipv4ToInt(parts);
  if (addr === null) return false;

  if (parts[0] === 169 && parts[1] === 254) return false;

  const a0 = ipv4ToInt([0, 0, 0, 0]) >>> 0;
  const b009 = ipv4ToInt([0, 255, 255, 255]) >>> 0;
  if ((addr >>> 0) >= a0 && (addr >>> 0) <= b009) return false;

  const a10 = ipv4ToInt([10, 0, 0, 0]) >>> 0;
  const b10 = ipv4ToInt([10, 255, 255, 255]) >>> 0;
  if ((addr >>> 0) >= a10 && (addr >>> 0) <= b10) return true;

  const a172 = ipv4ToInt([172, 16, 0, 0]) >>> 0;
  const b172 = ipv4ToInt([172, 31, 255, 255]) >>> 0;
  if ((addr >>> 0) >= a172 && (addr >>> 0) <= b172) return true;

  const a192 = ipv4ToInt([192, 168, 0, 0]) >>> 0;
  const b192 = ipv4ToInt([192, 168, 255, 255]) >>> 0;
  if ((addr >>> 0) >= a192 && (addr >>> 0) <= b192) return true;

  const a127 = ipv4ToInt([127, 0, 0, 0]) >>> 0;
  const b127 = ipv4ToInt([127, 255, 255, 255]) >>> 0;
  return (addr >>> 0) >= a127 && (addr >>> 0) <= b127;
}

/**
 * Accept only IPv6 loopback for literal inputs.
 *
 * @param {string} ip
 * @returns {boolean}
 */
function isPermittedIpv6Literal(ip) {
  const mapped = /^::ffff:(\d+)\.(\d+)\.(\d+)\.(\d+)$/i.exec(ip);
  if (mapped) return isPermittedIpv4(`${mapped[1]}.${mapped[2]}.${mapped[3]}.${mapped[4]}`);
  return ip === '::1';
}

/**
 * @param {string} ip — resolved address
 * @returns {boolean}
 */
function isPermittedResolved(ip) {
  if (net.isIPv4(ip)) return isPermittedIpv4(ip);
  if (net.isIPv6(ip)) return isPermittedIpv6Literal(ip);
  return false;
}

/**
 * @param {string} host
 * @returns {Promise<{ ok: boolean, error?: string }>}
 */
export async function validateEnterpriseSetupPgHost(host) {
  const hRaw = String(host ?? '').trim();
  if (!hRaw) return { ok: false, error: 'host is required' };

  const lowered = hRaw.toLowerCase();
  if (LITERAL_HOSTS.has(lowered) || lowered === '127.0.0.1') {
    return { ok: true };
  }

  if (net.isIPv4(hRaw)) {
    return isPermittedIpv4(hRaw)
      ? { ok: true }
      : { ok: false, error: 'DB host IP must be loopback or a private-network (RFC1918) address.' };
  }

  if (net.isIPv6(hRaw)) {
    return isPermittedIpv6Literal(hRaw)
      ? { ok: true }
      : { ok: false, error: 'DB host IPv6 is not permitted (use IPv4 loopback/private or localhost).' };
  }

  try {
    const addrs = await dns.lookup(hRaw, { all: true });

    if (!addrs.length) {
      return { ok: false, error: 'Could not resolve DB host name.' };
    }
    for (const a of addrs) {
      if (!isPermittedResolved(a.address)) {
        return {
          ok:    false,
          error: `DB host resolves to a non-permitted address (${a.address}). Use localhost, Docker service names resolving to private IP, loopback or RFC1918 only.`,
        };
      }
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Could not resolve DB host name.' };
  }
}

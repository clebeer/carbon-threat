/**
 * OSV Scanner Service
 *
 * Provides lockfile / SBOM parsing, OSV API batch querying, and result
 * persistence for the integrated vulnerability scanner module.
 *
 * Supported formats
 * ─────────────────
 *  npm         package-lock.json  (lockfileVersion 1 / 2 / 3)
 *  Yarn        yarn.lock          (classic v1 & berry v2+)
 *  pnpm        pnpm-lock.yaml     (v5 path-style & v6 package@version style)
 *  Python      requirements.txt   (== pinned entries only)
 *              Pipfile.lock       (JSON)
 *  Go          go.sum
 *  Rust        Cargo.lock         (TOML [[package]] sections)
 *  Ruby        Gemfile.lock       (Bundler GEM/specs block)
 *  NuGet       packages.lock.json
 *  PHP         composer.lock
 *  SPDX        *.spdx.json
 *  CycloneDX   cyclonedx*.json / bom.json with bomFormat field
 */

import https from 'https';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fsP from 'fs/promises';
import path from 'path';
import os from 'os';
import db from '../db/knex.js';
import loggerHelper from '../helpers/logger.helper.js';

const execFileAsync = promisify(execFile);

const logger = loggerHelper.get('services/osvScanner.js');

// ── Binary resolver ───────────────────────────────────────────────────────────
//
// When Node.js runs as a server process (pm2, systemd, npm start) it often
// inherits a minimal PATH that omits locations like /opt/homebrew/bin (macOS)
// or /usr/local/bin (Linux).  We resolve tool paths once at first use so that
// execFileAsync always receives an absolute path and never hits ENOENT.
//
// Lookup order:
//   1. `which <name>` / `where <name>` on Windows — honours the *current* PATH
//   2. Known common locations (Homebrew, nix, system)
//
const _binCache = new Map();

// Common directories where git / docker may live
const COMMON_BIN_DIRS = [
  '/usr/local/bin',
  '/usr/bin',
  '/bin',
  '/opt/homebrew/bin', // macOS Apple-Silicon Homebrew
  '/opt/homebrew/sbin',
  '/usr/local/homebrew/bin', // macOS Intel Homebrew
  '/usr/local/sbin',
  '/opt/local/bin', // MacPorts
  '/snap/bin', // Linux snap
  '/home/linuxbrew/.linuxbrew/bin', // Linuxbrew
];

/**
 * Resolve the absolute path of a binary, caching the result.
 * Throws a descriptive error if the binary cannot be found.
 */
async function resolveBin(name) {
  if (_binCache.has(name)) {return _binCache.get(name);}

  // Try `which` / `where` first — it searches the user's actual PATH.
  const whichCmd = os.platform() === 'win32' ? 'where' : 'which';
  try {
    const { stdout } = await execFileAsync(whichCmd, [name], { timeout: 5_000 });
    const resolved = stdout.trim().split('\n')[0].trim();
    if (resolved) {
      logger.info(`resolveBin: ${name} → ${resolved} (via ${whichCmd})`);
      _binCache.set(name, resolved);
      return resolved;
    }
  } catch { /* which not available or binary not on PATH — fall through */ }

  // Walk known directories
  for (const dir of COMMON_BIN_DIRS) {
    const candidate = path.join(dir, name);
    try {
      await fsP.access(candidate, fsP.constants?.X_OK ?? 1);
      logger.info(`resolveBin: ${name} → ${candidate} (common-dir fallback)`);
      _binCache.set(name, candidate);
      return candidate;
    } catch { /* not found here */ }
  }

  throw new Error(
    `'${name}' is not installed or not on the server PATH. ` +
    `Install it or ensure it is reachable from: ${COMMON_BIN_DIRS.join(', ')}`
  );
}

// Maximum packages per OSV /v1/querybatch request
const OSV_BATCH_SIZE = 100;
const OSV_API_URL = 'https://api.osv.dev/v1/querybatch';
const OSV_VULN_BASE_URL = 'https://api.osv.dev/v1/vulns';

// Maximum concurrent advisory detail fetches (avoids overwhelming the API)
const OSV_DETAIL_CONCURRENCY = 10;

// ── STRIDE keyword mapping (mirrors vulnSync.js for consistency) ──────────
const STRIDE_KEYWORDS = [
  { categories: ['Spoofing'], words: ['spoof', 'impersonat', 'authenticat', 'identity', 'bypass auth', 'forged', 'fake'] },
  { categories: ['Tampering'], words: ['tamper', 'inject', 'sql injection', 'xss', 'csrf', 'code injection', 'rce', 'remote code', 'path traversal', 'deserialization'] },
  { categories: ['Repudiation'], words: ['repudiat', 'log', 'audit', 'non-repudiat', 'trace'] },
  { categories: ['Information Disclosure'], words: ['disclosure', 'information leak', 'sensitive data', 'exposure', 'enumerat', 'directory listing', 'ssrf', 'xxe'] },
  { categories: ['DoS'], words: ['denial of service', 'dos', 'ddos', 'resource exhaust', 'memory leak', 'crash', 'flood', 'amplification', 'integer overflow'] },
  { categories: ['Elevation of Privilege'], words: ['privilege', 'escalat', 'sudo', 'root', 'admin bypass', 'acl bypass', 'authorization bypass', 'permission'] },
];

function mapToStride(title = '', description = '') {
  const text = `${title} ${description}`.toLowerCase();
  const matched = new Set();
  for (const { categories, words } of STRIDE_KEYWORDS) {
    if (words.some((w) => text.includes(w))) {categories.forEach((c) => matched.add(c));}
  }
  return matched.size > 0 ? [...matched] : ['Tampering'];
}

function normaliseSeverity(cvssScore, severityText = '') {
  if (cvssScore >= 9.0) {return 'Critical';}
  if (cvssScore >= 7.0) {return 'High';}
  if (cvssScore >= 4.0) {return 'Medium';}
  if (cvssScore > 0) {return 'Low';}
  const t = severityText.toLowerCase();
  if (t.includes('critical')) {return 'Critical';}
  if (t.includes('high')) {return 'High';}
  if (t.includes('medium') || t.includes('moderate')) {return 'Medium';}
  return 'Low';
}

// ── Internal HTTP helpers (no extra deps — uses built-in https) ───────────

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        path:     parsed.pathname,
        method:   'POST',
        headers: {
          'Content-Type':   'application/json',
          'Content-Length': Buffer.byteLength(data),
          'User-Agent':     'CarbonThreat-Scanner/1.0',
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); }
          catch { reject(new Error(`JSON parse error: ${raw.slice(0, 200)}`)); }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(30_000, () => { req.destroy(new Error('OSV querybatch timeout')); });
    req.write(data);
    req.end();
  });
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const req = https.request(
      {
        hostname: parsed.hostname,
        path:     parsed.pathname + (parsed.search || ''),
        method:   'GET',
        headers:  { 'User-Agent': 'CarbonThreat-Scanner/1.0' },
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          try { resolve(JSON.parse(raw)); }
          catch { reject(new Error(`JSON parse error: ${raw.slice(0, 200)}`)); }
        });
      }
    );
    req.on('error', reject);
    req.setTimeout(15_000, () => { req.destroy(new Error('OSV vuln detail timeout')); });
    req.end();
  });
}

// ── CVSS v3.x Base Score calculator ──────────────────────────────────────
//
// Implements the CVSS 3.1 specification so we can compute a numeric score
// from a vector string like "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:N/A:H".
//
// Reference: https://www.first.org/cvss/v3.1/specification-document
//
function parseCvssV3Score(vector) {
  try {
    // Strip "CVSS:3.x/" prefix
    const body = String(vector).replace(/^CVSS:[0-9.]+\//i, '');
    const metrics = Object.fromEntries(body.split('/').map((p) => p.split(':')));

    const AV = { N: 0.85, A: 0.62, L: 0.55, P: 0.20 };
    const AC = { L: 0.77, H: 0.44 };
    const UI = { N: 0.85, R: 0.62 };
    const CIA = { N: 0.00, L: 0.22, H: 0.56 };
    // Privileges Required differs by Scope
    const PR_U = { N: 0.85, L: 0.62, H: 0.27 };
    const PR_C = { N: 0.85, L: 0.50, H: 0.15 };

    const S = metrics.S ?? 'U';
    const av = AV[metrics.AV] ?? 0;
    const ac = AC[metrics.AC] ?? 0;
    const pr = (S === 'C' ? PR_C : PR_U)[metrics.PR] ?? 0;
    const ui = UI[metrics.UI] ?? 0;
    const c = CIA[metrics.C] ?? 0;
    const i = CIA[metrics.I] ?? 0;
    const a = CIA[metrics.A] ?? 0;

    const iss = 1 - (1 - c) * (1 - i) * (1 - a);

    const impact = S === 'U'
      ? 6.42 * iss
      : 7.52 * (iss - 0.029) - 3.25 * (iss - 0.02)**15;

    if (impact <= 0) {return 0;}

    const exploitability = 8.22 * av * ac * pr * ui;

    const raw = S === 'U'
      ? Math.min(impact + exploitability, 10)
      : Math.min(1.08 * (impact + exploitability), 10);

    // Roundup: smallest value at 1 decimal place ≥ raw
    return Math.ceil(raw * 10) / 10;
  } catch {
    return null;
  }
}

// ── Robust severity extractor ─────────────────────────────────────────────
//
// OSV advisory objects expose severity through several different fields
// depending on the source (GitHub, NVD, OSS-Fuzz, etc.).
// Priority order:
//   1. CVSS v3 vector in severity[]  → numeric score (most precise)
//   2. database_specific.cvss_score  → pre-computed numeric (rare)
//   3. database_specific.severity    → text e.g. "MODERATE", "HIGH"
//   4. affected[].ecosystem_specific.severity → text
//
function extractSeverityFromVuln(vuln) {
  // Priority 1: CVSS v3 vector → compute numeric score
  for (const sev of vuln.severity ?? []) {
    if ((sev.type === 'CVSS_V3' || sev.type === 'CVSS_V31') && sev.score) {
      const score = parseCvssV3Score(sev.score);
      if (score !== null) {return { cvssScore: score, severity: normaliseSeverity(score, '') };}
    }
  }

  // Priority 2: pre-computed numeric score in database_specific
  const dbSpec = vuln.database_specific ?? {};
  const numScore = parseFloat(dbSpec.cvss_score ?? dbSpec.cvss ?? 0);
  if (numScore > 0) {return { cvssScore: numScore, severity: normaliseSeverity(numScore, '') };}

  // Priority 3 + 4: text severity from multiple locations
  const textCandidates = [
    dbSpec.severity,
    dbSpec.github_severity,
    ...(vuln.affected ?? []).flatMap((a) => [
      a.ecosystem_specific?.severity,
      a.database_specific?.severity,
    ]),
  ].filter((v) => v && typeof v === 'string');

  for (const text of textCandidates) {
    const t = text.toLowerCase().trim();
    if (t === 'critical') {return { cvssScore: null, severity: 'Critical' };}
    if (t === 'high') {return { cvssScore: null, severity: 'High' };}
    if (t === 'medium' || t === 'moderate') {return { cvssScore: null, severity: 'Medium' };}
    if (t === 'low') {return { cvssScore: null, severity: 'Low' };}
  }

  // Nothing matched — default to Low
  return { cvssScore: null, severity: 'Low' };
}

// ─────────────────────────────────────────────────────────────────────────────
// LOCKFILE / SBOM PARSERS
// Each returns an array of { name, version, ecosystem }
// ─────────────────────────────────────────────────────────────────────────────

function parseNpmPackageLock(content) {
  const pkgs = [];
  let parsed;
  try { parsed = JSON.parse(content); } catch { return []; }

  if ((parsed.lockfileVersion ?? 1) >= 2 && parsed.packages) {
    // v2 / v3: flat packages map keyed by "node_modules/name"
    for (const [key, val] of Object.entries(parsed.packages)) {
      if (!key) {continue;} // root entry
      // Strip leading node_modules/ and any nested node_modules/ segments
      const name = key.replace(/^node_modules\//, '').replace(/\/node_modules\//g, '/');
      if (name && val.version) {pkgs.push({ name, version: val.version, ecosystem: 'npm' });}
    }
  } else if (parsed.dependencies) {
    // v1: recursive dependencies tree
    const walk = (deps) => {
      for (const [name, val] of Object.entries(deps)) {
        if (val.version) {pkgs.push({ name, version: val.version, ecosystem: 'npm' });}
        if (val.dependencies) {walk(val.dependencies);}
      }
    };
    walk(parsed.dependencies);
  }
  return pkgs;
}

function parseYarnLock(content) {
  const pkgs = [];
  // Split on blank lines to get individual package blocks
  const blocks = content.split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    if (!lines.length || lines[0].startsWith('#') || lines[0].startsWith('__metadata')) {continue;}

    // Find version inside the block
    const versionLine = lines.find((l) => (/^\s+version\s/).test(l));
    if (!versionLine) {continue;}
    const version = versionLine.trim().replace(/^version\s+"?/, '').
replace(/"$/, '');

    // Header may list multiple specifiers: "pkg@^1.0, pkg@^2.0":
    //   or: pkg@^1.0, pkg@^2.0:
    const header = lines[0].replace(/:\s*$/, '').replace(/^"|"$/g, '');
    const firstEntry = header.split(',')[0].trim().replace(/^"|"$/g, '');
    // Strip version specifier (everything from the last @ that isn't the start of a scoped pkg)
    const atIdx = firstEntry.lastIndexOf('@');
    const name = atIdx > 0 ? firstEntry.slice(0, atIdx) : firstEntry;
    if (name && version) {pkgs.push({ name: name.replace(/^"|"$/g, ''), version, ecosystem: 'npm' });}
  }
  return pkgs;
}

function parsePnpmLock(content) {
  const pkgs = [];
  // pnpm v5  — packages keyed as "/name/version:" or "/@scope/name/version:"
  const v5Re = /^\s{2}\/((?:@[^/]+\/)?[^/]+)\/([\w.\-+]+):/gm;
  // pnpm v6+ — packages keyed as "name@version:" or "@scope/name@version:"
  const v6Re = /^\s{2}((?:@[^@\s]+\/)?[^@\s]+)@([\w.\-+]+):/gm;

  let m;
  let found = false;
  while ((m = v5Re.exec(content)) !== null) {
    pkgs.push({ name: m[1], version: m[2], ecosystem: 'npm' });
    found = true;
  }
  if (!found) {
    while ((m = v6Re.exec(content)) !== null) {
      pkgs.push({ name: m[1], version: m[2], ecosystem: 'npm' });
    }
  }
  return pkgs;
}

function parseRequirementsTxt(content) {
  const pkgs = [];
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('-')) {continue;}
    // Accept only == pinned versions; skip ranges (>=, ~=, etc.) as version is ambiguous
    const m = line.match(/^([A-Za-z0-9_.\-\[\]]+)\s*==\s*([\w.\-+]+)/);
    if (m) {pkgs.push({ name: m[1].split('[')[0], version: m[2], ecosystem: 'PyPI' });}
  }
  return pkgs;
}

function parsePipfileLock(content) {
  const pkgs = [];
  let parsed;
  try { parsed = JSON.parse(content); } catch { return []; }
  for (const section of ['default', 'develop']) {
    const deps = parsed[section] ?? {};
    for (const [name, val] of Object.entries(deps)) {
      if (!val.version) {continue;}
      pkgs.push({ name, version: val.version.replace(/^==/, ''), ecosystem: 'PyPI' });
    }
  }
  return pkgs;
}

function parseGoSum(content) {
  const pkgs = [];
  const seen = new Set();
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line) {continue;}
    // Format: module version h1:hash  OR  module version/go.mod h1:hash
    const parts = line.split(/\s+/);
    if (parts.length < 2) {continue;}
    const name = parts[0];
    const versionRaw = parts[1];
    if (versionRaw.endsWith('/go.mod')) {continue;} // skip go.mod-only entries
    const version = versionRaw.replace(/^v/, '');
    const key = `${name}@${version}`;
    if (!seen.has(key)) {
      seen.add(key);
      pkgs.push({ name, version, ecosystem: 'Go' });
    }
  }
  return pkgs;
}

function parseCargoLock(content) {
  const pkgs = [];
  // TOML format — split on [[package]] section headers
  const sections = content.split(/\[\[package\]\]/);
  for (const section of sections.slice(1)) {
    const nameM = section.match(/name\s*=\s*"([^"]+)"/);
    const versionM = section.match(/version\s*=\s*"([^"]+)"/);
    if (nameM && versionM) {pkgs.push({ name: nameM[1], version: versionM[1], ecosystem: 'crates.io' });}
  }
  return pkgs;
}

function parseGemfileLock(content) {
  const pkgs = [];
  const lines = content.split('\n');
  let inSpecs = false;
  for (const raw of lines) {
    if (raw.trim() === 'specs:') { inSpecs = true; continue; }
    if (inSpecs) {
      // A non-indented line (or section header like PLATFORMS) ends the specs block
      if (!raw.startsWith('    ')) { inSpecs = false; continue; }
      // Gem line: "    gemname (version)" — exactly 4 spaces of indent
      const m = raw.match(/^ {4}([A-Za-z0-9_\-]+)\s+\(([^)]+)\)/);
      if (m) {pkgs.push({ name: m[1], version: m[2].split(',')[0].trim(), ecosystem: 'RubyGems' });}
    }
  }
  return pkgs;
}

function parseNugetPackagesLock(content) {
  const pkgs = [];
  let parsed;
  try { parsed = JSON.parse(content); } catch { return []; }
  const deps = parsed.dependencies ?? {};
  for (const frameworkDeps of Object.values(deps)) {
    for (const [name, val] of Object.entries(frameworkDeps)) {
      const version = val.resolved ?? val.requested;
      if (name && version) {pkgs.push({ name, version, ecosystem: 'NuGet' });}
    }
  }
  return pkgs;
}

function parseComposerLock(content) {
  const pkgs = [];
  let parsed;
  try { parsed = JSON.parse(content); } catch { return []; }
  for (const section of ['packages', 'packages-dev']) {
    for (const pkg of parsed[section] ?? []) {
      if (pkg.name && pkg.version) {
        pkgs.push({ name: pkg.name, version: pkg.version.replace(/^v/, ''), ecosystem: 'Packagist' });
      }
    }
  }
  return pkgs;
}

// ── SBOM parsers ──────────────────────────────────────────────────────────

function ecosystemFromPurl(purl = '') {
  if (purl.startsWith('pkg:npm')) {return 'npm';}
  if (purl.startsWith('pkg:pypi')) {return 'PyPI';}
  if (purl.startsWith('pkg:maven')) {return 'Maven';}
  if (purl.startsWith('pkg:nuget')) {return 'NuGet';}
  if (purl.startsWith('pkg:cargo')) {return 'crates.io';}
  if (purl.startsWith('pkg:gem')) {return 'RubyGems';}
  if (purl.startsWith('pkg:golang')) {return 'Go';}
  return 'npm';
}

function parseSpdxJson(content) {
  const pkgs = [];
  let parsed;
  try { parsed = JSON.parse(content); } catch { return []; }
  for (const pkg of parsed.packages ?? []) {
    if (!pkg.name || !pkg.versionInfo) {continue;}
    const purl = (pkg.externalRefs ?? []).find((r) => r.referenceType === 'purl')?.referenceLocator ?? '';
    pkgs.push({ name: pkg.name, version: pkg.versionInfo, ecosystem: ecosystemFromPurl(purl) });
  }
  return pkgs;
}

function parseCycloneDxJson(content) {
  const pkgs = [];
  let parsed;
  try { parsed = JSON.parse(content); } catch { return []; }
  for (const comp of parsed.components ?? []) {
    if (!comp.name || !comp.version) {continue;}
    pkgs.push({ name: comp.name, version: comp.version, ecosystem: ecosystemFromPurl(comp.purl ?? '') });
  }
  return pkgs;
}

// ─────────────────────────────────────────────────────────────────────────────
// DIRECTORY WALKER  (shared by git + container scan)
// ─────────────────────────────────────────────────────────────────────────────

// Directories that almost never contain top-level lockfiles and are skipped
// to avoid exploding the package list (node_modules alone can hold thousands).
const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'vendor', '.cache', '__pycache__',
  '.npm', '.yarn', 'dist', 'build', 'target', '.gradle', '.m2',
  '.idea', '.vscode', 'coverage', '.nyc_output',
]);

/**
 * Recursively walk a directory and return all packages found in recognised
 * lockfiles / SBOMs.  Silently skips unreadable entries.
 *
 * @param {string} dir      — root directory to start from
 * @param {number} maxDepth — maximum recursion depth (default 12)
 * @returns {Promise<{name,version,ecosystem}[]>}
 */
async function walkDirForPackages(dir, maxDepth = 12) {
  const packages = [];

  async function walk(currentDir, depth) {
    if (depth > maxDepth) {return;}
    let entries;
    try { entries = await fsP.readdir(currentDir, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          await walk(path.join(currentDir, entry.name), depth + 1);
        }
      } else if (entry.isFile()) {
        // Quick filename-only check (avoids reading every file)
        const quickType = detectLockfileType(entry.name, '');
        if (quickType) {
          try {
            const content = await fsP.readFile(path.join(currentDir, entry.name), 'utf-8');
            // Re-check with content snippet for SBOM sniffing
            const finalType = detectLockfileType(entry.name, content.slice(0, 2000));
            if (finalType) {
              const pkgs = parseLockfile(finalType, content);
              packages.push(...pkgs);
              logger.info(`walkDir: found ${pkgs.length} pkgs in ${path.join(currentDir, entry.name)}`);
            }
          } catch { /* unreadable — skip */ }
        }
      }
    }
  }

  await walk(dir, 0);
  return packages;
}

// ─────────────────────────────────────────────────────────────────────────────
// GIT REPOSITORY SCANNER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clone a git repository (shallow, depth 1) into a temporary directory,
 * walk it for lockfiles, parse all packages, then clean up.
 *
 * Requires `git` to be available on PATH.
 *
 * @param {string} repoUrl — HTTPS or HTTP git remote URL
 * @returns {Promise<{name,version,ecosystem}[]>}
 */
async function extractPackagesFromGitRepo(repoUrl) {
  // Validate URL
  let parsedUrl;
  try { parsedUrl = new URL(repoUrl); }
  catch { throw new Error('Invalid repository URL'); }

  if (!['https:', 'http:'].includes(parsedUrl.protocol)) {
    throw new Error('Repository URL must use HTTPS or HTTP');
  }

  const gitBin = await resolveBin('git');
  const tmpDir = await fsP.mkdtemp(path.join(os.tmpdir(), 'ct-git-'));
  try {
    logger.info(`git-scan: cloning ${repoUrl} → ${tmpDir}`);
    try {
      await execFileAsync(gitBin, ['clone', '--depth', '1', '--single-branch', repoUrl, tmpDir,], {
        timeout: 120_000,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: 'echo' },
      });
    } catch (spawnErr) {
      const raw = (spawnErr.stderr || spawnErr.stdout || '').trim();
      // git writes progress ("Cloning into...") to stderr alongside error lines.
      // Extract only the fatal/error line so the stored message is meaningful.
      const errorLine = raw.split('\n').
        map((l) => l.trim()).
        find((l) => l.startsWith('fatal:') || l.startsWith('error:'));
      throw new Error(errorLine || raw || spawnErr.message);
    }

    const packages = await walkDirForPackages(tmpDir);
    logger.info(`git-scan: ${packages.length} packages extracted from ${repoUrl}`);
    return packages;
  } finally {
    await fsP.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CONTAINER IMAGE SCANNER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pull a container image via the Docker CLI, export its filesystem to a
 * temporary directory, walk for lockfiles / SBOMs, then clean up.
 *
 * Requires `docker` and `tar` to be available on PATH.
 *
 * @param {string} imageName — e.g. "nginx:latest", "python:3.12-slim"
 * @returns {Promise<{name,version,ecosystem}[]>}
 */
async function extractPackagesFromContainer(imageName) {
  // Basic image name validation (no shell meta-chars)
  if (!(/^[a-zA-Z0-9._\-/:@]+$/).test(imageName) || imageName.length > 512) {
    throw new Error('Invalid container image name');
  }

  const dockerBin = await resolveBin('docker');
  const tarBin = await resolveBin('tar');
  const tmpDir = await fsP.mkdtemp(path.join(os.tmpdir(), 'ct-container-'));
  let containerId = null;
  try {
    // 1. Pull image
    logger.info(`container-scan: pulling ${imageName}`);
    await execFileAsync(dockerBin, ['pull', '--', imageName], { timeout: 300_000 });

    // 2. Create a stopped container so we can export its filesystem
    const { stdout: cid } = await execFileAsync(dockerBin, ['create', '--', imageName]);
    containerId = cid.trim();

    // 3. Export full filesystem to a tar archive
    const tarPath = path.join(tmpDir, 'image.tar');
    logger.info(`container-scan: exporting ${imageName} filesystem`);
    await execFileAsync(dockerBin, ['export', '-o', tarPath, containerId], { timeout: 180_000 });

    // 4. Extract the tar into a sub-directory
    const fsDir = path.join(tmpDir, 'fs');
    await fsP.mkdir(fsDir, { recursive: true });
    await execFileAsync(tarBin, [
      'xf', tarPath, '-C', fsDir,
      '--overwrite',
    ], { timeout: 120_000 }).catch((err) => {
      // Container image tarballs often contain device nodes, hard links, and
      // other special entries that BusyBox/GNU tar can't extract into a regular
      // tmpfs directory. Those failures are harmless — we only need package
      // manifest files. Log and continue.
      logger.warn(`tar extraction warnings for ${imageName} (non-fatal): ${err.message}`);
    });

    const packages = await walkDirForPackages(fsDir);
    logger.info(`container-scan: ${packages.length} packages extracted from ${imageName}`);
    return packages;
  } finally {
    // Always clean up container + temp dir
    if (containerId) {
      await execFileAsync(dockerBin, ['rm', '-f', containerId]).catch(() => {});
    }
    await fsP.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect the lockfile format from a filename and/or content snippet.
 * Returns a format key or null if unrecognised.
 */
export function detectLockfileType(filename = '', content = '') {
  const name = filename.toLowerCase();
  if (name === 'package-lock.json') {return 'npm-package-lock';}
  if (name === 'yarn.lock') {return 'yarn';}
  if (name === 'pnpm-lock.yaml') {return 'pnpm';}
  if (name === 'requirements.txt') {return 'requirements-txt';}
  if (name === 'pipfile.lock') {return 'pipfile-lock';}
  if (name === 'go.sum') {return 'go-sum';}
  if (name === 'cargo.lock') {return 'cargo-lock';}
  if (name === 'gemfile.lock') {return 'gemfile-lock';}
  if (name === 'packages.lock.json') {return 'nuget-packages-lock';}
  if (name === 'composer.lock') {return 'composer-lock';}
  // SBOM — try content sniffing too (for files with non-standard names)
  const snippet = content.slice(0, 2000);
  if (name.endsWith('.spdx.json') || snippet.includes('"SPDXID"')) {return 'spdx-json';}
  if (name.includes('cyclonedx') || snippet.includes('"bomFormat"')) {return 'cyclonedx-json';}
  if (name === 'bom.json' && snippet.includes('"CycloneDX"')) {return 'cyclonedx-json';}
  return null;
}

/**
 * Parse a lockfile or SBOM into a flat list of packages.
 * @param {string} type  — format key from detectLockfileType()
 * @param {string} content — raw file content
 * @returns {{ name: string, version: string, ecosystem: string }[]}
 */
export function parseLockfile(type, content) {
  switch (type) {
    case 'npm-package-lock': return parseNpmPackageLock(content);
    case 'yarn': return parseYarnLock(content);
    case 'pnpm': return parsePnpmLock(content);
    case 'requirements-txt': return parseRequirementsTxt(content);
    case 'pipfile-lock': return parsePipfileLock(content);
    case 'go-sum': return parseGoSum(content);
    case 'cargo-lock': return parseCargoLock(content);
    case 'gemfile-lock': return parseGemfileLock(content);
    case 'nuget-packages-lock': return parseNugetPackagesLock(content);
    case 'composer-lock': return parseComposerLock(content);
    case 'spdx-json': return parseSpdxJson(content);
    case 'cyclonedx-json': return parseCycloneDxJson(content);
    default: return [];
  }
}

// ── OSV query layer ───────────────────────────────────────────────────────
//
// The /v1/querybatch endpoint only returns { id, modified } per vulnerability.
// Full advisory data (summary, severity, affected, references) requires a
// separate GET /v1/vulns/{id} call per advisory.
//
// Flow:
//   Step 1 — querybatch by package+version  → get unique vuln IDs per package
//   Step 2 — fetch full advisories in parallel (capped concurrency)
//   Step 3 — merge full advisory data back onto each package result

/**
 * Step 1: query querybatch and collect { pkg, vulnIds[] } entries.
 */
async function fetchVulnIdsByPackage(packages) {
  // Each element: { pkg: {name,version,ecosystem}, vulnIds: string[] }
  const entries = [];

  for (let i = 0; i < packages.length; i += OSV_BATCH_SIZE) {
    const chunk = packages.slice(i, i + OSV_BATCH_SIZE);
    const queries = chunk.map((p) => ({
      package: { name: p.name, ecosystem: p.ecosystem },
      version: p.version,
    }));
    try {
      const response = await postJson(OSV_API_URL, { queries });
      const batchResult = response.results ?? [];
      for (let j = 0; j < chunk.length; j++) {
        const ids = (batchResult[j]?.vulns ?? []).map((v) => v.id).filter(Boolean);
        entries.push({ pkg: chunk[j], vulnIds: ids });
      }
    } catch (err) {
      logger.warn(`OSV querybatch failed (offset ${i}): ${err.message}`);
      for (const pkg of chunk) {entries.push({ pkg, vulnIds: [] });}
    }
  }
  return entries;
}

/**
 * Step 2: fetch full advisory details for a set of unique IDs,
 * with controlled concurrency to avoid hammering the API.
 * @returns {Map<string, object>} vulnId → full advisory object
 */
async function fetchAdvisoryDetails(vulnIds) {
  const advisoryMap = new Map();

  // Process in batches of OSV_DETAIL_CONCURRENCY concurrent requests
  for (let i = 0; i < vulnIds.length; i += OSV_DETAIL_CONCURRENCY) {
    const batch = vulnIds.slice(i, i + OSV_DETAIL_CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map((id) => getJson(`${OSV_VULN_BASE_URL}/${id}`))
    );
    for (let j = 0; j < batch.length; j++) {
      const result = settled[j];
      if (result.status === 'fulfilled' && result.value?.id) {
        advisoryMap.set(batch[j], result.value);
      } else {
        logger.warn(`OSV advisory fetch failed for ${batch[j]}: ${result.reason?.message ?? 'unknown'}`);
      }
    }
  }
  return advisoryMap;
}

/**
 * Query OSV for a list of packages and return full vulnerability details.
 * @param {{ name, version, ecosystem }[]} packages
 * @returns {Promise<{ name, version, ecosystem, vulns: object[] }[]>}
 */
async function queryOsvBatch(packages) {
  // Step 1: get IDs per package
  const entries = await fetchVulnIdsByPackage(packages);

  // Step 2: collect all unique vuln IDs that were actually returned
  const allIds = [...new Set(entries.flatMap((e) => e.vulnIds))];
  logger.info(`osv-scanner: ${packages.length} packages → ${allIds.length} unique vulns to enrich`);

  // Step 3: fetch full advisory details for all unique IDs
  const advisoryMap = allIds.length > 0
    ? await fetchAdvisoryDetails(allIds)
    : new Map();

  // Step 4: reassemble per-package results with full advisory objects
  return entries.map(({ pkg, vulnIds }) => ({
    ...pkg,
    vulns: vulnIds.
      map((id) => advisoryMap.get(id)).
      filter(Boolean), // drop any IDs we couldn't fetch
  }));
}

function extractFixedVersion(affected = []) {
  for (const a of affected) {
    for (const range of a.ranges ?? []) {
      for (const event of range.events ?? []) {
        if (event.fixed) {return event.fixed;}
      }
    }
  }
  return null;
}

// ── Core OSV scan loop (shared by all scan types) ─────────────────────────────
//
// Deduplicates the package list, queries OSV, persists findings, and updates
// the scan run record to complete/error.  Does NOT set status to 'running' —
// the caller is responsible for that transition.
//
async function _executeOsvScan(scanId, packages, ignoredVulnIds) {
  let vulnsFound = 0;
  try {
    // Deduplicate by name@version@ecosystem
    const seen = new Set();
    const unique = packages.filter((p) => {
      const key = `${p.name}@${p.version}@${p.ecosystem}`;
      if (seen.has(key)) {return false;}
      seen.add(key);
      return true;
    });

    await db('osv_scan_runs').where({ id: scanId }).
update({ packages_scanned: unique.length });

    const results = await queryOsvBatch(unique);
    const findings = [];

    for (const result of results) {
      for (const vuln of result.vulns) {
        const isIgnored = ignoredVulnIds.includes(vuln.id);
        const title = vuln.summary ?? vuln.id;
        const description = vuln.details ?? '';

        const { cvssScore, severity } = extractSeverityFromVuln(vuln);
        const fixedVersion = extractFixedVersion(vuln.affected);

        findings.push({
          scan_id:           scanId,
          package_name:      result.name,
          package_version:   result.version,
          ecosystem:         result.ecosystem,
          vuln_id:           vuln.id,
          title,
          description,
          severity,
          cvss_score:        cvssScore,
          stride_categories: mapToStride(title, description),
          fixed_version:     fixedVersion,
          affected_versions: JSON.stringify(vuln.affected ?? []),
          references:        JSON.stringify((vuln.references ?? []).map((r) => r.url).filter(Boolean)),
          is_ignored:        isIgnored,
        });
        vulnsFound++;
      }
    }

    const INSERT_CHUNK = 100;
    for (let i = 0; i < findings.length; i += INSERT_CHUNK) {
      await db('osv_scan_findings').insert(findings.slice(i, i + INSERT_CHUNK));
    }

    await db('osv_scan_runs').where({ id: scanId }).
update({
      status:      'complete',
      vulns_found: vulnsFound,
      finished_at: db.fn.now(),
    });

    logger.info(`osv-scan ${scanId}: packages=${unique.length} vulns=${vulnsFound}`);
  } catch (err) {
    logger.error(`osv-scan ${scanId} failed: ${err.message}`);
    await db('osv_scan_runs').where({ id: scanId }).
update({
      status:        'error',
      error_message: err.message,
      finished_at:   db.fn.now(),
    });
  }
}

/**
 * Run a lockfile / manual scan.
 * Packages are already parsed by the controller before this is called.
 */
export async function runScan(scanId, packages, ignoredVulnIds = []) {
  await db('osv_scan_runs').where({ id: scanId }).
update({ status: 'running', started_at: db.fn.now() });
  await _executeOsvScan(scanId, packages, ignoredVulnIds);
}

/**
 * Run a git repository scan asynchronously.
 * Clones the repo, walks it for lockfiles, then runs the OSV scan.
 *
 * @param {string}   scanId       — UUID of the osv_scan_runs row
 * @param {string}   repoUrl      — HTTPS remote URL to clone
 * @param {string[]} ignoredVulnIds
 */
export async function runGitScan(scanId, repoUrl, ignoredVulnIds = []) {
  await db('osv_scan_runs').where({ id: scanId }).
update({ status: 'running', started_at: db.fn.now() });

  let packages;
  try {
    packages = await extractPackagesFromGitRepo(repoUrl);
  } catch (err) {
    logger.error(`git-scan ${scanId}: clone/parse failed: ${err.message}`);
    await db('osv_scan_runs').where({ id: scanId }).
update({
      status:        'error',
      error_message: err.message,
      finished_at:   db.fn.now(),
    });
    return;
  }

  if (packages.length === 0) {
    await db('osv_scan_runs').where({ id: scanId }).
update({
      status:        'error',
      error_message: 'No supported lockfiles found in the repository',
      finished_at:   db.fn.now(),
    });
    return;
  }

  await _executeOsvScan(scanId, packages, ignoredVulnIds);
}

/**
 * Run a container image scan asynchronously.
 * Pulls the image via Docker, exports the filesystem, walks for lockfiles,
 * then runs the OSV scan.
 *
 * @param {string}   scanId       — UUID of the osv_scan_runs row
 * @param {string}   imageName    — e.g. "nginx:latest"
 * @param {string[]} ignoredVulnIds
 */
export async function runContainerScan(scanId, imageName, ignoredVulnIds = []) {
  await db('osv_scan_runs').where({ id: scanId }).
update({ status: 'running', started_at: db.fn.now() });

  let packages;
  try {
    packages = await extractPackagesFromContainer(imageName);
  } catch (err) {
    logger.error(`container-scan ${scanId}: extraction failed: ${err.message}`);
    await db('osv_scan_runs').where({ id: scanId }).
update({
      status:        'error',
      error_message: err.message,
      finished_at:   db.fn.now(),
    });
    return;
  }

  if (packages.length === 0) {
    await db('osv_scan_runs').where({ id: scanId }).
update({
      status:        'complete',
      vulns_found:   0,
      packages_scanned: 0,
      finished_at:   db.fn.now(),
      error_message: 'No supported lockfiles found in the container image',
    });
    return;
  }

  await _executeOsvScan(scanId, packages, ignoredVulnIds);
}

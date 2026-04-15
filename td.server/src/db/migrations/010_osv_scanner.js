/**
 * Migration 010 — OSV Scanner
 *
 * Tables for the integrated OSV vulnerability scanner module.
 *
 *  osv_scan_runs     — one record per scan invocation (lockfile / sbom / manual)
 *  osv_scan_findings — one record per vulnerability found in a scan
 *  osv_scanner_policy — single-row instance-level scanner configuration
 */

export async function up(knex) {
  // ── Scan runs ─────────────────────────────────────────────────────────────
  await knex.schema.createTable('osv_scan_runs', (t) => {
    t.uuid('id').primary().
defaultTo(knex.raw('gen_random_uuid()'));

    t.string('name').notNullable();
    // 'lockfile' | 'sbom' | 'manual'
    t.string('scan_type').notNullable();
    // 'pending' | 'running' | 'complete' | 'error'
    t.string('status').notNullable().
defaultTo('pending');

    // Original filename provided by the client (used for display + format detection)
    t.string('source_filename');
    // Parsed lockfile format: 'npm-package-lock' | 'yarn' | 'pnpm' | 'requirements-txt' | …
    t.string('lockfile_type');

    t.integer('packages_scanned').defaultTo(0);
    t.integer('vulns_found').defaultTo(0);
    t.text('error_message');

    t.uuid('created_by').references('id').
inTable('users').
onDelete('SET NULL');

    t.timestamp('started_at');
    t.timestamp('finished_at');
    t.timestamp('created_at').notNullable().
defaultTo(knex.fn.now());

    t.index('status', 'idx_scan_runs_status');
    t.index('created_at', 'idx_scan_runs_created_at');
    t.index('created_by', 'idx_scan_runs_created_by');
  });

  // ── Scan findings ─────────────────────────────────────────────────────────
  await knex.schema.createTable('osv_scan_findings', (t) => {
    t.uuid('id').primary().
defaultTo(knex.raw('gen_random_uuid()'));

    t.uuid('scan_id').
      notNullable().
      references('id').
      inTable('osv_scan_runs').
      onDelete('CASCADE');

    t.string('package_name').notNullable();
    t.string('package_version');
    t.string('ecosystem');

    // OSV advisory ID, e.g. "GHSA-xxxx-yyyy-zzzz" or "CVE-2024-12345"
    t.string('vuln_id').notNullable();
    t.string('title');
    t.text('description');

    // Critical | High | Medium | Low
    t.string('severity');
    t.decimal('cvss_score', 4, 1);

    // Derived STRIDE categories from keyword analysis (matches vulnSync.js logic)
    t.specificType('stride_categories', 'TEXT[]').defaultTo('{}');

    // Earliest version in which the vulnerability is fixed
    t.string('fixed_version');

    // Raw affected version ranges from OSV response
    t.jsonb('affected_versions').defaultTo('[]');
    // Advisory reference URLs
    t.jsonb('references').defaultTo('[]');

    // Set to true when the vuln ID appears in osv_scanner_policy.ignored_vuln_ids
    t.boolean('is_ignored').notNullable().
defaultTo(false);

    t.timestamp('created_at').notNullable().
defaultTo(knex.fn.now());

    t.index('scan_id', 'idx_findings_scan_id');
    t.index('severity', 'idx_findings_severity');
    t.index('vuln_id', 'idx_findings_vuln_id');
  });

  // ── Scanner policy (single-row) ───────────────────────────────────────────
  await knex.schema.createTable('osv_scanner_policy', (t) => {
    t.uuid('id').primary().
defaultTo(knex.raw('gen_random_uuid()'));

    // Array of OSV / CVE IDs that should be marked as ignored in scan results
    t.jsonb('ignored_vuln_ids').notNullable().
defaultTo('[]');

    // Minimum severity level to store findings for
    // Critical | High | Medium | Low  (default: Low = store everything)
    t.string('severity_threshold').notNullable().
defaultTo('Low');

    // Automatically link scan findings back to STRIDE threat records
    t.boolean('auto_enrich_threats').notNullable().
defaultTo(false);

    t.timestamp('updated_at').notNullable().
defaultTo(knex.fn.now());
  });

  // Seed the default policy row so the GET endpoint always returns a value
  await knex('osv_scanner_policy').insert({
    ignored_vuln_ids:   JSON.stringify([]),
    severity_threshold: 'Low',
    auto_enrich_threats: false,
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('osv_scan_findings');
  await knex.schema.dropTableIfExists('osv_scan_runs');
  await knex.schema.dropTableIfExists('osv_scanner_policy');
}

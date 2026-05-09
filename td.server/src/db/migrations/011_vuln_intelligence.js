/**
 * 011_vuln_intelligence.js
 *
 * Vulnerability Intelligence Engine — multi-source auto-update infrastructure.
 * Adds: vuln_sources (registered intel sources), vuln_source_health (monitoring),
 * and vuln_dedup_map (cross-source deduplication).
 */

export function up(knex) {
  return knex.schema.
    // ── Registered vulnerability intel sources ────────────────────────────────
    createTable('vuln_sources', (t) => {
      t.increments('id').primary();
      t.string('name', 64).notNullable().
unique(); // e.g. 'osv', 'nvd', 'ghsa'
      t.string('display_name', 128).notNullable(); // e.g. 'OSV Database'
      t.string('base_url', 512).notNullable(); // API base URL
      t.boolean('enabled').defaultTo(true);
      t.integer('priority').defaultTo(50); // lower = higher priority
      t.string('sync_interval').defaultTo('6h'); // cron-like: 1h, 6h, 24h
      t.integer('batch_size').defaultTo(100);
      t.integer('timeout_ms').defaultTo(30000);
      t.json('extra_config').defaultTo('{}'); // source-specific opts
      t.timestamp('last_sync_at').nullable();
      t.timestamp('last_success_at').nullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.fn.now());
    }).

    // ── Health tracking per source ─────────────────────────────────────────────
    createTable('vuln_source_health', (t) => {
      t.increments('id').primary();
      t.integer('source_id').unsigned().
notNullable().
        references('id').
inTable('vuln_sources').
onDelete('CASCADE');
      t.string('status', 16).notNullable(); // 'success' | 'error' | 'timeout'
      t.integer('fetched').defaultTo(0);
      t.integer('inserted').defaultTo(0);
      t.integer('updated').defaultTo(0);
      t.integer('duration_ms').defaultTo(0);
      t.text('error_message').nullable();
      t.timestamp('started_at').notNullable();
      t.timestamp('finished_at').nullable();
    }).

    // ── Cross-source deduplication map ─────────────────────────────────────────
    createTable('vuln_dedup_map', (t) => {
      t.increments('id').primary();
      t.string('canonical_id', 128).notNullable(); // CVE-YYYY-NNNNN or OSV-XXXX
      t.string('source_id_ref', 128).notNullable(); // source-specific ID (e.g. GHSA-xxxx)
      t.string('source_name', 64).notNullable(); // which source
      t.integer('confidence').defaultTo(100); // 0-100 match confidence
      t.timestamp('matched_at').defaultTo(knex.fn.now());
      t.unique(['canonical_id', 'source_id_ref', 'source_name']);
    }).

    // ── Seed default sources ───────────────────────────────────────────────────
    then(() => knex('vuln_sources').insert([
      {
        name: 'osv',
        display_name: 'OSV Database',
        base_url: 'https://api.osv.dev',
        priority: 10,
        sync_interval: '6h',
        batch_size: 100,
        extra_config: JSON.stringify({
          ecosystems: ['npm', 'PyPI', 'Go', 'Maven', 'NuGet', 'RubyGems', 'Docker', 'Linux', 'Kubernetes'],
          fetchLimit: 20,
        }),
      },
      {
        name: 'nvd',
        display_name: 'NVD (National Vulnerability Database)',
        base_url: 'https://services.nvd.nist.gov/rest/json/cves/2.0',
        priority: 20,
        sync_interval: '24h',
        batch_size: 200,
        timeout_ms: 60000,
        extra_config: JSON.stringify({ resultsPerPage: 200 }),
      },
      {
        name: 'ghsa',
        display_name: 'GitHub Security Advisory',
        base_url: 'https://api.github.com/advisories',
        priority: 30,
        sync_interval: '6h',
        batch_size: 100,
        extra_config: JSON.stringify({ type: 'reviewed' }),
      },
    ]));
}

export function down(knex) {
  return knex.schema.
    dropTableIfExists('vuln_dedup_map').
    dropTableIfExists('vuln_source_health').
    dropTableIfExists('vuln_sources');
}
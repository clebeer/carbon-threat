/**
 * Migration 019 — Carbon Dojo findings
 *
 *   findings           — one vulnerability (severity/status/sla/CVE/CWE/CVSS/remediation)
 *   finding_comments   — discussion thread per finding
 *   finding_evidence   — attached artifacts (screenshots, PoC, request/response)
 *   risk_acceptances   — two-person approval (requester ≠ approver, enforced app-side)
 *
 * Indexes cover the Findings list filters (org_id, product_id, severity, status, sla).
 */

export async function up(knex) {
  await knex.schema.createTable('findings', (t) => {
    t.uuid('id').primary().
defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('org_id').notNullable().
references('id').
inTable('organizations').
onDelete('CASCADE');
    t.uuid('product_id').notNullable().
references('id').
inTable('products').
onDelete('CASCADE');
    t.uuid('assessment_id').references('id').
inTable('assessments').
onDelete('SET NULL');

    t.string('title', 512).notNullable();
    // 'critical' | 'high' | 'medium' | 'low' | 'info'
    t.string('severity', 16).notNullable();
    // 'triage' | 'active' | 'resolved' | 'false_positive' | 'risk_accepted'
    t.string('status', 24).notNullable().
defaultTo('triage');
    // 'on_track' | 'at_risk' | 'breached'
    t.string('sla', 16).notNullable().
defaultTo('on_track');
    // 'web' | 'file' | 'scanner'
    t.string('source', 16).notNullable().
defaultTo('web');

    t.string('cve', 64);
    t.string('cwe', 64);
    t.string('cvss', 8);
    t.text('description');
    t.text('remediation');
    // De-duplication key for imports (product + fingerprint of title/cwe/location).
    t.string('fingerprint', 128);
    t.string('jira_key', 64);

    t.uuid('created_by').references('id').
inTable('users').
onDelete('SET NULL');
    t.timestamp('due_at');
    t.timestamps(true, true);

    t.index('org_id', 'idx_findings_org_id');
    t.index('product_id', 'idx_findings_product_id');
    t.index('severity', 'idx_cd_findings_severity');
    t.index('status', 'idx_findings_status');
    t.index('sla', 'idx_findings_sla');
    t.index(['product_id', 'fingerprint'], 'idx_findings_dedup');
  });

  await knex.schema.createTable('finding_comments', (t) => {
    t.uuid('id').primary().
defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('finding_id').notNullable().
references('id').
inTable('findings').
onDelete('CASCADE');
    t.uuid('author_id').references('id').
inTable('users').
onDelete('SET NULL');
    t.text('body').notNullable();
    t.timestamp('created_at').notNullable().
defaultTo(knex.fn.now());
    t.index('finding_id', 'idx_finding_comments_finding_id');
  });

  await knex.schema.createTable('finding_evidence', (t) => {
    t.uuid('id').primary().
defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('finding_id').notNullable().
references('id').
inTable('findings').
onDelete('CASCADE');
    t.string('filename', 512).notNullable();
    t.string('content_type', 128);
    t.integer('size_bytes');
    // Object-storage reference (never a public URL).
    t.string('storage_ref', 1024).notNullable();
    t.uuid('uploaded_by').references('id').
inTable('users').
onDelete('SET NULL');
    t.timestamp('created_at').notNullable().
defaultTo(knex.fn.now());
    t.index('finding_id', 'idx_finding_evidence_finding_id');
  });

  await knex.schema.createTable('risk_acceptances', (t) => {
    t.uuid('id').primary().
defaultTo(knex.raw('gen_random_uuid()'));
    t.uuid('finding_id').notNullable().
references('id').
inTable('findings').
onDelete('CASCADE');
    // Requester and approver MUST differ — enforced in the service layer (ADR 0001).
    t.uuid('requested_by').notNullable().
references('id').
inTable('users').
onDelete('RESTRICT');
    t.uuid('approved_by').references('id').
inTable('users').
onDelete('SET NULL');
    // 'requested' | 'approved' | 'rejected'
    t.string('status', 16).notNullable().
defaultTo('requested');
    t.date('reassess_by');
    t.text('justification');
    t.timestamp('requested_at').notNullable().
defaultTo(knex.fn.now());
    t.timestamp('approved_at');
    t.index('finding_id', 'idx_risk_acceptances_finding_id');
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists('risk_acceptances');
  await knex.schema.dropTableIfExists('finding_evidence');
  await knex.schema.dropTableIfExists('finding_comments');
  await knex.schema.dropTableIfExists('findings');
}

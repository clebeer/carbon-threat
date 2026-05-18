/* eslint-disable max-lines, max-lines-per-function, complexity, no-await-in-loop, require-unicode-regexp, no-mixed-operators, no-continue, prefer-named-capture-group, no-useless-escape, max-depth, no-empty-function, sort-imports, no-bitwise, no-promise-executor-return, require-await, no-console, no-inner-declarations, no-invalid-this */
/**
 * ATT&CK Framework Service
 *
 * Handles STIX 2.1 data ingestion from MITRE's public repository, query
 * helpers for tactics / techniques / groups / mitigations, coverage-gap
 * analysis against existing STRIDE threat models, and report generation.
 *
 * Data source: https://github.com/mitre-attack/attack-stix-data
 *   enterprise-attack/enterprise-attack.json  (≈ 30 MB)
 */

import https from 'https';
import http from 'http';
import db from '../db/knex.js';
import loggerHelper from '../helpers/logger.helper.js';

const logger = loggerHelper.get('services/attackFramework.js');

// ── Constants ─────────────────────────────────────────────────────────────────

const STIX_URL =
  'https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json';

// STRIDE category → ATT&CK tactic external IDs
const STRIDE_TO_TACTICS = {
  'Spoofing':               ['TA0001', 'TA0006'], // Initial Access, Credential Access
  'Tampering':              ['TA0003', 'TA0005', 'TA0008'], // Persistence, Defense Evasion, Lateral Movement
  'Repudiation':            ['TA0005', 'TA0040'], // Defense Evasion, Impact
  'Information Disclosure': ['TA0007', 'TA0009', 'TA0010'], // Discovery, Collection, Exfiltration
  'Denial of Service':      ['TA0040'], // Impact
  'Elevation of Privilege': ['TA0002', 'TA0004'], // Execution, Privilege Escalation
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Download a URL and return the full body as a string.
 * Follows up to one redirect.
 */
function fetchUrl(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const proto = url.startsWith('https') ? https : http;
    proto.get(url, { timeout: 120_000 }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location && maxRedirects > 0) {
        return resolve(fetchUrl(res.headers.location, maxRedirects - 1));
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      res.on('error', reject);
    }).on('error', reject).
on('timeout', () => reject(new Error('Request timed out')));
  });
}

/** Extract the MITRE ATT&CK external_id (e.g. T1059) from a STIX object. */
function getAttackId(obj) {
  return obj.external_references?.find((r) => r.source_name === 'mitre-attack')?.external_id ?? null;
}

/** Extract the ATT&CK URL from a STIX object. */
function getAttackUrl(obj) {
  return obj.external_references?.find((r) => r.source_name === 'mitre-attack')?.url ?? null;
}

/** Strip HTML tags from a description field (ATT&CK bundles may include <code> etc.) */
function stripHtml(str) {
  return (str ?? '').replace(/<[^>]+>/g, '').trim();
}

// ── STIX Sync ─────────────────────────────────────────────────────────────────

/**
 * Download the enterprise-attack STIX bundle, parse it, and upsert all
 * objects and relationships into the database.
 *
 * @param {string} logId  - UUID of the attack_sync_log row to update
 * @returns {{ objectsSynced, relationshipsSynced }}
 */
export async function syncAttackData(logId) {
  await db('attack_sync_log').where({ id: logId }).
update({ status: 'running' });

  try {
    logger.info('attack-sync: downloading STIX bundle from MITRE GitHub…');
    const raw = await fetchUrl(STIX_URL);
    const bundle = JSON.parse(raw);

    if (!bundle?.objects?.length) {
      throw new Error('STIX bundle is empty or malformed');
    }

    logger.info(`attack-sync: bundle loaded — ${bundle.objects.length} STIX objects`);

    // ── Separate by type ──────────────────────────────────────────────────
    const tactics = bundle.objects.filter((o) => o.type === 'x-mitre-tactic');
    const techniques = bundle.objects.filter((o) => o.type === 'attack-pattern');
    const mitigations = bundle.objects.filter((o) => o.type === 'course-of-action');
    const groups = bundle.objects.filter((o) => o.type === 'intrusion-set');
    const software = bundle.objects.filter((o) => o.type === 'tool' || o.type === 'malware');
    const relationships = bundle.objects.filter((o) => o.type === 'relationship');
    const collection = bundle.objects.find((o) => o.type === 'x-mitre-collection');

    const attackVersion = collection?.x_mitre_version ?? null;

    // ── Upsert all objects ────────────────────────────────────────────────
    let objectsSynced = 0;

    // Helper: upsert a batch of attack_objects rows
    async function upsertObjects(rows) {
      if (!rows.length) {return;}
      // Use raw insert … on conflict do update for upsert
      await db('attack_objects').
        insert(rows).
        onConflict('attack_id').
        merge([
'name', 'description', 'platforms', 'kill_chain_phases',
                'aliases', 'url', 'is_deprecated', 'is_revoked', 'extra', 'updated_at'
]);
      objectsSynced += rows.length;
    }

    // ── Tactics ───────────────────────────────────────────────────────────
    const tacticRows = tactics.
      filter((o) => !o.x_mitre_deprecated && !o.revoked).
      map((o) => ({
        attack_id:        getAttackId(o) ?? o.id,
        type:             'tactic',
        name:             o.name,
        description:      stripHtml(o.description),
        platforms:        [],
        kill_chain_phases: JSON.stringify([]),
        aliases:          [],
        url:              getAttackUrl(o),
        stix_id:          o.id,
        is_deprecated:    false,
        is_revoked:       false,
        extra:            JSON.stringify({ short_name: o.x_mitre_shortname }),
        updated_at:       db.fn.now(),
      }));
    await upsertObjects(tacticRows);

    // ── Techniques ────────────────────────────────────────────────────────
    const techniqueRows = techniques.
      filter((o) => !o.x_mitre_deprecated && !o.revoked).
      map((o) => ({
        attack_id:        getAttackId(o),
        type:             o.x_mitre_is_subtechnique ? 'sub-technique' : 'technique',
        name:             o.name,
        description:      stripHtml(o.description),
        platforms:        o.x_mitre_platforms ?? [],
        kill_chain_phases: JSON.stringify(o.kill_chain_phases ?? []),
        aliases:          [],
        url:              getAttackUrl(o),
        stix_id:          o.id,
        is_deprecated:    Boolean(o.x_mitre_deprecated),
        is_revoked:       Boolean(o.revoked),
        extra:            JSON.stringify({
          detection:    stripHtml(o.x_mitre_detection),
          data_sources: o.x_mitre_data_sources ?? [],
          defense_bypassed: o.x_mitre_defense_bypassed ?? [],
          permissions_required: o.x_mitre_permissions_required ?? [],
        }),
        updated_at:       db.fn.now(),
      })).
      filter((r) => r.attack_id); // skip entries with no external ID
    await upsertObjects(techniqueRows);

    // ── Mitigations ───────────────────────────────────────────────────────
    const mitigationRows = mitigations.
      filter((o) => !o.x_mitre_deprecated && !o.revoked).
      map((o) => ({
        attack_id:        getAttackId(o),
        type:             'mitigation',
        name:             o.name,
        description:      stripHtml(o.description),
        platforms:        [],
        kill_chain_phases: JSON.stringify([]),
        aliases:          [],
        url:              getAttackUrl(o),
        stix_id:          o.id,
        is_deprecated:    Boolean(o.x_mitre_deprecated),
        is_revoked:       Boolean(o.revoked),
        extra:            JSON.stringify({}),
        updated_at:       db.fn.now(),
      })).
      filter((r) => r.attack_id);
    await upsertObjects(mitigationRows);

    // ── Groups ────────────────────────────────────────────────────────────
    const groupRows = groups.
      filter((o) => !o.x_mitre_deprecated && !o.revoked).
      map((o) => ({
        attack_id:        getAttackId(o),
        type:             'group',
        name:             o.name,
        description:      stripHtml(o.description),
        platforms:        [],
        kill_chain_phases: JSON.stringify([]),
        aliases:          o.aliases ?? [],
        url:              getAttackUrl(o),
        stix_id:          o.id,
        is_deprecated:    Boolean(o.x_mitre_deprecated),
        is_revoked:       Boolean(o.revoked),
        extra:            JSON.stringify({}),
        updated_at:       db.fn.now(),
      })).
      filter((r) => r.attack_id);
    await upsertObjects(groupRows);

    // ── Software ──────────────────────────────────────────────────────────
    const softwareRows = software.
      filter((o) => !o.x_mitre_deprecated && !o.revoked).
      map((o) => ({
        attack_id:        getAttackId(o),
        type:             'software',
        name:             o.name,
        description:      stripHtml(o.description),
        platforms:        o.x_mitre_platforms ?? [],
        kill_chain_phases: JSON.stringify([]),
        aliases:          o.x_mitre_aliases ?? [],
        url:              getAttackUrl(o),
        stix_id:          o.id,
        is_deprecated:    Boolean(o.x_mitre_deprecated),
        is_revoked:       Boolean(o.revoked),
        extra:            JSON.stringify({ software_type: o.type }),
        updated_at:       db.fn.now(),
      })).
      filter((r) => r.attack_id);
    await upsertObjects(softwareRows);

    // ── Build stix_id → DB UUID lookup map ───────────────────────────────
    const allDbObjs = await db('attack_objects').select('id', 'stix_id');
    const stixToUuid = new Map(allDbObjs.map((o) => [o.stix_id, o.id]));

    // ── Parent linkage for sub-techniques ─────────────────────────────────
    // The sub-technique parent is encoded in the attack_id (T1059.003 → T1059)
    const subTechs = await db('attack_objects').where({ type: 'sub-technique' }).
select('id', 'attack_id');
    for (const sub of subTechs) {
      const parentAttackId = sub.attack_id.split('.')[0]; // T1059.003 → T1059
      const parent = await db('attack_objects').
        where({ attack_id: parentAttackId, type: 'technique' }).
        select('id').
        first();
      if (parent) {
        await db('attack_objects').where({ id: sub.id }).
update({ parent_id: parent.id });
      }
    }

    // ── Relationships ─────────────────────────────────────────────────────
    let relationshipsSynced = 0;
    const relRows = [];
    for (const rel of relationships) {
      if (rel.revoked || rel.x_mitre_deprecated) {continue;}
      const srcUuid = stixToUuid.get(rel.source_ref);
      const tgtUuid = stixToUuid.get(rel.target_ref);
      if (!srcUuid || !tgtUuid) {continue;}

      relRows.push({
        source_id:         srcUuid,
        target_id:         tgtUuid,
        relationship_type: rel.relationship_type,
        stix_id:           rel.id,
      });
    }

    if (relRows.length) {
      // upsert in batches of 500
      const BATCH = 500;
      for (let i = 0; i < relRows.length; i += BATCH) {
        const batch = relRows.slice(i, i + BATCH);
        await db('attack_relationships').
          insert(batch).
          onConflict('stix_id').
          merge(['source_id', 'target_id', 'relationship_type']);
        relationshipsSynced += batch.length;
      }
    }

    // ── Finalise sync log ──────────────────────────────────────────────────
    await db('attack_sync_log').where({ id: logId }).
update({
      status:                'complete',
      attack_version:        attackVersion,
      objects_synced:        objectsSynced,
      relationships_synced:  relationshipsSynced,
      finished_at:           db.fn.now(),
    });

    logger.info(`attack-sync: done — ${objectsSynced} objects, ${relationshipsSynced} relationships`);
    return { objectsSynced, relationshipsSynced };

  } catch (err) {
    logger.error('attack-sync: failed', err);
    await db('attack_sync_log').where({ id: logId }).
update({
      status:        'error',
      error_message: err.message,
      finished_at:   db.fn.now(),
    });
    throw err;
  }
}

// ── Query Helpers ─────────────────────────────────────────────────────────────

export async function getSyncStatus() {
  const last = await db('attack_sync_log').
    orderBy('started_at', 'desc').
    first();
  const count = await db('attack_objects').count('id as n').
first();
  return {
    lastSync:   last ?? null,
    totalObjects: parseInt(count?.n ?? '0', 10),
    isSynced:   Boolean(last) && last.status === 'complete',
  };
}

export async function getTactics() {
  return db('attack_objects').
    where({ type: 'tactic', is_deprecated: false, is_revoked: false }).
    orderBy('attack_id');
}

/**
 * List techniques with optional filters.
 * @param {{ tacticId?, tacticAttackId?, search?, type?, limit?, offset? }} filters
 */
export async function getTechniques(filters = {}) {
  const { tacticId, tacticAttackId, search, type = 'technique', limit = 100, offset = 0 } = filters;

  let q = db('attack_objects as ao').
    where('ao.is_deprecated', false).
    where('ao.is_revoked', false);

  if (type === 'technique') {
    q = q.whereIn('ao.type', ['technique', 'sub-technique']);
  } else if (type) {
    q = q.where('ao.type', type);
  }

  if (search) {
    const term = `%${search.toLowerCase()}%`;
    q = q.where(function () {
      this.whereRaw('lower(ao.name) like ?', [term]).
          orWhereRaw('lower(ao.attack_id) like ?', [term]);
    });
  }

  // Filter by tactic via kill_chain_phases (jsonb array contains phase_name)
  if (tacticAttackId) {
    // Get the tactic's short_name from the extra->short_name field
    const tactic = await db('attack_objects').
      where({ attack_id: tacticAttackId, type: 'tactic' }).
      select('extra').
      first();
    if (tactic) {
      const shortName = (tactic.extra?.short_name ?? tactic.extra?.shortName ?? '').toLowerCase();
      if (shortName) {
        q = q.whereRaw(
          `exists (select 1 from jsonb_array_elements(ao.kill_chain_phases) as kcp where kcp->>'phase_name' = ?)`,
          [shortName]
        );
      }
    }
  }

  if (tacticId) {
    const tactic = await db('attack_objects').
      where({ id: tacticId, type: 'tactic' }).
      select('extra').
      first();
    if (tactic) {
      const shortName = (tactic.extra?.short_name ?? '').toLowerCase();
      if (shortName) {
        q = q.whereRaw(
          `exists (select 1 from jsonb_array_elements(ao.kill_chain_phases) as kcp where kcp->>'phase_name' = ?)`,
          [shortName]
        );
      }
    }
  }

  const total = await q.clone().count('ao.id as n').
first();
  const rows = await q.
    select('ao.*').
    orderByRaw(`
      CASE ao.type
        WHEN 'technique'     THEN 1
        WHEN 'sub-technique' THEN 2
        ELSE 3
      END
    `).
    orderBy('ao.attack_id').
    limit(limit).
    offset(offset);

  return { techniques: rows, total: parseInt(total?.n ?? '0', 10) };
}

export async function getTechniqueById(attackId) {
  const tech = await db('attack_objects').
    where({ attack_id: attackId }).
    first();
  if (!tech) {return null;}

  // Sub-techniques
  const subTechs = await db('attack_objects').
    where({ parent_id: tech.id, type: 'sub-technique', is_deprecated: false, is_revoked: false }).
    orderBy('attack_id');

  // Mitigations via attack_relationships (mitigation → technique)
  const mitigations = await db('attack_relationships as ar').
    join('attack_objects as m', 'ar.source_id', 'm.id').
    where({ 'ar.target_id': tech.id, 'ar.relationship_type': 'mitigates', 'm.type': 'mitigation' }).
    select('m.*');

  // Groups that use this technique
  const groups = await db('attack_relationships as ar').
    join('attack_objects as g', 'ar.source_id', 'g.id').
    where({ 'ar.target_id': tech.id, 'ar.relationship_type': 'uses', 'g.type': 'group' }).
    select('g.id', 'g.attack_id', 'g.name');

  return { ...tech, subTechniques: subTechs, mitigations, groups };
}

export async function getGroups(filters = {}) {
  const { search, limit = 100, offset = 0 } = filters;
  let q = db('attack_objects').
    where({ type: 'group', is_deprecated: false, is_revoked: false });

  if (search) {
    const term = `%${search.toLowerCase()}%`;
    q = q.where(function () {
      this.whereRaw('lower(name) like ?', [term]).
          orWhereRaw('lower(attack_id) like ?', [term]);
    });
  }

  const total = await q.clone().count('id as n').
first();
  const rows = await q.orderBy('name').limit(limit).
offset(offset);
  return { groups: rows, total: parseInt(total?.n ?? '0', 10) };
}

export async function getMitigations(filters = {}) {
  const { search, limit = 100, offset = 0 } = filters;
  let q = db('attack_objects').
    where({ type: 'mitigation', is_deprecated: false, is_revoked: false });

  if (search) {
    const term = `%${search.toLowerCase()}%`;
    q = q.whereRaw('lower(name) like ?', [term]);
  }

  const total = await q.clone().count('id as n').
first();
  const rows = await q.orderBy('name').limit(limit).
offset(offset);
  return { mitigations: rows, total: parseInt(total?.n ?? '0', 10) };
}

// ── Coverage Analysis ─────────────────────────────────────────────────────────

/**
 * Analyse a threat model's STRIDE threats against the ATT&CK framework.
 *
 * Returns:
 *   - tactics: all ATT&CK tactics with coverage stats
 *   - coveredTacticIds: set of tactic attack_ids that have ≥1 mapped threat
 *   - gaps: tactic attack_ids with zero coverage
 *   - mappings: existing threat→technique mappings for this model
 *   - threats: the model's threats with their STRIDE categories
 */
export async function analyzeModelCoverage(modelId) {
  // Load the model's threats
  const threats = await db('threats').
    where({ model_id: modelId }).
    orderBy('created_at', 'desc');

  // Load existing mappings for this model
  const mappings = await db('attack_threat_mappings as atm').
    leftJoin('attack_objects as tech', 'atm.technique_id', 'tech.id').
    leftJoin('threats as t', 'atm.threat_id', 't.id').
    leftJoin('users as u', 'atm.created_by', 'u.id').
    where('atm.model_id', modelId).
    select(
      'atm.*',
      'tech.attack_id    as technique_attack_id',
      'tech.name         as technique_name',
      'tech.kill_chain_phases',
      't.title           as threat_title',
      't.stride_category as threat_stride',
      'u.display_name    as mapped_by_name',
    );

  // All tactics
  const tactics = await getTactics();

  // Build set of covered tactic short_names from mappings' kill_chain_phases
  const coveredTacticShortNames = new Set();
  for (const m of mappings) {
    const phases = m.kill_chain_phases ?? [];
    for (const phase of phases) {
      if (phase.phase_name) {coveredTacticShortNames.add(phase.phase_name);}
    }
  }

  // Correlate tactics to coverage
  const tacticCoverage = tactics.map((tac) => {
    const shortName = tac.extra?.short_name ?? '';
    const covered = coveredTacticShortNames.has(shortName);
    // STRIDE categories that map to this tactic
    const relatedStride = Object.entries(STRIDE_TO_TACTICS).
      filter(([, tacIds]) => tacIds.includes(tac.attack_id)).
      map(([stride]) => stride);
    // Count threats matching those STRIDE categories
    const relatedThreats = threats.filter((t) => relatedStride.includes(t.stride_category));
    return {
      ...tac,
      covered,
      relatedStrideCategories: relatedStride,
      relatedThreatCount: relatedThreats.length,
      mappingCount: mappings.filter((m) => {
        const phases = m.kill_chain_phases ?? [];
        return phases.some((p) => p.phase_name === shortName);
      }).length,
    };
  });

  const coveredCount = tacticCoverage.filter((t) => t.covered).length;
  const coverageScore = tactics.length ? Math.round((coveredCount / tactics.length) * 100) : 0;

  // STRIDE → tactic recommendations (for un-covered tactics)
  const recommendations = [];
  for (const threat of threats) {
    const tacticIds = STRIDE_TO_TACTICS[threat.stride_category] ?? [];
    for (const tacId of tacticIds) {
      const tac = tacticCoverage.find((t) => t.attack_id === tacId);
      if (tac && !tac.covered) {
        recommendations.push({
          threat_id:      threat.id,
          threat_title:   threat.title,
          stride_category: threat.stride_category,
          tactic_id:      tac.attack_id,
          tactic_name:    tac.name,
        });
      }
    }
  }

  return {
    modelId,
    threats,
    tactics: tacticCoverage,
    mappings,
    coverageScore,
    coveredCount,
    totalTactics: tactics.length,
    recommendations: recommendations.slice(0, 20), // cap to avoid noise
  };
}

// ── Threat → Technique Mappings ───────────────────────────────────────────────

export async function listMappings(filters = {}) {
  const { modelId, threatId } = filters;
  let q = db('attack_threat_mappings as atm').
    join('attack_objects as tech', 'atm.technique_id', 'tech.id').
    leftJoin('threats as t', 'atm.threat_id', 't.id').
    leftJoin('users as u', 'atm.created_by', 'u.id').
    select(
      'atm.id',
      'atm.threat_id',
      'atm.technique_id',
      'atm.model_id',
      'atm.confidence',
      'atm.notes',
      'atm.created_at',
      'tech.attack_id    as technique_attack_id',
      'tech.name         as technique_name',
      'tech.type         as technique_type',
      'tech.url          as technique_url',
      'tech.kill_chain_phases',
      't.title           as threat_title',
      't.stride_category as threat_stride',
      'u.display_name    as mapped_by_name',
    );

  if (modelId) {q = q.where('atm.model_id', modelId);}
  if (threatId) {q = q.where('atm.threat_id', threatId);}

  return q.orderBy('atm.created_at', 'desc');
}

export async function createMapping({ threatId, techniqueId, modelId, confidence, notes, userId }) {
  // techniqueId can be a UUID or an attack_id string (e.g. T1059)
  let techUuid = techniqueId;
  if (!(/^[0-9a-f]{8}-/).test(techniqueId)) {
    const tech = await db('attack_objects').where({ attack_id: techniqueId }).
first();
    if (!tech) {throw new Error(`Technique not found: ${techniqueId}`);}
    techUuid = tech.id;
  }

  const [mapping] = await db('attack_threat_mappings').
    insert({
      threat_id:    threatId ?? null,
      technique_id: techUuid,
      model_id:     modelId ?? null,
      confidence:   confidence ?? 'medium',
      notes:        notes ?? null,
      created_by:   userId ?? null,
    }).
    returning('*');
  return mapping;
}

export async function deleteMapping(id) {
  const deleted = await db('attack_threat_mappings').where({ id }).
delete();
  return deleted > 0;
}

// ── Report Generation ─────────────────────────────────────────────────────────

/**
 * Build a structured report object for a threat model.
 * Format can be 'json' | 'markdown'.
 */
export async function generateReport(modelId, format = 'json') {
  // Fetch the model metadata
  const model = await db('threat_models').where({ id: modelId }).
first();
  if (!model) {throw new Error('Threat model not found');}

  const coverage = await analyzeModelCoverage(modelId);

  if (format === 'json') {
    return {
      report: {
        generatedAt: new Date().toISOString(),
        model: { id: model.id, title: model.title, created_at: model.created_at },
        summary: {
          totalThreats:    coverage.threats.length,
          totalTactics:    coverage.totalTactics,
          coveredTactics:  coverage.coveredCount,
          coverageScore:   coverage.coverageScore,
          totalMappings:   coverage.mappings.length,
        },
        tactics:         coverage.tactics,
        mappings:        coverage.mappings,
        threats:         coverage.threats,
        recommendations: coverage.recommendations,
      },
    };
  }

  // ── Markdown ────────────────────────────────────────────────────────────
  const now = new Date().toUTCString();
  const sev = (s) => ({ Critical: '🔴', High: '🟠', Medium: '🟡', Low: '🔵' }[s] ?? '⚪');
  const cov = (covered) => (covered ? '✅' : '❌');

  const lines = [
    `# ATT&CK Coverage Report`,
    ``,
    `**Model:** ${model.title}`,
    `**Generated:** ${now}`,
    ``,
    `## Executive Summary`,
    ``,
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Total STRIDE Threats | ${coverage.threats.length} |`,
    `| ATT&CK Tactics Covered | ${coverage.coveredCount} / ${coverage.totalTactics} |`,
    `| Coverage Score | **${coverage.coverageScore}%** |`,
    `| Technique Mappings | ${coverage.mappings.length} |`,
    ``,
    `## Tactic Coverage`,
    ``,
    `| Tactic | ID | Covered | STRIDE Link | Mappings |`,
    `|--------|----|---------|-------------|----------|`,
    ...coverage.tactics.map((t) => `| ${t.name} | ${t.attack_id} | ${cov(t.covered)} | ${t.relatedStrideCategories.join(', ')} | ${t.mappingCount} |`
    ),
    ``,
    `## STRIDE Threats`,
    ``,
    `| Title | STRIDE | Severity | Status |`,
    `|-------|--------|----------|--------|`,
    ...coverage.threats.map((t) => `| ${t.title} | ${t.stride_category} | ${sev(t.severity)} ${t.severity} | ${t.status} |`
    ),
    ``,
    `## ATT&CK Mappings`,
    ``,
  ];

  if (coverage.mappings.length === 0) {
    lines.push('*No technique mappings defined for this model.*');
  } else {
    lines.push(
      `| Threat | Technique | ATT&CK ID | Confidence |`,
      `|--------|-----------|-----------|------------|`,
      ...coverage.mappings.map((m) => `| ${m.threat_title ?? '(model-level)'} | [${m.technique_name}](${m.technique_url ?? ''}) | ${m.technique_attack_id} | ${m.confidence} |`
      )
    );
  }

  lines.push(
    ``,
    `## Coverage Gaps & Recommendations`,
    ``,
  );

  if (coverage.recommendations.length === 0) {
    lines.push('*All identified STRIDE threats have corresponding ATT&CK tactic coverage.*');
  } else {
    lines.push(
      `The following STRIDE threats lack ATT&CK tactic coverage:`,
      ``,
      `| Threat | STRIDE Category | Missing Tactic |`,
      `|--------|-----------------|----------------|`,
      ...coverage.recommendations.map((r) => `| ${r.threat_title} | ${r.stride_category} | ${r.tactic_name} (${r.tactic_id}) |`
      )
    );
  }

  lines.push(``, `---`, `*Generated by Carbon Threat — MITRE ATT&CK Integration*`);

  return lines.join('\n');
}

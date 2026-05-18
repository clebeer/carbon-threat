/* eslint-disable max-lines, max-lines-per-function, complexity, no-await-in-loop, require-unicode-regexp, no-mixed-operators, no-continue, prefer-named-capture-group, no-useless-escape, max-depth, no-empty-function, sort-imports, no-bitwise, no-promise-executor-return, require-await, no-console, no-inner-declarations, no-invalid-this */
// td.server/src/repositories/jules.repository.js
import db from '../db/knex.js';

export async function createSession({ julesSessionId, findingId, findingType, sourceName, prompt, automationMode, createdBy }) {
  const [row] = await db('jules_sessions').insert({
    jules_session_id: julesSessionId ?? null,
    finding_id:       findingId,
    finding_type:     findingType,
    source_name:      sourceName,
    prompt,
    automation_mode:  automationMode,
    status:           'pending',
    created_by:       createdBy ?? null,
  }).
returning('*');
  return row;
}

export async function updateSession(id, fields) {
  const [row] = await db('jules_sessions').
    where({ id }).
    update({ ...fields, updated_at: db.fn.now() }).
    returning('*');
  return row;
}

export async function listSessions({
  page = 1,
  limit = 20,
  createdBy,
  viewerIsAdmin = false,
} = {}) {
  if (!viewerIsAdmin && (createdBy === undefined || createdBy === null)) {
    return { sessions: [], total: 0, page, limit };
  }
  const offset = (page - 1) * limit;
  let q = db('jules_sessions');
  if (!viewerIsAdmin) {
    q = q.where({ created_by: createdBy });
  }
  const rows = await q.clone().orderBy('created_at', 'desc').
    limit(limit).
    offset(offset).
    select('*');

  let countQ = db('jules_sessions');
  if (!viewerIsAdmin) {
    countQ = countQ.where({ created_by: createdBy });
  }
  const [{ count }] = await countQ.count('id as count');
  return { sessions: rows, total: Number(count), page, limit };
}

export async function getSessionById(id) {
  return db('jules_sessions').where({ id }).
first();
}

export async function deleteSession(id) {
  return db('jules_sessions').where({ id }).
delete();
}

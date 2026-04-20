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
  }).returning('*');
  return row;
}

export async function updateSession(id, fields) {
  const [row] = await db('jules_sessions')
    .where({ id })
    .update({ ...fields, updated_at: db.fn.now() })
    .returning('*');
  return row;
}

export async function listSessions({ page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const rows = await db('jules_sessions')
    .orderBy('created_at', 'desc')
    .limit(limit)
    .offset(offset)
    .select('*');
  const [{ count }] = await db('jules_sessions').count('id as count');
  return { sessions: rows, total: Number(count), page, limit };
}

export async function getSessionById(id) {
  return db('jules_sessions').where({ id }).first();
}

export async function deleteSession(id) {
  return db('jules_sessions').where({ id }).delete();
}

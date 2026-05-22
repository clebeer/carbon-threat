/**
 * AI Analyses Repository — persistence for STRIDE GPT analysis results.
 */
import db from '../db/knex.js';

/**
 * Create a new ai_analyses record.
 */
export async function create({ modelId, orgId, appType, inputs, provider, model, improvementSuggestions, rawOutput, createdBy }) {
    const [row] = await db('ai_analyses').insert({
        model_id: modelId,
        org_id: orgId,
        app_type: appType,
        inputs: JSON.stringify(inputs),
        provider,
        model,
        improvement_suggestions: JSON.stringify(improvementSuggestions || []),
        raw_output: JSON.stringify(rawOutput || {}),
        created_by: createdBy,
    }).
returning('*');
    return row;
}

/**
 * Get an analysis by ID.
 */
export async function getById(id) {
    const [row] = await db('ai_analyses').where({ id }).
first();
    return row || null;
}

/**
 * List analyses for a given model.
 */
export async function listByModelId(modelId, { page = 1, limit = 20 } = {}) {
    const offset = (page - 1) * limit;
    const [countRow] = await db('ai_analyses').where({ model_id: modelId }).
count('id as count');
    const rows = await db('ai_analyses').
        where({ model_id: modelId }).
        orderBy('created_at', 'desc').
        limit(limit).
        offset(offset);
    return { data: rows, total: Number(countRow.count), page, limit };
}

/**
 * Delete analyses older than a given date.
 */
export async function deleteOlderThan(date) {
    return db('ai_analyses').where('created_at', '<', date).
del();
}
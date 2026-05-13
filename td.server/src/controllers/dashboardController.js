/**
 * Dashboard Layout controller.
 *
 * GET    /api/dashboard/layout  — retrieve the user's dashboard layout
 * PUT    /api/dashboard/layout  — save the user's dashboard layout
 * POST   /api/dashboard/layout/reset — reset to default layout
 */

import loggerHelper from '../helpers/logger.helper.js';

const logger = loggerHelper.get('controllers/dashboardController.js');

/**
 * GET /api/dashboard/layout
 */
export async function getLayout(req, res) {
  try {
    const knex = req.app.get('db');
    const userId = req.user?.id ?? req.user?.sub;

    const row = await knex('dashboard_layouts').where('user_id', userId).
first();

    if (!row) {
      return res.json({ layout: [] });
    }

    return res.json({ layout: row.layout_config });
  } catch (err) {
    logger.error('getLayout failed', err);
    return res.status(500).json({ error: 'Failed to load dashboard layout' });
  }
}

/**
 * PUT /api/dashboard/layout
 *
 * Body: { layout: LayoutItem[] }
 */
export async function saveLayout(req, res) {
  try {
    const knex = req.app.get('db');
    const userId = req.user?.id ?? req.user?.sub;
    const { layout } = req.body;

    if (!Array.isArray(layout)) {
      return res.status(400).json({ error: '"layout" must be an array' });
    }

    await knex('dashboard_layouts').
      insert({
        user_id: userId,
        layout_config: JSON.stringify(layout),
        updated_at: knex.fn.now(),
      }).
      onConflict('user_id').
      merge(['layout_config', 'updated_at']);

    return res.json({ success: true });
  } catch (err) {
    logger.error('saveLayout failed', err);
    return res.status(500).json({ error: 'Failed to save dashboard layout' });
  }
}

/**
 * POST /api/dashboard/layout/reset
 *
 * Resets the user's layout to empty (frontend will use defaults).
 */
export async function resetLayout(req, res) {
  try {
    const knex = req.app.get('db');
    const userId = req.user?.id ?? req.user?.sub;

    await knex('dashboard_layouts').where('user_id', userId).
delete();

    return res.json({ success: true, layout: [] });
  } catch (err) {
    logger.error('resetLayout failed', err);
    return res.status(500).json({ error: 'Failed to reset dashboard layout' });
  }
}
import db from '../db/knex.js';
import { encryptModel } from '../security/encryption.js';
import loggerHelper from '../helpers/logger.helper.js';

const logger = loggerHelper.get('controllers/domainPacksController.js');

export async function listPacks(req, res) {
  try {
    const packs = await db('domain_packs').
      select('id', 'slug', 'name', 'description', 'is_builtin', 'created_at', 'updated_at').
      orderBy('name', 'asc');
    return res.json({ packs });
  } catch (err) {
    logger.error('listPacks failed', err);
    return res.status(500).json({ error: 'Failed to list domain packs' });
  }
}

export async function getPack(req, res) {
  const { slug } = req.params;
  try {
    const pack = await db('domain_packs').where({ slug }).
first();
    if (!pack) {return res.status(404).json({ error: 'Domain pack not found' });}
    return res.json({ pack });
  } catch (err) {
    logger.error('getPack failed', err);
    return res.status(500).json({ error: 'Failed to retrieve domain pack' });
  }
}

export async function listTemplates(req, res) {
  const { slug } = req.params;
  try {
    const pack = await db('domain_packs').where({ slug }).
first();
    if (!pack) {return res.status(404).json({ error: 'Domain pack not found' });}

    const templates = await db('domain_templates').
      where({ pack_id: pack.id }).
      select('id', 'pack_id', 'name', 'description', 'diagram_json', 'created_at', 'updated_at').
      orderBy('name', 'asc');

    return res.json({ templates });
  } catch (err) {
    logger.error('listTemplates failed', err);
    return res.status(500).json({ error: 'Failed to list templates' });
  }
}

export async function applyTemplate(req, res) {
  const { slug, templateId } = req.params;
  const { title } = req.body || {};

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  const userId = req.user?.id;
  const orgId = req.user?.orgId ?? req.provider?.orgId ?? null;

  try {
    const pack = await db('domain_packs').where({ slug }).
first();
    if (!pack) {return res.status(404).json({ error: 'Domain pack not found' });}

    const template = await db('domain_templates').
      where({ id: templateId, pack_id: pack.id }).
      first();
    if (!template) {return res.status(404).json({ error: 'Template not found' });}

    const content = template.diagram_json || {};
    const encrypted = encryptModel(content);

    const [model] = await db('threat_models').
      insert({
        title:             title.trim(),
        description:       `Created from template: ${template.name}`,
        content_encrypted: JSON.stringify(encrypted),
        owner_id:          userId,
        org_id:            orgId || null,
        version:           1,
      }).
      returning(['id', 'title', 'description', 'version', 'is_archived', 'created_at', 'updated_at', 'owner_id', 'org_id']);

    logger.info(`Model created from template ${templateId} by user ${userId}`);
    return res.status(201).json({ model });
  } catch (err) {
    logger.error('applyTemplate failed', err);
    return res.status(500).json({ error: 'Failed to apply template' });
  }
}

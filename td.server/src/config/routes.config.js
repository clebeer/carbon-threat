import express from 'express';
import rateLimit from 'express-rate-limit';

import auth from '../controllers/auth.js';
import * as authEnterprise from '../controllers/auth.enterprise.js';
import * as authSso from '../controllers/auth.sso.js';
import bearer from './bearer.config.js';
import configController from "../controllers/configcontroller";
import * as setupController from '../controllers/config.js';
import googleProviderThreatmodelController from '../controllers/googleProviderThreatmodelController.js';
import healthcheck from '../controllers/healthz.js';
import homeController from '../controllers/homecontroller.js';
import templateController from '../controllers/templateController.js';
import threatmodelController from '../controllers/threatmodelcontroller.js';
import * as usersController from '../controllers/users.js';
import * as aiController from '../controllers/aiController.js';
import * as integrationsController from '../controllers/integrationsController.js';
import * as threatmodelsPg from '../controllers/threatmodels.pg.js';
import * as smtpController from '../controllers/smtp.js';
import * as auditController from '../controllers/auditController.js';
import * as assetsController from '../controllers/assets.js';
import * as threatsController from '../controllers/threats.pg.js';
import * as domainPacksController from '../controllers/domainPacksController.js';
import * as cloudStorageController from '../controllers/cloudStorageController.js';
import * as vulnSyncController from '../controllers/vulnSync.js';
import { requireRole } from '../auth/rbac.js';
import { auditMiddleware } from '../security/audit.js';


// Strict rate limiter for credential endpoints:
// 20 attempts per 15 minutes per IP — brute-force protection
const authLimiter = rateLimit({
    windowMs:       15 * 60 * 1000,
    max:            20,
    standardHeaders: true,
    legacyHeaders:  false,
    message:        { error: 'Too many login attempts. Try again in 15 minutes.' },
    skipSuccessfulRequests: true,  // only count failures
});

// Token refresh: 60 per 15 min per IP
const refreshLimiter = rateLimit({
    windowMs:       15 * 60 * 1000,
    max:            60,
    standardHeaders: true,
    legacyHeaders:  false,
    message:        { error: 'Too many token refresh attempts.' },
});

/**
 * Routes that do **NOT** require authentication
 * Use with caution!!!!
 * @param {express.Router} router
 * @returns {express.Router}
 */
const unauthRoutes = (router) => {
    router.get('/', homeController.index);

    router.get('/healthz', healthcheck.healthz);
    router.get('/api/healthz', healthcheck.healthz);
    router.get('/api/config', configController.config);
    router.get('/api/config/setup-status', setupController.config);
    router.post('/api/config/setup', setupController.submitEnterpriseSetup);
    router.get('/api/threatmodel/organisation', threatmodelController.organisation);

    // Cloud storage OAuth callback (must be unauth — triggered from OAuth provider redirect)
    router.get('/api/cloud-storage/callback', cloudStorageController.oauthCallback);

    // OAuth providers
    router.get('/api/login/:provider', auth.login);
    router.get('/api/logout', auth.logout);
    router.get('/api/oauth/return', auth.oauthReturn);
    router.get('/api/oauth/:provider', auth.completeLogin);

    // Local (username/password) auth — unauthenticated by definition
    router.post('/api/auth/local/login', authLimiter, authEnterprise.localLogin);

    // Bootstrap first admin account — only works when zero users exist
    router.post('/api/auth/local/bootstrap', authLimiter, authEnterprise.bootstrapAdmin);

    // SSO / SAML — redirects to IdP (no auth token required)
    router.get('/api/auth/sso/saml', authSso.samlLogin);
    router.post('/api/auth/sso/saml/callback', authSso.samlCallback);
    // Fixes 401 on favicon.ico request by browser
    router.get('/favicon.ico', (req, res) => res.sendStatus(204));

    // Token management (needs to be unauth to allow refreshing with expired access tokens)
    router.post('/api/logout', auth.logout);
    router.post('/api/token/refresh', refreshLimiter, auth.refresh);

    // SSO auth-code exchange — single-use, 60s TTL code issued by samlCallback
    router.post('/api/auth/exchange', authLimiter, authSso.exchangeCode);
};

/**
 * Routes that require authentication.
 * This should be where you add new routes by default
 * @param {express.Router} router
 * @returns {express.Router}
 */
const routes = (router) => {
    // Template routes
    router.post('/api/templates/bootstrap', requireRole('admin'), auditMiddleware('TEMPLATE_BOOTSTRAP'), templateController.bootstrapTemplateRepository);
    router.get('/api/templates/', templateController.listTemplates);
    router.post('/api/templates/import', requireRole('admin', 'analyst'), auditMiddleware('TEMPLATE_IMPORT'), templateController.importTemplate);
    router.delete('/api/templates/:id', requireRole('admin'), auditMiddleware('TEMPLATE_DELETE'), templateController.deleteTemplate);
    router.put('/api/templates/:id', requireRole('admin', 'analyst'), auditMiddleware('TEMPLATE_UPDATE'), templateController.updateTemplate);
    router.get('/api/templates/:id/content', templateController.getTemplateContent);

    // Threat model routes (file-based — GitHub / GitLab / Bitbucket / Google Drive)
    router.get('/api/threatmodel/repos', threatmodelController.repos);
    router.get('/api/threatmodel/:organisation/:repo/branches', threatmodelController.branches);
    router.get('/api/threatmodel/:organisation/:repo/:branch/models', threatmodelController.models);
    router.get('/api/threatmodel/:organisation/:repo/:branch/:model/data', threatmodelController.model);

    router.post('/api/threatmodel/:organisation/:repo/:branch/createBranch', requireRole('admin', 'analyst'), auditMiddleware('BRANCH_CREATE'), threatmodelController.createBranch);

    // removed because of security denial of service concerns (denial of models)
    //router.delete('/api/threatmodel/:organisation/:repo/:branch/:model', threatmodelController.deleteModel);

    router.post('/api/threatmodel/:organisation/:repo/:branch/:model/create', requireRole('admin', 'analyst'), auditMiddleware('MODEL_CREATE'), threatmodelController.create);
    router.put('/api/threatmodel/:organisation/:repo/:branch/:model/update', requireRole('admin', 'analyst'), auditMiddleware('MODEL_UPDATE'), threatmodelController.update);

    // Google Drive routes
    router.get('/api/googleproviderthreatmodel/folders', googleProviderThreatmodelController.folders);
    router.post('/api/googleproviderthreatmodel/:folder/create', requireRole('admin', 'analyst'), auditMiddleware('GDRIVE_MODEL_CREATE'), googleProviderThreatmodelController.create);
    router.put('/api/googleproviderthreatmodel/:file/update', requireRole('admin', 'analyst'), auditMiddleware('GDRIVE_MODEL_UPDATE'), googleProviderThreatmodelController.update);
    router.get('/api/googleproviderthreatmodel/:file/data', googleProviderThreatmodelController.model);

    // User management — admin only
    router.get('/api/users', requireRole('admin'), usersController.listUsers);
    router.get('/api/users/:id', requireRole('admin', 'analyst', 'viewer'), usersController.getUser);
    router.post('/api/users', requireRole('admin'), auditMiddleware('USER_CREATE'), usersController.createUser);
    router.put('/api/users/:id', requireRole('admin', 'analyst', 'viewer'), auditMiddleware('USER_UPDATE'), usersController.updateUser);
    router.delete('/api/users/:id', requireRole('admin'), auditMiddleware('USER_DEACTIVATE'), usersController.deleteUser);

    // DB connection test (admin only — prevents unauthenticated SSRF)
    router.post('/api/config/test-db', requireRole('admin'), setupController.testDbConnection);

    // SMTP configuration (admin only)
    router.get('/api/config/smtp',        requireRole('admin'), smtpController.getSmtpConfig);
    router.put('/api/config/smtp',        requireRole('admin'), auditMiddleware('SMTP_CONFIG_UPDATE'), smtpController.saveSmtpConfig);
    router.post('/api/config/smtp/test',  requireRole('admin'), smtpController.testSmtpConfig);

    // Audit log (admin only)
    router.get('/api/audit', requireRole('admin'), auditController.listAuditLogs);

    // Vulnerability feed sync (admin only)
    router.get('/api/admin/vuln-feeds/status', requireRole('admin'), vulnSyncController.getVulnFeedStatus);
    router.post('/api/admin/vuln-feeds/sync',  requireRole('admin'), auditMiddleware('VULN_FEED_SYNC'), vulnSyncController.syncVulnFeeds);

    // PostgreSQL-backed threat models (enterprise storage)
    router.get('/api/threatmodels', threatmodelsPg.listThreatModels);
    router.post('/api/threatmodels/import', requireRole('admin', 'analyst'), auditMiddleware('MODEL_IMPORT'), threatmodelsPg.importThreatModel);
    router.post('/api/threatmodels', requireRole('admin', 'analyst'), auditMiddleware('MODEL_CREATE'), threatmodelsPg.createThreatModel);
    router.get('/api/threatmodels/:id', threatmodelsPg.getThreatModel);
    router.put('/api/threatmodels/:id', requireRole('admin', 'analyst'), auditMiddleware('MODEL_UPDATE'), threatmodelsPg.updateThreatModel);
    router.put('/api/threatmodels/:id/restore', requireRole('admin', 'analyst'), auditMiddleware('MODEL_RESTORE'), threatmodelsPg.restoreThreatModel);
    router.delete('/api/threatmodels/:id', requireRole('admin', 'analyst'), auditMiddleware('MODEL_ARCHIVE'), threatmodelsPg.archiveThreatModel);

    // Asset registry — derived from threat model nodes
    router.get('/api/assets', assetsController.listAssets);

    // ── F1: Threats (rule-based STRIDE engine) ────────────────────────────────
    router.get('/api/threats',       threatsController.listThreats);
    router.post('/api/threats',      requireRole('admin', 'analyst'), auditMiddleware('THREAT_CREATE'), threatsController.createThreat);
    router.put('/api/threats/:id',   requireRole('admin', 'analyst'), threatsController.updateThreat);
    router.delete('/api/threats/:id',requireRole('admin', 'analyst'), auditMiddleware('THREAT_DELETE'), threatsController.deleteThreat);
    router.post('/api/threatmodels/:id/analyze', requireRole('admin', 'analyst'), auditMiddleware('MODEL_ANALYZE'), threatsController.analyzeModel);
    router.get('/api/threatmodels/:id/sarif',   threatsController.exportSarif);

    // ── F3: Domain packs & templates ──────────────────────────────────────────
    router.get('/api/domain-packs',                                         domainPacksController.listPacks);
    router.get('/api/domain-packs/:slug',                                   domainPacksController.getPack);
    router.get('/api/domain-packs/:slug/templates',                         domainPacksController.listTemplates);
    router.post('/api/domain-packs/:slug/templates/:templateId/apply',      requireRole('admin', 'analyst'), auditMiddleware('TEMPLATE_APPLY'), domainPacksController.applyTemplate);

    // ── F4: Cloud storage (Google Drive / OneDrive) ───────────────────────────
    router.get('/api/cloud-storage/:provider/status',     cloudStorageController.getStatus);
    router.get('/api/cloud-storage/:provider/auth',       cloudStorageController.getAuthUrl);
    router.get('/api/cloud-storage/:provider/files',      cloudStorageController.listFiles);
    router.post('/api/cloud-storage/:provider/import',    requireRole('admin', 'analyst'), auditMiddleware('CLOUD_IMPORT'), cloudStorageController.importFile);
    router.post('/api/cloud-storage/:provider/export',    requireRole('admin', 'analyst'), auditMiddleware('CLOUD_EXPORT'), cloudStorageController.exportModel);
    router.delete('/api/cloud-storage/:provider/disconnect', cloudStorageController.disconnect);

    // AI Threat Bot — analyst+ required to prevent abuse
    router.post('/api/ai/suggest', requireRole('admin', 'analyst'), auditMiddleware('AI_SUGGEST'), aiController.suggest);

    // Integration configs — admin manages credentials; analyst/viewer can list/export
    router.get('/api/integrations', requireRole('admin', 'analyst', 'viewer'), integrationsController.listConfigs);
    router.get('/api/integrations/:platform', requireRole('admin', 'analyst', 'viewer'), integrationsController.getConfig);
    router.put('/api/integrations/:platform', requireRole('admin'), auditMiddleware('INTEGRATION_UPSERT'), integrationsController.upsertConfig);
    router.delete('/api/integrations/:platform', requireRole('admin'), auditMiddleware('INTEGRATION_DELETE'), integrationsController.deleteConfig);
    router.post('/api/integrations/:platform/export', requireRole('admin', 'analyst'), auditMiddleware('INTEGRATION_EXPORT'), integrationsController.exportIssue);
};

const config = (app) => {
    const router = express.Router();
    unauthRoutes(router);

    // routes protected by authorization
    router.use(bearer.middleware);
    routes(router);

    app.use('/', router);
};

export default {
    config
};

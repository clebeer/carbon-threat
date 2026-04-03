/**
 * OpenAPI 3.0 specification for CarbonThreat Enterprise API.
 *
 * Served at GET /api-docs (Swagger UI) and GET /api-docs.json (raw spec).
 * Authentication: Bearer JWT (access token from POST /api/auth/local/login).
 */

import swaggerJsdoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'CarbonThreat API',
      version: '1.0.0',
      description: `
Enterprise threat modeling platform API.

**Authentication:** All protected endpoints require a Bearer JWT.
Obtain a token via \`POST /api/auth/local/login\` and pass it as:
\`Authorization: Bearer <accessToken>\`

**Token refresh:** Use \`POST /api/token/refresh\` with your refresh token before the access token expires (default: 15 min).
      `.trim(),
      contact: { name: 'CarbonThreat', url: 'https://github.com/OWASP/threat-dragon' },
      license: { name: 'Apache 2.0', url: 'https://www.apache.org/licenses/LICENSE-2.0' },
    },
    servers: [
      { url: '/api', description: 'Current server' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Descriptive error message' },
          },
        },
        ThreatModelSummary: {
          type: 'object',
          properties: {
            id:          { type: 'string', format: 'uuid' },
            title:       { type: 'string' },
            description: { type: 'string', nullable: true },
            version:     { type: 'integer' },
            is_archived: { type: 'boolean' },
            owner_id:    { type: 'string', format: 'uuid' },
            org_id:      { type: 'string', format: 'uuid', nullable: true },
            created_at:  { type: 'string', format: 'date-time' },
            updated_at:  { type: 'string', format: 'date-time' },
          },
        },
        Threat: {
          type: 'object',
          properties: {
            id:              { type: 'string', format: 'uuid' },
            model_id:        { type: 'string', format: 'uuid' },
            title:           { type: 'string' },
            description:     { type: 'string', nullable: true },
            stride_category: { type: 'string', enum: ['Spoofing','Tampering','Repudiation','Information Disclosure','DoS','Elevation of Privilege'] },
            severity:        { type: 'string', enum: ['Critical','High','Medium','Low'] },
            status:          { type: 'string', enum: ['Open','Investigating','Mitigated','Not Applicable'] },
            source:          { type: 'string', enum: ['manual','rule','ai'] },
            mitigation:      { type: 'string', nullable: true },
            owasp_refs:      { type: 'array', items: { type: 'object' } },
            node_ids:        { type: 'array', items: { type: 'string' } },
            edge_ids:        { type: 'array', items: { type: 'string' } },
            created_at:      { type: 'string', format: 'date-time' },
            updated_at:      { type: 'string', format: 'date-time' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id:           { type: 'string', format: 'uuid' },
            email:        { type: 'string', format: 'email' },
            display_name: { type: 'string' },
            role:         { type: 'string', enum: ['admin','analyst','viewer'] },
            is_active:    { type: 'boolean' },
            created_at:   { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    tags: [
      { name: 'Auth',         description: 'Authentication and token management' },
      { name: 'Threat Models',description: 'CRUD for threat models (PostgreSQL-backed)' },
      { name: 'Threats',      description: 'STRIDE threat tracking and OWASP references' },
      { name: 'Users',        description: 'User management (admin only)' },
      { name: 'Domain Packs', description: 'Threat model templates by technology domain' },
      { name: 'Cloud Storage',description: 'Google Drive / OneDrive import & export' },
      { name: 'Integrations', description: 'Jira, GitHub Issues, ServiceNow, AI threat bot' },
      { name: 'Assets',       description: 'Asset registry derived from threat model nodes' },
      { name: 'Audit',        description: 'Immutable audit trail (admin only)' },
      { name: 'Config',       description: 'Server configuration and health' },
    ],
    paths: {
      // ── Auth ──────────────────────────────────────────────────────────────
      '/auth/local/login': {
        post: {
          tags: ['Auth'], operationId: 'localLogin', security: [],
          summary: 'Login with email and password',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', required: ['email','password'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } } } } },
          },
          responses: {
            200: { description: 'Login successful', content: { 'application/json': { schema: { type: 'object', properties: { accessToken: { type: 'string' }, refreshToken: { type: 'string' }, user: { $ref: '#/components/schemas/User' } } } } } },
            401: { description: 'Invalid credentials', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            429: { description: 'Rate limit exceeded', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/auth/local/bootstrap': {
        post: {
          tags: ['Auth'], operationId: 'bootstrapAdmin', security: [],
          summary: 'Create the first admin account (one-time, fails when users exist)',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', required: ['email','password','displayName'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 12 }, displayName: { type: 'string' } } } } },
          },
          responses: {
            201: { description: 'Admin created' },
            409: { description: 'Users already exist' },
          },
        },
      },
      '/token/refresh': {
        post: {
          tags: ['Auth'], operationId: 'refreshToken', security: [],
          summary: 'Exchange a refresh token for a new access token',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', required: ['refreshToken'], properties: { refreshToken: { type: 'string' } } } } },
          },
          responses: {
            200: { description: 'New access token issued', content: { 'application/json': { schema: { type: 'object', properties: { accessToken: { type: 'string' } } } } } },
            401: { description: 'Invalid or expired refresh token' },
          },
        },
      },

      // ── Health / Config ──────────────────────────────────────────────────
      '/healthz': {
        get: {
          tags: ['Config'], operationId: 'healthz', security: [],
          summary: 'Health check',
          responses: {
            200: { description: 'Server is healthy', content: { 'application/json': { schema: { type: 'object', properties: { uptime: { type: 'number' }, message: { type: 'string' } } } } } },
          },
        },
      },
      '/config': {
        get: {
          tags: ['Config'], operationId: 'getConfig', security: [],
          summary: 'Get public server configuration (auth providers enabled)',
          responses: {
            200: { description: 'Configuration', content: { 'application/json': { schema: { type: 'object' } } } },
          },
        },
      },

      // ── Threat Models ────────────────────────────────────────────────────
      '/threatmodels': {
        get: {
          tags: ['Threat Models'], operationId: 'listThreatModels',
          summary: 'List threat models (scoped to user org)',
          responses: {
            200: { description: 'List of models', content: { 'application/json': { schema: { type: 'object', properties: { models: { type: 'array', items: { $ref: '#/components/schemas/ThreatModelSummary' } } } } } } },
          },
        },
        post: {
          tags: ['Threat Models'], operationId: 'createThreatModel',
          summary: 'Create a new threat model',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', required: ['title'], properties: { title: { type: 'string' }, description: { type: 'string' }, content: { type: 'object' } } } } },
          },
          responses: {
            201: { description: 'Model created', content: { 'application/json': { schema: { type: 'object', properties: { model: { $ref: '#/components/schemas/ThreatModelSummary' } } } } } },
            400: { description: 'Validation error' },
          },
        },
      },
      '/threatmodels/import': {
        post: {
          tags: ['Threat Models'], operationId: 'importThreatModel',
          summary: 'Import a Threat Dragon v1/v2 JSON model',
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { type: 'object', required: ['json'], properties: { json: { type: 'object', description: 'Threat Dragon JSON object (v1 or v2 format)' } } } } },
          },
          responses: {
            201: { description: 'Model imported', content: { 'application/json': { schema: { type: 'object', properties: { model: { $ref: '#/components/schemas/ThreatModelSummary' }, imported: { type: 'object', properties: { nodes: { type: 'integer' }, edges: { type: 'integer' } } } } } } } },
            400: { description: 'Invalid JSON or missing title' },
          },
        },
      },
      '/threatmodels/{id}': {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        get: {
          tags: ['Threat Models'], operationId: 'getThreatModel',
          summary: 'Get a threat model with decrypted content',
          responses: {
            200: { description: 'Model with content' },
            404: { description: 'Not found' },
          },
        },
        put: {
          tags: ['Threat Models'], operationId: 'updateThreatModel',
          summary: 'Update a threat model (title, description, or canvas content)',
          requestBody: {
            content: { 'application/json': { schema: { type: 'object', properties: { title: { type: 'string' }, description: { type: 'string' }, content: { type: 'object' } } } } },
          },
          responses: { 200: { description: 'Updated model' }, 404: { description: 'Not found' } },
        },
        delete: {
          tags: ['Threat Models'], operationId: 'archiveThreatModel',
          summary: 'Soft-delete (archive) a threat model',
          responses: { 200: { description: 'Archived' }, 404: { description: 'Not found' } },
        },
      },
      '/threatmodels/{id}/analyze': {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        post: {
          tags: ['Threats'], operationId: 'analyzeModel',
          summary: 'Run STRIDE rule engine on a model to generate threat suggestions',
          responses: {
            200: { description: 'Generated threats', content: { 'application/json': { schema: { type: 'object', properties: { threats: { type: 'array', items: { $ref: '#/components/schemas/Threat' } }, count: { type: 'integer' } } } } } },
          },
        },
      },

      // ── Threats ─────────────────────────────────────────────────────────
      '/threats': {
        get: {
          tags: ['Threats'], operationId: 'listThreats',
          summary: 'List threats (optionally filtered by modelId, status, strideCategory)',
          parameters: [
            { name: 'modelId', in: 'query', schema: { type: 'string', format: 'uuid' } },
            { name: 'status', in: 'query', schema: { type: 'string', enum: ['Open','Investigating','Mitigated','Not Applicable'] } },
            { name: 'strideCategory', in: 'query', schema: { type: 'string' } },
          ],
          responses: { 200: { description: 'List of threats', content: { 'application/json': { schema: { type: 'object', properties: { threats: { type: 'array', items: { $ref: '#/components/schemas/Threat' } } } } } } } },
        },
        post: {
          tags: ['Threats'], operationId: 'createThreat',
          summary: 'Create a manual threat entry',
          requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Threat' } } } },
          responses: { 201: { description: 'Threat created' }, 400: { description: 'Validation error' } },
        },
      },
      '/threats/{id}': {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        put: {
          tags: ['Threats'], operationId: 'updateThreat',
          summary: 'Update a threat (status, severity, mitigation, etc.)',
          requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Threat' } } } },
          responses: { 200: { description: 'Updated' }, 404: { description: 'Not found' } },
        },
        delete: {
          tags: ['Threats'], operationId: 'deleteThreat',
          summary: 'Delete a threat',
          responses: { 200: { description: 'Deleted' }, 404: { description: 'Not found' } },
        },
      },

      // ── Users ────────────────────────────────────────────────────────────
      '/users': {
        get: {
          tags: ['Users'], operationId: 'listUsers',
          summary: 'List all users (admin only)',
          responses: { 200: { description: 'List of users', content: { 'application/json': { schema: { type: 'object', properties: { users: { type: 'array', items: { $ref: '#/components/schemas/User' } } } } } } } },
        },
        post: {
          tags: ['Users'], operationId: 'createUser',
          summary: 'Create a new user (admin only)',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['email','password','role'], properties: { email: { type: 'string', format: 'email' }, password: { type: 'string', minLength: 12 }, displayName: { type: 'string' }, role: { type: 'string', enum: ['admin','analyst','viewer'] } } } } } },
          responses: { 201: { description: 'User created' }, 400: { description: 'Validation error' }, 409: { description: 'Email already exists' } },
        },
      },
      '/users/{id}': {
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        get: { tags: ['Users'], operationId: 'getUser', summary: 'Get a user by ID', responses: { 200: { description: 'User' }, 404: { description: 'Not found' } } },
        put: { tags: ['Users'], operationId: 'updateUser', summary: 'Update a user (role, display name, password)', requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/User' } } } }, responses: { 200: { description: 'Updated' } } },
        delete: { tags: ['Users'], operationId: 'deactivateUser', summary: 'Deactivate a user (admin only)', responses: { 200: { description: 'Deactivated' } } },
      },

      // ── Domain Packs ─────────────────────────────────────────────────────
      '/domain-packs': {
        get: { tags: ['Domain Packs'], operationId: 'listPacks', summary: 'List available domain packs', responses: { 200: { description: 'Packs' } } },
      },
      '/domain-packs/{slug}/templates': {
        parameters: [{ name: 'slug', in: 'path', required: true, schema: { type: 'string' } }],
        get: { tags: ['Domain Packs'], operationId: 'listTemplates', summary: 'List templates for a domain pack', responses: { 200: { description: 'Templates' } } },
      },
      '/domain-packs/{slug}/templates/{templateId}/apply': {
        parameters: [
          { name: 'slug', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'templateId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } },
        ],
        post: {
          tags: ['Domain Packs'], operationId: 'applyTemplate',
          summary: 'Create a new threat model from a template',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['title'], properties: { title: { type: 'string' } } } } } },
          responses: { 201: { description: 'Model created from template' } },
        },
      },

      // ── Assets ───────────────────────────────────────────────────────────
      '/assets': {
        get: {
          tags: ['Assets'], operationId: 'listAssets',
          summary: 'List assets extracted from threat model nodes',
          responses: { 200: { description: 'Asset registry' } },
        },
      },

      // ── Audit ────────────────────────────────────────────────────────────
      '/audit': {
        get: {
          tags: ['Audit'], operationId: 'listAuditLogs',
          summary: 'List audit log entries (admin only)',
          parameters: [
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 50 } },
            { name: 'offset', in: 'query', schema: { type: 'integer', default: 0 } },
          ],
          responses: { 200: { description: 'Audit log entries' } },
        },
      },

      // ── Integrations ─────────────────────────────────────────────────────
      '/integrations': {
        get: { tags: ['Integrations'], operationId: 'listIntegrations', summary: 'List configured integrations', responses: { 200: { description: 'Integrations' } } },
      },
      '/integrations/{platform}': {
        parameters: [{ name: 'platform', in: 'path', required: true, schema: { type: 'string', enum: ['github','jira','servicenow','openai','ollama'] } }],
        get:    { tags: ['Integrations'], operationId: 'getIntegration',    summary: 'Get integration config for a platform', responses: { 200: { description: 'Config' } } },
        put:    { tags: ['Integrations'], operationId: 'upsertIntegration', summary: 'Save/update integration config (admin only)', requestBody: { content: { 'application/json': { schema: { type: 'object' } } } }, responses: { 200: { description: 'Saved' } } },
        delete: { tags: ['Integrations'], operationId: 'deleteIntegration', summary: 'Remove integration config (admin only)', responses: { 200: { description: 'Removed' } } },
      },
      '/integrations/{platform}/export': {
        parameters: [{ name: 'platform', in: 'path', required: true, schema: { type: 'string' } }],
        post: {
          tags: ['Integrations'], operationId: 'exportIssue',
          summary: 'Export a threat as an issue to the configured tracker',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['title','description'], properties: { title: { type: 'string' }, description: { type: 'string' } } } } } },
          responses: { 200: { description: 'Issue created' } },
        },
      },
      '/ai/suggest': {
        post: {
          tags: ['Integrations'], operationId: 'aiSuggest',
          summary: 'Request AI threat suggestions for a diagram node',
          requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
          responses: { 200: { description: 'AI suggestions' } },
        },
      },

      // ── Cloud Storage ────────────────────────────────────────────────────
      '/cloud-storage/{provider}/status': {
        parameters: [{ name: 'provider', in: 'path', required: true, schema: { type: 'string', enum: ['google','microsoft'] } }],
        get: { tags: ['Cloud Storage'], operationId: 'cloudStorageStatus', summary: 'Check cloud storage connection status', responses: { 200: { description: 'Status' } } },
      },
      '/cloud-storage/{provider}/auth': {
        parameters: [{ name: 'provider', in: 'path', required: true, schema: { type: 'string', enum: ['google','microsoft'] } }],
        get: { tags: ['Cloud Storage'], operationId: 'cloudStorageAuth', summary: 'Get OAuth authorization URL', responses: { 200: { description: 'Auth URL' } } },
      },
      '/cloud-storage/{provider}/files': {
        parameters: [{ name: 'provider', in: 'path', required: true, schema: { type: 'string', enum: ['google','microsoft'] } }],
        get: { tags: ['Cloud Storage'], operationId: 'listCloudFiles', summary: 'List threat model files in cloud storage', responses: { 200: { description: 'Files' } } },
      },
      '/cloud-storage/{provider}/import': {
        parameters: [{ name: 'provider', in: 'path', required: true, schema: { type: 'string', enum: ['google','microsoft'] } }],
        post: { tags: ['Cloud Storage'], operationId: 'importFromCloud', summary: 'Import a threat model from cloud storage', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['fileId','title'], properties: { fileId: { type: 'string' }, title: { type: 'string' } } } } } }, responses: { 201: { description: 'Imported' } } },
      },
      '/cloud-storage/{provider}/export': {
        parameters: [{ name: 'provider', in: 'path', required: true, schema: { type: 'string', enum: ['google','microsoft'] } }],
        post: { tags: ['Cloud Storage'], operationId: 'exportToCloud', summary: 'Export a threat model to cloud storage', requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['modelId'], properties: { modelId: { type: 'string', format: 'uuid' } } } } } }, responses: { 200: { description: 'Exported' } } },
      },
    },
  },
  apis: [], // paths defined inline above
};

export const openApiSpec = swaggerJsdoc(options);

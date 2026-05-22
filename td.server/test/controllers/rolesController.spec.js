/**
 * Unit tests — controllers/rolesController.js
 *
 * Stubs: roleService, permissions.catalog
 * Tests: status codes, validation, error mapping
 */

import { expect } from 'chai';
import sinon from 'sinon';

import * as roleService from '../../src/services/roleService.js';
import {
  listRolesHandler,
  getRoleHandler,
  createRoleHandler,
  updateRoleHandler,
  deleteRoleHandler,
  listPermissionCatalogHandler,
} from '../../src/controllers/rolesController.js';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeReqRes(body = {}, params = {}) {
  const req = { body, params };
  const res = {
    _status: 200,
    _json: null,
    status(code) { this._status = code; return this; },
    json(data)   { this._json  = data; return this; },
  };
  return { req, res };
}

const MOCK_ROLE = {
  id: 'role-1',
  slug: 'custom-role',
  name: 'Custom Role',
  description: '',
  is_system: false,
  is_active: true,
  permission_keys: ['scanner:read'],
  user_count: 0,
};

// ── tests ─────────────────────────────────────────────────────────────────────

describe('controllers/rolesController.js', () => {
  afterEach(() => sinon.restore());

  // ── listRolesHandler ─────────────────────────────────────────────────────────

  describe('listRolesHandler', () => {
    it('returns 200 with roles array', async () => {
      sinon.stub(roleService, 'listRoles').resolves([MOCK_ROLE]);
      const { req, res } = makeReqRes();

      await listRolesHandler(req, res);

      expect(res._status).to.equal(200);
      expect(res._json).to.deep.equal({ roles: [MOCK_ROLE] });
    });

    it('returns 500 on service error', async () => {
      sinon.stub(roleService, 'listRoles').rejects(new Error('DB fail'));
      const { req, res } = makeReqRes();

      await listRolesHandler(req, res);

      expect(res._status).to.equal(500);
    });
  });

  // ── getRoleHandler ───────────────────────────────────────────────────────────

  describe('getRoleHandler', () => {
    it('returns 200 with role', async () => {
      sinon.stub(roleService, 'getRole').resolves(MOCK_ROLE);
      const { req, res } = makeReqRes({}, { id: 'role-1' });

      await getRoleHandler(req, res);

      expect(res._status).to.equal(200);
      expect(res._json.role).to.deep.equal(MOCK_ROLE);
    });

    it('returns 404 for RoleNotFoundError', async () => {
      sinon.stub(roleService, 'getRole').rejects(new roleService.RoleNotFoundError('role-1'));
      const { req, res } = makeReqRes({}, { id: 'role-1' });

      await getRoleHandler(req, res);

      expect(res._status).to.equal(404);
    });
  });

  // ── createRoleHandler ────────────────────────────────────────────────────────

  describe('createRoleHandler', () => {
    it('returns 400 when name is missing', async () => {
      const { req, res } = makeReqRes({ description: 'no name' });

      await createRoleHandler(req, res);

      expect(res._status).to.equal(400);
      expect(res._json.error).to.include('name is required');
    });

    it('returns 201 on successful creation', async () => {
      sinon.stub(roleService, 'createRole').resolves(MOCK_ROLE);
      const { req, res } = makeReqRes({ name: 'Custom Role', permission_keys: ['scanner:read'] });

      await createRoleHandler(req, res);

      expect(res._status).to.equal(201);
      expect(res._json.role).to.deep.equal(MOCK_ROLE);
    });

    it('returns 400 for unknown permission keys', async () => {
      sinon.stub(roleService, 'createRole').rejects(new Error('Unknown permission keys: bad:key'));
      const { req, res } = makeReqRes({ name: 'X', permission_keys: ['bad:key'] });

      await createRoleHandler(req, res);

      expect(res._status).to.equal(400);
      expect(res._json.error).to.include('Unknown permission keys');
    });
  });

  // ── updateRoleHandler ────────────────────────────────────────────────────────

  describe('updateRoleHandler', () => {
    it('returns 200 on successful update', async () => {
      sinon.stub(roleService, 'updateRole').resolves(MOCK_ROLE);
      const { req, res } = makeReqRes({ name: 'Updated' }, { id: 'role-1' });

      await updateRoleHandler(req, res);

      expect(res._status).to.equal(200);
      expect(res._json.role).to.deep.equal(MOCK_ROLE);
    });

    it('returns 409 when trying to update a system role', async () => {
      sinon.stub(roleService, 'updateRole').rejects(new roleService.SystemRoleError('update'));
      const { req, res } = makeReqRes({ name: 'Hacked' }, { id: 'admin-role-id' });

      await updateRoleHandler(req, res);

      expect(res._status).to.equal(409);
      expect(res._json.error).to.include('system role');
    });

    it('returns 404 for non-existent role', async () => {
      sinon.stub(roleService, 'updateRole').rejects(new roleService.RoleNotFoundError('missing'));
      const { req, res } = makeReqRes({ name: 'X' }, { id: 'missing' });

      await updateRoleHandler(req, res);

      expect(res._status).to.equal(404);
    });
  });

  // ── deleteRoleHandler ────────────────────────────────────────────────────────

  describe('deleteRoleHandler', () => {
    it('returns 200 on successful delete', async () => {
      sinon.stub(roleService, 'deleteRole').resolves();
      const { req, res } = makeReqRes({}, { id: 'role-1' });

      await deleteRoleHandler(req, res);

      expect(res._status).to.equal(200);
      expect(res._json).to.deep.equal({ message: 'Role deleted' });
    });

    it('returns 409 when trying to delete a system role', async () => {
      sinon.stub(roleService, 'deleteRole').rejects(new roleService.SystemRoleError('delete'));
      const { req, res } = makeReqRes({}, { id: 'admin-id' });

      await deleteRoleHandler(req, res);

      expect(res._status).to.equal(409);
    });

    it('returns 409 when role is in use', async () => {
      sinon.stub(roleService, 'deleteRole').rejects(new roleService.RoleInUseError('custom', 3));
      const { req, res } = makeReqRes({}, { id: 'role-1' });

      await deleteRoleHandler(req, res);

      expect(res._status).to.equal(409);
      expect(res._json.error).to.include('3 user');
    });

    it('returns 404 for non-existent role', async () => {
      sinon.stub(roleService, 'deleteRole').rejects(new roleService.RoleNotFoundError('missing'));
      const { req, res } = makeReqRes({}, { id: 'missing' });

      await deleteRoleHandler(req, res);

      expect(res._status).to.equal(404);
    });
  });

  // ── listPermissionCatalogHandler ─────────────────────────────────────────────

  describe('listPermissionCatalogHandler', () => {
    it('returns 200 with grouped permissions array', () => {
      const { req, res } = makeReqRes();

      listPermissionCatalogHandler(req, res);

      expect(res._status).to.equal(200);
      expect(res._json.permissions).to.be.an('array').that.has.length.greaterThan(0);
      // Each entry has domain + permissions
      const first = res._json.permissions[0];
      expect(first).to.have.property('domain');
      expect(first.permissions[0]).to.have.property('key');
      expect(first.permissions[0]).to.have.property('label');
    });
  });
});

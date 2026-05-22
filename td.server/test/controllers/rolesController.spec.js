/* global describe, it, beforeEach, afterEach */
import { expect } from 'chai';
import sinon from 'sinon';

import * as rolesController from '../../src/controllers/rolesController.js';
import * as roleService from '../../src/services/roleService.js';
import loggerHelper from '../../src/helpers/logger.helper.js';

describe('controllers/rolesController.js', () => {
    let req, res, next;

    beforeEach(() => {
        req = { params: {}, body: {}, user: { id: 'admin1', role: 'admin' } };
        res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub(),
        };
        sinon.stub(loggerHelper.Logger.prototype, 'warn');
        sinon.stub(loggerHelper.Logger.prototype, 'info');
        sinon.stub(loggerHelper.Logger.prototype, 'error');
    });

    afterEach(() => {
        sinon.restore();
    });

    // ── listRoles ──────────────────────────────────────────────────────────

    describe('listRoles', () => {
        it('should return 200 with roles array', async () => {
            const mockRoles = [
                { id: 'r1', slug: 'admin', name: 'Administrator', permission_keys: [], user_count: 1 },
            ];
            sinon.stub(roleService, 'listRoles').resolves(mockRoles);

            await rolesController.listRoles(req, res);

            expect(res.json.calledOnce).to.be.true;
            expect(res.json.firstCall.args[0].roles).to.deep.equal(mockRoles);
            expect(res.status.called).to.be.false; // 200 default
        });

        it('should return 500 on service error', async () => {
            sinon.stub(roleService, 'listRoles').rejects(new Error('DB down'));

            await rolesController.listRoles(req, res);

            expect(res.status.calledOnceWith(500)).to.be.true;
            expect(res.json.firstCall.args[0].error).to.equal('Internal server error');
        });
    });

    // ── getRole ────────────────────────────────────────────────────────────

    describe('getRole', () => {
        it('should return 200 with role', async () => {
            const mockRole = { id: 'r1', slug: 'admin', name: 'Administrator', permission_keys: [] };
            sinon.stub(roleService, 'getRole').resolves(mockRole);
            req.params.id = 'r1';

            await rolesController.getRole(req, res);

            expect(res.json.calledOnce).to.be.true;
            expect(res.json.firstCall.args[0].role).to.deep.equal(mockRole);
        });

        it('should return 404 when role not found', async () => {
            sinon.stub(roleService, 'getRole').resolves(null);
            req.params.id = 'nonexistent';

            await rolesController.getRole(req, res);

            expect(res.status.calledOnceWith(404)).to.be.true;
            expect(res.json.firstCall.args[0].error).to.equal('Role not found');
        });
    });

    // ── createRole ─────────────────────────────────────────────────────────

    describe('createRole', () => {
        it('should return 201 with created role', async () => {
            const created = { id: 'r2', slug: 'reviewer', name: 'Reviewer', permission_keys: ['threatmodel:read'] };
            sinon.stub(roleService, 'createRole').resolves(created);
            req.body = { name: 'Reviewer', permission_keys: ['threatmodel:read'] };

            await rolesController.createRole(req, res);

            expect(res.status.calledOnceWith(201)).to.be.true;
            expect(res.json.firstCall.args[0].role).to.deep.equal(created);
        });

        it('should return 400 for validation error', async () => {
            const err = new Error('name is required');
            err.code = 'VALIDATION_ERROR';
            sinon.stub(roleService, 'createRole').rejects(err);
            req.body = {};

            await rolesController.createRole(req, res);

            expect(res.status.calledOnceWith(400)).to.be.true;
            expect(res.json.firstCall.args[0].error).to.equal('name is required');
        });
    });

    // ── updateRole ─────────────────────────────────────────────────────────

    describe('updateRole', () => {
        it('should return 200 with updated role', async () => {
            const updated = { id: 'r2', slug: 'reviewer', name: 'Updated', permission_keys: [] };
            sinon.stub(roleService, 'updateRole').resolves(updated);
            req.params.id = 'r2';
            req.body = { name: 'Updated' };

            await rolesController.updateRole(req, res);

            expect(res.json.calledOnce).to.be.true;
            expect(res.json.firstCall.args[0].role).to.deep.equal(updated);
        });

        it('should return 409 for system role mutation', async () => {
            const err = new Error('System roles cannot be modified');
            err.code = 'SYSTEM_ROLE_IMMUTABLE';
            sinon.stub(roleService, 'updateRole').rejects(err);

            await rolesController.updateRole(req, res);

            expect(res.status.calledOnceWith(409)).to.be.true;
        });

        it('should return 404 for role not found', async () => {
            const err = new Error('Role not found');
            err.code = 'NOT_FOUND';
            sinon.stub(roleService, 'updateRole').rejects(err);

            await rolesController.updateRole(req, res);

            expect(res.status.calledOnceWith(404)).to.be.true;
        });
    });

    // ── deleteRole ─────────────────────────────────────────────────────────

    describe('deleteRole', () => {
        it('should return 200 on successful delete', async () => {
            sinon.stub(roleService, 'deleteRole').resolves();
            req.params.id = 'r2';

            await rolesController.deleteRole(req, res);

            expect(res.json.calledOnce).to.be.true;
            expect(res.json.firstCall.args[0].message).to.equal('Role deleted');
        });

        it('should return 409 for system role deletion', async () => {
            const err = new Error('System roles cannot be deleted');
            err.code = 'SYSTEM_ROLE_IMMUTABLE';
            sinon.stub(roleService, 'deleteRole').rejects(err);

            await rolesController.deleteRole(req, res);

            expect(res.status.calledOnceWith(409)).to.be.true;
        });

        it('should return 409 for role-in-use deletion', async () => {
            const err = new Error('Cannot delete — users assigned');
            err.code = 'ROLE_IN_USE';
            sinon.stub(roleService, 'deleteRole').rejects(err);

            await rolesController.deleteRole(req, res);

            expect(res.status.calledOnceWith(409)).to.be.true;
        });
    });

    // ── listPermissionCatalog ──────────────────────────────────────────────

    describe('listPermissionCatalog', () => {
        it('should return 200 with the permission catalog', async () => {
            await rolesController.listPermissionCatalog(req, res);

            expect(res.json.calledOnce).to.be.true;
            const result = res.json.firstCall.args[0];
            expect(result).to.have.property('permissions');
            expect(result.permissions).to.have.property('threatmodel');
            expect(result.permissions.threatmodel).to.have.property('label');
            expect(result.permissions.threatmodel.permissions).to.be.an('array');
        });
    });
});
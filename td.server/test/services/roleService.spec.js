/**
 * Unit tests — services/roleService.js
 *
 * The knex default export is a CALLABLE (`db('roles')`), so it cannot be intercepted
 * by stubbing a method on the imported binding (an earlier approach stubbed `db.call`,
 * which never intercepts direct invocation and let queries hit a real database). We
 * inject a mock `db` via proxyquire instead: `db('table')` returns a controlled
 * query-builder mock and no real connection is attempted.
 *
 * Stubs: db (knex, injected), permissions.js cache.
 */

import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import sinon from 'sinon';
import proxyquire from 'proxyquire';

chai.use(chaiAsPromised);

// ── mock fixtures ───────────────────────────────────────────────────────────────

const MOCK_CUSTOM_ROLE = {
  id: 'role-uuid-custom',
  slug: 'custom-analyst',
  name: 'Custom Analyst',
  description: 'A custom analyst role',
  is_system: false,
  is_active: true,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const MOCK_SYSTEM_ROLE = {
  id: 'role-uuid-admin',
  slug: 'admin',
  name: 'Administrator',
  description: 'Full system access',
  is_system: true,
  is_active: true,
};

// ── injected mock db + permissions module ───────────────────────────────────────

// A callable knex mock: each invocation returns the next queued query-builder mock.
const dbStub = sinon.stub();
dbStub.transaction = sinon.stub();
dbStub.fn = { now: () => 'CURRENT_TIMESTAMP' };
const invalidateCacheStub = sinon.stub();

const {
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  RoleNotFoundError,
  SystemRoleError,
  RoleInUseError,
} = proxyquire('../../src/services/roleService.js', {
  '../db/knex.js': { __esModule: true, default: dbStub, '@noCallThru': true },
  '../auth/permissions.js': {
    __esModule: true,
    invalidateCache: invalidateCacheStub,
    getEffectivePermissions: sinon.stub(),
    '@noCallThru': true,
  },
});

/** Queue query-builder mocks in the order roleService calls `db(...)`. */
function queue(...chains) {
  chains.forEach((chain, i) => dbStub.onCall(i).returns(chain));
}

describe('services/roleService.js', () => {
  beforeEach(() => {
    dbStub.reset();
    dbStub.transaction.reset();
    invalidateCacheStub.reset();
  });

  // ── listRoles ───────────────────────────────────────────────────────────────

  describe('listRoles()', () => {
    it('returns roles with permission_keys and user_count', async () => {
      queue(
        { where: sinon.stub().returnsThis(), orderBy: sinon.stub().returnsThis(), select: sinon.stub().resolves([MOCK_CUSTOM_ROLE]) },
        { whereIn: sinon.stub().returnsThis(), select: sinon.stub().resolves([{ role_id: 'role-uuid-custom', permission_key: 'scanner:read' }]) },
        { whereIn: sinon.stub().returnsThis(), groupBy: sinon.stub().returnsThis(), count: sinon.stub().returnsThis(), select: sinon.stub().resolves([{ role: 'custom-analyst', user_count: '3' }]) },
      );

      const roles = await listRoles();

      expect(roles).to.have.length(1);
      expect(roles[0].permission_keys).to.deep.equal(['scanner:read']);
      expect(roles[0].user_count).to.equal(3);
    });
  });

  // ── getRole ─────────────────────────────────────────────────────────────────

  describe('getRole()', () => {
    it('returns the role with permission_keys and user_count', async () => {
      queue(
        { where: sinon.stub().returnsThis(), first: sinon.stub().resolves(MOCK_CUSTOM_ROLE) },
        { where: sinon.stub().returnsThis(), pluck: sinon.stub().resolves(['scanner:read']) },
        { where: sinon.stub().returnsThis(), count: sinon.stub().resolves([{ user_count: '1' }]) },
      );

      const role = await getRole('role-uuid-custom');

      expect(role.slug).to.equal('custom-analyst');
      expect(role.permission_keys).to.deep.equal(['scanner:read']);
      expect(role.user_count).to.equal(1);
    });

    it('throws RoleNotFoundError when role does not exist', async () => {
      queue({ where: sinon.stub().returnsThis(), first: sinon.stub().resolves(null) });

      await expect(getRole('nonexistent')).to.be.rejectedWith(RoleNotFoundError);
    });
  });

  // ── createRole ──────────────────────────────────────────────────────────────

  describe('createRole()', () => {
    it('creates a role and invalidates cache', async () => {
      // uniqueSlug check: no existing role with that slug.
      queue({ where: sinon.stub().returnsThis(), first: sinon.stub().resolves(null) });

      const insertChain = { insert: sinon.stub().returnsThis(), returning: sinon.stub().resolves([{ ...MOCK_CUSTOM_ROLE }]) };
      const grantsInsert = { insert: sinon.stub().resolves() };
      const trx = sinon.stub();
      trx.withArgs('roles').returns(insertChain);
      trx.withArgs('role_permissions').returns(grantsInsert);
      dbStub.transaction.callsFake(async (fn) => fn(trx));

      const role = await createRole({ name: 'Custom Analyst', permission_keys: ['scanner:read'] });

      expect(role.name).to.equal('Custom Analyst');
      expect(invalidateCacheStub.calledOnce).to.be.true;
    });

    it('throws on empty name', async () => {
      await expect(createRole({ name: '' })).to.be.rejectedWith('name is required');
    });

    it('throws on unknown permission key', async () => {
      await expect(createRole({ name: 'X', permission_keys: ['not:a:real:key'] }))
        .to.be.rejectedWith('Unknown permission keys');
    });
  });

  // ── updateRole ──────────────────────────────────────────────────────────────

  describe('updateRole()', () => {
    it('throws SystemRoleError when updating a system role', async () => {
      queue({ where: sinon.stub().returnsThis(), first: sinon.stub().resolves(MOCK_SYSTEM_ROLE) });

      await expect(updateRole('role-uuid-admin', { name: 'New Name' }))
        .to.be.rejectedWith(SystemRoleError);
    });

    it('throws RoleNotFoundError for unknown id', async () => {
      queue({ where: sinon.stub().returnsThis(), first: sinon.stub().resolves(null) });

      await expect(updateRole('missing', { name: 'X' })).to.be.rejectedWith(RoleNotFoundError);
    });

    it('invalidates cache after successful update', async () => {
      queue({ where: sinon.stub().returnsThis(), first: sinon.stub().resolves(MOCK_CUSTOM_ROLE) });

      const trxChain = {
        where:     sinon.stub().returnsThis(),
        update:    sinon.stub().returnsThis(),
        delete:    sinon.stub().resolves(),
        insert:    sinon.stub().resolves(),
        pluck:     sinon.stub().resolves(['scanner:read']),
        returning: sinon.stub().resolves([MOCK_CUSTOM_ROLE]),
      };
      const trx = sinon.stub().returns(trxChain);
      dbStub.transaction.callsFake(async (fn) => fn(trx));

      await updateRole('role-uuid-custom', { name: 'Updated' });

      expect(invalidateCacheStub.calledWith('custom-analyst')).to.be.true;
    });
  });

  // ── deleteRole ──────────────────────────────────────────────────────────────

  describe('deleteRole()', () => {
    it('throws RoleNotFoundError for unknown id', async () => {
      queue({ where: sinon.stub().returnsThis(), first: sinon.stub().resolves(null) });

      await expect(deleteRole('missing')).to.be.rejectedWith(RoleNotFoundError);
    });

    it('throws SystemRoleError when deleting a system role', async () => {
      queue({ where: sinon.stub().returnsThis(), first: sinon.stub().resolves(MOCK_SYSTEM_ROLE) });

      await expect(deleteRole('role-uuid-admin')).to.be.rejectedWith(SystemRoleError);
    });

    it('throws RoleInUseError when users are assigned to the role', async () => {
      queue(
        { where: sinon.stub().returnsThis(), first: sinon.stub().resolves(MOCK_CUSTOM_ROLE) },
        { where: sinon.stub().returnsThis(), count: sinon.stub().resolves([{ user_count: '2' }]) },
      );

      await expect(deleteRole('role-uuid-custom')).to.be.rejectedWith(RoleInUseError);
    });

    it('deletes the role and invalidates cache when safe', async () => {
      const deleteChain = { where: sinon.stub().returnsThis(), delete: sinon.stub().resolves(1) };
      queue(
        { where: sinon.stub().returnsThis(), first: sinon.stub().resolves(MOCK_CUSTOM_ROLE) },
        { where: sinon.stub().returnsThis(), count: sinon.stub().resolves([{ user_count: '0' }]) },
        deleteChain,
      );

      await deleteRole('role-uuid-custom');

      expect(invalidateCacheStub.calledWith('custom-analyst')).to.be.true;
      expect(deleteChain.delete.calledOnce).to.be.true;
    });
  });
});

import chaiAsPromised from "chai-as-promised";
import { use } from "chai";
use(chaiAsPromised);
/**
 * Unit tests — services/roleService.js
 *
 * Stubs: db (knex), permissions.js cache
 * Tests: listRoles, getRole, createRole, updateRole, deleteRole, system-role protection
 */

import { expect } from 'chai';
import sinon from 'sinon';

import db from '../../src/db/knex.js';
import * as permissionsModule from '../../src/auth/permissions.js';

import {
  listRoles,
  getRole,
  createRole,
  updateRole,
  deleteRole,
  RoleNotFoundError,
  SystemRoleError,
  RoleInUseError,
} from '../../src/services/roleService.js';

// ── helpers ───────────────────────────────────────────────────────────────────

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

// ── tests ─────────────────────────────────────────────────────────────────────

describe('services/roleService.js', () => {
  let invalidateCacheStub;

  beforeEach(() => {
    invalidateCacheStub = sinon.stub(permissionsModule, 'invalidateCache');
  });

  afterEach(() => {
    sinon.restore();
  });

  // ── listRoles ───────────────────────────────────────────────────────────────

  describe('listRoles()', () => {
    it('returns roles with permission_keys and user_count', async () => {
      const rolesChain = {
        where:   sinon.stub().returnsThis(),
        orderBy: sinon.stub().returnsThis(),
        select:  sinon.stub().resolves([MOCK_CUSTOM_ROLE]),
      };
      const grantsChain = {
        whereIn: sinon.stub().returnsThis(),
        select:  sinon.stub().resolves([
          { role_id: 'role-uuid-custom', permission_key: 'scanner:read' },
        ]),
      };
      const countsChain = {
        whereIn: sinon.stub().returnsThis(),
        groupBy: sinon.stub().returnsThis(),
        count:   sinon.stub().returnsThis(),
        select:  sinon.stub().resolves([{ role: 'custom-analyst', user_count: '3' }]),
      };

      let callIndex = 0;
      sinon.stub(db, 'call' in db ? 'call' : 'bind').callsFake(() => {
        return [rolesChain, grantsChain, countsChain][callIndex++];
      });

      const roles = await listRoles();

      expect(roles).to.have.length(1);
      expect(roles[0].permission_keys).to.deep.equal(['scanner:read']);
      expect(roles[0].user_count).to.equal(3);
    });
  });

  // ── getRole ─────────────────────────────────────────────────────────────────

  describe('getRole()', () => {
    it('returns the role with permission_keys and user_count', async () => {
      const roleChain  = { where: sinon.stub().returnsThis(), first: sinon.stub().resolves(MOCK_CUSTOM_ROLE) };
      const grantsChain = { where: sinon.stub().returnsThis(), pluck: sinon.stub().resolves(['scanner:read']) };
      const countChain  = { where: sinon.stub().returnsThis(), count: sinon.stub().resolves([{ user_count: '1' }]) };

      let i = 0;
      sinon.stub(db, 'call' in db ? 'call' : 'bind').callsFake(() => [roleChain, grantsChain, countChain][i++]);

      const role = await getRole('role-uuid-custom');

      expect(role.slug).to.equal('custom-analyst');
      expect(role.permission_keys).to.deep.equal(['scanner:read']);
      expect(role.user_count).to.equal(1);
    });

    it('throws RoleNotFoundError when role does not exist', async () => {
      const roleChain = { where: sinon.stub().returnsThis(), first: sinon.stub().resolves(null) };
      sinon.stub(db, 'call' in db ? 'call' : 'bind').callsFake(() => roleChain);

      await expect(getRole('nonexistent')).to.be.rejectedWith(RoleNotFoundError);
    });
  });

  // ── createRole ──────────────────────────────────────────────────────────────

  describe('createRole()', () => {
    it('creates a role and invalidates cache', async () => {
      // Stub: uniqueSlug check (no existing role with that slug)
      const slugCheckChain = { where: sinon.stub().returnsThis(), first: sinon.stub().resolves(null) };

      // Stub: transaction
      const insertChain = {
        insert:    sinon.stub().returnsThis(),
        returning: sinon.stub().resolves([{ ...MOCK_CUSTOM_ROLE }]),
      };
      const grantsInsert = {
        insert: sinon.stub().resolves(),
      };

      let i = 0;
      sinon.stub(db, 'call' in db ? 'call' : 'bind').callsFake(() => [slugCheckChain][i++] ?? slugCheckChain);

      // Stub db.transaction to call the callback synchronously
      const trx = {
        call:       (...args) => {
          const table = args[0];
          if (table === 'roles') return insertChain;
          return grantsInsert;
        },
      };
      sinon.stub(db, 'transaction').callsFake(async (fn) => fn(trx));

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
      const roleChain = { where: sinon.stub().returnsThis(), first: sinon.stub().resolves(MOCK_SYSTEM_ROLE) };
      sinon.stub(db, 'call' in db ? 'call' : 'bind').callsFake(() => roleChain);

      await expect(updateRole('role-uuid-admin', { name: 'New Name' }))
        .to.be.rejectedWith(SystemRoleError);
    });

    it('throws RoleNotFoundError for unknown id', async () => {
      const roleChain = { where: sinon.stub().returnsThis(), first: sinon.stub().resolves(null) };
      sinon.stub(db, 'call' in db ? 'call' : 'bind').callsFake(() => roleChain);

      await expect(updateRole('missing', { name: 'X' })).to.be.rejectedWith(RoleNotFoundError);
    });

    it('invalidates cache after successful update', async () => {
      const roleChain = { where: sinon.stub().returnsThis(), first: sinon.stub().resolves(MOCK_CUSTOM_ROLE) };

      const trxChain = {
        where:    sinon.stub().returnsThis(),
        update:   sinon.stub().returnsThis(),
        delete:   sinon.stub().resolves(),
        insert:   sinon.stub().resolves(),
        pluck:    sinon.stub().resolves(['scanner:read']),
        returning: sinon.stub().resolves([MOCK_CUSTOM_ROLE]),
      };
      const trx = { call: () => trxChain };

      sinon.stub(db, 'call' in db ? 'call' : 'bind').callsFake(() => roleChain);
      sinon.stub(db, 'transaction').callsFake(async (fn) => fn(trx));

      await updateRole('role-uuid-custom', { name: 'Updated' });

      expect(invalidateCacheStub.calledWith('custom-analyst')).to.be.true;
    });
  });

  // ── deleteRole ──────────────────────────────────────────────────────────────

  describe('deleteRole()', () => {
    it('throws RoleNotFoundError for unknown id', async () => {
      const roleChain = { where: sinon.stub().returnsThis(), first: sinon.stub().resolves(null) };
      sinon.stub(db, 'call' in db ? 'call' : 'bind').callsFake(() => roleChain);

      await expect(deleteRole('missing')).to.be.rejectedWith(RoleNotFoundError);
    });

    it('throws SystemRoleError when deleting a system role', async () => {
      const roleChain = { where: sinon.stub().returnsThis(), first: sinon.stub().resolves(MOCK_SYSTEM_ROLE) };
      sinon.stub(db, 'call' in db ? 'call' : 'bind').callsFake(() => roleChain);

      await expect(deleteRole('role-uuid-admin')).to.be.rejectedWith(SystemRoleError);
    });

    it('throws RoleInUseError when users are assigned to the role', async () => {
      const roleChain  = { where: sinon.stub().returnsThis(), first: sinon.stub().resolves(MOCK_CUSTOM_ROLE) };
      const countChain = { where: sinon.stub().returnsThis(), count: sinon.stub().resolves([{ user_count: '2' }]) };

      let i = 0;
      sinon.stub(db, 'call' in db ? 'call' : 'bind').callsFake(() => [roleChain, countChain][i++]);

      await expect(deleteRole('role-uuid-custom')).to.be.rejectedWith(RoleInUseError);
    });

    it('deletes the role and invalidates cache when safe', async () => {
      const roleChain   = { where: sinon.stub().returnsThis(), first: sinon.stub().resolves(MOCK_CUSTOM_ROLE) };
      const countChain  = { where: sinon.stub().returnsThis(), count: sinon.stub().resolves([{ user_count: '0' }]) };
      const deleteChain = { where: sinon.stub().returnsThis(), delete: sinon.stub().resolves(1) };

      let i = 0;
      sinon.stub(db, 'call' in db ? 'call' : 'bind').callsFake(() => [roleChain, countChain, deleteChain][i++]);

      await deleteRole('role-uuid-custom');

      expect(invalidateCacheStub.calledWith('custom-analyst')).to.be.true;
      expect(deleteChain.delete.calledOnce).to.be.true;
    });
  });
});

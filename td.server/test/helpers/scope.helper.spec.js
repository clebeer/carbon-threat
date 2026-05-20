/* global describe, it, beforeEach, afterEach */
import chai from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as knexModule from '../../src/db/knex.js';

chai.use(sinonChai);
const { expect } = chai;

import {
  getOrgId,
  getUserId,
  scopedThreatModels,
  assertThreatModelAccess
} from '../../src/helpers/scope.helper.js';

describe('helpers/scope.helper.js', () => {
    describe('getOrgId', () => {
        it('should return null for empty request', () => {
            expect(getOrgId({})).to.be.null;
        });

        it('should return req.user.orgId if present', () => {
            expect(getOrgId({ user: { orgId: 'org-1' } })).to.equal('org-1');
        });

        it('should return req.user.org_id if present', () => {
            expect(getOrgId({ user: { org_id: 'org-2' } })).to.equal('org-2');
        });

        it('should return req.provider.orgId if present', () => {
            expect(getOrgId({ provider: { orgId: 'org-3' } })).to.equal('org-3');
        });

        it('should return req.provider.org_id if present', () => {
            expect(getOrgId({ provider: { org_id: 'org-4' } })).to.equal('org-4');
        });

        it('should prioritize user over provider', () => {
            expect(getOrgId({ user: { orgId: 'user-org' }, provider: { orgId: 'prov-org' } })).to.equal('user-org');
        });

        it('should return null if user and provider have no org info', () => {
            expect(getOrgId({ user: { id: 1 }, provider: { name: 'github' } })).to.be.null;
        });
    });

    describe('getUserId', () => {
        it('should return null for empty request', () => {
            expect(getUserId({})).to.be.null;
        });

        it('should return req.user.id if present', () => {
            expect(getUserId({ user: { id: 'user-1' } })).to.equal('user-1');
        });

        it('should return null if user has no id', () => {
            expect(getUserId({ user: { name: 'test' } })).to.be.null;
        });
    });

    describe('scopedThreatModels', () => {
        let mockDb;
        let mockQuery;

        beforeEach(() => {
            mockQuery = {
                where: sinon.stub().returnsThis()
            };
            mockDb = sinon.stub(knexModule, 'default').returns(mockQuery);
        });

        afterEach(() => {
            sinon.restore();
        });

        it('should filter out archived by default', () => {
            scopedThreatModels({});
            expect(mockDb).to.have.been.calledWith('threat_models');
            expect(mockQuery.where).to.have.been.calledWith({ is_archived: false });
        });

        it('should not filter out archived if includeArchived is true', () => {
            scopedThreatModels({}, { includeArchived: true });
            expect(mockDb).to.have.been.calledWith('threat_models');
            expect(mockQuery.where).not.to.have.been.calledWith({ is_archived: false });
        });

        it('should scope by org_id if orgId is present', () => {
            const req = { user: { orgId: 'org-1' } };
            scopedThreatModels(req);
            expect(mockQuery.where).to.have.been.calledWith({ org_id: 'org-1' });
            expect(mockQuery.where).not.to.have.been.calledWith({ owner_id: sinon.match.any });
        });

        it('should scope by owner_id if orgId is not present but userId is', () => {
            const req = { user: { id: 'user-1' } };
            scopedThreatModels(req);
            expect(mockQuery.where).to.have.been.calledWith({ owner_id: 'user-1' });
            expect(mockQuery.where).not.to.have.been.calledWith({ org_id: sinon.match.any });
        });

        it('should scope by owner_id=null if neither orgId nor userId is present', () => {
            scopedThreatModels({});
            expect(mockQuery.where).to.have.been.calledWith({ owner_id: null });
        });
    });

    describe('assertThreatModelAccess', () => {
        let mockDb;
        let mockQuery;

        beforeEach(() => {
            mockQuery = {
                where: sinon.stub().returnsThis(),
                first: sinon.stub().resolves(undefined)
            };
            mockDb = sinon.stub(knexModule, 'default').returns(mockQuery);
        });

        afterEach(() => {
            sinon.restore();
        });

        it('should return null if modelId is not provided', async () => {
            const result = await assertThreatModelAccess({}, null);
            expect(result).to.be.null;
            expect(mockDb).not.to.have.been.called;
        });

        it('should return the row if access is permitted', async () => {
            const expectedRow = { id: 'model-1', name: 'Test Model' };
            mockQuery.first.resolves(expectedRow);

            const result = await assertThreatModelAccess({ user: { id: 'user-1' } }, 'model-1');

            expect(mockQuery.where).to.have.been.calledWith({ is_archived: false });
            expect(mockQuery.where).to.have.been.calledWith({ owner_id: 'user-1' });
            expect(mockQuery.where).to.have.been.calledWith({ id: 'model-1' });
            expect(mockQuery.first).to.have.been.called;
            expect(result).to.equal(expectedRow);
        });

        it('should pass includeArchived to scopedThreatModels', async () => {
            const expectedRow = { id: 'model-1', name: 'Test Model' };
            mockQuery.first.resolves(expectedRow);

            const result = await assertThreatModelAccess({ user: { orgId: 'org-1' } }, 'model-1', { includeArchived: true });

            expect(mockQuery.where).not.to.have.been.calledWith({ is_archived: false });
            expect(mockQuery.where).to.have.been.calledWith({ org_id: 'org-1' });
            expect(mockQuery.where).to.have.been.calledWith({ id: 'model-1' });
            expect(result).to.equal(expectedRow);
        });

        it('should return null if model is not found or access is denied', async () => {
            mockQuery.first.resolves(undefined);

            const result = await assertThreatModelAccess({ user: { id: 'user-1' } }, 'model-1');

            expect(mockQuery.where).to.have.been.calledWith({ id: 'model-1' });
            expect(result).to.be.null;
        });
    });
});

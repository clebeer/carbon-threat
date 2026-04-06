/**
 * Unit tests — repositories/token.js
 *
 * The token repository was migrated from an in-memory array to a
 * PostgreSQL-backed store via Knex. All operations are now async.
 *
 * Strategy: stub `knexModule.default` so that `db('refresh_tokens')`
 * returns a fake chainable query-builder without touching the real DB.
 * This works because Babel compiles `import db from '...'` to
 * `_knex["default"](...)` at call-site — the same object reference
 * that we replace via sinon.stub(knexModule, 'default').
 */

import { expect } from 'chai';
import sinon from 'sinon';

import * as knexModule from '../../src/db/knex.js';
import jwtHelper from '../../src/helpers/jwt.helper.js';
import tokenRepo from '../../src/repositories/token.js';

// ── helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds a minimal chainable Knex query-builder mock.
 * @param {object} opts
 * @param {*}      opts.firstResult  — value resolved by .first()
 */
function makeChain({ firstResult = null } = {}) {
    return {
        insert:     sinon.stub().returnsThis(),
        where:      sinon.stub().returnsThis(),
        delete:     sinon.stub().resolves(1),
        first:      sinon.stub().resolves(firstResult),
        onConflict: sinon.stub().returnsThis(),
        ignore:     sinon.stub().resolves(),
    };
}

const FUTURE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
const PAST   = new Date(Date.now() - 1000);

// ── tests ─────────────────────────────────────────────────────────────────────

describe('repositories/token.js', () => {
    let dbStub;
    let chain;

    afterEach(() => {
        sinon.restore();
    });

    // ── add ──────────────────────────────────────────────────────────────────

    describe('add', () => {
        beforeEach(() => {
            chain  = makeChain();
            dbStub = sinon.stub(knexModule, 'default').returns(chain);
        });

        it('calls db("refresh_tokens") to persist the token', async () => {
            await tokenRepo.add('test-token');
            expect(dbStub.calledWith('refresh_tokens')).to.be.true;
        });

        it('calls .insert() with the token and an expires_at date', async () => {
            await tokenRepo.add('test-token');
            expect(chain.insert.calledOnce).to.be.true;
            const [arg] = chain.insert.firstCall.args;
            expect(arg).to.have.property('token', 'test-token');
            expect(arg).to.have.property('expires_at').that.is.instanceOf(Date);
        });

        it('uses .onConflict().ignore() to avoid duplicate key errors', async () => {
            await tokenRepo.add('test-token');
            expect(chain.onConflict.calledWith('token')).to.be.true;
            expect(chain.ignore.calledOnce).to.be.true;
        });

        it('does not throw when db.insert rejects (error is swallowed)', async () => {
            chain.ignore.rejects(new Error('DB connection lost'));
            await expect(tokenRepo.add('test-token')).to.not.be.rejected;
        });
    });

    // ── remove ───────────────────────────────────────────────────────────────

    describe('remove', () => {
        beforeEach(() => {
            chain  = makeChain();
            dbStub = sinon.stub(knexModule, 'default').returns(chain);
        });

        it('calls .where({ token }) and .delete()', async () => {
            await tokenRepo.remove('tok-123');
            expect(chain.where.calledWith({ token: 'tok-123' })).to.be.true;
            expect(chain.delete.calledOnce).to.be.true;
        });

        it('does not throw when the token is not present in DB', async () => {
            chain.delete.resolves(0); // 0 rows deleted — token did not exist
            await expect(tokenRepo.remove('non-existent')).to.not.be.rejected;
        });

        it('does not throw when db.delete rejects', async () => {
            chain.delete.rejects(new Error('DB error'));
            await expect(tokenRepo.remove('any')).to.not.be.rejected;
        });
    });

    // ── verify ───────────────────────────────────────────────────────────────

    describe('verify', () => {
        describe('with a valid, non-expired token', () => {
            beforeEach(() => {
                chain  = makeChain({ firstResult: { token: 'good-token', expires_at: FUTURE } });
                dbStub = sinon.stub(knexModule, 'default').returns(chain);
                sinon.stub(jwtHelper, 'verifyRefresh').returns({ provider: { name: 'local' }, user: { id: '1' } });
            });

            it('returns the decoded JWT payload', async () => {
                const result = await tokenRepo.verify('good-token');
                expect(result).to.deep.equal({ provider: { name: 'local' }, user: { id: '1' } });
            });

            it('delegates cryptographic verification to jwtHelper.verifyRefresh', async () => {
                await tokenRepo.verify('good-token');
                expect(jwtHelper.verifyRefresh).to.have.been.calledWith('good-token');
            });
        });

        describe('with a non-existing token', () => {
            beforeEach(() => {
                chain  = makeChain({ firstResult: null });
                dbStub = sinon.stub(knexModule, 'default').returns(chain);
            });

            it('returns false when token is not found in DB', async () => {
                const result = await tokenRepo.verify('ghost-token');
                expect(result).to.be.false;
            });
        });

        describe('with an expired token', () => {
            beforeEach(() => {
                chain  = makeChain({ firstResult: { token: 'stale-token', expires_at: PAST } });
                dbStub = sinon.stub(knexModule, 'default').returns(chain);
            });

            it('returns false', async () => {
                const result = await tokenRepo.verify('stale-token');
                expect(result).to.be.false;
            });

            it('deletes the expired row from DB (opportunistic cleanup)', async () => {
                await tokenRepo.verify('stale-token');
                // db is called at least twice: once for .first(), once for .delete()
                expect(dbStub.callCount).to.be.at.least(2);
            });
        });

        describe('with an invalid JWT signature', () => {
            beforeEach(() => {
                chain  = makeChain({ firstResult: { token: 'bad-token', expires_at: FUTURE } });
                dbStub = sinon.stub(knexModule, 'default').returns(chain);
                sinon.stub(jwtHelper, 'verifyRefresh').throws(new Error('invalid signature'));
            });

            it('returns false when jwtHelper.verifyRefresh throws', async () => {
                const result = await tokenRepo.verify('bad-token');
                expect(result).to.be.false;
            });
        });

        describe('when the DB query itself throws', () => {
            beforeEach(() => {
                const errorChain = {
                    where: sinon.stub().returnsThis(),
                    first: sinon.stub().rejects(new Error('DB down')),
                };
                dbStub = sinon.stub(knexModule, 'default').returns(errorChain);
            });

            it('returns false (error is swallowed)', async () => {
                const result = await tokenRepo.verify('any-token');
                expect(result).to.be.false;
            });
        });
    });
});

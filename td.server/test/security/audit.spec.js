import { expect } from 'chai';
import sinon from 'sinon';

import * as knexModule from '../../src/db/knex.js';
import { auditMiddleware, logAudit, redactSensitive } from '../../src/security/audit.js';

describe('security/audit.js', () => {
    let mockReq, mockRes, mockNext;
    let knexStub, insertStub;

    beforeEach(() => {
        insertStub = sinon.stub().resolves();
        knexStub = sinon.stub(knexModule, 'default').returns({ insert: insertStub });

        mockReq = {
            user: { id: 'user123' },
            params: { id: 'resource123' },
            body: { data: 'test' },
            ip: '127.0.0.1'
        };
        mockRes = {
            statusCode: 200,
            send: sinon.spy()
        };
        mockNext = sinon.spy();
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('auditMiddleware', () => {
        it('should call next()', async () => {
            const middleware = auditMiddleware('TEST_ACTION');
            await middleware(mockReq, mockRes, mockNext);
            expect(mockNext.calledOnce).to.be.true;
        });

        it('should hook res.send to log audit on send', async () => {
            const middleware = auditMiddleware('TEST_ACTION');
            await middleware(mockReq, mockRes, mockNext);

            // simulate sending response
            mockRes.send('response data');

            expect(knexStub.calledWith('audit_logs')).to.be.true;
            expect(insertStub.calledOnce).to.be.true;
            const insertArgs = insertStub.firstCall.args[0];
            expect(insertArgs.action).to.equal('TEST_ACTION');
            expect(insertArgs.user_id).to.equal('user123');
            expect(insertArgs.entity_id).to.equal('resource123');
            expect(insertArgs.ip_address).to.equal('127.0.0.1');

            const diffObj = JSON.parse(insertArgs.diff);
            expect(diffObj.body.data).to.equal('test');
            expect(diffObj.statusCode).to.equal(200);
        });

        it('should handle missing user and params', async () => {
            mockReq.user = undefined;
            mockReq.params = {};
            const middleware = auditMiddleware('TEST_ACTION');
            await middleware(mockReq, mockRes, mockNext);

            mockRes.send('response data');

            expect(insertStub.calledOnce).to.be.true;
            const insertArgs = insertStub.firstCall.args[0];
            expect(insertArgs.user_id).to.be.null; // 'anonymous' mapped to null
            expect(insertArgs.entity_id).to.be.null; // 'N/A' mapped to null
        });

        it('should support actionProvider as a function', async () => {
            const actionProvider = sinon.stub().returns('DYNAMIC_ACTION');
            const middleware = auditMiddleware(actionProvider);
            await middleware(mockReq, mockRes, mockNext);

            mockRes.send('response data');

            expect(actionProvider.calledWith(mockReq)).to.be.true;
            const insertArgs = insertStub.firstCall.args[0];
            expect(insertArgs.action).to.equal('DYNAMIC_ACTION');
        });

        it('should call original res.send with data', async () => {
            const originalSend = mockRes.send;
            const middleware = auditMiddleware('TEST_ACTION');
            await middleware(mockReq, mockRes, mockNext);

            mockRes.send('response data');

            expect(originalSend.calledOnce).to.be.true;
            expect(originalSend.calledWith('response data')).to.be.true;
        });
    });

    describe('logAudit', () => {
        it('should write audit log using knex', async () => {
            await logAudit('ACTION', 'user1', 'res1', { a: 1 }, '1.1.1.1');
            expect(knexStub.calledWith('audit_logs')).to.be.true;
            expect(insertStub.calledOnce).to.be.true;
            const insertArgs = insertStub.firstCall.args[0];
            expect(insertArgs.action).to.equal('ACTION');
            expect(insertArgs.user_id).to.equal('user1');
            expect(insertArgs.entity_id).to.equal('res1');
            expect(insertArgs.ip_address).to.equal('1.1.1.1');
            expect(JSON.parse(insertArgs.diff)).to.deep.equal({ a: 1 });
        });

        it('should catch error on db failure', async () => {
            const consoleSpy = sinon.spy(console, 'error');
            insertStub.rejects(new Error('db error'));

            await logAudit('ACTION', 'user1', 'res1', { a: 1 }, '1.1.1.1');

            expect(consoleSpy.calledOnce).to.be.true;
            expect(consoleSpy.calledWith('Failed to write audit log')).to.be.true;
            // Also need to assert the error parameter if needed, but not strictly required
            consoleSpy.restore();
        });

        it('should handle anonymous user and N/A resourceId in logAudit directly', async () => {
            await logAudit('ACTION', 'anonymous', 'N/A', { a: 1 }, '1.1.1.1');
            expect(insertStub.calledOnce).to.be.true;
            const insertArgs = insertStub.firstCall.args[0];
            expect(insertArgs.user_id).to.be.null;
            expect(insertArgs.entity_id).to.be.null;
        });
    });

    describe('redactSensitive', () => {
        it('should redact sensitive string fields', () => {
            const data = {
                password: 'supersecretpassword',
                api_key: '1234567890',
                normal_field: 'public'
            };
            const result = redactSensitive(data);
            expect(result.password).to.equal('[REDACTED]');
            expect(result.api_key).to.equal('[REDACTED]');
            expect(result.normal_field).to.equal('public');
        });

        it('should handle nested objects and arrays', () => {
            const data = {
                users: [
                    { token: 'abc', name: 'John' },
                    { token: 'def', name: 'Jane' }
                ],
                meta: {
                    clientSecret: 'shhhh'
                }
            };
            const result = redactSensitive(data);
            expect(result.users[0].token).to.equal('[REDACTED]');
            expect(result.users[0].name).to.equal('John');
            expect(result.users[1].token).to.equal('[REDACTED]');
            expect(result.meta.clientSecret).to.equal('[REDACTED]');
        });

        it('should handle null and primitive values', () => {
            expect(redactSensitive(null)).to.be.null;
            expect(redactSensitive(undefined)).to.be.undefined;
            expect(redactSensitive('string')).to.equal('string');
            expect(redactSensitive(123)).to.equal(123);
        });

        it('should handle circular references', () => {
            const obj = { normal: 'val' };
            obj.self = obj;
            const result = redactSensitive(obj);
            expect(result.self).to.equal('[CIRCULAR]');
        });

        it('should handle circular references in arrays', () => {
            const arr = ['val'];
            arr.push(arr);
            const result = redactSensitive(arr);
            expect(result[1]).to.equal('[CIRCULAR]');
        });

        it('should truncate objects exceeding max depth', () => {
            // max depth is 6
            let obj = { level: 1 };
            let current = obj;
            for (let i = 2; i <= 8; i++) {
                current.next = { level: i };
                current = current.next;
            }

            const result = redactSensitive(obj);

            // max depth 6 means 6 levels of nesting allowed
            // The original object is 0 depth
            // next is 1
            // next.next is 2
            // next.next.next is 3
            // next.next.next.next is 4
            // next.next.next.next.next is 5
            // next.next.next.next.next.next is 6
            // next.next.next.next.next.next.next is [TRUNCATED]

            let depthCount = 0;
            let check = result;
            while(check.next && check.next !== '[TRUNCATED]') {
                depthCount++;
                check = check.next;
            }

            expect(check.next).to.equal('[TRUNCATED]');
            expect(depthCount).to.equal(6);
        });
    });
});

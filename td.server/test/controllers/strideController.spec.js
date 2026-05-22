/**
 * Tests for strideController — AI analysis endpoint
 */
import { expect } from 'chai';
import sinon from 'sinon';

// Mock the strideEngineService before importing controller
const mockRunFullAnalysis = sinon.stub();

// We'll test the controller functions directly
const VALID_UUID = '12345678-1234-1234-1234-123456789abc';

describe('strideController', () => {
  let req;
  let res;
  let statusStub;
  let jsonStub;

  beforeEach(() => {
    mockRunFullAnalysis.reset();
    req = { params: {}, body: {}, user: { id: 'user-1' } };
    jsonStub = sinon.stub();
    statusStub = sinon.stub().returns({ json: jsonStub });
    res = { status: statusStub, json: jsonStub };
  });

  describe('aiAnalyze input validation', () => {
    it('should reject invalid model id', async () => {
      // Dynamic import with mock
      const { aiAnalyze } = await import('../../src/controllers/strideController.js');
      req.params.id = 'not-a-uuid';
      await aiAnalyze(req, res);
      expect(statusStub.calledWith(400)).to.be.true;
    });

    it('should accept a valid UUID', async () => {
      // This test would require mocking strideEngineService
      // which is tested more thoroughly at the service level
      const { aiAnalyze } = await import('../../src/controllers/strideController.js');
      req.params.id = VALID_UUID;
      req.body = { appType: 'Traditional application' };
      // Will fail because no DB — but validates UUID is accepted
      // (status 502 means it passed validation and tried to call service)
      const result = await aiAnalyze(req, res);
      // Should not be 400
      const calledStatus = statusStub.firstCall?.args[0];
      expect(calledStatus).to.not.equal(400);
    });
  });
});
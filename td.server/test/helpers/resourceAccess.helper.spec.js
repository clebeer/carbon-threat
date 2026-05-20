import { expect } from 'chai';
import { canAccessOsvScanRun, canAccessJulesSession } from '../../src/helpers/resourceAccess.helper.js';

describe('helpers/resourceAccess.helper.js', () => {

  describe('canAccessOsvScanRun', () => {
    it('returns false if scan is not provided', () => {
      expect(canAccessOsvScanRun(undefined, { id: 1 })).to.be.false;
    });

    it('returns false if user is not provided', () => {
      expect(canAccessOsvScanRun({ created_by: 1 }, undefined)).to.be.false;
    });

    it('returns true if the user role is admin', () => {
      expect(canAccessOsvScanRun({ created_by: 2 }, { id: 1, role: 'admin' })).to.be.true;
    });

    it('returns false if the user id is undefined', () => {
      expect(canAccessOsvScanRun({ created_by: 1 }, { role: 'user' })).to.be.false;
    });

    it('returns false if the user id is null', () => {
      expect(canAccessOsvScanRun({ created_by: 1 }, { id: null, role: 'user' })).to.be.false;
    });

    it('returns false if scan.created_by is undefined', () => {
      expect(canAccessOsvScanRun({}, { id: 1, role: 'user' })).to.be.false;
    });

    it('returns false if scan.created_by is null', () => {
      expect(canAccessOsvScanRun({ created_by: null }, { id: 1, role: 'user' })).to.be.false;
    });

    it('returns false if user is not admin and created_by does not match user id', () => {
      expect(canAccessOsvScanRun({ created_by: 2 }, { id: 1, role: 'user' })).to.be.false;
    });

    it('returns true if created_by matches user id (numbers)', () => {
      expect(canAccessOsvScanRun({ created_by: 1 }, { id: 1, role: 'user' })).to.be.true;
    });

    it('returns true if created_by matches user id (strings)', () => {
      expect(canAccessOsvScanRun({ created_by: '1' }, { id: '1', role: 'user' })).to.be.true;
    });

    it('returns true if created_by matches user id (mixed types)', () => {
      expect(canAccessOsvScanRun({ created_by: 1 }, { id: '1', role: 'user' })).to.be.true;
      expect(canAccessOsvScanRun({ created_by: '1' }, { id: 1, role: 'user' })).to.be.true;
    });
  });

  describe('canAccessJulesSession', () => {
    it('returns false if session is not provided', () => {
      expect(canAccessJulesSession(undefined, { id: 1 })).to.be.false;
    });

    it('returns false if user is not provided', () => {
      expect(canAccessJulesSession({ created_by: 1 }, undefined)).to.be.false;
    });

    it('returns true if the user role is admin', () => {
      expect(canAccessJulesSession({ created_by: 2 }, { id: 1, role: 'admin' })).to.be.true;
    });

    it('returns false if the user id is undefined', () => {
      expect(canAccessJulesSession({ created_by: 1 }, { role: 'user' })).to.be.false;
    });

    it('returns false if the user id is null', () => {
      expect(canAccessJulesSession({ created_by: 1 }, { id: null, role: 'user' })).to.be.false;
    });

    it('returns false if session.created_by is undefined', () => {
      expect(canAccessJulesSession({}, { id: 1, role: 'user' })).to.be.false;
    });

    it('returns false if session.created_by is null', () => {
      expect(canAccessJulesSession({ created_by: null }, { id: 1, role: 'user' })).to.be.false;
    });

    it('returns false if user is not admin and created_by does not match user id', () => {
      expect(canAccessJulesSession({ created_by: 2 }, { id: 1, role: 'user' })).to.be.false;
    });

    it('returns true if created_by matches user id (numbers)', () => {
      expect(canAccessJulesSession({ created_by: 1 }, { id: 1, role: 'user' })).to.be.true;
    });

    it('returns true if created_by matches user id (strings)', () => {
      expect(canAccessJulesSession({ created_by: '1' }, { id: '1', role: 'user' })).to.be.true;
    });

    it('returns true if created_by matches user id (mixed types)', () => {
      expect(canAccessJulesSession({ created_by: 1 }, { id: '1', role: 'user' })).to.be.true;
      expect(canAccessJulesSession({ created_by: '1' }, { id: 1, role: 'user' })).to.be.true;
    });
  });

});

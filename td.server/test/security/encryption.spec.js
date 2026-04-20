/* global describe, it */
import { decryptModel, encryptModel } from '../../src/security/encryption.js';
import { expect } from 'chai';

describe('encryption', () => {
  it('should encrypt and decrypt a model', () => {
    const originalModel = { test: 'data' };
    const encrypted = encryptModel(originalModel);

    expect(encrypted).to.have.property('iv');
    expect(encrypted).to.have.property('encryptedData');
    expect(encrypted).to.have.property('authTag');

    const decrypted = decryptModel(encrypted);
    expect(decrypted).to.deep.equal(originalModel);
  });
});

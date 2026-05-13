import crypto, { createDecipheriv } from 'crypto';
import { expect } from 'chai';
import sinon from 'sinon';

import cryptoPromise from '../../src/helpers/crypto.promise.js';
import encryptionHelper from '../../src/helpers/encryption.helper.js';
import env from '../../src/env/Env.js';

describe('helpers/encryption.helper.js', () => {
    const plainText = 'test plain text';
    const encryptedText = 'encrypted';
    const randomIv = 'test random iv';
    // Keys must be exactly 32 bytes for AES-256
    const key32 = 'a'.repeat(32); // 32 ASCII chars = 32 bytes
    const encryptionKeys = 
    [
        {
            isPrimary: true,
            id: 0,
            value: key32
        },
        {
            isPrimary: false,
            id: 1,
            value: key32
        }
    ];
    const mockDecryptor = {
        update: () => '',
        final: () => ''
    };
    const mockCreateCipheriv = {
        update: () => '',
        final: () => '',
        getAuthTag: () => Buffer.from('fake-auth-tag-16b', 'ascii')
    };

    let mockEnv;

    beforeEach(() => {
        sinon.stub(crypto, 'createDecipheriv').returns(mockDecryptor);
        sinon.stub(crypto, 'createCipheriv').returns(mockCreateCipheriv);
        sinon.stub(cryptoPromise, 'randomBytes').resolves(randomIv);
    });

    describe('with invalid keys', () => {
        beforeEach(() => {
            const badKeys = [
                {
                    isPrimary: false,
                    id: 1,
                    value: 'testkey1'
                }
            ];
            mockEnv = {
                config: {
                    ENCRYPTION_KEYS: JSON.stringify(badKeys)
                }
            };
            sinon.stub(env, 'get').returns(mockEnv);
        });
    
        it('should detect an invalid primary key error and throw', () => {
            expect(() => encryptionHelper.encryptPromise('test plain text')).to.throw();
        });
    });

    describe('with valid encryption keys', () => {
        beforeEach(() => {
            mockEnv = {
                config: {
                    ENCRYPTION_KEYS: JSON.stringify(encryptionKeys)
                }
            };
            sinon.stub(env, 'get').returns(mockEnv);
        });

        it('should detect an invalid key error and throw', () => {
            const encryptedData = {
                keyId: 2,
                iv: 'test iv',
                data: 'test cipher text'
            };
            expect(() => encryptionHelper.decrypt(encryptedData)).to.throw();
        });
        
        it('should decrypt with the specified key and iv', () => {
            const encryptionKey = encryptionKeys.find(x => x.id === 1);
            const encryptedData = {
                keyId: encryptionKey.id,
                iv: 'test iv',
                data: 'test cipher data'
            };

            encryptionHelper.decrypt(encryptedData);

            expect(crypto.createDecipheriv).to.have.been.calledWith(
                'aes256',
                Buffer.from(encryptionKey.value, 'ascii'),
                Buffer.from(encryptedData.iv, 'ascii')
            );
        });
        
        it('should decrypt the ciphertext', () => {
            const encryptedData = {
                keyId: 1,
                iv: 'test iv',
                data: 'test cipher text'
            };

            sinon.stub(mockDecryptor, 'update').returns('');
            sinon.stub(mockDecryptor, 'final').returns(plainText);

            expect(encryptionHelper.decrypt(encryptedData)).to.eq(plainText);
        });
        
        it('should encrypt with the primary key with a random iv (AES-256-GCM)', async () => {
            const encryptionKey = encryptionKeys.find(x => x.isPrimary);

            sinon.stub(mockCreateCipheriv, 'update').returns(Buffer.alloc(0));
            sinon.stub(mockCreateCipheriv, 'final').returns(Buffer.alloc(0));
            
            await encryptionHelper.encryptPromise(plainText);
            expect(crypto.createCipheriv).to.have.been.calledWith(
                'aes-256-gcm',
                Buffer.from(encryptionKey.value, 'ascii'),
                randomIv
            );
        });
        
        it('should attach the key id and IV to the encrypted data', async () => {
            sinon.stub(mockCreateCipheriv, 'update').returns(Buffer.alloc(0));
            sinon.stub(mockCreateCipheriv, 'final').returns(Buffer.alloc(0));

            await encryptionHelper.encryptPromise(plainText);
            expect(mockCreateCipheriv.update).to.have.been.calledWith(
                plainText,
                'utf8'
            );
        });
        
        it('should encrypt the data', async () => {
            const encryptionKey = encryptionKeys.find(x => x.isPrimary);
            sinon.stub(mockCreateCipheriv, 'update').returns(Buffer.from('enc'));
            sinon.stub(mockCreateCipheriv, 'final').returns(Buffer.from('rypt'));

            const res = await encryptionHelper.encryptPromise(plainText);
            expect(res).to.have.property('v', 2);
            expect(res).to.have.property('keyId', encryptionKey.id);
            expect(res).to.have.property('iv');
            expect(res).to.have.property('tag');
            expect(res).to.have.property('data');
        });
    });
});

import crypto from 'crypto';

import cryptoPromise from './crypto.promise.js';
import env from '../env/Env.js';
import loggerHelper from './logger.helper.js';

const logger = loggerHelper.get('helpers/encryption.helper.js');

const inputEncoding = 'utf8';
const outputEncoding = 'base64';
const algorithm = 'aes-256-gcm';

/**
 * Gets the primary key used for encryption
 * @returns {Object}
 */
const getPrimaryKey = () => {
    const keys = JSON.parse(env.get().config.ENCRYPTION_KEYS);
    const primaryKey = keys.find((key) => key.isPrimary);

    if (!primaryKey) {
        const message = 'missing primary encryption key';
        logger.error(message);
        throw new Error(message);
    }

    return {
        id: primaryKey.id,
        value: Buffer.from(primaryKey.value, 'ascii')
    };
};

/**
 * Gets a key by its id
 * Other keys can be used for decryption to support key expiry
 * @param {String} id
 * @returns {Object}
 */
const getKeyById = (id) => {
    const keys = JSON.parse(env.get().config.ENCRYPTION_KEYS);
    const key = keys.find((key) => key.id === id);

    if (!key) {
        const message = `Missing encryption key id: ${id}`;
        logger.error(message);
        throw new Error(message);
    }

    return {
        id: key.id,
        value: Buffer.from(key.value, 'ascii')
    };
};

/**
 * Encrypts plaintext data using the given key and initialization vector
 * @param {String} plainText
 * @param {Object} key
 * @param {String} iv
 * @returns {Object}
 */
const encryptData = (plainText, key, iv) => {
    const encryptor = crypto.createCipheriv(algorithm, key.value, iv);
    let cipherText = encryptor.update(plainText, inputEncoding, outputEncoding);
    cipherText += encryptor.final(outputEncoding);
    const authTag = encryptor.getAuthTag().toString('base64');
    return {
        keyId: key.id,
        iv: iv.toString('hex'),
        data: cipherText,
        authTag
    };
};

/**
 * Decrypts a ciphertext using the given key and initialization vector
 * @param {String} cipherText
 * @param {Object} key
 * @param {String} iv
 * @returns {String}
 */
const decryptData = (cipherText, key, iv, authTag) => {
    const decryptor = crypto.createDecipheriv(algorithm, key.value, iv);
    decryptor.setAuthTag(Buffer.from(authTag, 'base64'));
    const plainText = decryptor.update(cipherText, outputEncoding, inputEncoding);
    return `${plainText}${decryptor.final(inputEncoding)}`;
};

/**
 * Encrypts a plaintext to a ciphertext
 * This uses the configured encryption keys
 * Refer to development/environment.md for more information
 * @param {String} plainText
 * @returns {Promise<Object>}
 */
const encryptPromise = (plainText) => {
    const key = getPrimaryKey();
    logger.debug('Encrypting plaintext');

    return cryptoPromise.randomBytes(12).
        then((iv) => encryptData(plainText, key, iv));
};

/**
 * Decrypts a ciphertext using the configured encryption keys
 * Refer to development/environment.md for more information
 * @param {Object} encryptedData
 * @returns {String}
 */
const decrypt = (encryptedData) => {
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const key = getKeyById(encryptedData.keyId);
    logger.debug('Decrypting ciphertext');

    return decryptData(encryptedData.data, key, iv, encryptedData.authTag);
};

export default {
    decrypt,
    encryptPromise
};

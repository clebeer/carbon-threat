import crypto from 'crypto';

import cryptoPromise from './crypto.promise.js';
import env from '../env/Env.js';
import loggerHelper from './logger.helper.js';

const logger = loggerHelper.get('helpers/encryption.helper.js');

// New encryption: AES-256-GCM (authenticated). Old rows produced with
// the legacy AES-256-CBC path (algorithm 'aes256') are still decryptable
// via the decryptData() fallback below so existing data keeps working.
const GCM_ALGORITHM = 'aes-256-gcm';
const LEGACY_CBC_ALGORITHM = 'aes256';

const GCM_IV_BYTES = 12;
const outputEncoding = 'base64';

/**
 * Load a key entry ({ id, value }) and materialise the raw key bytes.
 * Keys are stored in ENCRYPTION_KEYS as base64 (preferred) or hex.
 * Legacy keys stored as ascii are accepted for backward compatibility.
 */
function materialiseKey(entry) {
    const raw = entry.value;
    if (!raw) {throw new Error(`Encryption key ${entry.id} has no value`);}

    // Accept base64, hex, or ascii — pick the first encoding that yields 32 bytes.
    for (const enc of ['base64', 'hex', 'ascii']) {
        try {
            const buf = Buffer.from(raw, enc);
            if (buf.length === 32) {return { id: entry.id, value: buf, encoding: enc };}
        } catch {
            // try next
        }
    }
    throw new Error(`Encryption key ${entry.id} must decode to exactly 32 bytes (base64/hex/ascii)`);
}

const getPrimaryKey = () => {
    const keys = JSON.parse(env.get().config.ENCRYPTION_KEYS);
    const primaryKey = keys.find((key) => key.isPrimary);

    if (!primaryKey) {
        const message = 'missing primary encryption key';
        logger.error(message);
        throw new Error(message);
    }

    return materialiseKey(primaryKey);
};

const getKeyById = (id) => {
    const keys = JSON.parse(env.get().config.ENCRYPTION_KEYS);
    const key = keys.find((k) => k.id === id);

    if (!key) {
        const message = `Missing encryption key id: ${id}`;
        logger.error(message);
        throw new Error(message);
    }

    return materialiseKey(key);
};

/**
 * Encrypt with AES-256-GCM. Produces an object carrying the 12-byte IV and
 * 16-byte auth tag alongside the ciphertext, plus a version marker so the
 * decrypt path can distinguish GCM payloads from legacy CBC ones.
 */
const encryptData = (plainText, key, iv) => {
    const cipher = crypto.createCipheriv(GCM_ALGORITHM, key.value, iv);
    const ciphertext = Buffer.concat([
        cipher.update(plainText, 'utf8'),
        cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return {
        v: 2,                                  // version: GCM
        keyId: key.id,
        iv: iv.toString(outputEncoding),
        tag: authTag.toString(outputEncoding),
        data: ciphertext.toString(outputEncoding),
    };
};

const decryptData = (encryptedData) => {
    const key = getKeyById(encryptedData.keyId);

    // v2 = AES-256-GCM
    if (encryptedData.v === 2 && encryptedData.tag) {
        const iv = Buffer.from(encryptedData.iv, outputEncoding);
        const tag = Buffer.from(encryptedData.tag, outputEncoding);
        const decipher = crypto.createDecipheriv(GCM_ALGORITHM, key.value, iv);
        decipher.setAuthTag(tag);
        const plain = Buffer.concat([
            decipher.update(Buffer.from(encryptedData.data, outputEncoding)),
            decipher.final(),
        ]);
        return plain.toString('utf8');
    }

    // Legacy path: AES-256-CBC produced by the previous 'aes256' implementation.
    // IV and data were stored as ascii/base64 strings without an auth tag.
    const iv = Buffer.from(encryptedData.iv, 'ascii');
    const decryptor = crypto.createDecipheriv(LEGACY_CBC_ALGORITHM, key.value, iv);
    const plain = decryptor.update(encryptedData.data, outputEncoding, 'ascii');
    return `${plain}${decryptor.final('ascii')}`;
};

const encryptPromise = (plainText) => {
    const key = getPrimaryKey();
    logger.debug('Encrypting plaintext (AES-256-GCM)');

    return cryptoPromise.randomBytes(GCM_IV_BYTES).
        then((iv) => encryptData(plainText, key, iv));
};

const decrypt = (encryptedData) => {
    logger.debug('Decrypting ciphertext');
    return decryptData(encryptedData);
};

export default {
    decrypt,
    encryptPromise
};

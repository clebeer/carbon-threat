import fs from 'fs';
import jsonwebtoken from 'jsonwebtoken';

import encryptionHelper from './encryption.helper.js';
import env from '../env/Env.js';

/**
 * SECURITY FIX (FIX-3): Support RS256 asymmetric JWT signing.
 *
 * If JWT_RSA_PRIVATE_KEY_PATH and JWT_RSA_PUBLIC_KEY_PATH are configured,
 * RS256 is used for signing/verification. Otherwise, falls back to HS256
 * with the existing ENCRYPTION_JWT_SIGNING_KEY for backward compatibility.
 *
 * To enable RS256, set environment variables:
 *   JWT_RSA_PRIVATE_KEY_PATH=/path/to/private.pem
 *   JWT_RSA_PUBLIC_KEY_PATH=/path/to/public.pem
 */

let privateKey = null;
let publicKey = null;
let refreshPrivateKey = null;
let refreshPublicKey = null;

try {
    const privPath = process.env.JWT_RSA_PRIVATE_KEY_PATH;
    const pubPath = process.env.JWT_RSA_PUBLIC_KEY_PATH;
    if (privPath && pubPath && fs.existsSync(privPath) && fs.existsSync(pubPath)) {
        privateKey = fs.readFileSync(privPath, 'utf8');
        publicKey = fs.readFileSync(pubPath, 'utf8');
    }
} catch {
    // RSA keys not available — will use HS256 fallback
}

try {
    const refreshPrivPath = process.env.JWT_RSA_REFRESH_PRIVATE_KEY_PATH;
    const refreshPubPath = process.env.JWT_RSA_REFRESH_PUBLIC_KEY_PATH;
    if (refreshPrivPath && refreshPubPath && fs.existsSync(refreshPrivPath) && fs.existsSync(refreshPubPath)) {
        refreshPrivateKey = fs.readFileSync(refreshPrivPath, 'utf8');
        refreshPublicKey = fs.readFileSync(refreshPubPath, 'utf8');
    }
} catch {
    // RSA refresh keys not available — will use HS256 fallback
}

/**
 * Get signing options for access token.
 * Uses RS256 if RSA keys are configured, otherwise HS256.
 */
function getAccessSignOptions() {
    if (privateKey) {
        return { algorithm: 'RS256', expiresIn: '1d', keyid: 'ct-access' };
    }
    return { algorithm: 'HS256', expiresIn: '1d' };
}

function getRefreshSignOptions() {
    if (refreshPrivateKey || privateKey) {
        return { algorithm: 'RS256', expiresIn: '7d', keyid: 'ct-refresh' };
    }
    return { algorithm: 'HS256', expiresIn: '7d' };
}

function getAccessSecret() {
    return privateKey || env.get().config.ENCRYPTION_JWT_SIGNING_KEY;
}

function getRefreshSecret() {
    return refreshPrivateKey || privateKey || env.get().config.ENCRYPTION_JWT_REFRESH_SIGNING_KEY;
}

function getAccessVerifyKey() {
    return publicKey || env.get().config.ENCRYPTION_JWT_SIGNING_KEY;
}

function getRefreshVerifyKey() {
    return refreshPublicKey || publicKey || env.get().config.ENCRYPTION_JWT_REFRESH_SIGNING_KEY;
}

const createAsync = async (providerName, providerOptions, user) => {
    const encryptedProviderOptions = await encryptionHelper.encryptPromise(JSON.stringify(providerOptions));
    const providerOptsEncoded = Buffer.from(JSON.stringify(encryptedProviderOptions)).toString('base64');
    const provider = {
        [providerName]: providerOptsEncoded
    };

    const accessToken = jsonwebtoken.sign(
        { provider, user },
        getAccessSecret(),
        getAccessSignOptions()
    );

    const refreshToken = jsonwebtoken.sign(
        { provider, user },
        getRefreshSecret(),
        getRefreshSignOptions()
    );

    return { accessToken, refreshToken };
};

const decodeProvider = (encodedProvider) => {
    const providerName = Object.keys(encodedProvider)[0];
    const decodedProvider = JSON.parse(Buffer.from(encodedProvider[providerName], 'base64').toString('utf-8'));
    const provider = JSON.parse(encryptionHelper.decrypt(decodedProvider));
    provider.name = providerName;
    return provider;
};

const decode = (token, key) => {
    const algorithms = privateKey ? ['RS256'] : ['HS256'];
    const { provider, user } = jsonwebtoken.verify(token, key, { algorithms });
    const decodedProvider = decodeProvider(provider);
    return {
        provider: decodedProvider,
        user
    };
};

const verifyToken = (token) => decode(token, getAccessVerifyKey());

const verifyRefresh = (token) => decode(token, getRefreshVerifyKey());


export default {
    createAsync,
    verifyToken,
    verifyRefresh
};

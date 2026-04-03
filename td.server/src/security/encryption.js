import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';

if (!process.env.ENCRYPTION_KEY) {
  throw new Error(
    'ENCRYPTION_KEY environment variable is required. ' +
    'Generate with: openssl rand -hex 32'
  );
}

// Key must decode to exactly 32 bytes (64 hex chars)
const keyBuffer = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
if (keyBuffer.length !== 32) {
  throw new Error(
    `ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ` +
    `Got ${process.env.ENCRYPTION_KEY.length} chars. ` +
    'Generate with: openssl rand -hex 32'
  );
}

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

export function encryptModel(modelData) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  
  let encrypted = cipher.update(JSON.stringify(modelData), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return {
    iv: iv.toString('hex'),
    encryptedData: encrypted,
    authTag: authTag
  };
}

export function decryptModel(encryptedPayload) {
  const { iv, encryptedData, authTag } = encryptedPayload;
  
  const decipher = crypto.createDecipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(authTag, 'hex'));
  
  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return JSON.parse(decrypted);
}

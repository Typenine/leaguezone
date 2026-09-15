import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';

function getEncryptionSecret(): string {
  const secret = process.env.PROVIDER_TOKEN_ENCRYPTION_KEY?.trim() || '';
  if (secret.length < 32) {
    throw new Error('PROVIDER_TOKEN_ENCRYPTION_KEY must be at least 32 characters.');
  }
  return secret;
}

function getKey(): Buffer {
  return createHash('sha256').update(getEncryptionSecret(), 'utf8').digest();
}

export function providerTokenEncryptionConfigured(): boolean {
  return (process.env.PROVIDER_TOKEN_ENCRYPTION_KEY?.trim().length || 0) >= 32;
}

export function encryptProviderToken(value: string): string {
  if (!value) throw new Error('Cannot encrypt an empty provider token.');

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    VERSION,
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':');
}

export function decryptProviderToken(value: string): string {
  const [version, ivEncoded, tagEncoded, encryptedEncoded] = value.split(':');
  if (version !== VERSION || !ivEncoded || !tagEncoded || !encryptedEncoded) {
    throw new Error('Unsupported provider token format.');
  }

  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivEncoded, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagEncoded, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedEncoded, 'base64url')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

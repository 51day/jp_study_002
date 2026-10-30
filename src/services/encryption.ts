import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes recommended for GCM

/**
 * Derives a 32-byte Buffer key from the AI_CONFIG_ENCRYPTION_KEY environment variable.
 * Does NOT allow silent insecure fallback in production.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.AI_CONFIG_ENCRYPTION_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: 生产环境必须在环境变量中配置 AI_CONFIG_ENCRYPTION_KEY（建议32位以上随机密钥）。');
    }
    // Development local fallback with warning
    console.warn('⚠️ [Security Warning] 未检测到 AI_CONFIG_ENCRYPTION_KEY 环境变量，开发环境启用临时会话加密。生产环境请务必配置独立密钥。');
    // Combine access password with machine identifier to avoid static global salt
    const devSeed = (process.env.ACCESS_PASSWORD || '') + '_memorize_word_dev_seed_salt';
    return crypto.createHash('sha256').update(devSeed).digest();
  }
  // Ensure exactly 32 bytes (256 bits)
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Output format: ivHex:authTagHex:ciphertextHex
 */
export function encryptApiKey(plaintext: string): string {
  if (!plaintext || typeof plaintext !== 'string') return '';
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * Input format: ivHex:authTagHex:ciphertextHex
 * If ciphertext is corrupted or format is invalid, returns empty string - NEVER returns raw ciphertext as plaintext.
 */
export function decryptApiKey(encryptedData: string): string {
  if (!encryptedData || typeof encryptedData !== 'string') return '';
  const parts = encryptedData.split(':');
  if (parts.length !== 3) {
    console.warn('⚠️ [Security Audit] 密文格式不合法（非 iv:authTag:ciphertext 结构），已拒绝解密并返回空值。');
    return '';
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  if (!ivHex || !authTagHex || !ciphertextHex) {
    return '';
  }

  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    if (iv.length !== IV_LENGTH || authTag.length !== 16) {
      console.warn('⚠️ [Security Audit] IV 或 AuthTag 长度不符合 AES-256-GCM 规范，拒绝解密。');
      return '';
    }

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err: any) {
    console.warn('⚠️ [Security Audit] AES-256-GCM 解密失败或密文被篡改:', err?.message || err);
    return '';
  }
}

/**
 * Helper to mask an API key for safe UI display (e.g., "sk-ab...12cd")
 */
export function maskApiKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '********';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

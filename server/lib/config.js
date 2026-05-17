import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = resolve(__dirname, '../../config.json');
const KEY_PATH = resolve(__dirname, '../../data/.enc_key');

const ALGO = 'aes-256-gcm';
const IV_LEN = 16;
const AUTH_TAG_LEN = 16;

function getEncryptionKey() {
  if (existsSync(KEY_PATH)) {
    return Buffer.from(readFileSync(KEY_PATH, 'utf-8').trim(), 'hex');
  }
  const key = randomBytes(32);
  const dir = dirname(KEY_PATH);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(KEY_PATH, key.toString('hex'), 'utf-8');
  return key;
}

function encrypt(text) {
  if (!text) return text;
  try {
    const key = getEncryptionKey();
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf-8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `enc:${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  } catch {
    return text;
  }
}

function decrypt(text) {
  if (!text || !text.startsWith('enc:')) return text;
  try {
    const parts = text.split(':');
    if (parts.length !== 4) return text;
    const key = getEncryptionKey();
    const iv = Buffer.from(parts[1], 'hex');
    const authTag = Buffer.from(parts[2], 'hex');
    const encrypted = Buffer.from(parts[3], 'hex');
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf-8');
  } catch {
    return '';
  }
}

const PROJECT_ROOT = resolve(__dirname, '../..');

const DEFAULT_CONFIG = {
  cookie: '',
  downloadPath: resolve(PROJECT_ROOT, 'downloads'),
  concurrency: 3,
  audioFormat: 'mp3'
};

function ensureConfig() {
  if (!existsSync(CONFIG_PATH)) {
    writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
  }
}

function resolveDownloadPath(p) {
  if (!p) return DEFAULT_CONFIG.downloadPath;
  return resolve(p) === p ? p : resolve(PROJECT_ROOT, p);
}

export function getConfig() {
  ensureConfig();
  const raw = readFileSync(CONFIG_PATH, 'utf-8');
  const parsed = JSON.parse(raw);
  return {
    ...DEFAULT_CONFIG,
    ...parsed,
    downloadPath: resolveDownloadPath(parsed.downloadPath),
    cookie: decrypt(parsed.cookie || '')
  };
}

export function updateConfig(partial) {
  const current = getConfig();
  const merged = { ...current, ...partial };
  if (merged.cookie) {
    merged.cookie = encrypt(merged.cookie);
  }
  const toSave = { ...merged };
  writeFileSync(CONFIG_PATH, JSON.stringify(toSave, null, 2), 'utf-8');
  merged.cookie = decrypt(merged.cookie);
  return merged;
}

export function getCookie() {
  return getConfig().cookie;
}

import dotenv from 'dotenv';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { encryptApiKey, decryptApiKey, maskApiKey } from './encryption.js';
import { mergeLearningPayload } from './syncEngine.js';
import type { LearningSyncPayload } from '../types/index.js';

// 必须在 new DatabaseService() 之前加载 .env，否则 pool 初始化时读不到 DATABASE_URL
// （server.ts 顶部的 import 会先于其 dotenv.config() 执行，故在此处补加载）
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FALLBACK_CONFIG_PATH = path.resolve(__dirname, '../../public/data/ai_config_fallback.json');

export interface StoredAiConfig {
  activeProvider: 'gemini' | 'deepseek' | 'openai' | 'custom';
  geminiApiKeyEncrypted?: string;
  geminiModel: string;
  deepseekApiKeyEncrypted?: string;
  deepseekModel: string;
  openaiApiKeyEncrypted?: string;
  openaiModel: string;
  customBaseUrl?: string;
  customApiKeyEncrypted?: string;
  customModel: string;
  updatedAt: number;
}

export interface ClientAiConfigView {
  activeProvider: 'gemini' | 'deepseek' | 'openai' | 'custom';
  geminiKeyMasked: string;
  geminiConfigured: boolean;
  geminiModel: string;
  deepseekKeyMasked: string;
  deepseekConfigured: boolean;
  deepseekModel: string;
  openaiKeyMasked: string;
  openaiConfigured: boolean;
  openaiModel: string;
  customBaseUrl: string;
  customKeyMasked: string;
  customConfigured: boolean;
  customModel: string;
  dbConnected: boolean;
  updatedAt: number;
}

const DEFAULT_CONFIG: StoredAiConfig = {
  activeProvider: 'gemini',
  geminiModel: 'gemini-3.8-flash',
  deepseekModel: 'deepseek-chat',
  openaiModel: 'gpt-4o-mini',
  customBaseUrl: 'https://api.openai.com/v1',
  customModel: 'gpt-4o-mini',
  updatedAt: Date.now(),
};

class DatabaseService {
  private pool: pg.Pool | null = null;
  private isInitialized = false;
  private isSyncSchemaInitialized = false;

  constructor() {
    this.initPool();
  }

  private initPool() {
    const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
    if (connectionString) {
      this.pool = new pg.Pool({
        connectionString,
        max: 2, // Keep small for Serverless environments
        ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false },
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 15000,
      });
    } else {
      this.pool = null;
    }
  }

  public isDbAvailable(): boolean {
    return !!this.pool;
  }

  public async ensureSchema(): Promise<boolean> {
    if (!this.pool || this.isInitialized) return this.isInitialized;

    try {
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS user_ai_configs (
          id VARCHAR(64) PRIMARY KEY,
          active_provider VARCHAR(32) NOT NULL DEFAULT 'gemini',
          gemini_api_key TEXT,
          gemini_model VARCHAR(64) DEFAULT 'gemini-3.8-flash',
          deepseek_api_key TEXT,
          deepseek_model VARCHAR(64) DEFAULT 'deepseek-chat',
          openai_api_key TEXT,
          openai_model VARCHAR(64) DEFAULT 'gpt-4o-mini',
          custom_base_url TEXT,
          custom_api_key TEXT,
          custom_model VARCHAR(64) DEFAULT 'gpt-4o-mini',
          updated_at BIGINT NOT NULL
        );
      `);
      this.isInitialized = true;
      return true;
    } catch (err) {
      console.warn('PostgreSQL table initialization warning (will fallback to local cache):', err);
      return false;
    }
  }

  /* =======================================================================
   * Cloud Sync: app_universal_sync 表与读写方法
   * 设计：单表 JSONB 存储 + namespace 复用，支持跨设备按时间戳合并。
   * 铁律：不影响 user_ai_configs 表；DB 不可用时必须抛错给上层，返回 503/500。
   * ======================================================================= */

  private async ensureSyncSchema(): Promise<void> {
    if (!this.pool || this.isSyncSchemaInitialized) return;
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS app_universal_sync (
        namespace VARCHAR(64) NOT NULL DEFAULT 'memorize_word',
        owner_id VARCHAR(64) NOT NULL DEFAULT 'default_owner',
        sync_version BIGINT NOT NULL DEFAULT 1,
        state_data JSONB NOT NULL DEFAULT '{}'::jsonb,
        updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
        PRIMARY KEY (namespace, owner_id)
      );
    `);
    this.isSyncSchemaInitialized = true;
  }

  /**
   * 读取云端同步状态。若无记录返回 exists:false。
   * 若 pool 不存在抛出 'DATABASE_NOT_CONFIGURED'。
   */
  public async getSyncState(
    namespace = 'memorize_word'
  ): Promise<{ exists: boolean; syncVersion: number; stateData: LearningSyncPayload | null; updatedAt: number | null }> {
    if (!this.pool) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }
    await this.ensureSyncSchema();
    const res = await this.pool.query(
      'SELECT sync_version, state_data, updated_at FROM app_universal_sync WHERE namespace = $1 AND owner_id = $2',
      [namespace, 'default_owner']
    );
    if (res.rows.length === 0) {
      return { exists: false, syncVersion: 0, stateData: null, updatedAt: null };
    }
    const row = res.rows[0];
    return {
      exists: true,
      syncVersion: Number(row.sync_version) || 0,
      stateData: row.state_data as LearningSyncPayload,
      updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : null,
    };
  }

  /**
   * 保存同步状态。
   *  - 使用事务 + SELECT ... FOR UPDATE 防并发覆盖。
   *  - 若云端已有记录且 !forceOverwrite，调用 mergeLearningPayload 与云端数据合并。
   *  - 否则直接使用 incomingData（forceOverwrite 模式：导入/恢复后强推）。
   *  - sync_version + 1。
   */
  public async saveSyncState(
    incomingData: LearningSyncPayload,
    forceOverwrite = false,
    namespace = 'memorize_word'
  ): Promise<{ syncVersion: number; stateData: LearningSyncPayload; updatedAt: number }> {
    if (!this.pool) {
      throw new Error('DATABASE_NOT_CONFIGURED');
    }
    await this.ensureSyncSchema();

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // 行级锁，防止并发写覆盖
      const lockRes = await client.query(
        'SELECT sync_version, state_data, updated_at FROM app_universal_sync WHERE namespace = $1 AND owner_id = $2 FOR UPDATE',
        [namespace, 'default_owner']
      );

      let finalData: LearningSyncPayload;
      let nextVersion: number;

      if (lockRes.rows.length === 0) {
        finalData = incomingData;
        nextVersion = 1;
      } else {
        const existing = lockRes.rows[0];
        if (forceOverwrite) {
          finalData = incomingData;
        } else {
          // 本地（设备推送的 payload）与云端合并：local=incoming, remote=cloud
          finalData = mergeLearningPayload(incomingData, existing.state_data as LearningSyncPayload);
        }
        nextVersion = Number(existing.sync_version) + 1;
      }

      await client.query(
        `
        INSERT INTO app_universal_sync (namespace, owner_id, sync_version, state_data, updated_at)
        VALUES ($1, $2, $3, $4, NOW())
        ON CONFLICT (namespace, owner_id) DO UPDATE SET
          sync_version = EXCLUDED.sync_version,
          state_data = EXCLUDED.state_data,
          updated_at = EXCLUDED.updated_at
        `,
        [namespace, 'default_owner', nextVersion, JSON.stringify(finalData)]
      );

      await client.query('COMMIT');

      // 读取真实 updated_at
      const tsRes = await client.query(
        'SELECT updated_at FROM app_universal_sync WHERE namespace = $1 AND owner_id = $2',
        [namespace, 'default_owner']
      );
      const updatedAt = tsRes.rows[0]?.updated_at ? new Date(tsRes.rows[0].updated_at).getTime() : Date.now();

      return { syncVersion: nextVersion, stateData: finalData, updatedAt };
    } catch (err) {
      try {
        await client.query('ROLLBACK');
      } catch {
        /* ignore */
      }
      throw err;
    } finally {
      client.release();
    }
  }

  // Read raw fallback config if PostgreSQL is not available
  private readFallback(): StoredAiConfig {
    try {
      if (fs.existsSync(FALLBACK_CONFIG_PATH)) {
        const content = fs.readFileSync(FALLBACK_CONFIG_PATH, 'utf-8');
        return { ...DEFAULT_CONFIG, ...JSON.parse(content) };
      }
    } catch {
      // Ignore
    }
    return DEFAULT_CONFIG;
  }

  private writeFallback(config: StoredAiConfig) {
    try {
      const dir = path.dirname(FALLBACK_CONFIG_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(FALLBACK_CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
    } catch (e) {
      console.warn('Failed to write fallback config', e);
    }
  }

  public async getConfig(): Promise<StoredAiConfig> {
    if (this.pool) {
      try {
        await this.ensureSchema();
        const res = await this.pool.query('SELECT * FROM user_ai_configs WHERE id = $1', ['global_default']);
        if (res.rows.length > 0) {
          const row = res.rows[0];
          return {
            activeProvider: row.active_provider || 'gemini',
            geminiApiKeyEncrypted: row.gemini_api_key || '',
            geminiModel: row.gemini_model || 'gemini-3.8-flash',
            deepseekApiKeyEncrypted: row.deepseek_api_key || '',
            deepseekModel: row.deepseek_model || 'deepseek-chat',
            openaiApiKeyEncrypted: row.openai_api_key || '',
            openaiModel: row.openai_model || 'gpt-4o-mini',
            customBaseUrl: row.custom_base_url || 'https://api.openai.com/v1',
            customApiKeyEncrypted: row.custom_api_key || '',
            customModel: row.custom_model || 'gpt-4o-mini',
            updatedAt: Number(row.updated_at) || Date.now(),
          };
        }
      } catch (err) {
        console.warn('Failed to query PostgreSQL, using fallback config:', err);
      }
    }
    return this.readFallback();
  }

  public async saveConfig(delta: {
    activeProvider?: 'gemini' | 'deepseek' | 'openai' | 'custom';
    geminiApiKey?: string;
    geminiApiKeyPlain?: string;
    geminiModel?: string;
    deepseekApiKey?: string;
    deepseekApiKeyPlain?: string;
    deepseekModel?: string;
    openaiApiKey?: string;
    openaiApiKeyPlain?: string;
    openaiModel?: string;
    customBaseUrl?: string;
    customApiKey?: string;
    customApiKeyPlain?: string;
    customModel?: string;
  }): Promise<StoredAiConfig> {
    const current = await this.getConfig();

    const updated: StoredAiConfig = {
      ...current,
      activeProvider: delta.activeProvider || current.activeProvider,
      geminiModel: delta.geminiModel || current.geminiModel,
      deepseekModel: delta.deepseekModel || current.deepseekModel,
      openaiModel: delta.openaiModel || current.openaiModel,
      customBaseUrl: delta.customBaseUrl !== undefined ? delta.customBaseUrl : current.customBaseUrl,
      customModel: delta.customModel || current.customModel,
      updatedAt: Date.now(),
    };

    const gKey = delta.geminiApiKeyPlain !== undefined ? delta.geminiApiKeyPlain : delta.geminiApiKey;
    if (gKey !== undefined) {
      updated.geminiApiKeyEncrypted = gKey ? encryptApiKey(gKey) : '';
    }

    const dKey = delta.deepseekApiKeyPlain !== undefined ? delta.deepseekApiKeyPlain : delta.deepseekApiKey;
    if (dKey !== undefined) {
      updated.deepseekApiKeyEncrypted = dKey ? encryptApiKey(dKey) : '';
    }

    const oKey = delta.openaiApiKeyPlain !== undefined ? delta.openaiApiKeyPlain : delta.openaiApiKey;
    if (oKey !== undefined) {
      updated.openaiApiKeyEncrypted = oKey ? encryptApiKey(oKey) : '';
    }

    const cKey = delta.customApiKeyPlain !== undefined ? delta.customApiKeyPlain : delta.customApiKey;
    if (cKey !== undefined) {
      updated.customApiKeyEncrypted = cKey ? encryptApiKey(cKey) : '';
    }

    if (this.pool) {
      try {
        await this.ensureSchema();
        await this.pool.query(
          `
          INSERT INTO user_ai_configs (
            id, active_provider, gemini_api_key, gemini_model,
            deepseek_api_key, deepseek_model, openai_api_key, openai_model,
            custom_base_url, custom_api_key, custom_model, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO UPDATE SET
            active_provider = EXCLUDED.active_provider,
            gemini_api_key = EXCLUDED.gemini_api_key,
            gemini_model = EXCLUDED.gemini_model,
            deepseek_api_key = EXCLUDED.deepseek_api_key,
            deepseek_model = EXCLUDED.deepseek_model,
            openai_api_key = EXCLUDED.openai_api_key,
            openai_model = EXCLUDED.openai_model,
            custom_base_url = EXCLUDED.custom_base_url,
            custom_api_key = EXCLUDED.custom_api_key,
            custom_model = EXCLUDED.custom_model,
            updated_at = EXCLUDED.updated_at
          `,
          [
            'global_default',
            updated.activeProvider,
            updated.geminiApiKeyEncrypted || '',
            updated.geminiModel,
            updated.deepseekApiKeyEncrypted || '',
            updated.deepseekModel,
            updated.openaiApiKeyEncrypted || '',
            updated.openaiModel,
            updated.customBaseUrl || '',
            updated.customApiKeyEncrypted || '',
            updated.customModel,
            updated.updatedAt,
          ]
        );
      } catch (err) {
        console.warn('Failed to persist to PostgreSQL, saving to fallback:', err);
        this.writeFallback(updated);
      }
    } else {
      this.writeFallback(updated);
    }

    return updated;
  }

  // Returns safe masked representation for frontend UI
  public async getClientView(): Promise<ClientAiConfigView> {
    const config = await this.getConfig();
    const envGemini = process.env.GEMINI_API_KEY || '';

    // Resolve Gemini status
    const geminiDecrypted = config.geminiApiKeyEncrypted ? decryptApiKey(config.geminiApiKeyEncrypted) : envGemini;
    const deepseekDecrypted = config.deepseekApiKeyEncrypted ? decryptApiKey(config.deepseekApiKeyEncrypted) : (process.env.DEEPSEEK_API_KEY || '');
    const openaiDecrypted = config.openaiApiKeyEncrypted ? decryptApiKey(config.openaiApiKeyEncrypted) : (process.env.OPENAI_API_KEY || '');
    const customDecrypted = config.customApiKeyEncrypted ? decryptApiKey(config.customApiKeyEncrypted) : '';

    return {
      activeProvider: config.activeProvider,
      geminiKeyMasked: maskApiKey(geminiDecrypted),
      geminiConfigured: !!geminiDecrypted,
      geminiModel: config.geminiModel,
      deepseekKeyMasked: maskApiKey(deepseekDecrypted),
      deepseekConfigured: !!deepseekDecrypted,
      deepseekModel: config.deepseekModel,
      openaiKeyMasked: maskApiKey(openaiDecrypted),
      openaiConfigured: !!openaiDecrypted,
      openaiModel: config.openaiModel,
      customBaseUrl: config.customBaseUrl || 'https://api.openai.com/v1',
      customKeyMasked: maskApiKey(customDecrypted),
      customConfigured: !!customDecrypted,
      customModel: config.customModel,
      dbConnected: !!this.pool,
      updatedAt: config.updatedAt,
    };
  }

  // Returns decrypted credentials for server-side AI execution
  public async getResolvedCredentials(targetProvider?: 'gemini' | 'deepseek' | 'openai' | 'custom'): Promise<{
    provider: 'gemini' | 'deepseek' | 'openai' | 'custom';
    apiKey: string;
    baseURL?: string;
    modelName: string;
  }> {
    const config = await this.getConfig();
    const provider = targetProvider || config.activeProvider || 'gemini';

    if (provider === 'deepseek') {
      const apiKey = config.deepseekApiKeyEncrypted
        ? decryptApiKey(config.deepseekApiKeyEncrypted)
        : (process.env.DEEPSEEK_API_KEY || '');
      return {
        provider: 'deepseek',
        apiKey,
        modelName: config.deepseekModel || 'deepseek-chat',
      };
    }

    if (provider === 'openai') {
      const apiKey = config.openaiApiKeyEncrypted
        ? decryptApiKey(config.openaiApiKeyEncrypted)
        : (process.env.OPENAI_API_KEY || '');
      return {
        provider: 'openai',
        apiKey,
        modelName: config.openaiModel || 'gpt-4o-mini',
      };
    }

    if (provider === 'custom') {
      const apiKey = config.customApiKeyEncrypted ? decryptApiKey(config.customApiKeyEncrypted) : '';
      return {
        provider: 'custom',
        apiKey,
        baseURL: config.customBaseUrl || 'https://api.openai.com/v1',
        modelName: config.customModel || 'gpt-4o-mini',
      };
    }

    // Default: Gemini
    const apiKey = config.geminiApiKeyEncrypted
      ? decryptApiKey(config.geminiApiKeyEncrypted)
      : (process.env.GEMINI_API_KEY || '');

    return {
      provider: 'gemini',
      apiKey,
      modelName: config.geminiModel || 'gemini-3.8-flash',
    };
  }
}

export const dbService = new DatabaseService();

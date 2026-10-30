import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

import crypto from 'crypto';
import { dbService } from './src/services/db.js';
import { executeAiChat } from './src/services/aiRunner.js';

dotenv.config();


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
// 本地默认 3000；部署到容器/自建服务器时可通过 PORT 覆盖
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

app.use(express.json({ limit: '20mb' }));

// Auth & Session Configuration
const SESSION_COOKIE_NAME = 'auth_session';
const SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60; // 30 days
const isProduction = process.env.NODE_ENV === 'production' || !!process.env.VERCEL;

// Helper to parse cookies from header
function parseCookies(cookieHeader?: string): Record<string, string> {
  const map: Record<string, string> = {};
  if (!cookieHeader) return map;
  cookieHeader.split(';').forEach((item) => {
    const parts = item.split('=');
    const key = parts[0]?.trim();
    if (key) {
      map[key] = decodeURIComponent(parts.slice(1).join('=').trim());
    }
  });
  return map;
}

// Generate deterministic secret key from ACCESS_PASSWORD
function getSecretKey(): string {
  const pwd = process.env.ACCESS_PASSWORD || 'memorize_word_default_dev_secret';
  return crypto.createHash('sha256').update(`memorize_word_auth_v1_${pwd}`).digest('hex');
}

// Sign an HMAC-SHA256 session token
function createSessionToken(): string {
  const now = Date.now();
  const payload = JSON.stringify({
    iat: now,
    exp: now + SESSION_MAX_AGE_SEC * 1000,
  });
  const b64Payload = Buffer.from(payload).toString('base64url');
  const signature = crypto.createHmac('sha256', getSecretKey()).update(b64Payload).digest('base64url');
  return `${b64Payload}.${signature}`;
}

// Verify HMAC session token
function verifySessionToken(token: string): boolean {
  if (!token || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [b64Payload, signature] = parts;

  const expectedSig = crypto.createHmac('sha256', getSecretKey()).update(b64Payload).digest('base64url');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);

  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return false;
  }

  try {
    const payload = JSON.parse(Buffer.from(b64Payload, 'base64url').toString('utf8'));
    if (!payload.exp || Date.now() > payload.exp) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// Extract session token from Cookie or Bearer authorization header
function extractToken(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  const cookies = parseCookies(req.headers.cookie);
  if (cookies[SESSION_COOKIE_NAME]) {
    return cookies[SESSION_COOKIE_NAME];
  }
  return null;
}

// Global Auth Middleware - Protects all /api/* routes except login and auth status
app.use((req, res, next) => {
  if (!req.path.startsWith('/api')) {
    return next();
  }

  // Exempt auth status and login
  if (req.path === '/api/login' || req.path === '/api/auth/status') {
    return next();
  }

  const accessPassword = process.env.ACCESS_PASSWORD;

  // Strict production check: Fail closed if ACCESS_PASSWORD is not configured in production
  if (isProduction && !accessPassword) {
    return res.status(503).json({
      error: '服务端未配置 ACCESS_PASSWORD 访问密码环境变量，所有受保护请求已拒绝。',
      code: 'PASSWORD_NOT_CONFIGURED',
    });
  }

  // If in dev and no password set, also require setting it in .env
  if (!accessPassword) {
    return res.status(401).json({
      error: '开发环境尚未在 .env 中设置 ACCESS_PASSWORD 访问密码。',
      code: 'AUTH_REQUIRED',
    });
  }

  const token = extractToken(req);
  if (!token || !verifySessionToken(token)) {
    return res.status(401).json({
      error: '未授权或登录已过期，请验证全局访问密码',
      code: 'AUTH_REQUIRED',
    });
  }

  next();
});

// Auth Route 1: Check authentication status and get server WebDAV preset capabilities
app.get('/api/auth/status', (req, res) => {
  const accessPassword = process.env.ACCESS_PASSWORD;
  const isConfigured = !!accessPassword;
  const token = extractToken(req);
  const isAuthenticated = isConfigured && token ? verifySessionToken(token) : false;

  const webdavConfigured = !!(
    process.env.WEBDAV_SERVER_URL &&
    process.env.WEBDAV_USERNAME &&
    process.env.WEBDAV_PASSWORD
  );

  return res.json({
    authenticated: isAuthenticated,
    requiresPassword: isConfigured,
    isProduction,
    webdavConfigured,
    webdavPreset: isAuthenticated && webdavConfigured ? {
      serverUrl: process.env.WEBDAV_SERVER_URL || '',
      username: process.env.WEBDAV_USERNAME || '',
      remotePath: process.env.WEBDAV_REMOTE_PATH || '/MemorizeWord/memorize_word_backup.json',
    } : undefined,
  });
});

// Auth Route 2: Login with global access password and establish 30-day session
app.post('/api/login', (req, res) => {
  const expectedPassword = process.env.ACCESS_PASSWORD;

  if (!expectedPassword) {
    return res.status(503).json({
      error: isProduction
        ? '服务端未在环境变量中配置 ACCESS_PASSWORD，请联系管理员配置。'
        : '请在项目根目录 .env 文件中添加 ACCESS_PASSWORD=你的访问密码 后重启。',
      code: 'PASSWORD_NOT_CONFIGURED',
    });
  }

  const { password } = req.body || {};
  if (typeof password !== 'string' || !password) {
    return res.status(400).json({ error: '请输入访问密码', code: 'PASSWORD_REQUIRED' });
  }

  // Timing-safe comparison using SHA-256 hashes
  const hashProvided = crypto.createHash('sha256').update(password).digest();
  const hashExpected = crypto.createHash('sha256').update(expectedPassword).digest();

  if (!crypto.timingSafeEqual(hashProvided, hashExpected)) {
    return res.status(401).json({ error: '访问密码错误，请重新输入', code: 'INVALID_PASSWORD' });
  }

  const token = createSessionToken();
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https' || isProduction;
  const cookieFlags = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${SESSION_MAX_AGE_SEC}`,
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (isSecure) {
    cookieFlags.push('Secure');
  }

  res.setHeader('Set-Cookie', cookieFlags.join('; '));

  const webdavConfigured = !!(
    process.env.WEBDAV_SERVER_URL &&
    process.env.WEBDAV_USERNAME &&
    process.env.WEBDAV_PASSWORD
  );

  return res.json({
    ok: true,
    token, // Return token for Authorization header fallback
    webdavConfigured,
    webdavPreset: webdavConfigured ? {
      serverUrl: process.env.WEBDAV_SERVER_URL || '',
      username: process.env.WEBDAV_USERNAME || '',
      remotePath: process.env.WEBDAV_REMOTE_PATH || '/MemorizeWord/memorize_word_backup.json',
    } : undefined,
  });
});

// Auth Route 3: Logout and clear authentication cookie
app.post('/api/logout', (req, res) => {
  const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https' || isProduction;
  const cookieFlags = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (isSecure) {
    cookieFlags.push('Secure');
  }
  res.setHeader('Set-Cookie', cookieFlags.join('; '));
  return res.json({ ok: true });
});

// Initialize Google GenAI client
const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;

if (apiKey) {
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// WebDAV Proxy Endpoint - Solves browser CORS & supports Server Presets for multi-device sync
app.post('/api/webdav/proxy', async (req, res) => {
  try {
    let { endpoint, username, password, method = 'GET', remotePath = '', content, useServerPreset } = req.body || {};

    // If client requests server preset or didn't supply credentials, fallback to server env vars if configured
    if ((useServerPreset || (!endpoint || !username || !password)) &&
        process.env.WEBDAV_SERVER_URL && process.env.WEBDAV_USERNAME && process.env.WEBDAV_PASSWORD) {
      endpoint = endpoint || process.env.WEBDAV_SERVER_URL;
      username = username || process.env.WEBDAV_USERNAME;
      password = password || process.env.WEBDAV_PASSWORD;
      remotePath = remotePath || process.env.WEBDAV_REMOTE_PATH || '/MemorizeWord/memorize_word_backup.json';
    }

    if (!endpoint || !username || !password) {
      return res.status(400).json({
        error: '缺少 WebDAV 服务器地址、用户名或密码。可在服务端环境变量配置 WEBDAV_* 或在客户端自定义输入。',
      });
    }

    // Sanitize and build full URL
    const cleanEndpoint = endpoint.trim().replace(/\/?$/, '/');
    const cleanPath = remotePath.replace(/^\/+/, '');
    const targetUrl = new URL(cleanPath, cleanEndpoint).toString();

    const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

    const headers: Record<string, string> = {
      Authorization: authHeader,
      'User-Agent': 'MemorizeWord-Sync/2.0',
    };

    if (method.toUpperCase() === 'PROPFIND') {
      headers['Depth'] = '1';
    } else if (method.toUpperCase() === 'PUT') {
      headers['Content-Type'] = 'application/json; charset=utf-8';
    }

    const fetchOptions: RequestInit = {
      method: method.toUpperCase(),
      headers,
    };

    if (content && ['PUT', 'POST'].includes(method.toUpperCase())) {
      fetchOptions.body = typeof content === 'string' ? content : JSON.stringify(content);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get('content-type') || '';

    let responseData: any;
    if (contentType.includes('application/json')) {
      try {
        responseData = await response.json();
      } catch {
        responseData = await response.text();
      }
    } else {
      responseData = await response.text();
    }

    // Always return HTTP 200 from the proxy itself so upstream WebDAV 401s do not trigger client session logout
    return res.status(200).json({
      status: response.status,
      ok: response.ok,
      data: responseData,
    });
  } catch (error: any) {
    console.error('WebDAV Proxy Error:', error);
    return res.status(200).json({
      status: 500,
      ok: false,
      error: error.message || 'WebDAV proxy request failed',
    });
  }
});




// API Routes
app.get('/api/decks', (_req, res) => {
  try {
    const decksPath = path.resolve(__dirname, 'public/data/decks.json');
    if (fs.existsSync(decksPath)) {
      const data = JSON.parse(fs.readFileSync(decksPath, 'utf-8'));
      return res.json(data);
    }
    return res.status(404).json({ error: 'Decks metadata not found' });
  } catch (error) {
    console.error('Error fetching decks:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/decks/:deckId', (req, res) => {
  try {
    const { deckId } = req.params;
    // Basic sanitization
    const sanitizedId = deckId.replace(/[^a-zA-Z0-9_-]/g, '');
    const deckPath = path.resolve(__dirname, `public/data/decks/${sanitizedId}.json`);
    if (fs.existsSync(deckPath)) {
      const data = JSON.parse(fs.readFileSync(deckPath, 'utf-8'));
      return res.json(data);
    }
    return res.status(404).json({ error: 'Deck not found' });
  } catch (error) {
    console.error('Error fetching deck:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// AI Configuration Routes (PostgreSQL + AES-256-GCM encrypted multi-provider settings)
app.get('/api/ai/config', async (_req, res) => {
  try {
    const view = await dbService.getClientView();
    return res.json(view);
  } catch (error: any) {
    console.error('Failed to get AI config:', error);
    return res.status(500).json({ error: 'Failed to retrieve AI configuration' });
  }
});

app.post('/api/ai/config', async (req, res) => {
  try {
    const delta = req.body || {};
    await dbService.saveConfig(delta);
    const view = await dbService.getClientView();
    return res.json({ ok: true, config: view });
  } catch (error: any) {
    console.error('Failed to save AI config:', error);
    return res.status(500).json({ error: error.message || 'Failed to save AI configuration' });
  }
});

app.post('/api/ai/test-connection', async (req, res) => {
  try {
    const { provider, apiKey, baseURL, modelName } = req.body || {};
    let resolvedKey = apiKey;
    let resolvedBaseURL = baseURL;
    let resolvedModel = modelName;

    if (!resolvedKey) {
      const creds = await dbService.getResolvedCredentials(provider);
      resolvedKey = creds.apiKey;
      resolvedBaseURL = resolvedBaseURL || creds.baseURL;
      resolvedModel = resolvedModel || creds.modelName;
    }

    if (!resolvedKey) {
      return res.status(200).json({ success: false, message: '请提供或保存待测试的 API Key' });
    }

    const result = await executeAiChat({
      provider: provider || 'gemini',
      apiKey: resolvedKey,
      baseURL: resolvedBaseURL,
      modelName: resolvedModel,
      messages: [{ role: 'user', content: 'Hello! Please return a quick valid test response.' }],
      language: 'en',
      scenario: 'Test',
    });

    return res.json({ success: true, message: '模型连接与响应测试成功！', sampleReply: result.reply });
  } catch (err: any) {
    return res.status(200).json({ success: false, message: err.message || '连接测试失败，请检查 API Key 与 Base URL' });
  }
});

// AI Chat for Vocabulary Practice (Powered by Vercel AI SDK)
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { messages, focusWord, language = 'en', scenario = 'daily', scenarioRole } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Invalid messages array' });
    }

    const creds = await dbService.getResolvedCredentials();

    if (!creds.apiKey) {
      // Mock response if no API Key is configured
      const reply = language === 'ja'
        ? `素晴らしい表現ですね！「${focusWord?.headword || 'この単語'}」を上手に使っています。日常会話でも非常によく使われる表現です。次はどう返答しますか？`
        : `Excellent sentence! You used "${focusWord?.headword || 'this word'}" very naturally. In this scenario, natives often follow up with a detail or question. How would you like to continue?`;

      return res.json({
        reply,
        translation: language === 'ja' ? '很出色的表达！你很熟练地运用了这个词。在日常会话中非常常用。' : '很棒的句子！你自然地运用了这个词汇。接下来你想如何继续？',
        feedback: {
          isCorrect: true,
          tip: 'Tip: 在「设置 -> AI 模型与跨端配置」绑定 DeepSeek、Gemini 或 OpenAI 即可激活全功能实时 AI 对话。',
          exampleUsage: focusWord ? `例: ${focusWord.examples?.[0]?.text || focusWord.headword}` : ''
        },
        challenge: language === 'ja' ? '次の返答を続けてみてください' : 'Try continuing the conversation.'
      });
    }

    // Execute via Vercel AI SDK
    const result = await executeAiChat({
      provider: creds.provider,
      apiKey: creds.apiKey,
      baseURL: creds.baseURL,
      modelName: creds.modelName,
      messages,
      focusWord,
      language,
      scenario,
      scenarioRole,
    });

    return res.json(result);
  } catch (error: any) {
    console.warn('AI service temporarily returned error, applying graceful fallback:', error?.message || error);
    const fallbackReply = req.body?.language === 'ja'
      ? 'はい、喜んで！ご注文ありがとうございます。他にご質問やご注文はございますか？'
      : 'That sounds great! I completely understand. How would you like to proceed?';
    const fallbackTrans = req.body?.language === 'ja'
      ? '好的，非常乐意！十分感谢您的点单。请问还有其他需要或想了解的吗？'
      : '听起来很棒！完全明白。接下来想聊些什么呢？';

    return res.json({
      reply: fallbackReply,
      translation: fallbackTrans,
      feedback: {
        isCorrect: true,
        tip: `AI 导师对话进行中（已自动启用网络容灾保活：${error.message || '临时波动'}，请继续练习）。`,
      },
      challenge: req.body?.language === 'ja' ? '次の返答を続けてみてください' : 'Try continuing the conversation.',
    });
  }
});


import http from 'http';

// ===== Cloud Sync Routes (Vercel + Neon PostgreSQL) =====
// 受全局密码中间件保护；DB 不可用返回 503，异常返回 500（绝不伪装成空数据）

app.get('/api/sync/state', async (_req, res) => {
  if (!dbService.isDbAvailable()) {
    return res.status(503).json({ error: '云数据库未配置 (DATABASE_URL 缺失)，无法同步', code: 'DATABASE_NOT_CONFIGURED' });
  }
  try {
    const state = await dbService.getSyncState();
    return res.json(state);
  } catch (err: any) {
    console.error('GET /api/sync/state failed:', err);
    return res.status(500).json({ error: err?.message || '读取云端同步状态失败', code: 'SYNC_READ_ERROR' });
  }
});

app.post('/api/sync/state', async (req, res) => {
  if (!dbService.isDbAvailable()) {
    return res.status(503).json({ error: '云数据库未配置 (DATABASE_URL 缺失)，无法同步', code: 'DATABASE_NOT_CONFIGURED' });
  }
  try {
    const { stateData, forceOverwrite } = req.body || {};
    if (!stateData || typeof stateData !== 'object' || Array.isArray(stateData)) {
      return res.status(400).json({ error: '请求体 stateData 必须是非空对象', code: 'INVALID_PAYLOAD' });
    }
    const result = await dbService.saveSyncState(stateData, !!forceOverwrite);
    return res.json({ ok: true, ...result });
  } catch (err: any) {
    console.error('POST /api/sync/state failed:', err);
    return res.status(500).json({ error: err?.message || '保存云端同步状态失败', code: 'SYNC_WRITE_ERROR' });
  }
});

// Vite middleware setup
async function startServer() {
  process.env.DISABLE_HMR = 'true';
  const httpServer = http.createServer(app);

  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist/index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: {
        middlewareMode: true,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  httpServer.listen(PORT, HOST, () => {
    console.log(`> App running at http://${HOST}:${PORT}`);
  });
}

// Guard for Vercel / serverless deployments
if (!process.env.VERCEL) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

export { app };
export default app;

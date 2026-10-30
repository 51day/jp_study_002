/**
 * Unified API Client with 401 Unauthorized Interceptor and Session Management
 */

export interface AuthStatusResponse {
  authenticated: boolean;
  requiresPassword: boolean;
  isProduction: boolean;
  webdavConfigured: boolean;
  webdavPreset?: {
    serverUrl: string;
    username: string;
    remotePath: string;
  };
}

export interface LoginResponse {
  ok: boolean;
  token?: string;
  error?: string;
  code?: string;
  webdavConfigured?: boolean;
  webdavPreset?: {
    serverUrl: string;
    username: string;
    remotePath: string;
  };
}

type UnauthorizedCallback = () => void;

class ApiClient {
  private token: string | null = null;
  private onUnauthorizedListeners: Set<UnauthorizedCallback> = new Set();
  private isHandling401 = false;

  constructor() {
    try {
      this.token = localStorage.getItem('memorize_word_auth_token');
    } catch {
      this.token = null;
    }
  }

  public setToken(token: string | null) {
    this.token = token;
    try {
      if (token) {
        localStorage.setItem('memorize_word_auth_token', token);
      } else {
        localStorage.removeItem('memorize_word_auth_token');
      }
    } catch {
      // Ignore storage errors in restricted contexts
    }
  }

  public getToken(): string | null {
    return this.token;
  }

  public onUnauthorized(callback: UnauthorizedCallback): () => void {
    this.onUnauthorizedListeners.add(callback);
    return () => {
      this.onUnauthorizedListeners.delete(callback);
    };
  }

  private notifyUnauthorized() {
    if (this.isHandling401) return;
    this.isHandling401 = true;
    this.setToken(null);
    for (const listener of this.onUnauthorizedListeners) {
      try {
        listener();
      } catch (err) {
        console.error('Error in onUnauthorized listener:', err);
      }
    }
    setTimeout(() => {
      this.isHandling401 = false;
    }, 1000);
  }

  public async request<T = any>(url: string, options: RequestInit = {}): Promise<T> {
    const headers = new Headers(options.headers || {});

    // Include Bearer token header if available (Cookie is also automatically sent via credentials: 'include')
    if (this.token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${this.token}`);
    }

    if (!headers.has('Content-Type') && options.body && typeof options.body === 'string') {
      headers.set('Content-Type', 'application/json');
    }

    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include', // Ensure HttpOnly cookie is included
    });

    if (response.status === 401) {
      let errData: any = {};
      try {
        errData = await response.json();
      } catch {
        errData = { error: '未授权或访问已过期' };
      }
      // Only pop up the global login modal if it is our app's own auth middleware rejection
      if (errData.code === 'AUTH_REQUIRED' || !url.includes('/api/webdav/proxy')) {
        this.notifyUnauthorized();
      }
      throw new Error(errData.error || '未授权或访问已过期 (401)');
    }


    if (!response.ok) {
      let errData: any = {};
      try {
        errData = await response.json();
      } catch {
        errData = { error: `请求失败: HTTP ${response.status}` };
      }
      throw new Error(errData.error || `请求失败: HTTP ${response.status}`);
    }

    return response.json();
  }

  // Auth Operations
  public async getAuthStatus(): Promise<AuthStatusResponse> {
    return this.request<AuthStatusResponse>('/api/auth/status', { method: 'GET' });
  }

  public async login(password: string): Promise<LoginResponse> {
    const res = await this.request<LoginResponse>('/api/login', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    if (res.ok && res.token) {
      this.setToken(res.token);
    }
    return res;
  }

  public async logout(): Promise<void> {
    try {
      await this.request('/api/logout', { method: 'POST' });
    } finally {
      this.setToken(null);
    }
  }

  // Business Operations
  public async getDecks() {
    return this.request('/api/decks', { method: 'GET' });
  }

  public async getDeck(deckId: string) {
    return this.request(`/api/decks/${encodeURIComponent(deckId)}`, { method: 'GET' });
  }

  public async sendAiChat(payload: any) {
    return this.request('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public async webdavProxy(payload: any) {
    return this.request('/api/webdav/proxy', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // AI Configuration & Testing
  public async getAiConfig() {
    return this.request('/api/ai/config', { method: 'GET' });
  }

  public async saveAiConfig(delta: any) {
    return this.request('/api/ai/config', {
      method: 'POST',
      body: JSON.stringify(delta),
    });
  }

  public async testAiConnection(payload: any) {
    return this.request('/api/ai/test-connection', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // ===== Cloud Sync (Vercel + Neon PostgreSQL) =====
  public async getCloudSyncState(): Promise<{
    exists: boolean;
    syncVersion: number;
    stateData: any;
    updatedAt: number | null;
  }> {
    return this.request('/api/sync/state', { method: 'GET' });
  }

  public async pushCloudSyncState(stateData: any, forceOverwrite = false): Promise<{
    ok: boolean;
    syncVersion: number;
    stateData: any;
    updatedAt: number;
  }> {
    return this.request('/api/sync/state', {
      method: 'POST',
      body: JSON.stringify({ stateData, forceOverwrite }),
    });
  }
}

export const apiClient = new ApiClient();


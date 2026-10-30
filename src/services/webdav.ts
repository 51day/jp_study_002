import { WebDavConfig } from '../types';
import { apiClient } from './apiClient';

export interface WebDavResponse<T = any> {
  success: boolean;
  statusCode?: number;
  data?: T;
  error?: string;
}

export class WebDavService {
  /**
   * Helper to execute WebDAV requests via server-side proxy (to eliminate browser CORS issues and support server presets)
   * or direct fetch fallback.
   */
  private async execute(
    config: WebDavConfig,
    method: 'GET' | 'PUT' | 'PROPFIND' | 'MKCOL',
    remotePath: string,
    content?: string
  ): Promise<WebDavResponse> {
    const isUsingServerPreset = config.useServerPreset || config.isServerPresetActive;

    // If not using server preset, require user-entered config
    if (!isUsingServerPreset && (!config.serverUrl || !config.username || !config.password)) {
      return { success: false, error: 'WebDAV 服务器地址、用户名或密码未配置' };
    }

    try {
      // 1. Try server-side proxy (authenticated via session, eliminates CORS, supports server WEBDAV_* env vars)
      const proxyResult = await apiClient.webdavProxy({
        endpoint: config.serverUrl,
        username: config.username,
        password: config.password,
        method,
        remotePath,
        content,
        useServerPreset: isUsingServerPreset,
      });

      if (proxyResult.ok || proxyResult.status === 200 || proxyResult.status === 201 || proxyResult.status === 204 || proxyResult.status === 207) {
        return { success: true, statusCode: proxyResult.status, data: proxyResult.data };
      } else {
        return {
          success: false,
          statusCode: proxyResult.status,
          error: proxyResult.error || `WebDAV 响应状态码: ${proxyResult.status}`,
        };
      }
    } catch (proxyErr: any) {
      // If error was 401 or auth required, rethrow
      if (proxyErr.message && proxyErr.message.includes('401')) {
        return { success: false, statusCode: 401, error: proxyErr.message };
      }
      // If server preset was requested, we cannot fallback to direct client browser without credentials
      if (isUsingServerPreset) {
        return { success: false, error: proxyErr.message || '通过服务端预设同步失败，请检查网络或后端配置' };
      }
    }

    // 2. Direct browser fetch fallback (for custom configs with CORS enabled)
    try {
      const cleanEndpoint = config.serverUrl.trim().replace(/\/?$/, '/');
      const cleanPath = remotePath.replace(/^\/+/, '');
      const fullUrl = new URL(cleanPath, cleanEndpoint).toString();
      const auth = 'Basic ' + btoa(`${config.username}:${config.password}`);

      const headers: Record<string, string> = {
        Authorization: auth,
      };

      if (method === 'PROPFIND') {
        headers['Depth'] = '0';
      } else if (method === 'PUT') {
        headers['Content-Type'] = 'application/json; charset=utf-8';
      }

      const res = await fetch(fullUrl, {
        method,
        headers,
        body: content,
      });

      if (res.ok || res.status === 201 || res.status === 204 || res.status === 207) {
        let data: any = null;
        if (method === 'GET') {
          data = await res.text();
        }
        return { success: true, statusCode: res.status, data };
      } else {
        return { success: false, statusCode: res.status, error: `WebDAV 服务器返回 HTTP ${res.status}` };
      }
    } catch (directErr: any) {
      return {
        success: false,
        error: directErr.message || '网络连接失败，请检查 WebDAV 地址与网络',
      };
    }
  }

  /**
   * Test WebDAV connection credentials
   */
  public async testConnection(config: WebDavConfig): Promise<{ success: boolean; message: string }> {
    const res = await this.execute(config, 'PROPFIND', '');
    if (res.success || res.statusCode === 207 || res.statusCode === 200) {
      return { success: true, message: 'WebDAV 连接与认证成功！' };
    }

    if (res.statusCode === 401) {
      return { success: false, message: '认证失败 (HTTP 401)：用户名或 WebDAV 应用密码错误' };
    }

    if (res.statusCode === 403) {
      return { success: false, message: '权限受限 (HTTP 403)：该账户无权访问该路径' };
    }

    return { success: false, message: res.error || `连接失败 (HTTP ${res.statusCode || 'Unknown'})` };
  }

  /**
   * Ensure parent directory exists on WebDAV
   */
  public async ensureDirectory(config: WebDavConfig, dirName: string): Promise<boolean> {
    if (!dirName || dirName === '/' || dirName === '.') return true;
    const cleanDir = dirName.replace(/^\/+|\/+$/g, '');
    const res = await this.execute(config, 'MKCOL', cleanDir);
    return res.success || res.statusCode === 201 || res.statusCode === 405;
  }

  /**
   * Upload backup JSON string to WebDAV
   */
  public async uploadBackup(
    config: WebDavConfig,
    backupJson: string
  ): Promise<{ success: boolean; message: string; timestamp: number }> {
    const rawPath = config.remotePath || '/MemorizeWord/memorize_word_backup.json';
    const cleanPath = rawPath.replace(/^\/+/, '');

    const parts = cleanPath.split('/');
    if (parts.length > 1) {
      const parentDir = parts.slice(0, -1).join('/');
      await this.ensureDirectory(config, parentDir);
    }

    const res = await this.execute(config, 'PUT', cleanPath, backupJson);

    if (res.success || res.statusCode === 200 || res.statusCode === 201 || res.statusCode === 204) {
      return {
        success: true,
        message: '备份已成功同步至 WebDAV 云端！',
        timestamp: Date.now(),
      };
    }

    return {
      success: false,
      message: res.error || `上传失败 (HTTP ${res.statusCode})`,
      timestamp: Date.now(),
    };
  }

  /**
   * Download and read backup JSON from WebDAV
   */
  public async downloadBackup(
    config: WebDavConfig
  ): Promise<{ success: boolean; data?: string; message: string }> {
    const rawPath = config.remotePath || '/MemorizeWord/memorize_word_backup.json';
    const cleanPath = rawPath.replace(/^\/+/, '');

    const res = await this.execute(config, 'GET', cleanPath);

    if (res.success && res.data) {
      const textData = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      return {
        success: true,
        data: textData,
        message: '已成功从 WebDAV 下载云端备份数据！',
      };
    }

    if (res.statusCode === 404) {
      return {
        success: false,
        message: '云端暂未发现备份文件，请先在当前设备点击「立即备份至 WebDAV」',
      };
    }

    return {
      success: false,
      message: res.error || `下载失败 (HTTP ${res.statusCode})`,
    };
  }
}

export const webdav = new WebDavService();

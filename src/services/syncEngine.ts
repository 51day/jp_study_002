/**
 * syncEngine.ts —— 通用微同步引擎（前后端通用纯函数 + 前端低频批次同步控制器）
 *
 * 设计目标：
 *  - 与业务解耦：3 个无冲突合并纯函数（mergeDictionaryByTime / mergeAppendOnlyLogs /
 *    mergeListByIdWithTombstone）可直接复制到任意 Vercel + Neon 项目复用。
 *  - 业务级合并：mergeLearningPayload 针对「背单词」项目的 LearningSyncPayload 做字段级合并。
 *  - 保护 Neon 免费 Compute Hours：ClientSyncController 采用防抖 + 批次权重 + visibilitychange，
 *    避免每一次本地写入都打一次数据库请求。
 */

import type {
  LearningSyncPayload,
  CloudSyncStatus,
  Word,
  WordProgress,
  StudyLog,
  CustomAiScenario,
  Achievement,
  UserSettings,
} from '../types';

/* =========================================================================
 * Part 1 —— 通用无冲突合并积木（纯函数，前后端均可 import）
 * ========================================================================= */

/**
 * 按 Key 对比两个字典：保留时间戳更大的一方；若时间戳相同则保留 tieBreaker 更大的一方。
 * 任一端缺失该 Key 时，直接采用另一端的数据。
 */
export function mergeDictionaryByTime<T>(
  localMap: Record<string, T>,
  remoteMap: Record<string, T>,
  getTime: (item: T) => number,
  getTieBreaker?: (item: T) => number
): Record<string, T> {
  const merged: Record<string, T> = {};
  const keys = new Set<string>([...Object.keys(localMap || {}), ...Object.keys(remoteMap || {})]);
  for (const key of keys) {
    const local = localMap?.[key];
    const remote = remoteMap?.[key];
    if (!local && remote) {
      merged[key] = remote;
      continue;
    }
    if (local && !remote) {
      merged[key] = local;
      continue;
    }
    if (!local || !remote) continue;

    const localTime = getTime(local);
    const remoteTime = getTime(remote);
    if (localTime > remoteTime) {
      merged[key] = local;
    } else if (remoteTime > localTime) {
      merged[key] = remote;
    } else {
      // 时间戳相同，使用 tieBreaker 决胜
      if (getTieBreaker) {
        merged[key] = getTieBreaker(local) >= getTieBreaker(remote) ? local : remote;
      } else {
        merged[key] = local;
      }
    }
  }
  return merged;
}

/**
 * 追加型日志合并：按 ID Map 并集去重，按时间升序排列，并裁剪保留最新的 maxLimit 条
 * （保护 Vercel Serverless Function 4.5MB 请求体积限制）。
 */
export function mergeAppendOnlyLogs<T>(
  localArr: T[],
  remoteArr: T[],
  getId: (item: T) => string,
  getTime: (item: T) => number,
  maxLimit = 3000
): T[] {
  const byId = new Map<string, T>();
  const ingest = (arr: T[]) => {
    if (!Array.isArray(arr)) return;
    for (const item of arr) {
      if (!item) continue;
      const id = getId(item);
      const existing = byId.get(id);
      if (!existing || getTime(item) >= getTime(existing)) {
        byId.set(id, item);
      }
    }
  };
  ingest(localArr);
  ingest(remoteArr);

  const merged = Array.from(byId.values());
  merged.sort((a, b) => getTime(a) - getTime(b));

  // 裁剪：保留最新的 maxLimit 条
  if (merged.length > maxLimit) {
    return merged.slice(merged.length - maxLimit);
  }
  return merged;
}

/**
 * 列表按 ID 合并 + 软删除（墓碑）支持：保留更新时间较新的一方。
 * 当某一方存在 deletedAt 且时间更新时，该 ID 视为已删除（仍保留墓碑对象，由调用方决定是否过滤展示）。
 */
export function mergeListByIdWithTombstone<T>(
  localArr: T[],
  remoteArr: T[],
  getId: (item: T) => string,
  getTime: (item: T) => number
): T[] {
  const byId = new Map<string, T>();
  const ingest = (arr: T[]) => {
    if (!Array.isArray(arr)) return;
    for (const item of arr) {
      if (!item) continue;
      const id = getId(item);
      const existing = byId.get(id);
      if (!existing || getTime(item) > getTime(existing)) {
        byId.set(id, item);
      } else if (getTime(item) === getTime(existing)) {
        // 平局保留现有
      }
    }
  };
  ingest(localArr);
  ingest(remoteArr);
  return Array.from(byId.values());
}

/* =========================================================================
 * Part 2 —— 业务级合并纯函数 mergeLearningPayload
 * ========================================================================= */

const getProgressTime = (p: WordProgress): number => p.updatedAt || p.lastReviewAt || 0;
const getProgressTieBreaker = (p: WordProgress): number => p.reps || 0;

const getLogId = (l: StudyLog): string => l.id;
const getLogTime = (l: StudyLog): number => l.timestamp;

const getWordId = (w: Word): string => w.id;
const getWordTime = (w: Word): number => w.updatedAt || 0;
const getScenarioId = (s: CustomAiScenario): string => s.id;
const getScenarioTime = (s: CustomAiScenario): number => s.updatedAt || s.createdAt || 0;
const getAchievementId = (a: Achievement): string => a.id;
const getAchievementTime = (a: Achievement): number => a.unlockedAt || a.progress || 0;

/**
 * 合并本地与云端的 LearningSyncPayload。
 *  - progress：按 updatedAt||lastReviewAt 合并（tieBreaker=reps）。
 *  - logs：按 id 去重，保留最新 3000 条。
 *  - customWords：按 id 合并（含墓碑）。
 *  - customScenarios：仅合并 isCustom===true 的用户自建场景（内置预设不入库）。
 *  - achievements：已解锁优先（保留最早解锁时间），progress 取 max。
 *  - settings：取 updatedAt 较新者；onboardingCompleted 任一端为 true 则合并后为 true。
 */
export function mergeLearningPayload(
  local: LearningSyncPayload,
  remote: LearningSyncPayload
): LearningSyncPayload {
  const safeLocal = local || ({} as LearningSyncPayload);
  const safeRemote = remote || ({} as LearningSyncPayload);

  // progress 合并
  const mergedProgress = mergeDictionaryByTime<WordProgress>(
    safeLocal.progress || {},
    safeRemote.progress || {},
    getProgressTime,
    getProgressTieBreaker
  );

  // logs 合并
  const mergedLogs = mergeAppendOnlyLogs<StudyLog>(
    safeLocal.logs || [],
    safeRemote.logs || [],
    getLogId,
    getLogTime,
    3000
  );

  // customWords 合并
  const mergedCustomWords = mergeListByIdWithTombstone<Word>(
    safeLocal.customWords || [],
    safeRemote.customWords || [],
    getWordId,
    getWordTime
  ).filter((w) => !w.deletedAt); // 过滤掉墓碑，不展示

  // customScenarios 合并：仅 isCustom===true
  const localCustomScenarios = (safeLocal.customScenarios || []).filter((s) => s.isCustom === true);
  const remoteCustomScenarios = (safeRemote.customScenarios || []).filter((s) => s.isCustom === true);
  const mergedScenarios = mergeListByIdWithTombstone<CustomAiScenario>(
    localCustomScenarios,
    remoteCustomScenarios,
    getScenarioId,
    getScenarioTime
  ).filter((s) => !s.deletedAt);

  // achievements 合并：已解锁优先（保留最早解锁时间），progress 取 max
  const localAch = safeLocal.achievements || [];
  const remoteAch = safeRemote.achievements || [];
  const achMap = new Map<string, Achievement>();
  for (const a of localAch) achMap.set(a.id, { ...a });
  for (const a of remoteAch) {
    const existing = achMap.get(a.id);
    if (!existing) {
      achMap.set(a.id, { ...a });
      continue;
    }
    const mergedUnlockedAt =
      existing.unlockedAt && a.unlockedAt
        ? Math.min(existing.unlockedAt, a.unlockedAt) // 任一端已解锁，保留最早解锁时间
        : existing.unlockedAt || a.unlockedAt || null;
    achMap.set(a.id, {
      ...existing,
      unlockedAt: mergedUnlockedAt,
      progress: Math.max(existing.progress || 0, a.progress || 0),
    });
  }
  const mergedAchievements = Array.from(achMap.values());

  // settings 合并
  const localSettings = safeLocal.settings || ({} as UserSettings);
  const remoteSettings = safeRemote.settings || ({} as UserSettings);
  const localSettingsTime = localSettings.updatedAt || 0;
  const remoteSettingsTime = remoteSettings.updatedAt || 0;
  let mergedSettings: UserSettings;
  if (localSettingsTime >= remoteSettingsTime) {
    mergedSettings = { ...remoteSettings, ...localSettings };
  } else {
    mergedSettings = { ...localSettings, ...remoteSettings };
  }
  // onboardingCompleted：任一端为 true 则保持为 true
  if (localSettings.onboardingCompleted || remoteSettings.onboardingCompleted) {
    mergedSettings.onboardingCompleted = true;
  }

  return {
    settings: mergedSettings,
    progress: mergedProgress,
    customWords: mergedCustomWords,
    customScenarios: mergedScenarios,
    logs: mergedLogs,
    achievements: mergedAchievements,
    updatedAt: Date.now(),
  };
}

/* =========================================================================
 * Part 3 —— 前端低频批次同步控制器 ClientSyncController
 * （保护 Neon 免费 Compute Hours）
 * ========================================================================= */

type StatusListener = (status: CloudSyncStatus, lastSyncedAt: number | null, errorMessage: string | null) => void;

export interface ClientSyncControllerOptions {
  /** 累计变更权重达到该阈值立即触发一次 flush（如背满 10 个词） */
  batchThreshold?: number;
  /** 静置防抖毫秒数，超时后触发一次 flush */
  debounceMs?: number;
  /** 页面切回 visible 时，距离上次拉取超过多少毫秒则静默 pull */
  pullIntervalMs?: number;
  /** flush 时调用：把本地 payload push 到云端 */
  onFlush: (forceOverwrite?: boolean) => Promise<void>;
  /** visibilitychange 切回前台时静默拉取合并 */
  onPull?: () => Promise<void>;
}

export class ClientSyncController {
  private status: CloudSyncStatus = 'idle';
  private lastSyncedAt: number | null = null;
  private lastPulledAt: number | null = null;
  private errorMessage: string | null = null;
  private dirtyWeight = 0;
  private isDirty = false;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private flushInFlight = false;
  private listeners = new Set<StatusListener>();

  private batchThreshold: number;
  private debounceMs: number;
  private pullIntervalMs: number;
  private onFlush: (forceOverwrite?: boolean) => Promise<void>;
  private onPull?: () => Promise<void>;

  private boundVisibilityHandler: () => void;

  constructor(opts: ClientSyncControllerOptions) {
    this.batchThreshold = opts.batchThreshold ?? 10;
    this.debounceMs = opts.debounceMs ?? 20000;
    this.pullIntervalMs = opts.pullIntervalMs ?? 120000;
    this.onFlush = opts.onFlush;
    this.onPull = opts.onPull;

    this.boundVisibilityHandler = this.handleVisibilityChange.bind(this);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.boundVisibilityHandler);
    }
  }

  public getStatus(): CloudSyncStatus {
    return this.status;
  }

  public getLastSyncedAt(): number | null {
    return this.lastSyncedAt;
  }

  public getErrorMessage(): string | null {
    return this.errorMessage;
  }

  public subscribe(listener: StatusListener): () => void {
    this.listeners.add(listener);
    // 立即推送一次当前状态
    listener(this.status, this.lastSyncedAt, this.errorMessage);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    for (const l of this.listeners) {
      try {
        l(this.status, this.lastSyncedAt, this.errorMessage);
      } catch (e) {
        console.warn('Sync status listener error', e);
      }
    }
  }

  private setStatus(status: CloudSyncStatus, errorMessage: string | null = null) {
    this.status = status;
    this.errorMessage = errorMessage;
    this.notify();
  }

  /**
   * 标记本地数据有变更。不立即发请求，而是累计权重达到阈值或防抖超时再触发。
   */
  public markDirty(weight = 1): void {
    this.dirtyWeight += weight;
    this.isDirty = true;

    // 重置防抖计时
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      if (this.isDirty) {
        this.flush().catch((e) => console.warn('Debounced flush failed:', e));
      }
    }, this.debounceMs);

    // 权重达标立即触发
    if (this.dirtyWeight >= this.batchThreshold) {
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
        this.debounceTimer = null;
      }
      this.flush().catch((e) => console.warn('Threshold flush failed:', e));
    }
  }

  /**
   * 立即把本地变更推送到云端。
   */
  public async flush(forceOverwrite = false): Promise<void> {
    if (this.flushInFlight) return;
    if (!this.isDirty && !forceOverwrite) return;

    this.flushInFlight = true;
    this.setStatus('syncing');
    try {
      await this.onFlush(forceOverwrite);
      this.isDirty = false;
      this.dirtyWeight = 0;
      this.lastSyncedAt = Date.now();
      this.setStatus('synced');
    } catch (err: any) {
      // 离线（网络）与服务器错误分别标记
      const isOffline = err && (err.name === 'TypeError' || /Failed to fetch|NetworkError|offline/i.test(err.message || ''));
      this.setStatus(isOffline ? 'offline' : 'error', err?.message || String(err));
    } finally {
      this.flushInFlight = false;
    }
  }

  /**
   * 静默从云端拉取合并。用于 visibilitychange 切回前台。
   */
  public async pull(): Promise<void> {
    if (!this.onPull) return;
    try {
      this.setStatus('syncing');
      await this.onPull();
      this.lastPulledAt = Date.now();
      this.setStatus('synced');
    } catch (err: any) {
      const isOffline = err && (err.name === 'TypeError' || /Failed to fetch|NetworkError|offline/i.test(err.message || ''));
      this.setStatus(isOffline ? 'offline' : 'error', err?.message || String(err));
    }
  }

  private handleVisibilityChange(): void {
    if (typeof document === 'undefined') return;
    if (document.visibilityState === 'hidden') {
      // 切到后台且有未推送变更，立即 flush（浏览器可能随时被挂起）
      if (this.isDirty) {
        // hidden 时 sendBeacon 更理想，但这里 payload 较大走 fetch；尽力而为
        this.flush().catch(() => {
          /* 忽略，下次回到前台会再尝试 */
        });
      }
    } else if (document.visibilityState === 'visible') {
      // 切回前台，距上次拉取超过阈值则静默 pull
      const now = Date.now();
      const last = this.lastPulledAt || 0;
      if (now - last > this.pullIntervalMs) {
        this.pull().catch(() => {
          /* 忽略 */
        });
      }
    }
  }

  /**
   * 销毁控制器，移除事件监听。
   */
  public destroy(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.boundVisibilityHandler);
    }
    this.listeners.clear();
  }
}
import React, { useState, useRef, useEffect } from 'react';
import {
  Volume2,
  Sliders,
  Download,
  Upload,
  RotateCcw,
  BookOpen,
  Info,
  Check,
  AlertTriangle,
  Sparkles,
  Languages,
  Bot,
  Plus,
  Trash2,
  Edit2,
  Camera,
  History,
  FileSpreadsheet,
  FileJson,
  Layers,
  Cloud,
  CloudUpload,
  CloudDownload,
  RefreshCw,
  Key,
  Globe,
  Lock,
  Eye,
  EyeOff,
  FolderSync,
  HardDrive,
  LogOut,
  ShieldCheck,
  Database,
  Cpu,
  Shield,
} from 'lucide-react';
import {
  UserSettings,
  Deck,
  AudioSource,
  EnAccent,
  CustomAiScenario,
  LocalSnapshot,
  Word,
  WebDavConfig,
  CloudSyncStatus,
} from '../types';
import { storage } from '../services/storage';
import { tts } from '../services/tts';
import { webdav } from '../services/webdav';
import { apiClient } from '../services/apiClient';
import { useI18n } from '../i18n';
import { AiScenarioModal } from './AiScenarioModal';
import { JapaneseRubyText } from './JapaneseRubyText';

interface SettingsViewProps {
  settings: UserSettings;
  decks: Deck[];
  allWords: Word[];
  onUpdateSettings: (newSettings: Partial<UserSettings>) => void;
  onRefreshData: () => void;
  onRetakePlacement: () => void;
  onLogout?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  decks,
  allWords,
  onUpdateSettings,
  onRefreshData,
  onRetakePlacement,
  onLogout,
}) => {

  const { t, uiLang, setUiLang, supportedLanguages } = useI18n();

  // TTS settings state
  const [speechRate, setSpeechRate] = useState(settings.speechRate || 1.0);
  const [audioSource, setAudioSource] = useState<AudioSource>(settings.audioSource || 'online_first');
  const [enAccent, setEnAccent] = useState<EnAccent>(settings.enAccent || 'us');
  const [testedSourceNotice, setTestedSourceNotice] = useState<string | null>(null);

  // Quota states
  const [dailyNew, setDailyNew] = useState(settings.dailyNewWords);
  const [dailyReview, setDailyReview] = useState(settings.dailyReviewLimit);
  const [autoSpeak, setAutoSpeak] = useState(settings.autoSpeak);
  // 生词本是否并入学习队列（默认开启）
  const [includeCustom, setIncludeCustom] = useState(settings.includeCustomWords ?? true);

  // Snapshots & Custom AI Scenarios
  const [snapshots, setSnapshots] = useState<LocalSnapshot[]>([]);
  const [customScenarios, setCustomScenarios] = useState<CustomAiScenario[]>([]);
  const [editingScenario, setEditingScenario] = useState<CustomAiScenario | null>(null);
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'learn' | 'ai' | 'sync' | 'about'>('learn');

  // Import preview inspection modal state
  const [backupInspection, setBackupInspection] = useState<{
    rawJson: string;
    details: ReturnType<typeof storage.inspectBackup>;
  } | null>(null);

  const [importNotice, setImportNotice] = useState<{ success: boolean; message: string } | null>(null);
  const [showConfirmReset, setShowConfirmReset] = useState(false);
  const [resetSuccessNotice, setResetSuccessNotice] = useState(false);
  const [snapshotNotice, setSnapshotNotice] = useState<string | null>(null);

  // WebDAV Cloud Sync States
  const [webdavConfig, setWebdavConfig] = useState<WebDavConfig>(storage.getWebDavConfig());
  const [showWebdavPassword, setShowWebdavPassword] = useState(false);
  const [isTestingWebdav, setIsTestingWebdav] = useState(false);
  const [isUploadingWebdav, setIsUploadingWebdav] = useState(false);
  const [isDownloadingWebdav, setIsDownloadingWebdav] = useState(false);
  const [webdavNotice, setWebdavNotice] = useState<{ success: boolean; message: string } | null>(null);
  const [showWebdavImportConfirm, setShowWebdavImportConfirm] = useState<{
    rawJson: string;
    details: ReturnType<typeof storage.inspectBackup>;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // PostgreSQL 云端实时同步状态
  const [cloudSyncStatus, setCloudSyncStatus] = useState<CloudSyncStatus>(() => storage.getSyncStatus().status);
  const [cloudSyncLastAt, setCloudSyncLastAt] = useState<number | null>(() => storage.getSyncStatus().lastSyncedAt);
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(() => storage.getSyncStatus().errorMessage);
  const [isManualCloudSync, setIsManualCloudSync] = useState(false);
  const [isCloudPulling, setIsCloudPulling] = useState(false);
  const [cloudSyncNotice, setCloudSyncNotice] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    const unsubscribe = storage.subscribeSyncStatus((status, lastAt, errMsg) => {
      setCloudSyncStatus(status);
      setCloudSyncLastAt(lastAt);
      setCloudSyncError(errMsg);
      if (status !== 'syncing') {
        setIsManualCloudSync(false);
        setIsCloudPulling(false);
      }
    });
    return unsubscribe;
  }, []);

  const handleManualCloudSync = async () => {
    setIsManualCloudSync(true);
    setCloudSyncNotice(null);
    try {
      await storage.syncToCloud();
      setCloudSyncNotice({ success: true, message: '已手动同步本地数据到 PostgreSQL 云端' });
    } catch (err: any) {
      setCloudSyncNotice({ success: false, message: err?.message || '同步失败，请检查网络或数据库配置' });
    }
  };

  const handleCloudRePull = async () => {
    setIsCloudPulling(true);
    setCloudSyncNotice(null);
    try {
      await storage.pullFromCloud();
      setCloudSyncNotice({ success: true, message: '已从云端重新拉取并合并到本地' });
    } catch (err: any) {
      setCloudSyncNotice({ success: false, message: err?.message || '拉取失败，请检查网络或数据库配置' });
    }
  };

  // 首次挂载拉取一次状态
  useEffect(() => {
    setCloudSyncStatus(storage.getSyncStatus().status);
  }, []);


  // AI Multi-Provider & Vercel AI SDK States
  const [aiConfig, setAiConfig] = useState<any>(null);
  const [activeAiTab, setActiveAiTab] = useState<'gemini' | 'deepseek' | 'openai' | 'custom'>('gemini');

  // Input states
  const [geminiApiKeyInput, setGeminiApiKeyInput] = useState('');
  const [geminiModelInput, setGeminiModelInput] = useState('gemini-flash-latest');
  const [isEditingGeminiKey, setIsEditingGeminiKey] = useState(false);

  const [deepseekApiKeyInput, setDeepseekApiKeyInput] = useState('');
  const [deepseekModelInput, setDeepseekModelInput] = useState('deepseek-chat');
  const [isEditingDeepseekKey, setIsEditingDeepseekKey] = useState(false);

  const [openaiApiKeyInput, setOpenaiApiKeyInput] = useState('');
  const [openaiModelInput, setOpenaiModelInput] = useState('gpt-4o-mini');
  const [isEditingOpenaiKey, setIsEditingOpenaiKey] = useState(false);

  const [customBaseUrlInput, setCustomBaseUrlInput] = useState('https://api.openai.com/v1');
  const [customApiKeyInput, setCustomApiKeyInput] = useState('');
  const [customModelInput, setCustomModelInput] = useState('gpt-4o-mini');
  const [isEditingCustomKey, setIsEditingCustomKey] = useState(false);

  const [isTestingAi, setIsTestingAi] = useState(false);
  const [isSavingAi, setIsSavingAi] = useState(false);
  const [aiNotice, setAiNotice] = useState<{ success: boolean; message: string; sampleReply?: string } | null>(null);

  const loadAiConfig = async () => {
    try {
      const data = await apiClient.getAiConfig();
      if (data) {
        setAiConfig(data);
        if (data.activeProvider) {
          setActiveAiTab(data.activeProvider);
        }
        setGeminiModelInput(data.geminiModel || 'gemini-flash-latest');
        setDeepseekModelInput(data.deepseekModel || 'deepseek-chat');
        setOpenaiModelInput(data.openaiModel || 'gpt-4o-mini');
        setCustomBaseUrlInput(data.customBaseUrl || 'https://api.openai.com/v1');
        setCustomModelInput(data.customModel || 'gpt-4o-mini');
      }
    } catch (err) {
      console.warn('Failed to fetch AI configuration:', err);
    }
  };

  // Load snapshots & custom scenarios
  const refreshStorageLists = () => {
    setSnapshots(storage.getSnapshots());
    setCustomScenarios(storage.getCustomScenarios());
  };

  useEffect(() => {
    refreshStorageLists();
    loadAiConfig();
    tts.setAudioSource(audioSource);
    tts.setEnAccent(enAccent);
  }, []);

  const handleTestAi = async () => {
    setIsTestingAi(true);
    setAiNotice(null);
    try {
      let keyToTest = '';
      let urlToTest = '';
      let modelToTest = '';

      if (activeAiTab === 'gemini') {
        keyToTest = geminiApiKeyInput || '';
        modelToTest = geminiModelInput;
      } else if (activeAiTab === 'deepseek') {
        keyToTest = deepseekApiKeyInput || '';
        modelToTest = deepseekModelInput;
      } else if (activeAiTab === 'openai') {
        keyToTest = openaiApiKeyInput || '';
        modelToTest = openaiModelInput;
      } else {
        keyToTest = customApiKeyInput || '';
        urlToTest = customBaseUrlInput;
        modelToTest = customModelInput;
      }

      const res = await apiClient.testAiConnection({
        provider: activeAiTab,
        apiKey: keyToTest,
        baseURL: urlToTest,
        modelName: modelToTest,
      });

      setAiNotice(res);
    } catch (err: any) {
      setAiNotice({ success: false, message: err.message || '测试连接超时或失败，请检查网络配置' });
    } finally {
      setIsTestingAi(false);
    }
  };

  const handleSaveAi = async () => {
    setIsSavingAi(true);
    setAiNotice(null);
    try {
      const delta: any = {
        activeProvider: activeAiTab,
        geminiModel: geminiModelInput,
        deepseekModel: deepseekModelInput,
        openaiModel: openaiModelInput,
        customBaseUrl: customBaseUrlInput,
        customModel: customModelInput,
      };

      if (geminiApiKeyInput.trim()) delta.geminiApiKey = geminiApiKeyInput.trim();
      if (deepseekApiKeyInput.trim()) delta.deepseekApiKey = deepseekApiKeyInput.trim();
      if (openaiApiKeyInput.trim()) delta.openaiApiKey = openaiApiKeyInput.trim();
      if (customApiKeyInput.trim()) delta.customApiKey = customApiKeyInput.trim();

      const res = await apiClient.saveAiConfig(delta);
      if (res && res.config) {
        setAiConfig(res.config);
        setIsEditingGeminiKey(false);
        setIsEditingDeepseekKey(false);
        setIsEditingOpenaiKey(false);
        setIsEditingCustomKey(false);
        setGeminiApiKeyInput('');
        setDeepseekApiKeyInput('');
        setOpenaiApiKeyInput('');
        setCustomApiKeyInput('');
        setAiNotice({
          success: true,
          message: res.config.dbConnected
            ? '配置已通过 AES-256-GCM 服务端高强度加密保存至 PostgreSQL 数据库，全设备自动共享生效！'
            : '配置已通过 AES-256-GCM 服务端高强度加密保存至本地持久化（配置 DATABASE_URL 环境变量即可一键激活多设备 PostgreSQL 共享）。',
        });
      }
    } catch (err: any) {
      setAiNotice({ success: false, message: err.message || '保存配置失败' });
    } finally {
      setIsSavingAi(false);
    }
  };

  const availableDecks = decks.filter((d) => d.language === settings.learningLang);

  const handleSaveQuotas = () => {
    onUpdateSettings({
      dailyNewWords: dailyNew,
      dailyReviewLimit: dailyReview,
      includeCustomWords: includeCustom,
      speechRate,
      autoSpeak,
      audioSource,
      enAccent,
    });
  };

  const handleTestTts = async () => {
    tts.setAudioSource(audioSource);
    tts.setEnAccent(enAccent);

    const sample =
      settings.learningLang === 'ja'
        ? 'こんにちは！今日も単語を楽しく覚えましょう。'
        : enAccent === 'uk'
        ? 'Brilliant! Enjoy your vocabulary session today.'
        : 'Hello! Welcome to your daily vocabulary session.';

    const sampleReading = settings.learningLang === 'ja' ? 'こんにちは！きょうもたんごをたのしくおぼえましょう。' : null;

    await tts.speak(sample, settings.learningLang, speechRate, sampleReading);
    const used = tts.getLastUsedSource();
    if (used === 'online') {
      setTestedSourceNotice('当前播报：在线高清原声 (有道/Google音频流)');
    } else if (used === 'local') {
      setTestedSourceNotice('当前播报：本机系统语音 (Web Speech API 离线引擎)');
    } else {
      setTestedSourceNotice('语音播报完毕');
    }

    setTimeout(() => setTestedSourceNotice(null), 5000);
  };

  // Create Snapshot
  const handleCreateSnapshot = () => {
    const snap = storage.createSnapshot();
    setSnapshots(storage.getSnapshots());
    setSnapshotNotice(`快照已创建：「${snap.name}」(${snap.sizeKb} KB)`);
    setTimeout(() => setSnapshotNotice(null), 4000);
  };

  // Restore Snapshot
  const handleRestoreSnapshot = (id: string, name: string) => {
    const ok = storage.restoreSnapshot(id);
    if (ok) {
      onRefreshData();
      refreshStorageLists();
      setSnapshotNotice(`已成功还原到快照：「${name}」`);
      setTimeout(() => setSnapshotNotice(null), 4000);
    }
  };

  // Delete Snapshot
  const handleDeleteSnapshot = (id: string) => {
    storage.deleteSnapshot(id);
    setSnapshots(storage.getSnapshots());
  };

  // Full Export JSON
  const handleExportJson = () => {
    const jsonStr = storage.exportData();
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memorize_word_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Export Anki TSV
  const handleExportAnkiTsv = () => {
    const tsvStr = storage.exportAnkiTsv(allWords, settings.learningLang);
    const blob = new Blob([tsvStr], { type: 'text/tab-separated-values;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `anki_deck_${settings.learningLang}_${new Date().toISOString().slice(0, 10)}.tsv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Handle selected file for import
  const handleSelectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const details = storage.inspectBackup(content);
      if (!details.valid) {
        setImportNotice({ success: false, message: `备份文件校验失败: ${details.error}` });
      } else {
        // Open inspection modal
        setBackupInspection({ rawJson: content, details });
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const confirmApplyImport = (mode: 'merge' | 'overwrite') => {
    if (!backupInspection) return;
    const res = storage.importData(backupInspection.rawJson, mode);
    setImportNotice(res);
    setBackupInspection(null);
    if (res.success) {
      onRefreshData();
      refreshStorageLists();
    }
  };

  const confirmReset = () => {
    storage.clearAllData();
    onRefreshData();
    refreshStorageLists();
    setShowConfirmReset(false);
    setResetSuccessNotice(true);
    setTimeout(() => setResetSuccessNotice(false), 4000);
  };

  // WebDAV Synchronization Handlers
  const handleUpdateWebdav = (delta: Partial<WebDavConfig>) => {
    const updated = storage.saveWebDavConfig(delta);
    setWebdavConfig(updated);
  };

  const handleTestWebdav = async () => {
    if (!webdavConfig.useServerPreset && (!webdavConfig.serverUrl || !webdavConfig.username || !webdavConfig.password)) {
      setWebdavNotice({ success: false, message: '请完整填写 WebDAV 服务器地址、用户名与授权密码，或启用服务端预设模式' });
      return;
    }
    setIsTestingWebdav(true);
    setWebdavNotice(null);
    try {
      const res = await webdav.testConnection(webdavConfig);
      setWebdavNotice(res);
      handleUpdateWebdav({
        lastSyncStatus: res.success ? 'success' : 'error',
        lastSyncMessage: res.message,
      });
    } catch (err: any) {
      setWebdavNotice({ success: false, message: err.message || '连接测试异常' });
    } finally {
      setIsTestingWebdav(false);
    }
  };

  const handleUploadToWebdav = async () => {
    if (!webdavConfig.useServerPreset && (!webdavConfig.serverUrl || !webdavConfig.username || !webdavConfig.password)) {
      setWebdavNotice({ success: false, message: '请完整填写 WebDAV 配置，或启用服务端预设模式' });
      return;
    }
    setIsUploadingWebdav(true);
    setWebdavNotice(null);
    try {
      // 1. Automatic safe snapshot before pushing
      storage.createSnapshot('WebDAV 同步前自动快照');
      refreshStorageLists();

      // 2. Export full app payload and upload
      const backupJson = storage.exportData();
      const res = await webdav.uploadBackup(webdavConfig, backupJson);
      setWebdavNotice(res);
      handleUpdateWebdav({
        lastSyncAt: res.timestamp,
        lastSyncStatus: res.success ? 'success' : 'error',
        lastSyncMessage: res.message,
      });
    } catch (err: any) {
      setWebdavNotice({ success: false, message: err.message || '上传异常' });
    } finally {
      setIsUploadingWebdav(false);
    }
  };

  const handleDownloadFromWebdav = async () => {
    if (!webdavConfig.useServerPreset && (!webdavConfig.serverUrl || !webdavConfig.username || !webdavConfig.password)) {
      setWebdavNotice({ success: false, message: '请完整填写 WebDAV 配置，或启用服务端预设模式' });
      return;
    }
    setIsDownloadingWebdav(true);
    setWebdavNotice(null);
    try {
      const res = await webdav.downloadBackup(webdavConfig);
      if (!res.success || !res.data) {
        setWebdavNotice({ success: false, message: res.message });
        return;
      }

      const details = storage.inspectBackup(res.data);
      if (!details.valid) {
        setWebdavNotice({ success: false, message: `云端文件解析失败: ${details.error}` });
        return;
      }

      // Prompt confirmation modal with parsed stats
      setShowWebdavImportConfirm({ rawJson: res.data, details });
    } catch (err: any) {
      setWebdavNotice({ success: false, message: err.message || '下载异常' });
    } finally {
      setIsDownloadingWebdav(false);
    }
  };

  const confirmWebdavImport = (mode: 'merge' | 'overwrite') => {
    if (!showWebdavImportConfirm) return;
    storage.createSnapshot('WebDAV 云端拉取前安全快照');
    const res = storage.importData(showWebdavImportConfirm.rawJson, mode);
    setWebdavNotice({
      success: res.success,
      message: res.success ? `已成功拉取并恢复 WebDAV 数据！${res.message}` : res.message,
    });
    handleUpdateWebdav({
      lastSyncAt: Date.now(),
      lastSyncStatus: res.success ? 'success' : 'error',
      lastSyncMessage: res.message,
    });
    setShowWebdavImportConfirm(null);
    if (res.success) {
      onRefreshData();
      refreshStorageLists();
    }
  };


  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      {/* 1. Modal: In-app Backup Inspection & Confirmation */}
      {backupInspection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 flex items-center justify-center">
              <FileJson className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                确认恢复备份文件
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                已识别备份内容，请选择数据导入恢复方式：
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>单词记忆进度：</span>
                <span className="font-bold text-indigo-600">{backupInspection.details.progressCount} 条</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>生词本自定义单词：</span>
                <span className="font-bold text-indigo-600">{backupInspection.details.customWordsCount} 个</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>AI 实战自定义场景：</span>
                <span className="font-bold text-indigo-600">{backupInspection.details.scenariosCount} 个</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>历史学习打卡日志：</span>
                <span className="font-bold text-indigo-600">{backupInspection.details.logsCount} 次</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => confirmApplyImport('merge')}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm text-left flex items-center justify-between"
              >
                <div>
                  <div className="font-bold">智能增量合并 (推荐)</div>
                  <div className="text-[10px] opacity-80">保留现有数据，按最新时间戳合并新卡片</div>
                </div>
                <Check className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => confirmApplyImport('overwrite')}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition text-left flex items-center justify-between"
              >
                <div>
                  <div className="font-bold">完全覆盖还原</div>
                  <div className="text-[10px] text-slate-400">重置当前数据，完全以备份文件为准</div>
                </div>
                <RotateCcw className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={() => setBackupInspection(null)}
                className="text-xs text-slate-400 hover:text-slate-600 transition"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: WebDAV Cloud Import Inspection & Confirmation */}
      {showWebdavImportConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 flex items-center justify-center">
              <CloudDownload className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                已成功从 WebDAV 获取云端备份
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                已校验数据完整性，请选择数据合并或覆盖恢复方式：
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>单词记忆进度：</span>
                <span className="font-bold text-indigo-600">{showWebdavImportConfirm.details.progressCount} 条</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>生词本自定义单词：</span>
                <span className="font-bold text-indigo-600">{showWebdavImportConfirm.details.customWordsCount} 个</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>AI 实战场景：</span>
                <span className="font-bold text-indigo-600">{showWebdavImportConfirm.details.scenariosCount} 个</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>历史学习打卡日志：</span>
                <span className="font-bold text-indigo-600">{showWebdavImportConfirm.details.logsCount} 次</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                type="button"
                onClick={() => confirmWebdavImport('merge')}
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-sm text-left flex items-center justify-between"
              >
                <div>
                  <div className="font-bold">智能增量合并 (推荐)</div>
                  <div className="text-[10px] opacity-80">保留本地新增记录，按最新时间戳合并云端进度</div>
                </div>
                <Check className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => confirmWebdavImport('overwrite')}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition text-left flex items-center justify-between"
              >
                <div>
                  <div className="font-bold">完全覆盖本地数据</div>
                  <div className="text-[10px] text-slate-400">本地重置为与 WebDAV 备份完全一致</div>
                </div>
                <RotateCcw className="w-4 h-4 text-slate-400" />
              </button>
            </div>

            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={() => setShowWebdavImportConfirm(null)}
                className="text-xs text-slate-400 hover:text-slate-600 transition"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}


      {/* 2. Modal: Reset Confirm */}
      {showConfirmReset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl p-6 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {t('settings.reset_confirm_title')}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {t('settings.reset_confirm_desc')}
              </p>
              <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
                ⚠️ 此操作仅清空当前浏览器的本地缓存，不会删除 PostgreSQL 云端与 WebDAV 备份。下次登录仍可从云端恢复。
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmReset(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={confirmReset}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-sm"
              >
                {t('settings.confirm_reset_btn')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Modal: Custom AI Scenario Modal */}
      {showScenarioModal && (
        <AiScenarioModal
          initialScenario={editingScenario}
          currentLang={settings.learningLang}
          onClose={() => {
            setShowScenarioModal(false);
            setEditingScenario(null);
          }}
          onSaved={() => {
            refreshStorageLists();
          }}
        />
      )}

      {resetSuccessNotice && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{t('settings.reset_success')}</span>
        </div>
      )}

      {snapshotNotice && (
        <div className="p-3.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 text-xs font-medium flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span>{snapshotNotice}</span>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">
          {t('settings.title')}
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          {t('settings.desc')}
        </p>
      </div>

      {/* Settings Tab Bar - 顶部分类切换，避免单页超长滚动 */}
      <div className="flex gap-1.5 p-1.5 rounded-2xl bg-slate-100/95 dark:bg-slate-800/90 backdrop-blur border border-slate-200/60 dark:border-slate-700/60 overflow-x-auto scrollbar-none snap-row sticky top-0 z-30 mb-4">
        {([
          { key: 'learn', label: '学习基础' },
          { key: 'ai', label: 'AI 与场景' },
          { key: 'sync', label: '同步与备份' },
          { key: 'about', label: '关于' },
        ] as const).map((tab) => {
          const active = activeSettingsTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveSettingsTab(tab.key)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition cursor-pointer ${
                active
                  ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeSettingsTab === 'learn' && (<>
      {/* Section 1: Interface Language (UI Language Packs) */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
            <Languages className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm">
              {t('settings.ui_language_title')}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('settings.ui_language_desc')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          {supportedLanguages.map((lang) => {
            const isSelected = lang.code === uiLang;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  setUiLang(lang.code);
                  onUpdateSettings({ uiLanguage: lang.code });
                }}
                className={`p-3.5 rounded-2xl border text-center transition flex flex-col items-center gap-1.5 ${
                  isSelected
                    ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                }`}
              >
                <span className="text-2xl">{lang.flag}</span>
                <span className="text-xs font-bold">{lang.nativeName}</span>
                <span className="text-[10px] text-slate-400">{lang.name}</span>
                {isSelected && (
                  <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400 mt-0.5" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Section 2: Target Study Language & Primary Deck */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-indigo-500" />
          <span>{t('settings.target_lang_title')}</span>
        </h3>

        {/* Learning target switch */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              const defaultDeck = decks.find((d) => d.language === 'en')?.id || 'en-cefr-a1';
              onUpdateSettings({ learningLang: 'en', selectedDeckId: defaultDeck });
            }}
            className={`p-4 rounded-2xl border text-left transition ${
              settings.learningLang === 'en'
                ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            <div className="font-bold text-sm">{t('settings.lang_en')}</div>
            <div className="text-xs opacity-75 mt-0.5">{t('settings.lang_en_sub')}</div>
          </button>

          <button
            type="button"
            onClick={() => {
              const defaultDeck = decks.find((d) => d.language === 'ja')?.id || 'ja-jlpt-n5';
              onUpdateSettings({ learningLang: 'ja', selectedDeckId: defaultDeck });
            }}
            className={`p-4 rounded-2xl border text-left transition ${
              settings.learningLang === 'ja'
                ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            <div className="font-bold text-sm">{t('settings.lang_ja')}</div>
            <div className="text-xs opacity-75 mt-0.5">{t('settings.lang_ja_sub')}</div>
          </button>
        </div>

        {/* Deck Select */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1.5">
            {t('settings.current_deck_label')}
          </label>
          <select
            value={settings.selectedDeckId}
            onChange={(e) => onUpdateSettings({ selectedDeckId: e.target.value })}
            className="w-full p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {availableDecks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.word_count} {t('common.words')})
              </option>
            ))}
          </select>
        </div>

        <div className="pt-1 flex justify-end">
          <button
            type="button"
            onClick={onRetakePlacement}
            className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline flex items-center gap-1"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('settings.retake_placement')}</span>
          </button>
        </div>
      </div>

      {/* Section 3: Dual-Engine Speech & Audio Settings (发音优化与声源切换) */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-indigo-500" />
            <span>发音引擎优化 (在线真人音频 / 本机双引擎)</span>
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 font-semibold">
            全网成熟方案
          </span>
        </div>

        <div className="space-y-4">
          {/* Audio Engine Mode Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              发音声源模式选择：
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setAudioSource('online_first');
                  tts.setAudioSource('online_first');
                  onUpdateSettings({ audioSource: 'online_first' });
                }}
                className={`p-3 rounded-2xl border text-left transition ${
                  audioSource === 'online_first'
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 text-indigo-900 dark:text-indigo-200'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="font-bold text-xs">在线优先 (推荐)</div>
                <div className="text-[10px] opacity-75 mt-0.5">有道/Google真人原声，离线自动回退本机</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAudioSource('local_only');
                  tts.setAudioSource('local_only');
                  onUpdateSettings({ audioSource: 'local_only' });
                }}
                className={`p-3 rounded-2xl border text-left transition ${
                  audioSource === 'local_only'
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 text-indigo-900 dark:text-indigo-200'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="font-bold text-xs">纯本机离线</div>
                <div className="text-[10px] opacity-75 mt-0.5">Web Speech API 系统本地语音合成</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAudioSource('online_only');
                  tts.setAudioSource('online_only');
                  onUpdateSettings({ audioSource: 'online_only' });
                }}
                className={`p-3 rounded-2xl border text-left transition ${
                  audioSource === 'online_only'
                    ? 'bg-indigo-50 dark:bg-indigo-950/50 border-indigo-500 text-indigo-900 dark:text-indigo-200'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div className="font-bold text-xs">纯在线原声</div>
                <div className="text-[10px] opacity-75 mt-0.5">仅使用高清词典原声音频流</div>
              </button>
            </div>
          </div>

          {/* Accent choice for English */}
          {settings.learningLang === 'en' && (
            <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                英语发音口音偏好：
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEnAccent('us');
                    tts.setEnAccent('us');
                    onUpdateSettings({ enAccent: 'us' });
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    enAccent === 'us'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  美式发音 (US)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEnAccent('uk');
                    tts.setEnAccent('uk');
                    onUpdateSettings({ enAccent: 'uk' });
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${
                    enAccent === 'uk'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  英式发音 (UK)
                </button>
              </div>
            </div>
          )}

          {/* Japanese special voice optimization notice */}
          {settings.learningLang === 'ja' && (
            <div className="p-3 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs text-indigo-900 dark:text-indigo-200 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">针对日语发音与假名智能对齐优化：</span>
                <p className="text-[11px] text-indigo-800 dark:text-indigo-300 mt-0.5 leading-relaxed">
                  系统在播放日语汉字词汇时，已自动采用振假名 (Kana reading) 作为校准音频流，彻底消除日语汉字由于音读/训读歧义导致的误读（如「辛い」误读为「つらい」而非「からい」）。
                </p>
              </div>
            </div>
          )}

          {/* Auto speak & Speech Rate */}
          <div className="flex items-center justify-between pt-1">
            <div>
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {t('settings.auto_speak_label')}
              </div>
              <div className="text-[11px] text-slate-400">
                {t('settings.auto_speak_desc')}
              </div>
            </div>
            <input
              type="checkbox"
              checked={autoSpeak}
              onChange={(e) => {
                setAutoSpeak(e.target.checked);
                onUpdateSettings({ autoSpeak: e.target.checked });
              }}
              className="w-5 h-5 accent-indigo-600 rounded cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              <span>{t('settings.speech_rate_label')}</span>
              <span className="text-indigo-600 font-bold">{speechRate.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              min="0.7"
              max="1.3"
              step="0.1"
              value={speechRate}
              onChange={(e) => setSpeechRate(Number(e.target.value))}
              onMouseUp={() => onUpdateSettings({ speechRate })}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>

          <div className="pt-1 flex items-center justify-between flex-wrap gap-2">
            <button
              type="button"
              onClick={handleTestTts}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition"
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>{t('settings.test_speech_btn')}</span>
            </button>

            {testedSourceNotice && (
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium animate-in fade-in">
                {testedSourceNotice}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Section 4: Japanese Furigana & Display Showcase (针对日本语词库显示方案说明) */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-500" />
            <span>日语汉字振假名 (Ruby Furigana) 与音调显示方案</span>
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 font-semibold">
            HTML5 &lt;ruby&gt; 标准
          </span>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          针对用户导入或添加日语词库时「汉字多音、读音不对」的问题，本应用已全面支持全网主流格式（WaniKani / NHK Easy / Anki）：
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
            <div className="font-bold text-slate-800 dark:text-slate-200">1. 标准括号振假名格式</div>
            <div className="text-[11px] text-slate-400">支持 <code>散歩[さんぽ]</code> 或 <code>新[あたら]しい</code></div>
            <div className="pt-2 text-base font-bold text-slate-900 dark:text-white">
              实时渲染预览：<JapaneseRubyText text="新[あたら]しい" /> · <JapaneseRubyText text="散歩[さんぽ]" />
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
            <div className="font-bold text-slate-800 dark:text-slate-200">2. 汉字 + 读音对齐与声调</div>
            <div className="text-[11px] text-slate-400">词条自动对齐假名，标注 ⓪平板 / ①头高</div>
            <div className="pt-2 text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <JapaneseRubyText text="日本語" reading="にほんご" />
              <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200 font-semibold">
                ⓪ 平板型
              </span>
            </div>
          </div>
        </div>
      </div>

      </>)}
      {activeSettingsTab === 'ai' && (<>
      {/* Section 5: AI Practice Scenarios Manager (AI 实战自定义添加与管理) */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <Bot className="w-4 h-4 text-indigo-500" />
              <span>AI 实战场景管理 (支持自定义添加)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              自定义角色设定、专属开场白与交流目标，在 AI 实战中任意选用
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                storage.resetToDefaultScenarios();
                refreshStorageLists();
              }}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-semibold transition"
              title="载入官方包含建筑工程、居酒屋、技术面试等10大场景"
            >
              载入官方实战模板
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingScenario(null);
                setShowScenarioModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>新建场景</span>
            </button>
          </div>
        </div>

        {/* Custom Scenarios List */}
        <div className="space-y-2">
          {customScenarios.length === 0 ? (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-dashed border-slate-200 dark:border-slate-700 text-center text-xs text-slate-400">
              暂无自定义场景，点击右上角「新建场景」即可一键选用成熟模板或自由创作
            </div>
          ) : (
            customScenarios.map((sc) => (
              <div
                key={sc.id}
                className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white text-xs">{sc.title}</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-semibold uppercase">
                      {sc.language === 'ja' ? '🇯🇵 日语' : sc.language === 'en' ? '🇬🇧 英语' : '🌐 双语'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{sc.desc}</p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingScenario(sc);
                      setShowScenarioModal(true);
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      storage.deleteCustomScenario(sc.id);
                      refreshStorageLists();
                    }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Section 5.5: AI Multi-Provider & Cloud Sync (Vercel AI SDK + PostgreSQL + AES-256-GCM) */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-500" />
              <span>AI 模型服务与多端配置 (Vercel AI SDK)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              支持 DeepSeek / Gemini / OpenAI 及自定义兼容接口，服务端 AES-256-GCM 高度加密保护，支持 PostgreSQL 全设备免密共享
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* DB status badge */}
            <span
              className={`text-[11px] px-2.5 py-1 rounded-xl flex items-center gap-1.5 font-medium border ${
                aiConfig?.dbConnected
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>{aiConfig?.dbConnected ? 'PostgreSQL 云端持久化 (已连接)' : '本地缓存持久化模式'}</span>
            </span>

            {/* Encryption badge */}
            <span className="text-[11px] px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 flex items-center gap-1.5 font-medium">
              <Shield className="w-3.5 h-3.5" />
              <span>AES-256-GCM 加密</span>
            </span>
          </div>
        </div>

        {/* Provider Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
          <button
            type="button"
            onClick={() => setActiveAiTab('gemini')}
            className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
              activeAiTab === 'gemini'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">Google Gemini</span>
              {aiConfig?.geminiConfigured && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="已配置" />
              )}
            </div>
            <span className="text-[10px] text-slate-400 mt-1">官方推荐 · 极速响应</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveAiTab('deepseek')}
            className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
              activeAiTab === 'deepseek'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">DeepSeek</span>
              {aiConfig?.deepseekConfigured && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="已配置" />
              )}
            </div>
            <span className="text-[10px] text-slate-400 mt-1">深度推理 · 高性价比</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveAiTab('openai')}
            className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
              activeAiTab === 'openai'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">OpenAI</span>
              {aiConfig?.openaiConfigured && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="已配置" />
              )}
            </div>
            <span className="text-[10px] text-slate-400 mt-1">GPT-4o / GPT-4o-mini</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveAiTab('custom')}
            className={`p-3 rounded-2xl border text-left transition flex flex-col justify-between ${
              activeAiTab === 'custom'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-500 text-indigo-900 dark:text-indigo-200 shadow-xs'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold">自定义接口</span>
              {aiConfig?.customConfigured && (
                <span className="w-2 h-2 rounded-full bg-emerald-500" title="已配置" />
              )}
            </div>
            <span className="text-[10px] text-slate-400 mt-1">兼容 OpenAI 任意规范</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-4">
          {/* Active Provider Indicator */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700/60">
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
              当前编辑厂商：{
                activeAiTab === 'gemini' ? 'Google Gemini' :
                activeAiTab === 'deepseek' ? 'DeepSeek' :
                activeAiTab === 'openai' ? 'OpenAI' : '自定义 OpenAI 兼容接口'
              }
            </span>
            {aiConfig?.activeProvider === activeAiTab && (
              <span className="text-[11px] px-2 py-0.5 rounded-md bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-semibold flex items-center gap-1">
                <Check className="w-3 h-3" />
                <span>当前全站主用</span>
              </span>
            )}
          </div>

          {/* Gemini Tab */}
          {activeAiTab === 'gemini' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  Gemini 模型选择：
                </label>
                <div className="space-y-2">
                  <select
                    value={geminiModelInput}
                    onChange={(e) => setGeminiModelInput(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="gemini-3.8-flash">gemini-3.8-flash (官方推荐 · 最新稳定)</option>
                    <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (极低延迟 · 极速免排队)</option>
                    <option value="gemini-flash-latest">gemini-flash-latest (实时动态主分支)</option>
                    <option value="gemini-2.5-pro">gemini-2.5-pro (深度多模态推理)</option>
                    <option value="custom_input">手动输入其他模型标识...</option>
                  </select>
                  {geminiModelInput === 'custom_input' && (
                    <input
                      type="text"
                      placeholder="输入自定义 Gemini 模型名称（如 gemini-3.1-pro-preview）"
                      onChange={(e) => setGeminiModelInput(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono"
                    />
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Gemini API Key：
                  </label>
                  {aiConfig?.geminiConfigured && !isEditingGeminiKey && (
                    <button
                      type="button"
                      onClick={() => setIsEditingGeminiKey(true)}
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                    >
                      重新输入密钥
                    </button>
                  )}
                </div>

                {aiConfig?.geminiConfigured && !isEditingGeminiKey ? (
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-600 dark:text-slate-400">
                      {aiConfig.geminiKeyMasked}
                    </span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>已服务端安全加密存储</span>
                    </span>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="AIzaSy... (若留空则优先使用服务器 GEMINI_API_KEY 环境变量)"
                      value={geminiApiKeyInput}
                      onChange={(e) => setGeminiApiKeyInput(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* DeepSeek Tab */}
          {activeAiTab === 'deepseek' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  DeepSeek 官方模型选择：
                </label>
                <div className="flex gap-2">
                  <select
                    value={deepseekModelInput}
                    onChange={(e) => setDeepseekModelInput(e.target.value)}
                    className="flex-1 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="deepseek-chat">deepseek-chat (DeepSeek-V3 通用多轮对话 · 推荐)</option>
                    <option value="deepseek-reasoner">deepseek-reasoner (DeepSeek-R1 深度长思维链推理)</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    DeepSeek API Key：
                  </label>
                  {aiConfig?.deepseekConfigured && !isEditingDeepseekKey && (
                    <button
                      type="button"
                      onClick={() => setIsEditingDeepseekKey(true)}
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                    >
                      重新输入密钥
                    </button>
                  )}
                </div>

                {aiConfig?.deepseekConfigured && !isEditingDeepseekKey ? (
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-600 dark:text-slate-400">
                      {aiConfig.deepseekKeyMasked}
                    </span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>已服务端安全加密存储</span>
                    </span>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="sk-..."
                      value={deepseekApiKeyInput}
                      onChange={(e) => setDeepseekApiKeyInput(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* OpenAI Tab */}
          {activeAiTab === 'openai' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  OpenAI 模型选择：
                </label>
                <div className="flex gap-2">
                  <select
                    value={openaiModelInput}
                    onChange={(e) => setOpenaiModelInput(e.target.value)}
                    className="flex-1 p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="gpt-4o-mini">gpt-4o-mini (极速经济)</option>
                    <option value="gpt-4o">gpt-4o (旗舰)</option>
                    <option value="gpt-4-turbo">gpt-4-turbo</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    OpenAI API Key：
                  </label>
                  {aiConfig?.openaiConfigured && !isEditingOpenaiKey && (
                    <button
                      type="button"
                      onClick={() => setIsEditingOpenaiKey(true)}
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                    >
                      重新输入密钥
                    </button>
                  )}
                </div>

                {aiConfig?.openaiConfigured && !isEditingOpenaiKey ? (
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-600 dark:text-slate-400">
                      {aiConfig.openaiKeyMasked}
                    </span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>已服务端安全加密存储</span>
                    </span>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="sk-proj-..."
                      value={openaiApiKeyInput}
                      onChange={(e) => setOpenaiApiKeyInput(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Custom OpenAI-Compatible Tab */}
          {activeAiTab === 'custom' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  接口 Base URL (兼容 OpenAI 规范)：
                </label>
                <input
                  type="text"
                  placeholder="https://api.siliconflow.cn/v1 或 https://openrouter.ai/api/v1"
                  value={customBaseUrlInput}
                  onChange={(e) => setCustomBaseUrlInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                  模型名称 (Model Identifier)：
                </label>
                <input
                  type="text"
                  placeholder="如 deepseek-ai/DeepSeek-V3 或 Qwen/Qwen2.5-72B-Instruct"
                  value={customModelInput}
                  onChange={(e) => setCustomModelInput(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                />

                {/* Quick Presets */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-400">常用预设：</span>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomBaseUrlInput('https://api.siliconflow.cn/v1');
                      setCustomModelInput('deepseek-ai/DeepSeek-V3');
                    }}
                    className="px-2 py-0.5 rounded-lg text-[11px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-600 dark:text-slate-300 transition"
                  >
                    硅基流动 (DeepSeek-V3)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomBaseUrlInput('https://api.siliconflow.cn/v1');
                      setCustomModelInput('deepseek-ai/DeepSeek-R1');
                    }}
                    className="px-2 py-0.5 rounded-lg text-[11px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-600 dark:text-slate-300 transition"
                  >
                    硅基流动 (DeepSeek-R1)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCustomBaseUrlInput('https://openrouter.ai/api/v1');
                      setCustomModelInput('deepseek/deepseek-chat');
                    }}
                    className="px-2 py-0.5 rounded-lg text-[11px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-slate-600 dark:text-slate-300 transition"
                  >
                    OpenRouter
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    API Key：
                  </label>
                  {aiConfig?.customConfigured && !isEditingCustomKey && (
                    <button
                      type="button"
                      onClick={() => setIsEditingCustomKey(true)}
                      className="text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                    >
                      重新输入密钥
                    </button>
                  )}
                </div>

                {aiConfig?.customConfigured && !isEditingCustomKey ? (
                  <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs">
                    <span className="font-mono text-slate-600 dark:text-slate-400">
                      {aiConfig.customKeyMasked}
                    </span>
                    <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>已服务端安全加密存储</span>
                    </span>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="sk-..."
                      value={customApiKeyInput}
                      onChange={(e) => setCustomApiKeyInput(e.target.value)}
                      className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* AI Notice Alert */}
          {aiNotice && (
            <div
              className={`p-3 rounded-2xl text-xs font-medium space-y-1.5 ${
                aiNotice.success
                  ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
                  : 'bg-rose-50 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
              }`}
            >
              <div className="flex items-center gap-2 font-bold">
                {aiNotice.success ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                <span>{aiNotice.message}</span>
              </div>
              {aiNotice.sampleReply && (
                <div className="text-[11px] opacity-90 pl-6 border-l-2 border-emerald-400">
                  返回示例: {aiNotice.sampleReply}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-slate-700/60">
            <button
              type="button"
              disabled={isTestingAi}
              onClick={handleTestAi}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTestingAi ? 'animate-spin' : ''}`} />
              <span>{isTestingAi ? '连通性测试中...' : '测试当前模型连通性'}</span>
            </button>

            <button
              type="button"
              disabled={isSavingAi}
              onClick={handleSaveAi}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>{isSavingAi ? '正在加密保存...' : '设为当前活动模型 & 加密保存至云端'}</span>
            </button>
          </div>
        </div>
      </div>

      </>)}
      {activeSettingsTab === 'learn' && (<>
      {/* Section 6: Quotas & Study Plan */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
          <Sliders className="w-4 h-4 text-indigo-500" />
          <span>{t('settings.quota_title')}</span>
        </h3>

        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              <span>{t('settings.daily_new_label')}</span>
              <span className="text-indigo-600 font-bold">{dailyNew} {t('common.words')}</span>
            </div>
            <input
              type="range"
              min="5"
              max="60"
              step="5"
              value={dailyNew}
              onChange={(e) => setDailyNew(Number(e.target.value))}
              onMouseUp={handleSaveQuotas}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              <span>{t('settings.daily_review_label')}</span>
              <span className="text-indigo-600 font-bold">{dailyReview} {t('common.words')}</span>
            </div>
            <input
              type="range"
              min="10"
              max="200"
              step="10"
              value={dailyReview}
              onChange={(e) => setDailyReview(Number(e.target.value))}
              onMouseUp={handleSaveQuotas}
              className="w-full accent-indigo-600 cursor-pointer"
            />
          </div>

          {/* 生词本是否并入学习队列 */}
          <div className="flex items-start justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t('settings.include_custom_label')}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                {t('settings.include_custom_desc')}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={includeCustom}
              onClick={() => {
                setIncludeCustom(!includeCustom);
                onUpdateSettings({ includeCustomWords: !includeCustom });
              }}
              className={`relative w-12 h-7 min-w-[48px] rounded-full transition shrink-0 ${
                includeCustom ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
              }`}
            >
              <span
                className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${
                  includeCustom ? 'left-6' : 'left-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      </>)}
      {activeSettingsTab === 'sync' && (<>
      {/* Section 6.4: PostgreSQL Cloud Real-time Sync (Vercel + Neon 日常自动同步) */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <Database className="w-4 h-4 text-indigo-500" />
              <span>PostgreSQL 云端实时同步</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              日常学习数据自动后台同步（防抖 + 批次），跨设备无缝衔接。下方的 WebDAV 仅作为独立网盘冷备份。
            </p>
          </div>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 ${
              cloudSyncStatus === 'syncing'
                ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400'
                : cloudSyncStatus === 'offline'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  : cloudSyncStatus === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {cloudSyncStatus === 'syncing'
              ? '同步中'
              : cloudSyncStatus === 'offline'
                ? '离线缓存'
                : cloudSyncStatus === 'error'
                  ? '同步失败'
                : '已同步'}
          </span>
        </div>

        {/* 状态信息 */}
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/50 rounded-2xl px-4 py-3">
          {isManualCloudSync || isCloudPulling || cloudSyncStatus === 'syncing' ? (
            <RefreshCw className="w-4 h-4 text-sky-500 animate-spin" />
          ) : cloudSyncStatus === 'offline' ? (
            <AlertTriangle className="w-4 h-4 text-slate-400" />
          ) : cloudSyncStatus === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          ) : (
            <Check className="w-4 h-4 text-emerald-500" />
          )}
          <span className="flex-1">
            {cloudSyncStatus === 'syncing'
              ? '正在与云端同步...'
              : cloudSyncStatus === 'offline'
                ? '云端不可达，已切换为离线缓存模式（本地数据不受影响）'
                : cloudSyncStatus === 'error'
                  ? `同步失败：${cloudSyncError || '未知错误'}`
                  : cloudSyncLastAt
                    ? `上次同步：${new Date(cloudSyncLastAt).toLocaleString()}`
                    : '尚未同步，点击下方按钮开始'}
          </span>
        </div>

        {cloudSyncNotice && (
          <div
            className={`p-3.5 rounded-2xl text-xs font-medium flex items-center gap-2 ${
              cloudSyncNotice.success
                ? 'bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
            }`}
          >
            {cloudSyncNotice.success ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span className="flex-1">{cloudSyncNotice.message}</span>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleManualCloudSync}
            disabled={isManualCloudSync}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs font-bold transition shadow-sm"
          >
            <CloudUpload className="w-3.5 h-3.5" />
            <span>{isManualCloudSync ? '同步中...' : '立即同步'}</span>
          </button>
          <button
            type="button"
            onClick={handleCloudRePull}
            disabled={isCloudPulling}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-60 text-slate-700 dark:text-slate-200 text-xs font-bold transition"
          >
            <CloudDownload className="w-3.5 h-3.5" />
            <span>{isCloudPulling ? '拉取中...' : '从云端重新拉取合并'}</span>
          </button>
        </div>

        <div className="text-[10px] text-slate-400 leading-relaxed">
          ⚙️ 同步机制：本地变更累计达到阈值或静置 20 秒后自动推送；切回前台静默拉取。包含词库进度、自定义词、自建场景、学习日志、成就与设置，WebDAV 密码等敏感信息不入库。
        </div>
      </div>

      {/* Section 6.5: WebDAV Cloud Sync (跨端网盘无缝同步 - 坚果云 / Nextcloud / 群晖 NAS / Alist) */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <Cloud className="w-4 h-4 text-sky-500" />
              <span>WebDAV 云端数据同步 (跨端防丢)</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              主流学术笔记标配（Joplin / Zotero / Obsidian 同款架构）：零服务器运营成本，数据完全自主掌控
            </p>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 font-semibold flex items-center gap-1">
            <Globe className="w-3 h-3" />
            <span>私有云直连</span>
          </span>
        </div>

        {/* Quick Presets */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
            快速选用常用 WebDAV 服务商模板：
          </label>
          <div className="flex flex-wrap gap-2">
            {[
              { name: 'pCloud', url: 'https://ewebdav.pcloud.com', username: 'li5968347@outlook.com' },
              { name: 'Koofr.net', url: 'https://app.koofr.net/dav/Koofr/' },
              { name: '坚果云 (Jianguoyun)', url: 'https://dav.jianguoyun.com/dav/' },
              { name: 'Nextcloud / ownCloud', url: 'https://cloud.example.com/remote.php/dav/files/USER/' },
              { name: '群晖 NAS (Synology)', url: 'https://nas-ip:5006/' },
              { name: 'Alist 私有网盘', url: 'http://127.0.0.1:5244/dav/' },
              { name: 'InfiniCLOUD', url: 'https://teracloud.jp/dav/' },
            ].map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => {
                  const delta: { serverUrl: string; useServerPreset: boolean; username?: string } = {
                    serverUrl: p.url,
                    useServerPreset: false,
                  };
                  if (p.username) delta.username = p.username;
                  handleUpdateWebdav(delta);
                }}
                className="px-2.5 py-1 rounded-xl text-[11px] font-medium bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-sky-400 text-slate-600 dark:text-slate-300 transition cursor-pointer"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>

        {/* Server Preset Mode Banner */}
        <div className="p-3.5 rounded-2xl bg-sky-50/70 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-900/60 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
            <div>
              <span className="font-bold text-sky-900 dark:text-sky-200">
                多设备免重复配置模式
              </span>
              <p className="text-[11px] text-sky-700 dark:text-sky-300 mt-0.5">
                在 Vercel 环境变量中配置 WEBDAV_* 即可免密跨设备自动直连 Koofr 或私有网盘
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              const nextVal = !webdavConfig.useServerPreset;
              handleUpdateWebdav({ useServerPreset: nextVal });
            }}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs transition cursor-pointer ${
              webdavConfig.useServerPreset
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
            }`}
          >
            {webdavConfig.useServerPreset ? '已启用服务端预设' : '使用手动自定义'}
          </button>
        </div>


        {/* Configuration Form */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              WebDAV 服务器完整 URL:
            </label>
            <input
              type="text"
              value={webdavConfig.serverUrl}
              onChange={(e) => handleUpdateWebdav({ serverUrl: e.target.value })}
              placeholder="https://dav.jianguoyun.com/dav/"
              className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              账号 / 邮箱 (Username):
            </label>
            <input
              type="text"
              value={webdavConfig.username}
              onChange={(e) => handleUpdateWebdav({ username: e.target.value })}
              placeholder="your-account@example.com"
              className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              应用授权密码 / 密码:
            </label>
            <div className="relative">
              <input
                type={showWebdavPassword ? 'text' : 'password'}
                value={webdavConfig.password}
                onChange={(e) => handleUpdateWebdav({ password: e.target.value })}
                placeholder="坚果云/Nextcloud中生成的授权码"
                className="w-full pl-3.5 pr-10 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500"
              />
              <button
                type="button"
                onClick={() => setShowWebdavPassword(!showWebdavPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition"
              >
                {showWebdavPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              云端存储相对路径:
            </label>
            <input
              type="text"
              value={webdavConfig.remotePath}
              onChange={(e) => handleUpdateWebdav({ remotePath: e.target.value })}
              placeholder="/MemorizeWord/memorize_word_backup.json"
              className="w-full px-3.5 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-sky-500 font-mono text-[11px]"
            />
          </div>
        </div>

        {/* Sync Status Banner */}
        {webdavNotice && (
          <div
            className={`p-3 rounded-2xl text-xs font-medium flex items-center gap-2 ${
              webdavNotice.success
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
            }`}
          >
            {webdavNotice.success ? <Check className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
            <span className="flex-1">{webdavNotice.message}</span>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isTestingWebdav}
              onClick={handleTestWebdav}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-semibold transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTestingWebdav ? 'animate-spin' : ''}`} />
              <span>{isTestingWebdav ? '连接测试中...' : '测试连接认证'}</span>
            </button>

            {webdavConfig.lastSyncAt && (
              <span className="text-[11px] text-slate-400">
                最近同步: {new Date(webdavConfig.lastSyncAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isUploadingWebdav}
              onClick={handleUploadToWebdav}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold transition shadow-xs disabled:opacity-50"
            >
              <CloudUpload className="w-3.5 h-3.5" />
              <span>{isUploadingWebdav ? '正在上传...' : '立即备份至 WebDAV'}</span>
            </button>

            <button
              type="button"
              disabled={isDownloadingWebdav}
              onClick={handleDownloadFromWebdav}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-xs font-bold transition disabled:opacity-50"
            >
              <CloudDownload className="w-3.5 h-3.5" />
              <span>{isDownloadingWebdav ? '正在下载...' : '从 WebDAV 拉取恢复'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Section 7: Manual Backup, Snapshots & Data Sync (手动备份功能增强) */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <Download className="w-4 h-4 text-indigo-500" />
              <span>数据备份、历史快照与多格式导出</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              全网成熟防丢档架构：支持快照一键保存回滚、完整 JSON 备份及 Anki/Excel 导出
            </p>
          </div>

          <button
            type="button"
            onClick={handleCreateSnapshot}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition border border-indigo-200 dark:border-indigo-800"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>立即存档快照</span>
          </button>
        </div>

        {/* Local Snapshots List */}
        <div>
          <div className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2 flex items-center gap-1">
            <History className="w-3.5 h-3.5 text-slate-400" />
            <span>本地历史快照存档 (最多保留 10 份)：</span>
          </div>

          {snapshots.length === 0 ? (
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-700">
              暂无快照，点击「立即存档快照」可瞬间生成当前记忆进度还原点
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {snapshots.map((snap) => (
                <div
                  key={snap.id}
                  className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{snap.name}</span>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      学习词数: {snap.learnedCount} · 连续打卡: {snap.streak}天 · 大小: {snap.sizeKb}KB
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleRestoreSnapshot(snap.id, snap.name)}
                      className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition"
                    >
                      还原
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSnapshot(snap.id)}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {importNotice && (
          <div
            className={`p-3 rounded-2xl text-xs font-medium flex items-center gap-2 ${
              importNotice.success
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300'
                : 'bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
            }`}
          >
            {importNotice.success ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
            <span>{importNotice.message}</span>
          </div>
        )}

        {/* Export / Import Button Group */}
        <div className="flex flex-wrap gap-2.5 pt-2">
          <button
            type="button"
            onClick={handleExportJson}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 text-xs font-bold transition border border-indigo-200/60 dark:border-indigo-800"
          >
            <Download className="w-3.5 h-3.5" />
            <span>导出全部备份 (JSON)</span>
          </button>

          <button
            type="button"
            onClick={handleExportAnkiTsv}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs font-bold transition border border-emerald-200/60 dark:border-emerald-800"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>导出为 Anki / Excel (TSV)</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>导入备份文件...</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleSelectFile}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => setShowConfirmReset(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-xs font-semibold transition ml-auto"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('settings.reset_btn')}</span>
          </button>
        </div>
      </div>

      {/* Section 7.5: Global Security & Session */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white text-xs">
              全局访问密码保护：会话生效中
            </h4>
            <p className="text-[11px] text-slate-400 mt-0.5">
              已启用 30 天 HttpOnly 安全 Cookie 会话凭据，受服务端严密保护
            </p>
          </div>
        </div>

        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 dark:hover:text-rose-300 text-slate-600 dark:text-slate-300 text-xs font-bold transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>退出当前会话</span>
          </button>
        )}
      </div>

      </>)}
      {activeSettingsTab === 'about' && (<>
      {/* Section 8: About */}
      <div className="bg-slate-50 dark:bg-slate-900/60 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 text-xs text-slate-500 space-y-2">
        <h4 className="font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" />
          <span>{t('settings.about_title')}</span>
        </h4>
        <p>
          MemorizeWord v2 · 科学 FSRS-5 记忆算法 · 双引擎真人音频 · 日语振假名校音 · Gemini 3.8 Flash AI
        </p>
      </div>
      </>)}
    </div>
  );
};

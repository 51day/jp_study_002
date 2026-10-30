import React, { useState, useRef, useEffect } from 'react';
import {
  Home,
  PlayCircle,
  Sparkles,
  BookOpen,
  BarChart3,
  Settings,
  Languages,
  BookMarked,
  Check,
  ChevronDown,
  User,
  Cloud,
  RefreshCw,
  CloudOff,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { Language, UILanguage, CloudSyncStatus } from '../types';
import { useI18n } from '../i18n';
import { storage } from '../services/storage';

export type NavTab = 'home' | 'study' | 'ai_chat' | 'library' | 'stats' | 'settings' | 'profile';

// 「我的」聚合了几个二级页面，进入这些页面时 tab 仍应保持高亮
const PROFILE_TABS: NavTab[] = ['profile', 'library', 'stats', 'settings'];

interface NavbarProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  language: Language;
  onLanguageToggle: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  language,
  onLanguageToggle,
}) => {
  const { t, uiLang, setUiLang, supportedLanguages } = useI18n();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const langMenuRef = useRef<HTMLDivElement>(null);

  // 云同步状态指示器
  const [syncStatus, setSyncStatus] = useState<CloudSyncStatus>(() => storage.getSyncStatus().status);
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(() => storage.getSyncStatus().lastSyncedAt);
  const [syncError, setSyncError] = useState<string | null>(() => storage.getSyncStatus().errorMessage);

  useEffect(() => {
    const unsubscribe = storage.subscribeSyncStatus((status, lastAt, errMsg) => {
      setSyncStatus(status);
      setLastSyncedAt(lastAt);
      setSyncError(errMsg);
      if (status !== 'syncing') setIsManualSyncing(false);
    });
    return unsubscribe;
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (langMenuRef.current && !langMenuRef.current.contains(e.target as Node)) {
        setShowLangMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { id: 'home', label: t('nav.home'), icon: Home },
    { id: 'study', label: t('nav.study'), icon: PlayCircle },
    { id: 'ai_chat', label: t('nav.ai_chat'), icon: Sparkles, badge: t('nav.badge_v2') },
    { id: 'profile', label: t('nav.profile'), icon: User },
  ];

  // 进入词库/统计/设置时，「我的」保持选中态
  const isItemActive = (id: string) =>
    id === 'profile' ? PROFILE_TABS.includes(activeTab) : activeTab === id;

  const currentUiLangObj = supportedLanguages.find((l) => l.code === uiLang) || supportedLanguages[0];

  return (
    <header className="shrink-0 sticky top-0 z-40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 transition">
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between gap-2">
        {/* Brand */}
        <div
          onClick={() => onTabChange('home')}
          className="flex items-center gap-2.5 cursor-pointer select-none"
        >
          <div className="w-9 h-9 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black shadow-md shadow-indigo-500/20">
            词
          </div>
          <div>
            <div className="font-black text-base text-slate-900 dark:text-white tracking-tight leading-none">
              背单词 <span className="text-indigo-600 text-xs font-semibold">FSRS + AI</span>
            </div>
            <div className="text-[10px] text-slate-400 font-medium leading-none mt-1">
              MemorizeWord v2
            </div>
          </div>
        </div>

        {/* Desktop Nav Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/60 p-1.5 rounded-2xl border border-slate-200 dark:border-slate-700/60">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = isItemActive(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onTabChange(item.id as NavTab)}
                className={`flex items-center gap-1.5 px-4 min-h-[44px] rounded-xl text-xs font-semibold transition relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                  isActive
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
                {item.badge && (
                  <span className="text-[9px] px-1 py-0.2 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-bold">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right Actions: Cloud Sync Indicator + UI Language Selector & Target Vocab Toggle */}
        <div className="flex items-center gap-2">
          {/* Cloud Sync Status Indicator */}
          <button
            type="button"
            onClick={() => {
              setIsManualSyncing(true);
              storage.syncToCloud().catch(() => setIsManualSyncing(false));
            }}
            title={
              syncStatus === 'syncing'
                ? '正在同步中...'
                : syncStatus === 'offline'
                  ? '离线缓存模式（云端不可达，本地数据已保留）'
                  : syncStatus === 'error'
                    ? `同步失败：${syncError || '未知错误'}，点击重试`
                    : lastSyncedAt
                      ? `已同步 · 上次同步 ${new Date(lastSyncedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : '点击立即同步到云端'
            }
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold transition border ${
              syncStatus === 'syncing'
                ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-300 border-sky-200 dark:border-sky-800'
                : syncStatus === 'offline'
                  ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700'
                  : syncStatus === 'error'
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                    : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
            }`}
          >
            {(isManualSyncing || syncStatus === 'syncing') ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : syncStatus === 'offline' ? (
              <CloudOff className="w-3.5 h-3.5" />
            ) : syncStatus === 'error' ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : syncStatus === 'synced' ? (
              <Check className="w-3.5 h-3.5" />
            ) : (
              <Cloud className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {syncStatus === 'syncing'
                ? '同步中...'
                : syncStatus === 'offline'
                  ? '离线缓存'
                  : syncStatus === 'error'
                    ? '同步失败'
                    : '已同步'}
            </span>
          </button>

          {/* Interface Language Dropdown */}
          <div className="relative" ref={langMenuRef}>
            <button
              type="button"
              onClick={() => setShowLangMenu(!showLangMenu)}
              aria-label="切换界面语言"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 transition border border-slate-200 dark:border-slate-700"
            >
              <Languages className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{currentUiLangObj.flag} {currentUiLangObj.nativeName}</span>
              <ChevronDown className="w-3 h-3 text-slate-400 ml-0.5" />
            </button>

            {showLangMenu && (
              <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100 dark:border-slate-800">
                  {t('settings.ui_language_title')}
                </div>
                {supportedLanguages.map((l) => {
                  const isSelected = l.code === uiLang;
                  return (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => {
                        setUiLang(l.code as UILanguage);
                        setShowLangMenu(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2 text-xs transition ${
                        isSelected
                          ? 'bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 font-bold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span>{l.flag}</span>
                        <span>{l.nativeName}</span>
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Target Vocabulary Switcher */}
          <button
            type="button"
            onClick={onLanguageToggle}
            title="点击切换正在学习的目标词库 (英语/日语)"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-xs font-bold text-indigo-700 dark:text-indigo-300 transition border border-indigo-200/80 dark:border-indigo-800/80"
          >
            <BookMarked className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span>{language === 'ja' ? '日语 JLPT' : '英语 CEFR'}</span>
          </button>
        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] flex items-center justify-around">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = isItemActive(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id as NavTab)}
              className={`flex flex-col items-center justify-center gap-1 flex-1 min-h-[48px] px-2 rounded-xl transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <div className="relative">
                <Icon className="w-5 h-5" />
                {item.badge && (
                  <span className="absolute -top-1 -right-2 w-2 h-2 rounded-full bg-indigo-600" />
                )}
              </div>
              <span className="text-[10px]">{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};

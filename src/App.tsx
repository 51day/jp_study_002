import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Navbar, NavTab } from './components/Navbar';
import { HomeView } from './components/HomeView';
import { StudyView, StudySessionMode } from './components/StudyView';
import { AiChatView } from './components/AiChatView';
import { LibraryView } from './components/LibraryView';
import { StatsView } from './components/StatsView';
import { SettingsView } from './components/SettingsView';
import { ProfileView } from './components/ProfileView';
import { WordDetailModal } from './components/WordDetailModal';
import { AddWordModal } from './components/AddWordModal';
import { PlacementModal } from './components/PlacementModal';
import { LoginModal } from './components/LoginModal';
import { LanguageOnboardingModal } from './components/LanguageOnboardingModal';
import { PageScroll } from './components/PageScroll';
import { useBodyScrollLock } from './hooks/useBodyScrollLock';
import { Word, Deck, UserSettings, Suggestion, Language } from './types';
import { storage } from './services/storage';
import { SuggestionEngine } from './services/suggestions';
import { apiClient, LoginResponse } from './services/apiClient';
import { inferWordLanguage } from './services/storage';
import { I18nProvider } from './i18n';

export default function App() {
  const [settings, setSettings] = useState<UserSettings>(() => storage.getSettings());
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  // 本次要进的学习会话类型：review=只复习到期卡 / new=只学新词 / mixed=两者混编
  const [studyMode, setStudyMode] = useState<StudySessionMode>('mixed');
  const [decks, setDecks] = useState<Deck[]>([]);
  const [deckWords, setDeckWords] = useState<Word[]>([]);
  const [customWords, setCustomWords] = useState<Word[]>(() => storage.getCustomWords());
  const [progressMap, setProgressMap] = useState(() => storage.getProgressMap());
  const [studyLogs, setStudyLogs] = useState(() => storage.getStudyLogs());
  const [achievements, setAchievements] = useState(() => storage.getAchievements());

  // Auth & Session States
  const [authState, setAuthState] = useState<'loading' | 'unauthenticated' | 'authenticated'>('loading');
  const [serverRequiresSetup, setServerRequiresSetup] = useState(false);
  // 首次云端同步是否已完成（或失败回退）。用于防止 onboarding 抢跑与默认初始化覆盖旧设备设置。
  const [initialSyncDone, setInitialSyncDone] = useState(false);

  // Modals
  const [detailWord, setDetailWord] = useState<Word | null>(null);
  const [showAddWordModal, setShowAddWordModal] = useState(false);
  const [showPlacementModal, setShowPlacementModal] = useState(false);
  const [showLanguageOnboarding, setShowLanguageOnboarding] = useState(false);
  const [aiFocusWord, setAiFocusWord] = useState<Word | null>(null);

  // Deck word cache
  const [wordsCache, setWordsCache] = useState<Record<string, Word[]>>({});

  // 1. Initial Authentication Status Check
  useEffect(() => {
    apiClient
      .getAuthStatus()
      .then((status) => {
        if (status.authenticated) {
          setAuthState('authenticated');
          if (status.webdavConfigured && status.webdavPreset) {
            storage.saveWebDavConfig({
              isServerPresetActive: true,
              useServerPreset: true,
              serverUrl: status.webdavPreset.serverUrl,
              username: status.webdavPreset.username,
              remotePath: status.webdavPreset.remotePath,
            });
          }
        } else {
          setAuthState('unauthenticated');
        }
      })
      .catch((err: any) => {
        if (err.message && err.message.includes('503')) {
          setServerRequiresSetup(true);
        }
        setAuthState('unauthenticated');
      });

    const unsubscribe = apiClient.onUnauthorized(() => {
      setAuthState('unauthenticated');
    });

    return unsubscribe;
  }, []);

// 2. Language Onboarding —— 必须等首次云端同步检查完成后再决定是否弹出，
  //    防止新设备登录时未拉取云端就抢先弹窗让你选词库
  useEffect(() => {
    if (authState === 'authenticated' && initialSyncDone && !settings.onboardingCompleted) {
      setShowLanguageOnboarding(true);
    }
  }, [authState, initialSyncDone, settings.onboardingCompleted]);

  // Fetch Decks Index —— 立即拉取列表用于展示；自动校正词库需等首次云端同步完成，避免默认初始化覆盖旧设备设置
  useEffect(() => {
    if (authState !== 'authenticated') return;
    fetch('/data/decks.json')
      .then((res) => res.json())
      .then((data: Deck[]) => {
        setDecks(data);
        if (!initialSyncDone) return; // 等云端合并后再校正
        const currentValid = data.find(
          (d) => d.id === settings.selectedDeckId && d.language === settings.learningLang
        );
        if (!currentValid) {
          const match = data.find((d) => d.language === settings.learningLang);
          if (match) {
            handleUpdateSettings({ selectedDeckId: match.id });
          }
        }
      })
      .catch((err) => console.error('Failed to load decks index:', err));
  }, [authState, settings.learningLang, initialSyncDone]);


  // Load words for selected deck
  const loadDeckWords = useCallback(
    async (deckId: string) => {
      if (wordsCache[deckId]) {
        setDeckWords(wordsCache[deckId]);
        return;
      }
      try {
        const res = await fetch(`/data/decks/${deckId}.json`);
        if (!res.ok) throw new Error('Deck file not found');
        const words: Word[] = await res.json();
        setWordsCache((prev) => ({ ...prev, [deckId]: words }));
        setDeckWords(words);
      } catch (err) {
        console.error(`Failed to load words for deck ${deckId}:`, err);
      }
    },
    [wordsCache]
  );

  useEffect(() => {
    if (settings.selectedDeckId) {
      loadDeckWords(settings.selectedDeckId);
    }
  }, [settings.selectedDeckId, loadDeckWords]);

  // Check onboarding on first visit is handled via showLanguageOnboarding

  // 生词本按当前学习目标语言过滤：自定义词过去没有 language 字段，
  // 日语模式下会把英语生词（以及反向）一起算进数量、混在列表里。
  const customWordsForLang = useMemo(() => {
    return customWords.filter(
      (w) => (w.language ?? inferWordLanguage(w)) === settings.learningLang
    );
  }, [customWords, settings.learningLang]);

  // 当前 active Deck
  const currentDeck = useMemo(() => {
    return decks.find((d) => d.id === settings.selectedDeckId) || decks[0] || null;
  }, [decks, settings.selectedDeckId]);

  // Refresh progress & logs from storage
  const refreshStorageData = useCallback(() => {
    setProgressMap(storage.getProgressMap());
    setStudyLogs(storage.getStudyLogs());
    setCustomWords(storage.getCustomWords());
    setAchievements(storage.checkAchievements());
  }, []);

  // 后台首次双向同步（防阻塞：本地点开即用，拉取合并后再把本地全集推回云端）。
  // 放在 refreshStorageData 之后，避免 block-scoped 变量 TDZ 报错。
  // 用 bidirectionalSync 而非 pullFromCloud：否则只读取本地老数据、无写入操作时
  // isDirty 恒 false，本地历史进度永远不会推送上云，多端拉到的就是空数据。
  useEffect(() => {
    if (authState !== 'authenticated' || initialSyncDone) return;
    let cancelled = false;
    // 先给历史自定义词补上 language 字段，保证推上云的数据本身是干净的
    storage.ensureCustomWordsLanguage();
    refreshStorageData();
    storage
      .bidirectionalSync()
      .then(() => {
        if (cancelled) return;
        refreshStorageData();
        setSettings(storage.getSettings());
      })
      .catch((err: any) => {
        console.warn('Initial bidirectional sync skipped:', err?.message || err);
      })
      .finally(() => {
        if (!cancelled) setInitialSyncDone(true);
      });
    return () => {
      cancelled = true;
    };
  }, [authState, initialSyncDone, refreshStorageData]);

  const handleUpdateSettings = (newSettings: Partial<UserSettings>) => {
    const updated = storage.saveSettings(newSettings);
    setSettings(updated);
  };

  // Login & Logout Handlers
  const handleLoginSuccess = (res: LoginResponse) => {
    setAuthState('authenticated');
    if (res.webdavConfigured && res.webdavPreset) {
      storage.saveWebDavConfig({
        isServerPresetActive: true,
        useServerPreset: true,
        serverUrl: res.webdavPreset.serverUrl,
        username: res.webdavPreset.username,
        remotePath: res.webdavPreset.remotePath,
      });
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.logout();
    } finally {
      setAuthState('unauthenticated');
    }
  };

  // Language Onboarding Complete Handler
  const handleLanguageOnboardingComplete = (lang: Language, deckId: string) => {
    setShowLanguageOnboarding(false);
    handleUpdateSettings({
      learningLang: lang,
      selectedDeckId: deckId,
      onboardingCompleted: true,
    });
  };


  // 学习池 = 官方词书 + 生词本（按 id 去重）。复习 / 新词队列都从这里取，
  // 之前生词本完全被排除在学习队列之外，手动加的词加完就再也背不到。
  const studyPool = useMemo(() => {
    const includeCustom = settings.includeCustomWords ?? true;
    if (!includeCustom || customWordsForLang.length === 0) return deckWords;
    const map = new Map<string, Word>();
    for (const w of deckWords) map.set(w.id, w);
    for (const w of customWordsForLang) {
      if (!map.has(w.id)) map.set(w.id, w);
    }
    return Array.from(map.values());
  }, [deckWords, customWordsForLang, settings.includeCustomWords]);

  // 今日已复习的卡数（去重）：除 new_card 外的题型都是到期卡的作答。
  // dailyReviewLimit 这才变成真正的「每日累计上限」，而不是一开始的每批截断。
  const reviewedTodayCount = useMemo(() => {
    const ids = new Set(
      storage.getTodayLogs()
        .filter((l) => l.mode !== 'new_card')
        .map((l) => l.wordId)
    );
    return ids.size;
  }, [studyLogs]);

  const reviewQuotaLeft = Math.max(0, settings.dailyReviewLimit - reviewedTodayCount);

  // Due words calculation
  const dueWords = useMemo(() => {
    const now = Date.now();
    return studyPool
      .filter((w) => {
        const p = progressMap[w.id];
        return p && p.due <= now;
      })
      .slice(0, reviewQuotaLeft);
  }, [studyPool, progressMap, reviewQuotaLeft]);

  // New words calculation
  const newWords = useMemo(() => {
    return studyPool.filter((w) => !progressMap[w.id]).slice(0, settings.dailyNewWords);
  }, [studyPool, progressMap, settings.dailyNewWords]);

  // 真实到期总数（未被每日上限截断），用于首页如实显示「还有多少没复习」
  const dueTotal = useMemo(() => {
    const now = Date.now();
    return studyPool.filter((w) => {
      const p = progressMap[w.id];
      return p && p.due <= now;
    }).length;
  }, [studyPool, progressMap]);

  // Today studied count
  const todayStudiedCount = useMemo(() => {
    return storage.getTodayLogs().length;
  }, [studyLogs]);

  // Total learned words (reps > 0, 与快照/FSRS 统计口径一致)
  const totalLearnedCount = useMemo(() => {
    return Object.values(progressMap).filter((p) => p.reps > 0).length;
  }, [progressMap]);

  // 弹窗打开时锁住背景滚动（避免 iOS 橡皮筋抖动 / 背景跟着一起滑）
  const anyModalOpen = Boolean(
    showLanguageOnboarding || detailWord || showAddWordModal || showPlacementModal
  );
  useBodyScrollLock(anyModalOpen);

  // Streak days
  const streakDays = useMemo(() => {
    return storage.getStreakDays();
  }, [studyLogs]);

  // Suggestions engine
  const suggestions = useMemo(() => {
    const recentLogs = studyLogs.slice(-50);
    const accuracy =
      recentLogs.length > 0
        ? (recentLogs.filter((l) => l.correct).length / recentLogs.length) * 100
        : null;

    let daysSinceLastStudy: number | null = null;
    if (studyLogs.length > 0) {
      const last = studyLogs[studyLogs.length - 1].timestamp;
      daysSinceLastStudy = Math.floor((Date.now() - last) / (1000 * 60 * 60 * 24));
    }

    return SuggestionEngine.build({
      streak: streakDays,
      dueCount: dueWords.length,
      recentAccuracy: accuracy,
      daysSinceLastStudy,
      dailyReviewLimit: settings.dailyReviewLimit,
    });
  }, [studyLogs, streakDays, dueWords.length, settings.dailyReviewLimit]);

  // Handle suggestion action
  const handleApplySuggestion = (s: Suggestion) => {
    if (s.actionType === 'half_review') {
      const half = Math.max(10, Math.floor(settings.dailyReviewLimit / 2));
      handleUpdateSettings({ dailyReviewLimit: half });
    } else if (s.actionType === 'start_study') {
      setStudyMode('mixed');
      setActiveTab('study');
    } else if (s.actionType === 'add_quota') {
      handleUpdateSettings({ dailyNewWords: settings.dailyNewWords + 5 });
    }
  };

  // Language toggle
  const handleToggleLanguage = () => {
    const nextLang = settings.learningLang === 'en' ? 'ja' : 'en';
    const firstDeck = decks.find((d) => d.language === nextLang)?.id || (nextLang === 'ja' ? 'ja-jlpt-n5' : 'en-cefr-a1');
    handleUpdateSettings({ learningLang: nextLang, selectedDeckId: firstDeck });
  };

  // Placement modal handler
  const handlePlacementComplete = (recommendedLevel: string) => {
    setShowPlacementModal(false);
    // Find matching deck
    const prefix = settings.learningLang === 'ja' ? 'ja-jlpt-' : 'en-cefr-';
    const targetDeckId = `${prefix}${recommendedLevel.toLowerCase()}`;
    const found = decks.find((d) => d.id === targetDeckId);

    handleUpdateSettings({
      onboardingCompleted: true,
      assessedLevel: recommendedLevel,
      selectedDeckId: found ? found.id : settings.selectedDeckId,
    });
  };

  const handleSkipPlacement = () => {
    setShowPlacementModal(false);
    handleUpdateSettings({ onboardingCompleted: true });
  };

  // 1. Loading State
  if (authState === 'loading') {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-white space-y-3">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-slate-400 font-medium tracking-wide">正在校验全局访问权限...</p>
      </div>
    );
  }

  // 2. Unauthenticated State - Fullscreen Login Gate
  if (authState === 'unauthenticated') {
    return <LoginModal onLoginSuccess={handleLoginSuccess} serverRequiresSetup={serverRequiresSetup} />;
  }

  // 3. Authenticated State - Main Application
  return (
    <I18nProvider
      uiLang={settings.uiLanguage || 'zh-CN'}
      onLanguageChange={(newLang) => handleUpdateSettings({ uiLanguage: newLang })}
    >
      {/* 定高 App Shell：整屏不滚动，滚动交给内部各分区容器。
          之前这里是 min-h-[100dvh]，高度会被内容撑开，
          导致聊天输入框被长内容顶到屏幕之外（"找不到对话框"）。 */}
      <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-slate-50/50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
        <Navbar
          activeTab={activeTab}
          onTabChange={(tab) => {
            // 从底部导航直接进学习页时走混编模式；「复习 / 学新词」这两个入口会显式指定 mode
            if (tab === 'study') setStudyMode('mixed');
            setActiveTab(tab);
          }}
          language={settings.learningLang}
          onLanguageToggle={handleToggleLanguage}
        />

        <main className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {activeTab === 'home' && (
            <PageScroll>
              <HomeView
              settings={settings}
              currentDeck={currentDeck}
              dueWords={dueWords}
              dueTotal={dueTotal}
              reviewedTodayCount={reviewedTodayCount}
              reviewLimit={settings.dailyReviewLimit}
              newWords={newWords}
              todayStudiedCount={todayStudiedCount}
              totalLearnedCount={totalLearnedCount}
              streakDays={streakDays}
              suggestions={suggestions}
              onStartStudy={(mode: StudySessionMode = 'mixed') => {
                setStudyMode(mode);
                setActiveTab('study');
              }}
              onStartAiChat={() => {
                if (dueWords[0] || newWords[0]) {
                  setAiFocusWord(dueWords[0] || newWords[0]);
                }
                setActiveTab('ai_chat');
              }}
              onOpenDeckSelect={() => setActiveTab('profile')}
              onApplySuggestion={handleApplySuggestion}
              onOpenPlacement={() => setShowPlacementModal(true)}
              onWordClick={(w) => setDetailWord(w)}
            />
            </PageScroll>
          )}

          {activeTab === 'study' && (
            <StudyView
              key={studyMode + dueWords.length + newWords.length}
              language={settings.learningLang}
              wordsPool={studyPool}
              dueWords={dueWords}
              newWords={newWords}
              sessionMode={studyMode}
              onFinishSession={() => {
                refreshStorageData();
                storage.syncToCloud().catch(() => {});
                setActiveTab('home');
              }}
              onContinueNew={() => {
                setStudyMode('new');
              }}
              onExit={() => {
                refreshStorageData();
                storage.syncToCloud().catch(() => {});
                setActiveTab('home');
              }}
              autoSpeak={settings.autoSpeak}
            />
          )}

          {activeTab === 'ai_chat' && (
            <AiChatView
              language={settings.learningLang}
              currentWord={aiFocusWord || dueWords[0] || newWords[0] || deckWords[0] || null}
              allWords={studyPool.length > 0 ? studyPool : customWordsForLang}
              onSelectWord={(w) => setAiFocusWord(w)}
            />
          )}

          {activeTab === 'library' && (
            <PageScroll>
            <LibraryView
              language={settings.learningLang}
              decks={decks}
              currentDeck={currentDeck}
              deckWords={deckWords}
              customWords={customWordsForLang}
              progressMap={progressMap}
              onSelectDeck={(deckId) => {
                handleUpdateSettings({ selectedDeckId: deckId });
              }}
              onWordClick={(w) => setDetailWord(w)}
              onOpenAddWord={() => setShowAddWordModal(true)}
              onToggleFavorite={(wordId) => {
                storage.toggleFavorite(wordId, settings.learningLang);
                refreshStorageData();
              }}
            />
            </PageScroll>
          )}

          {activeTab === 'profile' && (
            <PageScroll>
            <ProfileView
              learnedCount={totalLearnedCount}
              streakDays={streakDays}
              dueCount={dueWords.length}
              customWordCount={customWordsForLang.length}
              onNavigate={(tab) => setActiveTab(tab)}
            />
            </PageScroll>
          )}

          {activeTab === 'stats' && (
            <PageScroll>
            <StatsView
              logs={studyLogs}
              progressMap={progressMap}
              streakDays={streakDays}
              achievements={achievements}
            />
            </PageScroll>
          )}

          {activeTab === 'settings' && (
            <PageScroll>
            <SettingsView
              settings={settings}
              decks={decks}
              allWords={deckWords.length > 0 ? deckWords : customWordsForLang}
              onUpdateSettings={handleUpdateSettings}
              onRefreshData={refreshStorageData}
              onRetakePlacement={() => setShowPlacementModal(true)}
              onLogout={handleLogout}
            />
            </PageScroll>
          )}
        </main>

        {/* First-time Language & Deck Onboarding Modal */}
        {showLanguageOnboarding && (
          <LanguageOnboardingModal
            decks={decks}
            onComplete={handleLanguageOnboardingComplete}
          />
        )}

        {/* Word Detail Modal */}
        {detailWord && (
          <WordDetailModal
            word={detailWord}
            progress={progressMap[detailWord.id] || null}
            language={settings.learningLang}
            onClose={() => setDetailWord(null)}
            onFavoriteToggled={refreshStorageData}
            onStartAiPractice={(w) => {
              setAiFocusWord(w);
              setActiveTab('ai_chat');
            }}
          />
        )}

        {/* Custom Word Modal */}
        {showAddWordModal && (
          <AddWordModal
            language={settings.learningLang}
            onClose={() => setShowAddWordModal(false)}
            onWordAdded={(newWord) => {
              refreshStorageData();
              setDetailWord(newWord);
            }}
            onBatchAdded={() => {
              refreshStorageData();
            }}
          />
        )}

        {/* Placement Modal */}
        {showPlacementModal && (
          <PlacementModal
            language={settings.learningLang}
            wordsPool={deckWords}
            onComplete={handlePlacementComplete}
            onSkip={handleSkipPlacement}
          />
        )}
      </div>
    </I18nProvider>
  );
}


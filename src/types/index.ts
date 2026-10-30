export type Language = 'en' | 'ja';

export interface MeaningItem {
  lang: string;
  def: string;
}

export interface ExampleItem {
  text: string;
  translation?: string | null;
}

export interface Word {
  id: string;
  headword: string;
  reading?: string | null;
  pos?: string | null;
  phonetic?: string | null;
  meanings: MeaningItem[];
  examples: ExampleItem[];
  difficulty: number;
  level: string;
  tags?: Record<string, any>;
  isCustom?: boolean;
  // 自定义词所属学习目标语言。旧数据可能缺失，读取时用 inferWordLanguage() 兜底。
  language?: Language;
  updatedAt?: number;
  deletedAt?: number | null;
}

export interface Deck {
  id: string;
  language: Language;
  name: string;
  sort_order: number;
  word_count: number;
  file?: string;
}

export type FSRSState = 0 | 1 | 2; // 0: Learning, 1: Review, 2: Relearning
export type FSRSRating = 1 | 2 | 3 | 4; // 1: Again, 2: Hard, 3: Good, 4: Easy

export interface WordProgress {
  id: string;
  wordId: string;
  language: Language;
  state: FSRSState;
  due: number; // Unix timestamp in ms
  stability: number; // Stability in days
  difficulty: number; // Difficulty 1.0 - 10.0
  step: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  lastReviewAt: number | null;
  updatedAt: number;
  isFavorite?: boolean;
  userNotes?: string;
}

export type StudyMode = 'new_card' | 'choice' | 'dictation' | 'cloze' | 'placement';

export interface StudyLog {
  id: string;
  wordId: string;
  language: Language;
  mode: StudyMode;
  rating: FSRSRating;
  correct: boolean;
  durationMs: number;
  timestamp: number;
}

export type UILanguage = 'zh-CN' | 'zh-TW' | 'en-US' | 'ja-JP';
export type AudioSource = 'online_first' | 'local_only' | 'online_only';
export type EnAccent = 'us' | 'uk';

export interface UserSettings {
  uiLanguage: UILanguage;
  learningLang: Language;
  selectedDeckId: string;
  dailyNewWords: number;
  dailyReviewLimit: number;
  /** 生词本是否并入学习队列（默认开启）：关掉后复习/新词只走官方词库 */
  includeCustomWords?: boolean;
  autoSpeak: boolean;
  speechRate: number;
  audioSource?: AudioSource;
  enAccent?: EnAccent;
  reminderTime: string;
  onboardingCompleted: boolean;
  assessedLevel: string | null;
  updatedAt?: number;
}

export interface CustomAiScenario {
  id: string;
  title: string;
  icon: string; // e.g. 'Coffee', 'Plane', 'Briefcase', 'GraduationCap', 'MessageCircle', 'ShoppingBag', 'Utensils', 'HeartPulse', 'Building', 'Sparkles'
  desc: string;
  language: 'all' | 'en' | 'ja';
  rolePersona: string; // System instruction for AI character
  openingGreeting: {
    en: string;
    ja: string;
    translation: string;
  };
  challengePrompt?: string;
  isCustom?: boolean;
  createdAt: number;
  updatedAt?: number;
  deletedAt?: number | null;
}

export interface LocalSnapshot {
  id: string;
  name: string;
  timestamp: number;
  wordCount: number;
  learnedCount: number;
  streak: number;
  sizeKb: number;
}

export interface Suggestion {
  id: string;
  iconName: 'comeback' | 'clear' | 'scale';
  title: string;
  body: string;
  actionLabel?: string;
  actionType: 'half_review' | 'start_study' | 'add_quota';
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockedAt: number | null;
  progress: number;
  maxProgress: number;
}

export interface WebDavConfig {
  enabled: boolean;
  serverUrl: string; // e.g. "https://dav.jianguoyun.com/dav/" or "https://app.koofr.net/dav/Koofr/"
  username: string;
  password: string; // App-specific password
  remotePath: string; // e.g. "/MemorizeWord/memorize_word_backup.json"
  autoSync: boolean; // Auto-sync after study sessions
  useServerPreset?: boolean; // Use environment variables configured on server (multi-device zero-config)
  isServerPresetActive?: boolean;
  lastSyncAt: number | null;
  lastSyncStatus: 'idle' | 'success' | 'error';
  lastSyncMessage?: string;
}


// ===== Cloud Sync (Vercel + Neon PostgreSQL) Types =====

export type CloudSyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface LearningSyncPayload {
  settings: UserSettings;
  progress: Record<string, WordProgress>;
  customWords: Word[];
  customScenarios: CustomAiScenario[];
  logs: StudyLog[];
  achievements: Achievement[];
  updatedAt: number;
}



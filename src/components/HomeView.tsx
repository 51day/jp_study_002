import React from 'react';
import {
  Flame,
  Play,
  Sparkles,
  BookOpen,
  ArrowRight,
  TrendingUp,
  Calendar,
  AlertCircle,
  Bell,
  Sliders,
  RotateCcw,
  CheckCircle2,
} from 'lucide-react';
import { Word, Deck, UserSettings, Suggestion } from '../types';
import { useI18n } from '../i18n';
import { StudySessionMode } from './StudyView';

interface HomeViewProps {
  settings: UserSettings;
  currentDeck: Deck | null;
  dueWords: Word[];
  /** 未被每日上限截断的到期总数 */
  dueTotal?: number;
  /** 今日已复习的卡数与每日上限，用于显示配额消耗 */
  reviewedTodayCount?: number;
  reviewLimit?: number;
  newWords: Word[];
  todayStudiedCount: number;
  totalLearnedCount: number;
  streakDays: number;
  suggestions: Suggestion[];
  onStartStudy: (mode: StudySessionMode) => void;
  onStartAiChat: () => void;
  onOpenDeckSelect: () => void;
  onApplySuggestion: (suggestion: Suggestion) => void;
  onOpenPlacement: () => void;
  onWordClick: (word: Word) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  settings,
  currentDeck,
  dueWords,
  dueTotal = 0,
  reviewedTodayCount = 0,
  reviewLimit = 50,
  newWords,
  todayStudiedCount,
  totalLearnedCount,
  streakDays,
  suggestions,
  onStartStudy,
  onStartAiChat,
  onOpenDeckSelect,
  onApplySuggestion,
  onOpenPlacement,
  onWordClick,
}) => {
  const { t } = useI18n();
  const dailyTarget = settings.dailyNewWords + settings.dailyReviewLimit;
  const progressRatio = Math.min(1, todayStudiedCount / Math.max(1, dailyTarget));
  const progressPercent = Math.round(progressRatio * 100);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Top Deck & Quota Overview Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl">
        {/* Background decorative glow */}
        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenDeckSelect}
                className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md text-xs font-semibold tracking-wide transition border border-white/10"
              >
                <BookOpen className="w-3.5 h-3.5 text-indigo-300" />
                <span>{currentDeck?.name || t('home.select_deck')}</span>
                <Sliders className="w-3 h-3 text-white/60 ml-0.5" />
              </button>

              <button
                type="button"
                onClick={onOpenPlacement}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-500/30 hover:bg-indigo-500/50 text-[11px] font-medium transition border border-indigo-400/20"
              >
                <Sparkles className="w-3 h-3 text-amber-300" />
                <span>{t('home.retest')}</span>
              </button>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              {t('home.title')}
            </h1>

            <p className="text-indigo-200 text-xs sm:text-sm max-w-md leading-relaxed">
              {t('home.desc', { due: dueTotal || dueWords.length, newWords: newWords.length })}
            </p>
          </div>

          {/* Circular Progress & Quick Start */}
          <div className="flex items-center gap-5 sm:gap-6 shrink-0">
            {/* Circular Gauge */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-white/10"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-emerald-400 transition-all duration-1000 ease-out"
                  strokeDasharray={`${progressPercent}, 100`}
                  strokeLinecap="round"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute flex flex-col items-center">
                <span className="text-lg sm:text-xl font-black text-white">{totalLearnedCount}</span>
                <span className="text-[10px] text-indigo-200">{t('home.words_studied')}</span>
              </div>
            </div>

            {/* 复习 / 学新词 拆成两个独立入口。复习按钮常驻：
                没有到期卡时置灰而不是消失，否则用户会以为「复习功能不存在」。 */}
            <div className="flex flex-col gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => onStartStudy('review')}
                disabled={dueWords.length === 0}
                className={`flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl font-bold text-xs sm:text-sm transition active:scale-95 group ${
                  dueWords.length > 0
                    ? 'bg-amber-400 hover:bg-amber-300 text-amber-950 shadow-xl hover:shadow-2xl'
                    : 'bg-white/10 text-white/55 border border-white/15 cursor-not-allowed'
                }`}
              >
                <RotateCcw
                  className={`w-4 h-4 shrink-0 transition ${
                    dueWords.length > 0 ? 'group-hover:-rotate-90' : ''
                  }`}
                />
                <span>
                  {dueWords.length > 0
                    ? t('home.start_review', { count: dueWords.length })
                    : dueTotal > 0
                      ? t('home.review_quota_used')
                      : t('home.review_none')}
                </span>
              </button>

              {newWords.length > 0 ? (
                <button
                  type="button"
                  onClick={() => onStartStudy('new')}
                  className={`flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl font-bold text-xs sm:text-sm transition active:scale-95 group ${
                    dueWords.length > 0
                      ? 'bg-white/15 hover:bg-white/25 text-white border border-white/25'
                      : 'bg-white hover:bg-indigo-50 text-indigo-900 border-0 shadow-xl hover:shadow-2xl'
                  }`}
                >
                  <Play className="w-4 h-4 group-hover:scale-110 transition shrink-0" />
                  <span>
                    {dueWords.length > 0
                      ? t('home.start_new', { count: newWords.length })
                      : t('home.start_study')}
                  </span>
                </button>
              ) : null}

              {/* 到期数与配额提示 */}
              {dueTotal > dueWords.length ? (
                <span className="text-[10px] sm:text-[11px] text-amber-200 text-center leading-tight">
                  {reviewedTodayCount >= reviewLimit
                    ? t('home.review_quota_done', { limit: reviewLimit })
                    : t('home.due_overflow', { total: dueTotal, limit: dueWords.length })}
                </span>
              ) : null}

              {reviewedTodayCount > 0 ? (
                <span className="text-[10px] sm:text-[11px] text-indigo-200 text-center leading-tight">
                  {t('home.review_quota', { done: reviewedTodayCount, limit: reviewLimit })}
                </span>
              ) : null}

              {/* 全部清空的完成态（只作提示，不占按钮位） */}
              {dueTotal === 0 && newWords.length === 0 && reviewedTodayCount === 0 ? (
                <span className="text-[10px] sm:text-[11px] text-emerald-200 text-center leading-tight flex items-center justify-center gap-1">
                  <CheckCircle2 className="w-3 h-3 shrink-0" />
                  {t('home.all_caught_up')}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-3 gap-2 text-center">
          <div>
            <span className="text-[11px] text-indigo-200 block">{t('home.due_review')}</span>
            <span className="text-lg font-black text-amber-300">{dueTotal || dueWords.length}</span>
          </div>
          <div>
            <span className="text-[11px] text-indigo-200 block">{t('home.today_new')}</span>
            <span className="text-lg font-black text-white">{newWords.length}</span>
          </div>
          <div>
            <span className="text-[11px] text-indigo-200 block">{t('home.streak_days')}</span>
            <span className="text-lg font-black text-orange-400 flex items-center justify-center gap-1">
              <Flame className="w-4 h-4 fill-orange-400" />
              <span>{streakDays} {t('home.streak_unit')}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Flagship Second-Stage AI Banner */}
      <div className="bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-blue-500/10 dark:from-purple-950/40 dark:via-indigo-950/40 dark:to-blue-950/40 p-5 rounded-3xl border border-indigo-200/80 dark:border-indigo-800/60 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {t('home.ai_banner_title')}
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white">
                {t('home.ai_banner_tag')}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {t('home.ai_banner_desc')}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onStartAiChat}
          className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition flex items-center justify-center gap-1.5 active:scale-95"
        >
          <span>{t('home.ai_banner_btn')}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Smart Rule Suggestions */}
      {suggestions.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
            <span>{t('home.suggestions_title')}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {suggestions.map((s) => (
              <div
                key={s.id}
                className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                      {s.iconName === 'comeback' ? (
                        <AlertCircle className="w-4 h-4" />
                      ) : s.iconName === 'clear' ? (
                        <Bell className="w-4 h-4" />
                      ) : (
                        <TrendingUp className="w-4 h-4" />
                      )}
                    </div>
                    <h4 className="font-bold text-slate-900 dark:text-white text-sm">{s.title}</h4>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    {s.body}
                  </p>
                </div>

                {s.actionLabel && (
                  <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <button
                      type="button"
                      onClick={() => onApplySuggestion(s)}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-1"
                    >
                      <span>{s.actionLabel}</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Today's Queue Preview */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <span>{t('home.preview_title')}</span>
          </h3>
          <span className="text-xs text-slate-400">{t('home.preview_hint')}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
          {[...dueWords.slice(0, 3), ...newWords.slice(0, 3)].map((w) => (
            <div
              key={w.id}
              onClick={() => onWordClick(w)}
              className="bg-white dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition cursor-pointer shadow-2xs group flex items-center justify-between"
            >
              <div>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-indigo-600 transition">
                    {w.headword}
                  </span>
                  {w.reading && (
                    <span className="text-[11px] text-indigo-500">【{w.reading}】</span>
                  )}
                </div>
                <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                  {w.meanings?.[0]?.def || ''}
                </p>
              </div>
              <span className="text-[10px] uppercase font-bold text-slate-400 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800">
                {w.level}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

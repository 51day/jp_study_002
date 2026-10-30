import React, { useMemo, useState, useEffect } from 'react';
import {
  Flame,
  Award,
  CheckCircle2,
  Calendar,
  Activity,
  Layers,
  Sparkles,
  Zap,
  BookmarkCheck,
  Trophy,
  Headphones,
  Bot,
} from 'lucide-react';
import { StudyLog, WordProgress, Achievement } from '../types';
import { useI18n } from '../i18n';

interface StatsViewProps {
  logs: StudyLog[];
  progressMap: Record<string, WordProgress>;
  streakDays: number;
  achievements: Achievement[];
}

export const StatsView: React.FC<StatsViewProps> = ({
  logs,
  progressMap,
  streakDays,
  achievements,
}) => {
  const { t } = useI18n();

  // Mastery distribution
  const masteryStats = useMemo(() => {
    const list = Object.values(progressMap);
    const learning = list.filter((p) => p.state === 0).length;
    const reviewing = list.filter((p) => p.state === 1 && p.stability < 15).length;
    const mastered = list.filter((p) => p.state === 1 && p.stability >= 15).length;
    const relearning = list.filter((p) => p.state === 2).length;
    return { learning, reviewing, mastered, relearning, total: list.length };
  }, [progressMap]);

  // Overall accuracy
  const accuracy = useMemo(() => {
    if (logs.length === 0) return 100;
    const correct = logs.filter((l) => l.correct).length;
    return Math.round((correct / logs.length) * 100);
  }, [logs]);

  // Last 14 days activity bar chart
  const last14Days = useMemo(() => {
    const days: { dateStr: string; label: string; count: number }[] = [];
    const now = new Date();

    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const label = `${d.getMonth() + 1}/${d.getDate()}`;
      days.push({ dateStr: str, label, count: 0 });
    }

    const dayMap = new Map(days.map((item) => [item.dateStr, item]));
    for (const log of logs) {
      const d = new Date(log.timestamp);
      const str = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const found = dayMap.get(str);
      if (found) {
        found.count++;
      }
    }

    return days;
  }, [logs]);

  const maxDailyCount = Math.max(1, ...last14Days.map((d) => d.count));

  // 日历热力图：窄屏只渲染最近 8 周（否则每格会被压得只剩 1~2px，看不清）
  const [isNarrow, setIsNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const onChange = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    setIsNarrow(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const heatmapWeeks = useMemo(() => {
    const weeks: { dateStr: string; count: number }[][] = [];
    const logCounts: Record<string, number> = {};

    for (const l of logs) {
      const d = new Date(l.timestamp);
      const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      logCounts[s] = (logCounts[s] || 0) + 1;
    }

    const today = new Date();
    const weeksToShow = isNarrow ? 8 : 16;
    for (let w = weeksToShow - 1; w >= 0; w--) {
      const weekDays: { dateStr: string; count: number }[] = [];
      for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
        const d = new Date(today);
        d.setDate(d.getDate() - (w * 7 + (6 - dayOffset)));
        const s = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        weekDays.push({ dateStr: s, count: logCounts[s] || 0 });
      }
      weeks.push(weekDays);
    }
    return weeks;
  }, [logs, isNarrow]);

  const getHeatmapColor = (count: number) => {
    if (count === 0) return 'bg-slate-100 dark:bg-slate-800';
    if (count < 10) return 'bg-indigo-300 dark:bg-indigo-900';
    if (count < 25) return 'bg-indigo-500 dark:bg-indigo-700';
    return 'bg-indigo-700 dark:bg-indigo-500';
  };

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Sparkles':
        return <Sparkles className="w-5 h-5" />;
      case 'Flame':
        return <Flame className="w-5 h-5" />;
      case 'Zap':
        return <Zap className="w-5 h-5" />;
      case 'BookmarkCheck':
        return <BookmarkCheck className="w-5 h-5" />;
      case 'Trophy':
        return <Trophy className="w-5 h-5" />;
      case 'Headphones':
        return <Headphones className="w-5 h-5" />;
      case 'Bot':
        return <Bot className="w-5 h-5" />;
      default:
        return <Award className="w-5 h-5" />;
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">
          {t('stats.title')}
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          {t('stats.desc')}
        </p>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-xs text-slate-400">{t('stats.streak')}</span>
          <div className="flex items-center gap-1.5">
            <Flame className="w-5 h-5 text-orange-500 fill-orange-500" />
            <span className="text-2xl font-black text-slate-900 dark:text-white">{streakDays}</span>
            <span className="text-xs text-slate-400 font-medium">{t('home.streak_unit')}</span>
          </div>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-xs text-slate-400">{t('stats.total_reviews')}</span>
          <div className="flex items-center gap-1.5">
            <Activity className="w-5 h-5 text-indigo-500" />
            <span className="text-2xl font-black text-slate-900 dark:text-white">{logs.length}</span>
            <span className="text-xs text-slate-400 font-medium">次</span>
          </div>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-xs text-slate-400">{t('stats.overall_accuracy')}</span>
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            <span className="text-2xl font-black text-slate-900 dark:text-white">{accuracy}</span>
            <span className="text-xs text-slate-400 font-medium">%</span>
          </div>
        </div>

        <div className="p-4 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xs space-y-1">
          <span className="text-xs text-slate-400">{t('stats.mastered_words')}</span>
          <div className="flex items-center gap-1.5">
            <BookmarkCheck className="w-5 h-5 text-purple-500" />
            <span className="text-2xl font-black text-slate-900 dark:text-white">
              {masteryStats.mastered}
            </span>
            <span className="text-xs text-slate-400 font-medium">{t('common.words')}</span>
          </div>
        </div>
      </div>

      {/* Mastery Ring / Breakdown */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-500" />
          <span>{t('stats.fsrs_distribution')}</span>
        </h3>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/60">
            <span className="text-xs text-indigo-600 dark:text-indigo-400 block font-medium">
              {t('stats.stage_learning')}
            </span>
            <span className="text-xl font-bold text-slate-900 dark:text-white mt-1 block">
              {masteryStats.learning}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/60">
            <span className="text-xs text-amber-600 dark:text-amber-400 block font-medium">
              {t('stats.stage_relearning')}
            </span>
            <span className="text-xl font-bold text-slate-900 dark:text-white mt-1 block">
              {masteryStats.relearning}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/60">
            <span className="text-xs text-blue-600 dark:text-blue-400 block font-medium">
              {t('stats.stage_reviewing')}
            </span>
            <span className="text-xl font-bold text-slate-900 dark:text-white mt-1 block">
              {masteryStats.reviewing}
            </span>
          </div>

          <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-900/60">
            <span className="text-xs text-emerald-600 dark:text-emerald-400 block font-medium">
              {t('stats.stage_mastered')}
            </span>
            <span className="text-xl font-bold text-slate-900 dark:text-white mt-1 block">
              {masteryStats.mastered}
            </span>
          </div>
        </div>
      </div>

      {/* 14-Day Activity Bar Chart */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-500" />
          <span>{t('stats.trend_title')}</span>
        </h3>

        <div className="h-44 flex items-end justify-between gap-1 sm:gap-2 pt-6 pb-2 px-1">
          {last14Days.map((d) => {
            const heightPercent = Math.max(8, Math.round((d.count / maxDailyCount) * 100));
            return (
              <div key={d.dateStr} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                <span className="text-[10px] font-semibold text-slate-400 opacity-0 group-hover:opacity-100 transition">
                  {d.count}
                </span>
                <div
                  className={`w-full max-w-[28px] rounded-t-lg transition-all duration-300 ${
                    d.count > 0
                      ? 'bg-indigo-600 dark:bg-indigo-500 group-hover:bg-indigo-700'
                      : 'bg-slate-100 dark:bg-slate-800'
                  }`}
                  style={{ height: `${heightPercent}%` }}
                />
                <span className="text-[10px] text-slate-400 whitespace-nowrap">{d.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Annual Calendar Heatmap */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
          <Activity className="w-4 h-4 text-indigo-500" />
          <span>{t('stats.heatmap_title')}</span>
        </h3>

        <div className="overflow-x-auto pb-2 scrollbar-none snap-row">
          <div className="flex gap-1.5 min-w-max">
            {heatmapWeeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1.5">
                {week.map((day, dIdx) => (
                  <div
                    key={dIdx}
                    title={`${day.dateStr}: ${day.count}`}
                    className={`w-4 h-4 rounded-sm transition ${getHeatmapColor(day.count)}`}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Achievements Section */}
      <div className="space-y-4">
        <h3 className="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
          <Trophy className="w-4 h-4 text-amber-500" />
          <span>{t('stats.achievements_title')}</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {achievements.map((ach) => {
            const isUnlocked = !!ach.unlockedAt;
            const progressRatio = Math.min(1, (ach.progress || 0) / ach.maxProgress);

            return (
              <div
                key={ach.id}
                className={`p-4 rounded-3xl border transition flex items-start gap-3.5 ${
                  isUnlocked
                    ? 'bg-white dark:bg-slate-900 border-indigo-200 dark:border-indigo-800/80 shadow-2xs'
                    : 'bg-slate-50/60 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 opacity-70'
                }`}
              >
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    isUnlocked
                      ? 'bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 shadow-xs'
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                  }`}
                >
                  {getIcon(ach.icon)}
                </div>

                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-sm text-slate-900 dark:text-white">
                      {ach.title}
                    </h4>
                    {isUnlocked && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300">
                        {t('stats.achieved')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 leading-snug">{ach.description}</p>

                  {/* Progress bar */}
                  {!isUnlocked && (
                    <div className="pt-1 space-y-1">
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full"
                          style={{ width: `${progressRatio * 100}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-400 text-right">
                        {ach.progress} / {ach.maxProgress}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

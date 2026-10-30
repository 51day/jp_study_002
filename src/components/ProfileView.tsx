import React from 'react';
import { BookOpen, BarChart3, Settings, ChevronRight, Flame } from 'lucide-react';
import { useI18n } from '../i18n';

interface ProfileViewProps {
  learnedCount: number;
  streakDays: number;
  dueCount: number;
  customWordCount: number;
  onNavigate: (tab: 'library' | 'stats' | 'settings') => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  learnedCount,
  streakDays,
  dueCount,
  customWordCount,
  onNavigate,
}) => {
  const { t } = useI18n();

  const menuItems = [
    {
      id: 'library' as const,
      icon: BookOpen,
      title: t('nav.library'),
      desc: `生词本 · 官方词书 · 已收录 ${customWordCount} 个`,
    },
    {
      id: 'stats' as const,
      icon: BarChart3,
      title: t('nav.stats'),
      desc: 'FSRS 掌握度分布 · 学习曲线 · 打卡热力图',
    },
    {
      id: 'settings' as const,
      icon: Settings,
      title: t('nav.settings'),
      desc: 'AI 模型 · 学习计划 · 同步与备份',
    },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
      {/* 学习概览卡片 */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-slate-900 text-white rounded-3xl p-6 shadow-lg">
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-indigo-400/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center text-xl font-black shrink-0">
            {learnedCount}
          </div>
          <div className="min-w-0">
            <div className="text-sm text-indigo-100">累计已学单词</div>
            <div className="text-xs text-indigo-200 mt-0.5">坚持每天进步一点点</div>
          </div>
        </div>

        <div className="relative mt-5 pt-4 border-t border-white/15 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="text-lg font-black text-amber-300">{dueCount}</div>
            <div className="text-[11px] text-indigo-200">待复习</div>
          </div>
          <div>
            <div className="text-lg font-black text-white">{customWordCount}</div>
            <div className="text-[11px] text-indigo-200">生词本</div>
          </div>
          <div>
            <div className="text-lg font-black text-orange-300 flex items-center justify-center gap-1">
              <Flame className="w-4 h-4" />
              {streakDays}
            </div>
            <div className="text-[11px] text-indigo-200">连续打卡</div>
          </div>
        </div>
      </div>

      {/* 功能入口 */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className="w-full flex items-center gap-3.5 px-4 min-h-[60px] text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition group focus-visible:outline-none focus-visible:bg-slate-50 dark:focus-visible:bg-slate-800/60"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition">
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-slate-900 dark:text-white">{item.title}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.desc}</div>
              </div>
              <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 shrink-0" />
            </button>
          );
        })}
      </div>
    </div>
  );
};

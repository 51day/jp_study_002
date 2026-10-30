import React, { useState, useMemo } from 'react';
import {
  Search,
  BookOpen,
  Star,
  Plus,
  Volume2,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Word, WordProgress, Deck, Language } from '../types';
import { tts } from '../services/tts';
import { inferWordLanguage } from '../services/storage';
import { useI18n } from '../i18n';
import { JapaneseRubyText } from './JapaneseRubyText';

interface LibraryViewProps {
  language: Language;
  decks: Deck[];
  currentDeck: Deck | null;
  deckWords: Word[];
  customWords: Word[];
  progressMap: Record<string, WordProgress>;
  onSelectDeck: (deckId: string) => void;
  onWordClick: (word: Word) => void;
  onOpenAddWord: () => void;
  onToggleFavorite: (wordId: string) => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({
  language,
  decks,
  currentDeck,
  deckWords,
  customWords,
  progressMap,
  onSelectDeck,
  onWordClick,
  onOpenAddWord,
  onToggleFavorite,
}) => {
  const { t } = useI18n();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'learning' | 'mastered' | 'starred' | 'custom'>('all');

  const filteredDecks = useMemo(() => {
    return decks.filter((d) => d.language === language);
  }, [decks, language]);

  // 生词本只保留当前学习目标语言的词（历史数据没有 language 字段，用假名/汉字兜底判断）
  const visibleCustomWords = useMemo(() => {
    return customWords.filter((w) => (w.language ?? inferWordLanguage(w)) === language);
  }, [customWords, language]);

  // Combine deck words + custom words
  const combinedWords = useMemo(() => {
    if (statusFilter === 'custom') {
      return visibleCustomWords;
    }
    return deckWords;
  }, [deckWords, visibleCustomWords, statusFilter]);

  const filteredWords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return combinedWords.filter((w) => {
      const p = progressMap[w.id];

      // Filter by status
      if (statusFilter === 'starred' && !p?.isFavorite) return false;
      if (statusFilter === 'learning' && (!p || p.state !== 0)) return false;
      if (statusFilter === 'mastered' && (!p || p.state !== 1 || (p.stability || 0) < 5)) return false;

      // Filter by search text
      if (!q) return true;
      const head = w.headword.toLowerCase();
      const read = (w.reading || '').toLowerCase();
      const phon = (w.phonetic || '').toLowerCase();
      const def = (w.meanings?.[0]?.def || '').toLowerCase();

      return head.includes(q) || read.includes(q) || phon.includes(q) || def.includes(q);
    });
  }, [combinedWords, progressMap, statusFilter, searchQuery]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Top Header & Add Word button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white">
            {t('library.title')}
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {t('library.desc')}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAddWord}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>{t('library.add_custom_word')}</span>
        </button>
      </div>

      {/* Deck Selector Tabs */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
          <BookOpen className="w-3.5 h-3.5" />
          <span>{t('library.official_decks')}</span>
        </div>

        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none snap-row">
          {filteredDecks.map((d) => {
            const isSelected = currentDeck?.id === d.id && statusFilter !== 'custom';
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  if (statusFilter === 'custom') setStatusFilter('all');
                  onSelectDeck(d.id);
                }}
                className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap transition border ${
                  isSelected
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <span>{d.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-indigo-800 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}
                >
                  {d.word_count}
                </span>
              </button>
            );
          })}

          {/* Custom Words Book Tab */}
          <button
            type="button"
            onClick={() => setStatusFilter('custom')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap transition border ${
              statusFilter === 'custom'
                ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>{t('library.my_custom_book')}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                statusFilter === 'custom' ? 'bg-indigo-800 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
              }`}
            >
              {visibleCustomWords.length}
            </span>
          </button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('library.search_placeholder')}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {[
            { id: 'all', label: t('library.tab_all') },
            { id: 'learning', label: t('library.tab_learning') },
            { id: 'mastered', label: t('library.tab_mastered') },
            { id: 'starred', label: t('library.tab_starred') },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setStatusFilter(item.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition ${
                statusFilter === item.id
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-2xs'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Word Count Indicator */}
      <div className="flex items-center justify-between text-xs text-slate-400 px-1 gap-3">
        <span>{t('library.showing_words', { count: filteredWords.length })}</span>
        <span className="text-right truncate">
          {statusFilter === 'custom'
            ? `生词本（${language === 'ja' ? '日语' : '英语'}）· 点上方词库可返回官方词书`
            : t('library.click_card_hint')}
        </span>
      </div>

      {/* Empty State */}
      {filteredWords.length === 0 && (
        <div className="bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700 py-12 px-6 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            {statusFilter === 'custom' ? '生词本里还没有单词' : '没有符合条件的单词'}
          </div>
          <div className="text-xs text-slate-400">
            {statusFilter === 'custom'
              ? `切换到${language === 'ja' ? '日语' : '英语'}后添加的生词会出现在这里`
              : '换个筛选条件或清空搜索试试'}
          </div>
          {statusFilter === 'custom' && (
            <button
              type="button"
              onClick={onOpenAddWord}
              className="inline-flex items-center justify-center gap-1.5 px-4 min-h-[44px] rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition active:scale-95"
            >
              <Plus className="w-4 h-4" />
              <span>{t('library.add_custom_word')}</span>
            </button>
          )}
        </div>
      )}

      {/* Word List Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {filteredWords.slice(0, 100).map((w) => {
          const p = progressMap[w.id];
          const isStarred = !!p?.isFavorite;

          return (
            <div
              key={w.id}
              onClick={() => onWordClick(w)}
              className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition cursor-pointer shadow-2xs hover:shadow-sm flex items-start justify-between gap-3 group"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="font-extrabold text-slate-900 dark:text-white text-base group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition">
                    {language === 'ja' ? (
                      <JapaneseRubyText text={w.headword} reading={w.reading} />
                    ) : (
                      w.headword
                    )}
                  </span>
                  {w.reading && language !== 'ja' && (
                    <span className="text-xs font-medium text-indigo-500">
                      【{w.reading}】
                    </span>
                  )}
                  {w.phonetic && (
                    <span className="text-xs font-mono text-slate-400">
                      /{w.phonetic}/
                    </span>
                  )}
                  {w.pos && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-500 font-medium">
                      {w.pos}
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-1">
                  {w.meanings?.[0]?.def || ''}
                </p>

                {/* Progress Mini Tags */}
                <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400">
                  {p ? (
                    <>
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{t('library.reviewed_times', { count: p.reps })}</span>
                      </span>
                      <span>·</span>
                      <span>{t('library.stability_days', { days: p.stability.toFixed(1) })}</span>
                    </>
                  ) : (
                    <span className="text-slate-400">{t('library.not_studied')}</span>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                <button
                  type="button"
                  onClick={() => tts.speak(w.headword, language, 1.0, w.reading)}
                  aria-label="发音"
                  className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <Volume2 className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => onToggleFavorite(w.id)}
                  aria-label={isStarred ? "取消收藏" : "收藏生词"}
                  className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl transition ${
                    isStarred
                      ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/40'
                      : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <Star className={`w-5 h-5 ${isStarred ? 'fill-amber-500' : ''}`} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filteredWords.length === 0 && (
        <div className="text-center py-16 text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <BookOpen className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 mb-2" />
          <p className="text-sm font-medium">{t('library.no_results')}</p>
          <p className="text-xs text-slate-500 mt-1">{t('library.no_results_sub')}</p>
        </div>
      )}
    </div>
  );
};

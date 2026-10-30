import React, { useState } from 'react';
import {
  X,
  Volume2,
  Star,
  Calendar,
  Activity,
  Layers,
  Sparkles,
  Save,
  MessageSquare,
} from 'lucide-react';
import { Word, WordProgress, Language } from '../types';
import { tts } from '../services/tts';
import { storage } from '../services/storage';
import { useI18n } from '../i18n';
import { JapaneseRubyText } from './JapaneseRubyText';

interface WordDetailModalProps {
  word: Word | null;
  progress?: WordProgress | null;
  language: Language;
  onClose: () => void;
  onFavoriteToggled?: () => void;
  onStartAiPractice?: (word: Word) => void;
}

export const WordDetailModal: React.FC<WordDetailModalProps> = ({
  word,
  progress: initialProgress,
  language,
  onClose,
  onFavoriteToggled,
  onStartAiPractice,
}) => {
  const { t } = useI18n();
  if (!word) return null;

  const [isFav, setIsFav] = useState(!!initialProgress?.isFavorite);
  const [notes, setNotes] = useState(initialProgress?.userNotes || '');
  const [isSavingNotes, setIsSavingNotes] = useState(false);

  const handleSpeak = (text: string) => {
    tts.speak(text, language, 1.0, word.reading);
  };

  const handleToggleFavorite = () => {
    const nextState = storage.toggleFavorite(word.id, language);
    setIsFav(nextState);
    if (onFavoriteToggled) onFavoriteToggled();
  };

  const handleSaveNotes = () => {
    setIsSavingNotes(true);
    storage.updateWordNotes(word.id, notes);
    setTimeout(() => setIsSavingNotes(false), 500);
  };

  const formatDate = (timestamp?: number | null) => {
    if (!timestamp) return t('word_modal.not_scheduled');
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  const getStateBadge = (state?: number) => {
    switch (state) {
      case 1:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
            {t('word_modal.state_reviewing')}
          </span>
        );
      case 2:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
            {t('word_modal.state_relearning')}
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300">
            {t('word_modal.state_learning')}
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
              {word.level}
            </span>
            {word.pos && (
              <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400">
                {word.pos}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleFavorite}
              aria-label={isFav ? t('common.unfavorite') : t('common.favorite')}
              className={`p-2 rounded-xl transition ${
                isFav
                  ? 'text-amber-500 bg-amber-50 dark:bg-amber-950/50'
                  : 'text-slate-400 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              <Star className={`w-5 h-5 ${isFav ? 'fill-amber-500' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label={t('common.close')}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Headword Section */}
          <div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <h2 className="text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                {language === 'ja' ? (
                  <JapaneseRubyText text={word.headword} reading={word.reading} />
                ) : (
                  word.headword
                )}
              </h2>
              {word.reading && (
                <span className="text-lg font-medium text-indigo-600 dark:text-indigo-400">
                  【{word.reading}】
                </span>
              )}
              {word.phonetic && (
                <span className="text-sm font-mono text-slate-500 dark:text-slate-400">
                  /{word.phonetic}/
                </span>
              )}
              <button
                type="button"
                onClick={() => handleSpeak(word.headword)}
                aria-label="播放发音"
                className="p-2 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900 transition active:scale-95"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Definitions */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" />
              {t('word_modal.meanings')}
            </h4>
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 space-y-2">
              {word.meanings && word.meanings.length > 0 ? (
                word.meanings.map((m, idx) => (
                  <div key={idx} className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">
                    {m.def}
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500">{t('word_modal.no_meanings')}</div>
              )}
            </div>
          </div>

          {/* Examples */}
          {word.examples && word.examples.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                {t('word_modal.examples')}
              </h4>
              <div className="space-y-2.5">
                {word.examples.slice(0, 3).map((ex, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-sm space-y-1"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-slate-900 dark:text-slate-100 leading-snug">
                        {ex.text}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleSpeak(ex.text)}
                        aria-label="朗读例句"
                        className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-slate-400 hover:text-indigo-600 transition shrink-0"
                      >
                        <Volume2 className="w-5 h-5" />
                      </button>
                    </div>
                    {ex.translation && (
                      <p className="text-slate-500 dark:text-slate-400 text-xs">
                        {ex.translation}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FSRS Scientific Repetition Metrics */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" />
              {t('word_modal.fsrs_title')}
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-1">
                  {t('word_modal.memory_state')}
                </span>
                {getStateBadge(initialProgress?.state)}
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-1">
                  {t('word_modal.memory_stability')}
                </span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {initialProgress?.stability ? `${initialProgress.stability.toFixed(1)} 天` : t('library.not_studied')}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-1">
                  {t('word_modal.review_lapses')}
                </span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {initialProgress ? `${initialProgress.reps} / ${initialProgress.lapses}` : '0 / 0'}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                <span className="text-[11px] text-slate-400 block mb-1">
                  {t('word_modal.difficulty_index')}
                </span>
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  {initialProgress?.difficulty ? initialProgress.difficulty.toFixed(1) : word.difficulty.toFixed(1)}
                </span>
              </div>
            </div>
            {initialProgress?.due && (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 pt-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>{t('word_modal.next_due')}：{formatDate(initialProgress.due)}</span>
              </div>
            )}
          </div>

          {/* User Notes */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {t('word_modal.personal_notes')}
              </h4>
              <button
                type="button"
                onClick={handleSaveNotes}
                className="flex items-center gap-1 text-xs text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
              >
                <Save className="w-3 h-3" />
                <span>{isSavingNotes ? t('word_modal.saved') : t('word_modal.save_notes')}</span>
              </button>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('word_modal.notes_placeholder')}
              rows={2}
              className="w-full text-xs p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 dark:text-slate-200 placeholder-slate-400"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between gap-3">
          {onStartAiPractice && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onStartAiPractice(word);
              }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm transition shadow-sm active:scale-98"
            >
              <MessageSquare className="w-4 h-4" />
              <span>{t('word_modal.start_ai_with_word')}</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-2xl bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-medium text-sm border border-slate-200 dark:border-slate-700 transition"
          >
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

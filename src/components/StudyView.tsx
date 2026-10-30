import React, { useState, useEffect } from 'react';
import {
  Volume2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  RotateCcw,
  Trophy,
  Flame,
  X,
  Keyboard,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Word, WordProgress, StudyMode, FSRSRating, Language } from '../types';
import { fsrs } from '../services/fsrs';
import { tts } from '../services/tts';
import { storage } from '../services/storage';
import { KanaKeyboard } from './KanaKeyboard';
import { useI18n } from '../i18n';
import { JapaneseRubyText } from './JapaneseRubyText';
import { normalizeAndCompareJapanese } from '../services/japaneseHelper';

interface StudyItem {
  word: Word;
  progress: WordProgress | null;
  mode: StudyMode;
  /** 同一张卡在本次会话内被回炉的次数（答错重排），用于防止无限循环 */
  retries?: number;
}

/** 会话类型：只复习到期卡 / 只学新词 / 混合（兼容旧行为） */
export type StudySessionMode = 'review' | 'new' | 'mixed';

interface StudyViewProps {
  language: Language;
  wordsPool: Word[];
  dueWords: Word[];
  newWords: Word[];
  /** 本次会话的模式，决定队列里放哪些词 */
  sessionMode?: StudySessionMode;
  onFinishSession: () => void;
  /** 复习完成后直接转去学新词，不用退回首页 */
  onContinueNew?: () => void;
  onExit: () => void;
  autoSpeak?: boolean;
}

/** 单张卡在本会话内最多被回炉的次数（超过后不再重排，交给明天的复习队列） */
const MAX_RELEARN = 2;

export const StudyView: React.FC<StudyViewProps> = ({
  language,
  wordsPool,
  dueWords,
  newWords,
  sessionMode = 'mixed',
  onFinishSession,
  onContinueNew,
  onExit,
  autoSpeak = true,
}) => {
  const { t } = useI18n();
  // Build session queue
  const [queue, setQueue] = useState<StudyItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false); // For new_card / flashcard
  const [userAnswer, setUserAnswer] = useState(''); // For dictation & cloze
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null); // For choice
  const [choiceOptions, setChoiceOptions] = useState<string[]>([]);
  const [correctChoiceIdx, setCorrectChoiceIdx] = useState(0);
  const [isAnswered, setIsAnswered] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showKanaKeyboard, setShowKanaKeyboard] = useState(language === 'ja');
  const [sessionLogs, setSessionLogs] = useState<{ word: Word; rating: FSRSRating; correct: boolean }[]>([]);
  const [isSessionComplete, setIsSessionComplete] = useState(false);
  const [queueReady, setQueueReady] = useState(false);

  // Initialize queue —— 按会话模式决定装哪些卡：
  // review = 只放到期卡；new = 只放生卡；mixed = 复习在前、新词在后（旧行为）
  useEffect(() => {
    const items: StudyItem[] = [];
    const progressMap = storage.getProgressMap();
    const useDue = sessionMode === 'review' || sessionMode === 'mixed';
    const useNew = sessionMode === 'new' || sessionMode === 'mixed';

    // Due cards first: 随机分配到三种答题模式
    if (useDue) {
      for (const w of dueWords) {
        const rand = Math.random();
        const mode: StudyMode = rand < 0.4 ? 'choice' : rand < 0.7 ? 'dictation' : 'cloze';
        items.push({ word: w, progress: progressMap[w.id] || null, mode });
      }
    }

    // Then new cards
    if (useNew) {
      for (const w of newWords) {
        items.push({ word: w, progress: progressMap[w.id] || null, mode: 'new_card' });
      }
    }

    // Fallback：新词配额用完且没有到期卡时，从词库抽 10 张保底（复习模式不兜底，
    // 因为「今天没有到期卡」本身就是一个需要如实告知的完成态）
    if (items.length === 0 && wordsPool.length > 0 && sessionMode !== 'review') {
      const sample = wordsPool.slice(0, 10);
      for (const w of sample) {
        items.push({ word: w, progress: progressMap[w.id] || null, mode: 'new_card' });
      }
    }

    setQueue(items);
    setCurrentIndex(0);
    setQueueReady(true);
  }, [dueWords, newWords, wordsPool, sessionMode]);

  const currentItem = queue[currentIndex];

  // Set up current card / question
  useEffect(() => {
    if (!currentItem) return;

    setIsFlipped(false);
    setUserAnswer('');
    setSelectedChoice(null);
    setIsAnswered(false);
    setShowHint(false);

    // Auto speak
    if (autoSpeak) {
      tts.speak(currentItem.word.headword, language, 1.0, currentItem.word.reading);
    }

    // Prepare choice options if in choice mode
    if (currentItem.mode === 'choice') {
      const targetDef = currentItem.word.meanings?.[0]?.def || '词义';
      const cleanTarget = targetDef.split('\n')[0].replace(/^(\w+\.\s*)/, '').slice(0, 36);

      const otherWords = wordsPool
        .filter((w) => w.id !== currentItem.word.id)
        .sort(() => 0.5 - Math.random())
        .slice(0, 3);

      const distractorDefs = otherWords.map((w) => {
        const d = w.meanings?.[0]?.def || '释义';
        return d.split('\n')[0].replace(/^(\w+\.\s*)/, '').slice(0, 36);
      });

      const options = [cleanTarget, ...distractorDefs].sort(() => 0.5 - Math.random());
      setChoiceOptions(options);
      setCorrectChoiceIdx(options.indexOf(cleanTarget));
    }
  }, [currentIndex, currentItem, autoSpeak, language, wordsPool]);

  // Handle rating & FSRS progression
  const applyRating = (rating: FSRSRating, isCorrect: boolean) => {
    if (!currentItem) return;

    const { nextProgress } = fsrs.review(currentItem.progress, rating);
    nextProgress.wordId = currentItem.word.id;
    nextProgress.language = language;
    storage.saveProgress(nextProgress);

    // Save study log
    storage.addStudyLog({
      id: crypto.randomUUID ? crypto.randomUUID() : `log_${Date.now()}`,
      wordId: currentItem.word.id,
      language,
      mode: currentItem.mode,
      rating,
      correct: isCorrect,
      durationMs: 3000,
      timestamp: Date.now(),
    });

    setSessionLogs((prev) => [...prev, { word: currentItem.word, rating, correct: isCorrect }]);

    // 「遗忘」的卡重新排到本次会话队尾，直到当场真正回想起来为止。
    // 之前答错的卡直接跳过，一轮复习下来没记住的词反而再也不出现，
    // 这是复习链路里最致命的一处问题。单卡最多回炉 2 次，避免卡死循环。
    const retries = currentItem.retries ?? 0;
    const requeue = rating === 1 && retries < MAX_RELEARN;
    if (requeue) {
      setQueue((prev) => [...prev, { ...currentItem, retries: retries + 1 }]);
    }

    // Move to next item or finish
    if (currentIndex + 1 < queue.length || requeue) {
      setCurrentIndex((prev) => prev + 1);
    } else {
      setIsSessionComplete(true);
      try {
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.6 } });
      } catch (_) {}
    }
  };

  // Choice mode select
  const handleChoiceSelect = (index: number) => {
    if (isAnswered) return;
    setSelectedChoice(index);
    setIsAnswered(true);

    const isCorrect = index === correctChoiceIdx;
    tts.speak(currentItem.word.headword, language, 1.0, currentItem.word.reading);

    setTimeout(() => {
      applyRating(isCorrect ? 3 : 1, isCorrect);
    }, 1100);
  };

  // Dictation & Cloze submit
  const handleTextSubmit = () => {
    if (isAnswered || !currentItem) return;
    setIsAnswered(true);

    const cleanInput = userAnswer.trim().toLowerCase();
    const cleanTarget = currentItem.word.headword.trim().toLowerCase();
    const cleanReading = currentItem.word.reading?.trim().toLowerCase();

    // Check if correct against headword, kana reading, or fuzzy Japanese normalization
    const isCorrect: boolean =
      language === 'ja'
        ? normalizeAndCompareJapanese(userAnswer, currentItem.word.headword, currentItem.word.reading)
        : cleanInput === cleanTarget || (cleanReading ? cleanInput === cleanReading : false);

    tts.speak(currentItem.word.headword, language, 1.0, currentItem.word.reading);

    setTimeout(() => {
      const rating: FSRSRating = isCorrect ? (showHint ? 2 : 3) : 1;
      applyRating(rating, isCorrect);
    }, 1200);
  };

  const isReviewSession = sessionMode === 'review';
  const canContinueNew = isReviewSession && newWords.length > 0;

  if (isSessionComplete || (queueReady && queue.length === 0)) {
    const total = sessionLogs.length;
    const correctCount = sessionLogs.filter((l) => l.correct).length;
    const accuracy = total > 0 ? Math.round((correctCount / total) * 100) : 100;
    const nothingToReview = queueReady && queue.length === 0 && isReviewSession;

    return (
      <div className="max-w-xl mx-auto px-4 py-8 animate-in fade-in duration-300">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-8 border border-slate-200 dark:border-slate-800 shadow-xl text-center space-y-6">
          <div className={`w-20 h-20 mx-auto rounded-3xl ${
            nothingToReview
              ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400'
              : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400'
          } flex items-center justify-center shadow-inner`}>
            {nothingToReview ? <CheckCircle2 className="w-10 h-10" /> : <Trophy className="w-10 h-10" />}
          </div>

          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">
              {nothingToReview
                ? t('study.review_cleared')
                : isReviewSession
                  ? t('study.review_finished')
                  : t('study.session_finished')}
            </h2>
            <p className="text-slate-500 text-sm mt-1">
              {nothingToReview
                ? t('study.review_cleared_desc')
                : t('study.session_finished_desc')}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
              <span className="text-xs text-slate-400 block mb-1">
                {t('study.completed_count')}
              </span>
              <span className="text-2xl font-black text-slate-900 dark:text-white">{total}</span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
              <span className="text-xs text-slate-400 block mb-1">
                {t('study.accuracy')}
              </span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {accuracy}%
              </span>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
              <span className="text-xs text-slate-400 block mb-1">
                {t('study.today_checkin')}
              </span>
              <span className="text-2xl font-black text-amber-500 flex items-center justify-center gap-1">
                <Flame className="w-5 h-5 fill-amber-500" />
                <span>+1</span>
              </span>
            </div>
          </div>

          <div className="pt-4 flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onFinishSession}
              className={`${
                canContinueNew ? 'flex-1 sm:order-1' : 'flex-1'
              } py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md transition`}
            >
              {t('study.back_home')}
            </button>
            {canContinueNew && (
              <button
                type="button"
                onClick={() => onContinueNew && onContinueNew()}
                className="flex-1 sm:order-2 py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-md transition"
              >
                {t('study.continue_new', { count: newWords.length })}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!currentItem) {
    return (
      <div className="text-center py-20 text-slate-500">
        {t('study.preparing')}
      </div>
    );
  }

  const { word, mode, progress } = currentItem;
  const progressPercent = Math.round(((currentIndex + 1) / queue.length) * 100);

  const getModeLabel = (m: StudyMode) => {
    switch (m) {
      case 'new_card':
        return t('study.mode_new_card');
      case 'choice':
        return t('study.mode_choice');
      case 'dictation':
        return t('study.mode_dictation');
      case 'cloze':
        return t('study.mode_cloze');
      default:
        return t('study.mode_new_card');
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom,0px)+1rem)] w-full flex-1 min-h-0 flex flex-col justify-between overflow-y-auto overscroll-contain">
      {/* Top Header & Progress */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onExit}
            aria-label={t('study.exit_and_save')}
            className="flex items-center gap-1.5 px-3 min-h-[44px] rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-4 h-4" />
            <span>{t('study.exit_and_save')}</span>
          </button>

          <div className="flex items-center gap-2">
            {currentItem.retries ? (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold border bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900">
                {t('study.relearn_badge', { count: currentItem.retries })}
              </span>
            ) : null}
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              {getModeLabel(mode)}
            </span>
            <span className="text-xs font-bold text-slate-400">
              {currentIndex + 1} / {queue.length}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Main Interactive Stage */}
      <div className="my-4">
        {/* MODE 1: Flashcard / New Card */}
        {mode === 'new_card' && (
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="cursor-pointer bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-lg hover:border-indigo-300 dark:hover:border-indigo-700 transition min-h-[320px] flex flex-col justify-between select-none"
          >
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="uppercase tracking-wider font-semibold">
                  {word.level} · {word.pos || 'VOCAB'}
                </span>
                <span className="text-indigo-600 dark:text-indigo-400 font-medium">
                  {isFlipped ? t('study.click_see_front') : t('study.click_see_back')}
                </span>
              </div>

              {/* Front side */}
              <div className="text-center py-6">
                <div className="text-4xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
                  {language === 'ja' ? (
                    <JapaneseRubyText text={word.headword} reading={word.reading} />
                  ) : (
                    word.headword
                  )}
                </div>
                {word.reading && language !== 'ja' && (
                  <div className="text-lg font-medium text-indigo-600 dark:text-indigo-400 mt-2">
                    【{word.reading}】
                  </div>
                )}
                {word.phonetic && (
                  <div className="text-sm font-mono text-slate-400 mt-1">
                    /{word.phonetic}/
                  </div>
                )}

                <div className="mt-4 flex justify-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      tts.speak(word.headword, language, 1.0, word.reading);
                    }}
                    aria-label="朗读"
                    className="p-3 rounded-full bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 hover:scale-105 transition active:scale-95 shadow-xs"
                  >
                    <Volume2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Back side details */}
            {isFlipped ? (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3 animate-in fade-in duration-150">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 text-sm font-medium">
                  {word.meanings?.[0]?.def || ''}
                </div>

                {word.examples?.[0] && (
                  <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 text-xs space-y-1">
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {word.examples[0].text}
                    </p>
                    {word.examples[0].translation && (
                      <p className="text-slate-500">{word.examples[0].translation}</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-xs text-slate-400 flex items-center justify-center gap-1">
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('study.flip_hint')}</span>
              </div>
            )}
          </div>
        )}

        {/* MODE 2: Choice Mode */}
        {mode === 'choice' && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-lg text-center">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {t('study.choice_prompt')}
              </span>
              <div className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white mt-2">
                {word.headword}
              </div>
              {word.reading && (
                <div className="text-sm text-indigo-500 mt-1">【{word.reading}】</div>
              )}
              {word.phonetic && (
                <div className="text-xs font-mono text-slate-400 mt-1">/{word.phonetic}/</div>
              )}
              <div className="mt-3 flex justify-center">
                <button
                  type="button"
                  onClick={() => tts.speak(word.headword, language)}
                  className="p-2 rounded-full text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition"
                >
                  <Volume2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Options */}
            <div className="grid grid-cols-1 gap-2.5">
              {choiceOptions.map((opt, idx) => {
                const isSelected = selectedChoice === idx;
                const isCorrect = idx === correctChoiceIdx;
                let btnStyle =
                  'bg-white dark:bg-slate-800 hover:bg-indigo-50/50 dark:hover:bg-slate-700/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200';

                if (isAnswered) {
                  if (isCorrect) {
                    btnStyle =
                      'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-semibold';
                  } else if (isSelected) {
                    btnStyle =
                      'bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-700 dark:text-rose-300';
                  }
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleChoiceSelect(idx)}
                    disabled={isAnswered}
                    className={`p-4 rounded-2xl border text-left text-sm flex items-center justify-between transition active:scale-99 ${btnStyle}`}
                  >
                    <span>{opt}</span>
                    {isAnswered && (
                      <span>
                        {isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                        {isSelected && !isCorrect && (
                          <XCircle className="w-5 h-5 text-rose-500" />
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* MODE 3: Dictation (听写) */}
        {mode === 'dictation' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-lg space-y-6">
            <div className="text-center space-y-3">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                {t('study.dictation_prompt')}
              </span>

              <div className="flex justify-center py-4">
                <button
                  type="button"
                  onClick={() => tts.speak(word.headword, language)}
                  className="w-20 h-20 rounded-3xl bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center shadow-lg transition active:scale-95"
                >
                  <Volume2 className="w-8 h-8" />
                </button>
              </div>

              <p className="text-xs text-slate-400">{t('study.dictation_hint')}</p>

              {showHint && (
                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 text-xs text-amber-700 dark:text-amber-300 font-medium animate-in fade-in">
                  提示: 首字母为「{word.headword[0]}」，共 {word.headword.length} 个字符
                  {word.pos ? ` · 词性 ${word.pos}` : ''}
                </div>
              )}
            </div>

            {/* Input area */}
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={userAnswer}
                  onChange={(e) => setUserAnswer(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleTextSubmit();
                  }}
                  disabled={isAnswered}
                  placeholder={language === 'ja' ? '入力してください...' : 'Type spelling...'}
                  className="flex-1 px-4 py-3 rounded-2xl text-base bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleTextSubmit}
                  disabled={!userAnswer.trim() || isAnswered}
                  className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium text-sm transition shadow-sm"
                >
                  {t('common.confirm')}
                </button>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <button
                  type="button"
                  onClick={() => setShowHint(true)}
                  className="flex items-center gap-1 hover:text-indigo-600 transition"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>{t('study.get_hint')}</span>
                </button>

                {language === 'ja' && (
                  <button
                    type="button"
                    onClick={() => setShowKanaKeyboard(!showKanaKeyboard)}
                    className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium hover:underline"
                  >
                    <Keyboard className="w-3.5 h-3.5" />
                    <span>
                      {showKanaKeyboard ? t('study.collapse_kana') : t('study.expand_kana')}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Kana Keyboard */}
            {language === 'ja' && showKanaKeyboard && (
              <KanaKeyboard
                onInput={(char) => setUserAnswer((prev) => prev + char)}
                onBackspace={() => setUserAnswer((prev) => prev.slice(0, -1))}
                onSubmit={handleTextSubmit}
              />
            )}

            {/* Revealed answer if answered */}
            {isAnswered && (
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2 animate-in fade-in">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">{t('study.standard_answer')}：</span>
                  <span className="font-bold text-base text-slate-900 dark:text-white">
                    {word.headword}
                  </span>
                  {word.reading && <span className="text-sm text-indigo-500">【{word.reading}】</span>}
                </div>
                <p className="text-xs text-slate-500">{word.meanings?.[0]?.def}</p>
              </div>
            )}
          </div>
        )}

        {/* MODE 4: Cloze (填空) */}
        {mode === 'cloze' && (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-lg space-y-6">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block text-center">
              {t('study.cloze_prompt')}
            </span>

            {/* Example sentence with blank */}
            <div className="p-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/60 space-y-2 text-center">
              <p className="text-lg font-medium text-slate-900 dark:text-white leading-relaxed">
                {word.examples?.[0]?.text
                  ? word.examples[0].text.replace(new RegExp(`\\b${word.headword}\\b`, 'gi'), ' [ ______ ] ')
                  : `Please practice the word: [ ______ ] (${word.pos || 'v.'})`}
              </p>
              {word.examples?.[0]?.translation && (
                <p className="text-xs text-slate-500">{word.examples[0].translation}</p>
              )}
            </div>

            <div className="text-center text-xs text-slate-500">
              {t('study.cloze_hint')}：{word.meanings?.[0]?.def?.slice(0, 40) || ''}
            </div>

            {/* Input area */}
            <div className="flex gap-2">
              <input
                type="text"
                value={userAnswer}
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTextSubmit();
                }}
                disabled={isAnswered}
                placeholder="Type here..."
                className="flex-1 px-4 py-3 rounded-2xl text-base bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono text-slate-900 dark:text-white"
              />
              <button
                type="button"
                onClick={handleTextSubmit}
                disabled={!userAnswer.trim() || isAnswered}
                className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-medium text-sm transition shadow-sm"
              >
                {t('common.confirm')}
              </button>
            </div>

            {isAnswered && (
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  {t('study.correct_answer')}：{word.headword}
                </span>
                <button
                  type="button"
                  onClick={() => tts.speak(word.headword, language)}
                  className="text-xs text-indigo-600 font-medium flex items-center gap-1"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>{t('common.read')}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Rating Bar for Flashcard Mode */}
      {mode === 'new_card' && (
        <div className="space-y-2">
          {/* 窄屏 2 列（每格更大更好按），md 以上恢复 4 列一排 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => applyRating(1, false)}
              className="min-h-[62px] p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-200 dark:border-rose-900/80 text-rose-700 dark:text-rose-300 font-medium transition active:scale-95"
            >
              <div className="text-base font-bold">{t('study.again')}</div>
              <div className="text-[11px] text-rose-500 mt-0.5">
                {fsrs.getIntervalPreview(progress, 1)}
              </div>
            </button>

            <button
              type="button"
              onClick={() => applyRating(2, true)}
              className="min-h-[62px] p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200 dark:border-amber-900/80 text-amber-700 dark:text-amber-300 font-medium transition active:scale-95"
            >
              <div className="text-base font-bold">{t('study.hard')}</div>
              <div className="text-[11px] text-amber-500 mt-0.5">
                {fsrs.getIntervalPreview(progress, 2)}
              </div>
            </button>

            <button
              type="button"
              onClick={() => applyRating(3, true)}
              className="min-h-[62px] p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200 dark:border-indigo-900/80 text-indigo-700 dark:text-indigo-300 font-medium transition active:scale-95"
            >
              <div className="text-base font-bold">{t('study.good')}</div>
              <div className="text-[11px] text-indigo-500 mt-0.5">
                {fsrs.getIntervalPreview(progress, 3)}
              </div>
            </button>

            <button
              type="button"
              onClick={() => applyRating(4, true)}
              className="min-h-[62px] p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-900/80 text-emerald-700 dark:text-emerald-300 font-medium transition active:scale-95"
            >
              <div className="text-base font-bold">{t('study.easy')}</div>
              <div className="text-[11px] text-emerald-500 mt-0.5">
                {fsrs.getIntervalPreview(progress, 4)}
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import { Sparkles, ArrowRight, CheckCircle2, XCircle, Award } from 'lucide-react';
import confetti from 'canvas-confetti';
import { Word, Language } from '../types';
import { PlacementEngine, PlacementQuestion } from '../services/placement';
import { tts } from '../services/tts';
import { useI18n } from '../i18n';

interface PlacementModalProps {
  language: Language;
  wordsPool: Word[];
  onComplete: (recommendedLevel: string) => void;
  onSkip: () => void;
}

export const PlacementModal: React.FC<PlacementModalProps> = ({
  language,
  wordsPool,
  onComplete,
  onSkip,
}) => {
  const { t } = useI18n();
  const [engine] = useState(() => new PlacementEngine(language));
  const [currentQuestion, setCurrentQuestion] = useState<PlacementQuestion | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [isTestFinished, setIsTestFinished] = useState(false);

  // Generate question for current level
  const generateQuestion = () => {
    if (wordsPool.length === 0) return;
    const targetLevel = engine.currentLevel;
    const matchingWords = wordsPool.filter(w => w.level.toUpperCase() === targetLevel.toUpperCase());
    const candidateList = matchingWords.length >= 4 ? matchingWords : wordsPool;

    // Pick 1 random target word
    const targetWord = candidateList[Math.floor(Math.random() * candidateList.length)];

    // Pick 3 distractors
    const distractors = candidateList
      .filter(w => w.id !== targetWord.id)
      .sort(() => 0.5 - Math.random())
      .slice(0, 3);

    const getMeaningStr = (w: Word) => {
      const def = w.meanings?.[0]?.def || '词汇释义';
      return def.split('\n')[0].replace(/^(\w+\.\s*)/, '').slice(0, 32);
    };

    const targetDef = getMeaningStr(targetWord);
    const distractorDefs = distractors.map(getMeaningStr);

    const allOptions = [targetDef, ...distractorDefs].sort(() => 0.5 - Math.random());
    const correctIndex = allOptions.indexOf(targetDef);

    setCurrentQuestion({
      word: targetWord,
      level: targetLevel,
      options: allOptions,
      correctIndex,
    });
    setSelectedOption(null);
    setIsAnswered(false);
  };

  useEffect(() => {
    generateQuestion();
  }, []);

  const handleSelect = (index: number) => {
    if (isAnswered || !currentQuestion) return;
    setSelectedOption(index);
    setIsAnswered(true);

    const isCorrect = index === currentQuestion.correctIndex;
    tts.speak(currentQuestion.word.headword, language);

    setTimeout(() => {
      engine.recordAnswer(isCorrect);
      if (engine.isDone) {
        setIsTestFinished(true);
        try {
          confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        } catch (_) {}
      } else {
        generateQuestion();
      }
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col">
        {/* Top Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">
                {language === 'ja' ? t('placement.ja_title') : t('placement.en_title')}
              </h3>
              <p className="text-xs text-slate-400">{t('placement.desc')}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            {t('placement.skip')}
          </button>
        </div>

        {/* Content */}
        {!isTestFinished ? (
          <div className="p-6 space-y-6">
            {/* Ladder level indicator */}
            <div className="flex items-center justify-between gap-1.5">
              {engine.levels.map((lvl) => {
                const isCurrent = lvl === engine.currentLevel;
                return (
                  <div
                    key={lvl}
                    className={`flex-1 text-center py-1.5 rounded-xl text-xs font-bold transition-all ${
                      isCurrent
                        ? 'bg-indigo-600 text-white shadow-md scale-105'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                    }`}
                  >
                    {lvl}
                  </div>
                );
              })}
            </div>

            {/* Question Card */}
            {currentQuestion ? (
              <div className="space-y-4">
                <div className="p-6 text-center rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
                  <span className="text-xs uppercase font-semibold text-indigo-600 dark:text-indigo-400 tracking-wider">
                    {t('placement.difficulty_stage')}: {currentQuestion.level} · {t('placement.question_num', { num: engine.askedCount + 1 })}
                  </span>
                  <div className="text-3xl font-extrabold text-slate-900 dark:text-white mt-2">
                    {currentQuestion.word.headword}
                  </div>
                  {currentQuestion.word.reading && (
                    <div className="text-sm text-indigo-500 mt-1">
                      【{currentQuestion.word.reading}】
                    </div>
                  )}
                  {currentQuestion.word.phonetic && (
                    <div className="text-xs text-slate-400 font-mono mt-1">
                      /{currentQuestion.word.phonetic}/
                    </div>
                  )}
                </div>

                {/* Options */}
                <div className="grid grid-cols-1 gap-2.5">
                  {currentQuestion.options.map((option, idx) => {
                    const isSelected = selectedOption === idx;
                    const isCorrect = idx === currentQuestion.correctIndex;
                    let optionStyle =
                      'bg-white dark:bg-slate-800 hover:bg-indigo-50/50 dark:hover:bg-slate-700/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200';

                    if (isAnswered) {
                      if (isCorrect) {
                        optionStyle =
                          'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-500 text-emerald-700 dark:text-emerald-300 font-medium';
                      } else if (isSelected) {
                        optionStyle =
                          'bg-rose-50 dark:bg-rose-950/60 border-rose-500 text-rose-700 dark:text-rose-300';
                      }
                    }

                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelect(idx)}
                        disabled={isAnswered}
                        className={`p-3.5 rounded-2xl border text-left text-sm flex items-center justify-between transition active:scale-99 ${optionStyle}`}
                      >
                        <span>{option}</span>
                        {isAnswered && (
                          <span>
                            {isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                            {isSelected && !isCorrect && (
                              <XCircle className="w-4 h-4 text-rose-500" />
                            )}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-slate-400">{t('placement.generating')}</div>
            )}
          </div>
        ) : (
          /* Finished Result View */
          <div className="p-8 text-center space-y-6">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-indigo-100 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shadow-inner">
              <Award className="w-8 h-8" />
            </div>

            <div>
              <h4 className="text-xl font-bold text-slate-900 dark:text-white">
                {t('placement.finished_title')}
              </h4>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {t('placement.finished_desc')}
              </p>
              <div className="mt-4 inline-block px-5 py-2.5 rounded-2xl bg-indigo-600 text-white font-black text-2xl shadow-lg">
                {engine.resultLevel}
              </div>
            </div>

            <p className="text-xs text-slate-400 max-w-xs mx-auto">
              {t('placement.finished_tip')}
            </p>

            <button
              type="button"
              onClick={() => onComplete(engine.resultLevel)}
              className="w-full py-3.5 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition"
            >
              <span>{t('placement.start_plan_btn')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

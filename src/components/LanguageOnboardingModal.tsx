import React, { useState } from 'react';
import { Check, Sparkles, ArrowRight } from 'lucide-react';
import { Language, Deck } from '../types';

interface LanguageOnboardingModalProps {
  decks: Deck[];
  onComplete: (lang: Language, deckId: string) => void;
}

export const LanguageOnboardingModal: React.FC<LanguageOnboardingModalProps> = ({
  decks,
  onComplete,
}) => {
  // Default to Japanese as user requested
  const [selectedLang, setSelectedLang] = useState<Language>('ja');
  const [selectedDeckId, setSelectedDeckId] = useState<string>('ja-jlpt-n5');

  const filteredDecks = decks.filter((d) => d.language === selectedLang);

  const handleSelectLang = (lang: Language) => {
    setSelectedLang(lang);
    const firstDeck = decks.find((d) => d.language === lang);
    if (firstDeck) {
      setSelectedDeckId(firstDeck.id);
    }
  };

  const handleFinish = () => {
    onComplete(selectedLang, selectedDeckId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 mb-1">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            定制你的专属学习起点
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            随时可以在设置中无缝切换语言、词库与口音
          </p>
        </div>

        {/* Language Selection Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <button
            type="button"
            onClick={() => handleSelectLang('ja')}
            className={`p-4 rounded-2xl border text-left transition relative cursor-pointer ${
              selectedLang === 'ja'
                ? 'bg-rose-50/60 dark:bg-rose-950/40 border-rose-500 ring-2 ring-rose-500/20'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">🇯🇵</span>
              {selectedLang === 'ja' && (
                <div className="w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              )}
            </div>
            <div className="font-bold text-sm text-slate-900 dark:text-white">日本語 (Japanese)</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              JLPT N5~N1 考纲全覆盖 · 假名软键盘与振假名对齐 · 居酒屋与工程朝礼实战
            </p>
          </button>

          <button
            type="button"
            onClick={() => handleSelectLang('en')}
            className={`p-4 rounded-2xl border text-left transition relative cursor-pointer ${
              selectedLang === 'en'
                ? 'bg-indigo-50/60 dark:bg-indigo-950/40 border-indigo-500 ring-2 ring-indigo-500/20'
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl">🇬🇧</span>
              {selectedLang === 'en' && (
                <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
              )}
            </div>
            <div className="font-bold text-sm text-slate-900 dark:text-white">English (英语)</div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              CEFR A1~C2 考纲词库 · 英美双口音真声 · 外企技术面试与国际工程 BIM 实战
            </p>
          </button>
        </div>

        {/* Deck Level Picker */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
            选择起始目标词库阶梯：
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {filteredDecks.map((deck) => (
              <button
                key={deck.id}
                type="button"
                onClick={() => setSelectedDeckId(deck.id)}
                className={`p-2.5 rounded-xl border text-left transition text-xs cursor-pointer ${
                  selectedDeckId === deck.id
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent font-bold shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                <div className="truncate">{deck.name}</div>
                <div className="text-[10px] opacity-75 mt-0.5">{deck.word_count} 词</div>
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleFinish}
          className="w-full py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition shadow-sm hover:shadow-md flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>进入科学记忆工作台</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

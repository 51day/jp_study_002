import React, { useState } from 'react';
import { Delete, ArrowRight } from 'lucide-react';

interface KanaKeyboardProps {
  onInput: (char: string) => void;
  onBackspace: () => void;
  onSubmit?: () => void;
}

const HIRAGANA_GRID = [
  ['あ', 'い', 'う', 'え', 'お'],
  ['か', 'き', 'く', 'け', 'こ'],
  ['さ', 'し', 'す', 'せ', 'そ'],
  ['た', 'ち', 'つ', 'て', 'と'],
  ['な', 'に', 'ぬ', 'ね', 'の'],
  ['は', 'ひ', 'ふ', 'へ', 'ほ'],
  ['ま', 'み', 'む', 'め', 'も'],
  ['や', '（', 'ゆ', '）', 'よ'],
  ['ら', 'り', 'る', 'れ', 'ろ'],
  ['わ', 'を', 'ん', 'ー', 'っ'],
  ['が', 'ぎ', 'ぐ', 'げ', 'ご'],
  ['ざ', 'じ', 'ず', 'ぜ', 'ぞ'],
  ['だ', 'ぢ', 'づ', 'で', 'ど'],
  ['ば', 'び', 'ぶ', 'べ', 'ぼ'],
  ['ぱ', 'ぴ', 'ぷ', 'ぺ', 'ぽ'],
];

const KATAKANA_GRID = [
  ['ア', 'イ', 'ウ', 'エ', 'オ'],
  ['カ', 'キ', 'ク', 'ケ', 'コ'],
  ['サ', 'シ', 'ス', 'セ', 'ソ'],
  ['タ', 'チ', 'ツ', 'テ', 'ト'],
  ['ナ', 'ニ', 'ヌ', 'ネ', 'ノ'],
  ['ハ', 'ヒ', 'フ', 'ヘ', 'ホ'],
  ['マ', 'ミ', 'ム', 'メ', 'モ'],
  ['ヤ', '（', 'ユ', '）', 'ヨ'],
  ['ラ', 'リ', 'ル', 'レ', 'ロ'],
  ['ワ', 'ヲ', 'ン', 'ー', 'ッ'],
  ['ガ', 'ギ', 'グ', 'ゲ', 'ゴ'],
  ['ザ', 'ジ', 'ズ', 'ゼ', 'ゾ'],
  ['ダ', 'ヂ', 'ヅ', 'デ', 'ド'],
  ['バ', 'ビ', 'ブ', 'ベ', 'ボ'],
  ['パ', 'ピ', 'プ', 'ペ', 'ポ'],
];

export const KanaKeyboard: React.FC<KanaKeyboardProps> = ({
  onInput,
  onBackspace,
  onSubmit,
}) => {
  const [mode, setMode] = useState<'hiragana' | 'katakana'>('hiragana');
  const currentGrid = mode === 'hiragana' ? HIRAGANA_GRID : KATAKANA_GRID;

  return (
    <div className="bg-slate-100 dark:bg-slate-800 p-2 sm:p-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm max-w-xl mx-auto select-none">
      {/* Top action bar */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-700">
        <div className="flex gap-1 bg-slate-200 dark:bg-slate-700 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setMode('hiragana')}
            className={`px-3 min-h-[44px] rounded-lg text-sm sm:text-xs font-medium transition ${
              mode === 'hiragana'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            平假名 (あ)
          </button>
          <button
            type="button"
            onClick={() => setMode('katakana')}
            className={`px-3 min-h-[44px] rounded-lg text-sm sm:text-xs font-medium transition ${
              mode === 'katakana'
                ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
            }`}
          >
            片假名 (ア)
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onBackspace}
            aria-label="退格删除"
            className="flex items-center gap-1 px-4 min-h-[44px] rounded-xl bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-sm sm:text-xs font-medium transition"
          >
            <Delete className="w-3.5 h-3.5" />
            <span>退格</span>
          </button>
          {onSubmit && (
            <button
              type="button"
              onClick={onSubmit}
              className="flex items-center gap-1 px-4 min-h-[44px] rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm sm:text-xs font-medium shadow-xs transition active:scale-95"
            >
              <span>确认</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Grid container with scrolling for extended kana */}
      <div className="max-h-64 overflow-y-auto pr-1 space-y-2">
        {currentGrid.map((row, rIdx) => (
          <div key={rIdx} className="grid grid-cols-5 gap-2">
            {row.map((char, cIdx) => (
              <button
                key={cIdx}
                type="button"
                onClick={() => onInput(char)}
                className="min-h-[48px] rounded-xl bg-white dark:bg-slate-900 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 active:scale-95 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium text-lg sm:text-base flex items-center justify-center transition shadow-2xs"
              >
                {char}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

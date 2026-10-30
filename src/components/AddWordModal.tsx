import React, { useState } from 'react';
import { X, Plus, BookOpen, Sparkles, Upload, FileText, Check } from 'lucide-react';
import { Word, Language } from '../types';
import { storage } from '../services/storage';
import { useI18n } from '../i18n';
import { JapaneseRubyText } from './JapaneseRubyText';

interface AddWordModalProps {
  language: Language;
  onClose: () => void;
  onWordAdded: (word: Word) => void;
  onBatchAdded?: (count: number) => void;
}

export const AddWordModal: React.FC<AddWordModalProps> = ({
  language,
  onClose,
  onWordAdded,
  onBatchAdded,
}) => {
  const { t } = useI18n();
  const [tab, setTab] = useState<'single' | 'batch'>('single');

  // Single word form state
  const [headword, setHeadword] = useState('');
  const [reading, setReading] = useState('');
  const [phonetic, setPhonetic] = useState('');
  const [pitch, setPitch] = useState('0');
  const [pos, setPos] = useState('n.');
  const [definition, setDefinition] = useState('');
  const [exampleText, setExampleText] = useState('');
  const [exampleTrans, setExampleTrans] = useState('');
  const [error, setError] = useState('');

  // Batch import state
  const [batchText, setBatchText] = useState('');
  const [batchNotice, setBatchNotice] = useState<string | null>(null);

  const insertRubyBracket = () => {
    setHeadword((prev) => prev + '[かんじ]');
  };

  const handleSubmitSingle = (e: React.FormEvent) => {
    e.preventDefault();
    if (!headword.trim()) {
      setError(t('add_word.error_headword'));
      return;
    }
    if (!definition.trim()) {
      setError(t('add_word.error_meaning'));
      return;
    }

    const newWord: Word = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      headword: headword.trim(),
      reading: reading.trim() || null,
      phonetic: phonetic.trim() || null,
      pos: pos || null,
      meanings: [{ lang: 'zh', def: `${pos ? pos + ' ' : ''}${definition.trim()}` }],
      examples: exampleText.trim()
        ? [{ text: exampleText.trim(), translation: exampleTrans.trim() || null }]
        : [],
      difficulty: 3.0,
      level: 'Custom',
      tags: language === 'ja' && pitch ? { pitch } : undefined,
      isCustom: true,
      language,
      updatedAt: Date.now(),
      deletedAt: null,
    };

    storage.addCustomWord(newWord);
    onWordAdded(newWord);
    onClose();
  };

  const handleBatchImport = () => {
    if (!batchText.trim()) return;

    const lines = batchText.split('\n').filter((l) => l.trim().length > 0);
    let importedCount = 0;

    for (const line of lines) {
      // Support tab, comma, or pipe separator
      let parts: string[] = [];
      if (line.includes('\t')) {
        parts = line.split('\t');
      } else if (line.includes('|')) {
        parts = line.split('|');
      } else if (line.includes('，')) {
        parts = line.split('，');
      } else {
        parts = line.split(',');
      }

      const rawHead = parts[0]?.trim();
      if (!rawHead) continue;

      let rawReading = '';
      let rawDef = '';
      let rawEx = '';

      if (parts.length >= 3) {
        rawReading = parts[1]?.trim() || '';
        rawDef = parts[2]?.trim() || '';
        rawEx = parts[3]?.trim() || '';
      } else if (parts.length === 2) {
        rawDef = parts[1]?.trim() || '';
      }

      // Check if rawHead has bracket format e.g. 散歩[さんぽ]
      const match = rawHead.match(/([\u4e00-\u9faf]+)[\[\(（]([^\u4e00-\u9faf\[\]\(\)（）]+)[\]\)）]/);
      if (match && !rawReading) {
        rawReading = match[2];
      }

      const word: Word = {
        id: `custom_batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        headword: rawHead,
        reading: rawReading || null,
        phonetic: null,
        pos: 'n.',
        meanings: [{ lang: 'zh', def: rawDef || '自定义词义' }],
        examples: rawEx ? [{ text: rawEx }] : [],
        difficulty: 3.0,
        level: 'Custom',
        isCustom: true,
        language,
        updatedAt: Date.now(),
        deletedAt: null,
      };

      storage.addCustomWord(word);
      importedCount++;
    }

    if (importedCount > 0) {
      setBatchNotice(`成功批量添加 ${importedCount} 个词汇到生词本！`);
      if (onBatchAdded) onBatchAdded(importedCount);
      setTimeout(() => {
        onClose();
      }, 1200);
    } else {
      setError('未能识别到有效的词汇条目，请检查格式');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white">
                {language === 'ja' ? '添加日语单词 / 词库' : '添加英语单词 / 词库'}
              </h3>
              <p className="text-xs text-slate-400">
                支持标准振假名注音、声调标注与 TSV/CSV 批量导入
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('common.close')}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Toggle: Single vs Batch */}
        <div className="flex border-b border-slate-100 dark:border-slate-800 px-5 pt-2 gap-4">
          <button
            type="button"
            onClick={() => setTab('single')}
            className={`pb-2.5 text-xs font-bold border-b-2 transition ${
              tab === 'single'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            单条录入 (含假名助手)
          </button>
          <button
            type="button"
            onClick={() => setTab('batch')}
            className={`pb-2.5 text-xs font-bold border-b-2 transition flex items-center gap-1.5 ${
              tab === 'batch'
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>批量导入 (Anki / TSV)</span>
          </button>
        </div>

        {/* Tab 1: Single Word Form */}
        {tab === 'single' ? (
          <form onSubmit={handleSubmitSingle} className="p-5 space-y-4 overflow-y-auto">
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-medium">
                {error}
              </div>
            )}

            {/* Live Ruby Preview for Japanese */}
            {language === 'ja' && headword && (
              <div className="p-3 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800">
                <div className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" />
                  <span>振假名标准渲染实时预览：</span>
                </div>
                <div className="text-xl font-bold text-slate-900 dark:text-white">
                  <JapaneseRubyText text={headword} reading={reading} />
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {t('add_word.headword')} <span className="text-rose-500">*</span>
                </label>
                {language === 'ja' && (
                  <button
                    type="button"
                    onClick={insertRubyBracket}
                    className="text-[11px] text-indigo-600 hover:underline flex items-center gap-0.5"
                  >
                    <span>+ [假名] 语法</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                value={headword}
                onChange={(e) => {
                  setHeadword(e.target.value);
                  setError('');
                }}
                placeholder={language === 'ja' ? '例: 散歩 或 散歩[さんぽ]' : '例: serendipity'}
                className="w-full text-base md:text-sm p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  {language === 'ja' ? t('add_word.reading_kana') : t('add_word.phonetic')}
                </label>
                <input
                  type="text"
                  value={language === 'ja' ? reading : phonetic}
                  onChange={(e) => {
                    if (language === 'ja') setReading(e.target.value);
                    else setPhonetic(e.target.value);
                  }}
                  placeholder={language === 'ja' ? '例: さんぽ' : '例: ˌserənˈdɪpɪti'}
                  className="w-full text-base md:text-sm p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {language === 'ja' ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    日语声调 (Pitch Accent)
                  </label>
                  <select
                    value={pitch}
                    onChange={(e) => setPitch(e.target.value)}
                    className="w-full text-base md:text-sm p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="0">⓪ 平板型</option>
                    <option value="1">① 头高型</option>
                    <option value="2">② 中高型</option>
                    <option value="3">③ 尾高型</option>
                    <option value="4">④+ 型</option>
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t('add_word.pos')}
                  </label>
                  <select
                    value={pos}
                    onChange={(e) => setPos(e.target.value)}
                    className="w-full text-base md:text-sm p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="n.">名词 (n.)</option>
                    <option value="v.">动词 (v.)</option>
                    <option value="adj.">形容词 (adj.)</option>
                    <option value="adv.">副词 (adv.)</option>
                    <option value="phrase">短语 (phrase)</option>
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('add_word.meaning')} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={definition}
                onChange={(e) => {
                  setDefinition(e.target.value);
                  setError('');
                }}
                placeholder="例: 意外发现美好事物的机缘；散步"
                className="w-full text-base md:text-sm p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t('add_word.example')}
              </label>
              <input
                type="text"
                value={exampleText}
                onChange={(e) => setExampleText(e.target.value)}
                placeholder="例句外语"
                className="w-full text-base md:text-sm p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
              />
              <input
                type="text"
                value={exampleTrans}
                onChange={(e) => setExampleTrans(e.target.value)}
                placeholder="例句中文翻译"
                className="w-full text-base md:text-sm p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="pt-2 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-2xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-medium transition"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>{t('add_word.save_btn')}</span>
              </button>
            </div>
          </form>
        ) : (
          /* Tab 2: Batch TSV / Anki Import */
          <div className="p-5 space-y-4 overflow-y-auto">
            {batchNotice && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-semibold flex items-center gap-2">
                <Check className="w-4 h-4" />
                <span>{batchNotice}</span>
              </div>
            )}

            <div className="text-xs text-slate-500 leading-relaxed space-y-1">
              <p className="font-semibold text-slate-800 dark:text-slate-200">
                支持直接粘贴 Anki / Excel / TSV 格式（每行一个单词）：
              </p>
              <p className="text-[11px] text-slate-400">
                格式1: <code>单词 [Tab] 读音/音标 [Tab] 释义 [Tab] 例句</code><br />
                格式2: <code>散步[さんぽ], 散步休闲</code> 或 <code>word, meaning</code>
              </p>
            </div>

            <textarea
              rows={8}
              value={batchText}
              onChange={(e) => setBatchText(e.target.value)}
              placeholder={
                language === 'ja'
                  ? '散歩\tさんぽ\t散步、溜达\n美味しい\tおいしい\t美味可口的\n猫[ねこ]\t猫咪'
                  : 'serendipity\tˌserənˈdɪpɪti\t意外发现的美好\nepiphany\tɪˈpɪfəni\t顿悟'
              }
              className="w-full text-xs font-mono p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-slate-400">
                检测到 {batchText.split('\n').filter((l) => l.trim().length > 0).length} 行内容
              </span>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-2xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-medium transition"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="button"
                  onClick={handleBatchImport}
                  disabled={!batchText.trim()}
                  className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm transition"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>立即批量导入</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

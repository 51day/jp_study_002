import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Send,
  Volume2,
  Sparkles,
  Bot,
  User,
  Coffee,
  Plane,
  Briefcase,
  GraduationCap,
  MessageCircle,
  HelpCircle,
  RefreshCw,
  Plus,
  X,
  SlidersHorizontal,
  Utensils,
  ShoppingBag,
  HeartPulse,
  Building,
  Building2,
  HardHat,
  Ruler,
  Hammer,
  Truck,
  Wrench,
  Cpu,
} from 'lucide-react';
import { Word, Language, CustomAiScenario } from '../types';
import { tts } from '../services/tts';
import { storage } from '../services/storage';
import { useI18n } from '../i18n';
import { JapaneseRubyText } from './JapaneseRubyText';
import { AiScenarioModal } from './AiScenarioModal';
import { apiClient } from '../services/apiClient';


interface Message {
  role: 'user' | 'assistant';
  content: string;
  translation?: string;
  feedback?: {
    isCorrect?: boolean;
    tip?: string;
    exampleUsage?: string;
  };
  challenge?: string;
}

interface AiChatViewProps {
  language: Language;
  currentWord: Word | null;
  allWords: Word[];
  onSelectWord: (word: Word) => void;
}

const ICON_MAP: Record<string, React.ElementType> = {
  HardHat,
  Ruler,
  Building2,
  Hammer,
  Truck,
  Wrench,
  Coffee,
  Plane,
  Briefcase,
  GraduationCap,
  MessageCircle,
  Utensils,
  ShoppingBag,
  HeartPulse,
  Building,
  Sparkles,
};

export const AiChatView: React.FC<AiChatViewProps> = ({
  language,
  currentWord,
  allWords,
  onSelectWord,
}) => {
  const { t } = useI18n();
  const [selectedScenarioId, setSelectedScenarioId] = useState(
    language === 'ja' ? 'ja_verb_conjugation' : 'cafe'
  );
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showTranslation, setShowTranslation] = useState(true);
  const [focusWord, setFocusWord] = useState<Word | null>(currentWord);
  const [showScenarioModal, setShowScenarioModal] = useState(false);
  const [customScenarios, setCustomScenarios] = useState<CustomAiScenario[]>([]);
  const [activeAiInfo, setActiveAiInfo] = useState<string>('');
  // 控制面板在手机上默认收起：把竖向空间全部留给对话
  const [showPanel, setShowPanel] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // 最近一条 AI 建议，做成输入框上方的「快捷提问」胶囊
  const lastChallenge = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && messages[i].challenge) {
        return messages[i].challenge as string;
      }
    }
    return '';
  }, [messages]);

  // Load custom scenarios & current AI model
  const refreshScenarios = () => {
    setCustomScenarios(storage.getCustomScenarios());
  };

  useEffect(() => {
    refreshScenarios();
    apiClient.getAiConfig().then((cfg) => {
      if (cfg) {
        if (cfg.activeProvider === 'deepseek') {
          setActiveAiInfo(`DeepSeek · ${cfg.deepseekModel || 'deepseek-chat'}`);
        } else if (cfg.activeProvider === 'openai') {
          setActiveAiInfo(`OpenAI · ${cfg.openaiModel || 'gpt-4o-mini'}`);
        } else if (cfg.activeProvider === 'custom') {
          setActiveAiInfo(`自定义 · ${cfg.customModel || 'OpenAI兼容'}`);
        } else {
          setActiveAiInfo(`Gemini · ${cfg.geminiModel || 'gemini-3.8-flash'}`);
        }
      }
    }).catch(() => {});
  }, []);

  const allScenarios = useMemo(() => {
    // 3 core grammar scenarios placed at the very front
    const coreGrammarScenarios = [
      {
        id: 'ja_verb_conjugation',
        title: '动词变形',
        icon: Sparkles,
        desc: '五段/一段/サ变カ变动词的ます形、て形、ない形、た形、可能形、使役形及被动态实战特训',
        isCustom: false,
        role: '你是一位极其严谨亲切的日语语法特训专家。当前场景是【日语动词变形特训】。针对用户当前学习的重点动词（若没有指定动词，则由你指定一个典型动词如「行く」「食べる」「書く」「話す」「する」「来る」等），引导或考核用户进行各种形态的变换：包括【ます形、て形、ない形、た形、可能形、使役形、被动态（受身）、假定形（ば形）、意向形（よう形）、命令形/禁止形】。当用户给出变形时，严格判断其正确性：肯定正确之处，指出任何促音变/拨音变细微错误，解析规律并给出下一个动词变形挑战。输出严格遵守 JSON 格式。',
      },
      {
        id: 'ja_adj_conjugation',
        title: '形容词变形',
        icon: Sparkles,
        desc: 'い形容词与な形容词的时态、否定、连接式、副词化与假定形实战',
        isCustom: false,
        role: '你是一位精通日语语法体系的专业导师。当前场景是【日语形容词变形特训】。带领用户系统练习一类形容词（い形容词）与二类形容词（な形容词/形容动词）的全部变形活用规则：包括【现在肯定、现在否定（〜くない / 〜ではない）、过去肯定（〜かった / 〜でした）、过去否定（〜くなかった / 〜ではありませんでした）、て形连接式（〜くて / 〜で）、副词化（〜く / 〜に）、假定形（〜ければ / 〜なら）】及特殊词「いい（良い）」的特殊变法。精准辨析判断其形态，提供生动实用的例句拓展和下一个变形挑战。输出严格遵守 JSON 格式。',
      },
      {
        id: 'ja_verb_type_quiz',
        title: '出题判断三个类型动词',
        icon: HelpCircle,
        desc: 'AI 交互出题：一类动词（五段）、二类动词（一段/以いる・える结尾）与三类动词（する・来る）及特殊五段动词辨析',
        isCustom: false,
        role: '你是一位风趣、精准且极具互动感的日语动词分类主考官。当前场景是【动词三类型判断与出题实战】。帮助用户彻底掌握动词的三大类别划分：一类动词（五段动词）、二类动词（一段动词）、三类动词（サ变动词与カ变动词）以及常见特殊五段动词陷阱（如「帰る」「走る」「入る」「切る」「知る」等）。每轮互动中：先权威点评用户的上一题回答并分析原因；随后立即主动为用户出下一道生动有趣的动词分类考题，让用户判断类型并写出ます形验证。输出严格遵守 JSON 格式。',
      },
    ];

    const builtIn = [
      { id: 'cafe', title: t('ai_chat.scenarios.cafe'), icon: Coffee, desc: t('ai_chat.scenarios.cafe_desc'), isCustom: false, role: 'A friendly barista in a cozy cafe' },
      { id: 'travel', title: t('ai_chat.scenarios.travel'), icon: Plane, desc: t('ai_chat.scenarios.travel_desc'), isCustom: false, role: 'An airport staff member or flight attendant helping travelers' },
      { id: 'business', title: t('ai_chat.scenarios.business'), icon: Briefcase, desc: t('ai_chat.scenarios.business_desc'), isCustom: false, role: 'A business colleague in an international workplace project meeting' },
      { id: 'campus', title: t('ai_chat.scenarios.campus'), icon: GraduationCap, desc: t('ai_chat.scenarios.campus_desc'), isCustom: false, role: 'A university classmate discussing coursework and campus life' },
      { id: 'casual', title: t('ai_chat.scenarios.casual'), icon: MessageCircle, desc: t('ai_chat.scenarios.casual_desc'), isCustom: false, role: 'A friendly language partner chatting about daily life and hobbies' },
    ];

    // Filter out duplicate IDs from customScenarios if already defined in coreGrammarScenarios
    const coreIds = new Set(coreGrammarScenarios.map((s) => s.id));
    const customs = customScenarios
      .filter((s) => !coreIds.has(s.id) && (s.language === 'all' || s.language === language))
      .map((s) => ({
        id: s.id,
        title: s.title,
        icon: ICON_MAP[s.icon] || Sparkles,
        desc: s.desc,
        isCustom: true,
        role: s.rolePersona,
        rawCustom: s,
      }));

    return [...coreGrammarScenarios, ...builtIn, ...customs];
  }, [t, customScenarios, language]);

  // Sync focus word if prop changes
  useEffect(() => {
    if (currentWord) {
      setFocusWord(currentWord);
    } else if (!focusWord && allWords.length > 0) {
      setFocusWord(allWords[0]);
    }
  }, [currentWord, allWords]);

  // Initial welcome message
  useEffect(() => {
    initScenario();
  }, [selectedScenarioId, focusWord, language]);

  const initScenario = () => {
    const sc = allScenarios.find((s) => s.id === selectedScenarioId) || allScenarios[0];
    const target = focusWord?.headword || (language === 'ja' ? '友達' : 'experience');

    let greeting = '';
    let translation = '';
    let challenge = '';

    if (sc?.id === 'ja_verb_conjugation') {
      greeting = language === 'ja'
        ? `こんにちは！「動詞活用・変化マスター」特訓へようこそ！\n日本語の動詞には、五段動詞（一類）、一段動詞（二類）、サ変・カ変動詞（三類）があり、て形・ない形・可能形・受身形など多彩な変化があります。\n\n今日の練習として、まずは重点単語「${target}」（または練習したい動詞）について、使い勝手抜群の【て形】と【ない形】に変形してみてください！`
        : `Welcome to Japanese Verb Conjugation Practice! Let's practice verb transformations (Te-form, Nai-form, Potential, etc.). Try transforming "${target}" into its Te-form and Nai-form!`;
      translation = `你好！欢迎来到「日语动词活用与变形特训」！日语动词分为五段（一类）、一段（二类）与サ变/カ变（三类）。针对当前词「${target}」（或你想练习的任意动词），请试着写出它的【て形】和【ない形】吧！`;
      challenge = `写出「${target}」的「て形」与「ない形」，或任意向 AI 询问变形规律。`;
    } else if (sc?.id === 'ja_adj_conjugation') {
      greeting = language === 'ja'
        ? `こんにちは！「形容詞の活用・変形マスター」へようこそ！\n日本語の形容詞には「い形容詞」と「な形容詞」があり、否定（〜くない／〜ではない）、過去（〜かった／〜でした）、副詞化（〜く／〜に）など表情豊かな変形があります。\n\n練習したい形容詞（例えば「高い」「静か」「いい」または重点単語「${target}」）の【過去形】と【否定形】を答えてみてください！`
        : `Welcome to the Japanese Adjective Conjugation Trainer! Practice I-adjectives and Na-adjectives across affirmative, negative, past, and adverbial forms. Try conjugating "${target}"!`;
      translation = `你好！欢迎来到「形容词活用与变形特训」！日语形容词分为「い形容词」与「な形容词」。请试着写出你想练习的形容词（或当前词「${target}」）的【过去式】与【否定形式】吧！`;
      challenge = `写出形容词的过去肯定或否定式（如：おいしかった、静かではない），或副词化造句。`;
    } else if (sc?.id === 'ja_verb_type_quiz') {
      greeting = language === 'ja'
        ? `ようこそ「動詞3グループ識別クイズ」へ！\n日本語の動詞は【グループ1（五段動詞）】、【グループ2（一段動詞）】、【グループ3（サ変・カ変動詞）】の3種類に分かれます。動詞分類をマスターすると、あらゆる変形が一瞬でできるようになります！\n\nそれでは第1問です！次の3つの動詞はそれぞれどのグループでしょうか？\n①「食べる」\n②「帰る」\n③「運転する」\n\n番号とグループ名を答えてみてください！（ヒント：②はよくある罠動詞です！）`
        : `Welcome to the Japanese Verb Classification Quiz! Verbs fall into Group 1 (Godan), Group 2 (Ichidan), and Group 3 (Irregular: Suru & Kuru). Question 1: Classify these three verbs: ① 食べる, ② 帰る, ③ 運転する!`;
      translation = `欢迎来到「动词三类型判断与出题特训」！日语动词分为【一类动词（五段动词）】、【二类动词（一段动词）】与【三类动词（サ变・カ变动词）】。\n\n现在请接第1题：请判断以下三个动词分别属于哪一类？\n①「食べる」\n②「帰る」\n③「運転する」\n\n请回答序号与类别！（提示：②是一个经典陷阱词哦！）`;
      challenge = `回答这三个动词所属的类型（如：①二类/一段、②一类/五段、③三类/サ变），AI 会立即为你详细解析并出下一道题！`;
    } else if (sc && 'rawCustom' in sc && sc.rawCustom) {
      const custom = sc.rawCustom as CustomAiScenario;
      const customGreeting = language === 'ja' ? custom.openingGreeting.ja : custom.openingGreeting.en;
      greeting = customGreeting || (language === 'ja'
        ? `こんにちは！「${custom.title}」へようこそ。重要単語「${target}」を使って会話してみましょう！`
        : `Welcome! Let's practice using the focus word "${target}".`);
      translation = custom.openingGreeting.translation || `欢迎来到「${custom.title}」实战场景。`;
      challenge = custom.challengePrompt || (language === 'ja' ? `「${target}」を使ってみてください` : `Try using "${target}" in your response.`);
    } else {
      greeting =
        language === 'ja'
          ? `こんにちは！ここは「${sc?.title}」のシチュエーションです。今日の重要単語「${target}」を使って、自由に話しかけてみてください！まずは私から：\n今日はどんなご用件ですか？`
          : `Hi there! Welcome to the "${sc?.title}" scenario. Let's practice using today's focus word: "${target}".\nTo start: What would you like to discuss or order today?`;

      translation =
        language === 'ja'
          ? `你好！这里是「${sc?.title}」情景。请尝试运用今日目标词「${target}」和我交流吧！请问今天有什么想了解或聊聊的吗？`
          : `你好！欢迎来到「${sc?.title}」场景。让我们试着在对话中运用重点词「${target}」吧。今天有什么想聊或咨询的呢？`;

      challenge = language === 'ja' ? `「${target}」を使ってみてください` : `Try using "${target}" in your response.`;
    }

    setMessages([
      {
        role: 'assistant',
        content: greeting,
        translation,
        challenge,
      },
    ]);
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput('');

    const newMessages: Message[] = [...messages, { role: 'user', content: userText }];
    setMessages(newMessages);
    setIsLoading(true);

    const activeScenario = allScenarios.find((s) => s.id === selectedScenarioId);

    try {
      const data = await apiClient.sendAiChat({
        messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        focusWord: focusWord,
        language,
        scenario: activeScenario?.title,
        scenarioRole: activeScenario?.role,
      });



      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: data.reply || 'Great conversation!',
          translation: data.translation,
          feedback: typeof data.feedback === 'object' ? data.feedback : { tip: data.feedback },
          challenge: data.challenge,
        },
      ]);

      storage.recordAiSession();
    } catch (err) {
      console.error('Chat error:', err);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            language === 'ja'
              ? '申し訳ありません、一時的に接続が不安定です。少し待ってからもう一度送信してください。'
              : 'Sorry, communication timed out. Please try again or check your connection.',
          translation: '抱歉，暂时未能连接到 AI 服务，请重试。',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSpeak = (text: string) => {
    tts.speak(text, language, 1.0, focusWord?.reading);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full max-w-4xl mx-auto px-3 sm:px-6 pt-3 pb-[calc(var(--tabbar-h)+env(safe-area-inset-bottom,0px)+0.75rem)] md:pb-4">
      {/* Modal for adding/editing custom scenario */}
      {showScenarioModal && (
        <AiScenarioModal
          currentLang={language}
          onClose={() => setShowScenarioModal(false)}
          onSaved={(newSc) => {
            refreshScenarios();
            setSelectedScenarioId(newSc.id);
          }}
        />
      )}

      {/* 手机顶部工具条：重点词 + 发音 + 打开设置面板 */}
      <div className="md:hidden shrink-0 flex items-center gap-2 bg-white dark:bg-slate-900 rounded-2xl px-3 py-2 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="p-2 rounded-xl bg-indigo-600 text-white shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-semibold text-slate-400 leading-none">
            {t('ai_chat.current_focus')}
          </div>
          <div className="flex items-center gap-1 mt-1">
            <span className="font-extrabold text-base text-slate-900 dark:text-white truncate">
              {language === 'ja' ? (
                <JapaneseRubyText text={focusWord?.headword || ''} reading={focusWord?.reading} />
              ) : (
                focusWord?.headword || ''
              )}
            </span>
            <button
              type="button"
              onClick={() => focusWord && tts.speak(focusWord.headword, language, 1.0, focusWord.reading)}
              aria-label="朗读重点词"
              className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 transition"
            >
              <Volume2 className="w-4 h-4" />
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowPanel((v) => !v)}
          aria-label="打开实战设置"
          aria-expanded={showPanel}
          className={`min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl border transition ${
            showPanel
              ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400'
              : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'
          }`}
        >
          {showPanel ? <X className="w-4 h-4" /> : <SlidersHorizontal className="w-4 h-4" />}
        </button>
      </div>

      {/* 主体容器：手机上下堆叠，桌面左右分栏（左控制面板 / 右聊天区） */}
      <div className="relative flex flex-col md:flex-row flex-1 min-h-0 gap-3 md:gap-4 mt-3 md:mt-0">
      {/* 控制面板：手机上是浮层抽屉（不挤压对话区），桌面常驻左侧栏 */}
      <div
        className={`${
          showPanel
            ? 'flex absolute inset-x-0 top-0 z-30 max-h-[78%] overflow-y-auto shadow-2xl'
            : 'hidden'
        } md:flex md:static md:z-auto md:max-h-none shrink-0 flex-col md:w-72 bg-white dark:bg-slate-900 rounded-3xl p-3.5 md:p-4 border border-slate-200 dark:border-slate-800 shadow-xs gap-3 md:overflow-y-auto`}
      >
        {/* 手机端抽屉标题 + 收起 */}
        <div className="md:hidden flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400">实战设置</span>
          <button
            type="button"
            onClick={() => setShowPanel(false)}
            aria-label="收起实战设置"
            className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 重点词卡（桌面端显示；手机端已在顶部工具条展示） */}
        <div className="hidden md:flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-sm shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold text-slate-400">
              {t('ai_chat.current_focus')}:
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-lg text-slate-900 dark:text-white truncate">
                {language === 'ja' ? (
                  <JapaneseRubyText text={focusWord?.headword || ''} reading={focusWord?.reading} />
                ) : (
                  focusWord?.headword || ''
                )}
              </span>
              <button
                type="button"
                onClick={() => focusWord && tts.speak(focusWord.headword, language, 1.0, focusWord.reading)}
                aria-label="朗读重点词"
                className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-indigo-600 transition"
              >
                <Volume2 className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
              {focusWord?.meanings?.[0]?.def || ''}
            </p>
          </div>
        </div>

        {/* 当前模型 */}
        {activeAiInfo && (
          <div className="flex items-center gap-1.5 text-[11px] px-2.5 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 font-semibold">
            <Cpu className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
            <span className="truncate">{activeAiInfo}</span>
          </div>
        )}

        {/* 译文开关 */}
        <div className="flex items-center justify-between gap-2 px-0.5">
          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
            {t('ai_chat.translation_toggle', {
              state: showTranslation ? t('ai_chat.on') : t('ai_chat.off'),
            })}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={showTranslation}
            onClick={() => setShowTranslation(!showTranslation)}
            className={`relative w-12 h-7 min-w-[48px] rounded-full transition shrink-0 ${
              showTranslation ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-700'
            }`}
          >
            <span
              className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${
                showTranslation ? 'left-6' : 'left-1'
              }`}
            />
          </button>
        </div>

        {/* 控制项：竖排，触控区 >= 44px（替代原先拥挤的横向胶囊） */}
        <div className="flex flex-col gap-2">
          {/* Quick Word Dropdown */}
          <select
            value={focusWord?.id || ''}
            onChange={(e) => {
              const target = allWords.find((w) => w.id === e.target.value);
              if (target) {
                setFocusWord(target);
                onSelectWord(target);
              }
            }}
            className="w-full min-h-[44px] text-base md:text-sm py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 truncate"
          >
            <option value="" disabled>
              {t('ai_chat.change_word')}
            </option>
            {allWords.slice(0, 50).map((w) => (
              <option key={w.id} value={w.id}>
                {w.headword} ({w.meanings?.[0]?.def?.slice(0, 15) || ''})
              </option>
            ))}
          </select>

          {/* Scenario Dropdown */}
          <select
            value={selectedScenarioId || ''}
            onChange={(e) => setSelectedScenarioId(e.target.value)}
            className="w-full min-h-[44px] text-base md:text-sm py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 truncate"
          >
            {allScenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}{s.isCustom ? ' (自定义)' : ''}
              </option>
            ))}
          </select>

          {/* Add custom scenario */}
          <button
            type="button"
            onClick={() => setShowScenarioModal(true)}
            className="flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-xl text-sm md:text-xs font-semibold whitespace-nowrap bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900 text-indigo-600 dark:text-indigo-400 border border-dashed border-indigo-300 dark:border-indigo-800 transition"
          >
            <Plus className="w-4 h-4" />
            <span>自定场景</span>
          </button>
        </div>
      </div>

      {/* 聊天列：消息区 + 输入区 */}
      <div className="flex-1 min-h-0 flex flex-col gap-2">
      {/* Chat Messages Log */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4 rounded-3xl bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800">
        {messages.map((m, idx) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={idx}
              className={`flex gap-3 max-w-[88%] sm:max-w-[78%] ${
                isUser ? 'ml-auto flex-row-reverse' : ''
              }`}
            >
              <div
                className={`w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 ${
                  isUser
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 border border-slate-200 dark:border-slate-700 shadow-2xs'
                }`}
              >
                {isUser ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
              </div>

              <div className="space-y-1.5">
                <div
                  className={`p-4 rounded-3xl text-sm leading-relaxed ${
                    isUser
                      ? 'bg-indigo-600 text-white rounded-tr-xs shadow-sm'
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 rounded-tl-xs border border-slate-200 dark:border-slate-700 shadow-xs'
                  }`}
                >
                  <div className="whitespace-pre-wrap">{m.content}</div>

                  {!isUser && showTranslation && m.translation && (
                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-xs text-slate-500 dark:text-slate-400">
                      {m.translation}
                    </div>
                  )}

                  {!isUser && (
                    <div className="mt-2.5 flex items-center justify-between text-xs text-slate-400">
                      <button
                        type="button"
                        onClick={() => handleSpeak(m.content)}
                        aria-label="朗读回复"
                        className="flex items-center gap-1 min-h-[44px] px-2 -mx-2 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                      >
                        <Volume2 className="w-4 h-4" />
                        <span>{t('ai_chat.speak_reply')}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* AI Feedback Banner */}
                {m.feedback && (m.feedback.tip || m.feedback.exampleUsage) && (
                  <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 text-xs text-amber-800 dark:text-amber-200 space-y-1">
                    {m.feedback.tip && (
                      <div className="flex items-start gap-1.5 font-medium">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>{m.feedback.tip}</span>
                      </div>
                    )}
                    {m.feedback.exampleUsage && (
                      <div className="text-[11px] text-amber-700 dark:text-amber-300 pl-5">
                        {m.feedback.exampleUsage}
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          );
        })}

        {isLoading && (
          <div className="flex gap-3 max-w-[80%]">
            <div className="w-8 h-8 rounded-2xl bg-white dark:bg-slate-800 text-indigo-600 flex items-center justify-center border border-slate-200 dark:border-slate-700">
              <Bot className="w-4 h-4 animate-spin" />
            </div>
            <div className="p-4 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-400 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>{t('ai_chat.ai_thinking')}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* 快捷提问 + 输入区：常驻聊天列底部，永不被长内容挤出屏幕 */}
      <div className="shrink-0 space-y-2">
        {lastChallenge && (
          <button
            type="button"
            onClick={() => {
              setInput(lastChallenge);
              inputRef.current?.focus();
            }}
            className="w-full flex items-start gap-1.5 text-left px-3 py-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-100 dark:border-indigo-900/60 text-xs text-indigo-700 dark:text-indigo-300 transition active:scale-[0.99]"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
            <span className="line-clamp-2">
              {t('ai_chat.suggest_try')}：{lastChallenge}
            </span>
          </button>
        )}

        <div className="bg-white dark:bg-slate-900 rounded-2xl p-1.5 pl-3 pr-1.5 border-2 border-indigo-200 dark:border-indigo-800/70 shadow-md flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSend();
            }}
            placeholder={
              language === 'ja'
                ? t('ai_chat.input_placeholder_ja', { word: focusWord?.headword || '単語' })
                : t('ai_chat.input_placeholder_en', { word: focusWord?.headword || 'word' })
            }
            className="flex-1 min-w-0 min-h-[46px] px-1 text-base md:text-sm bg-transparent text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="min-h-[48px] min-w-[48px] inline-flex items-center justify-center rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white transition shadow-sm active:scale-95"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
      </div>
      </div>
    </div>
  );
};

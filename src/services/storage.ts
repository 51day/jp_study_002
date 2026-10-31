import {
  Word,
  WordProgress,
  StudyLog,
  UserSettings,
  Achievement,
  Language,
  CustomAiScenario,
  LocalSnapshot,
  WebDavConfig,
  LearningSyncPayload,
  CloudSyncStatus,
} from '../types';
import {
  ClientSyncController,
  CLOUD_SYNC_LOG_LIMIT,
  LOCAL_SYNC_LOG_LIMIT,
  mergeLearningPayload,
} from './syncEngine';
import { apiClient } from './apiClient';

const SETTINGS_KEY = 'memorize_word_settings';
const PROGRESS_KEY = 'memorize_word_progress';
const LOGS_KEY = 'memorize_word_logs';
const CUSTOM_WORDS_KEY = 'memorize_word_custom_words';
const ACHIEVEMENTS_KEY = 'memorize_word_achievements';
const SNAPSHOTS_KEY = 'memorize_word_snapshots';
const CUSTOM_SCENARIOS_KEY = 'memorize_word_custom_scenarios';
const WEBDAV_KEY = 'memorize_word_webdav_config';
// 已删除场景的墓碑记录（跨设备删除同步）：{ id, deletedAt }
const DELETED_SCENARIOS_KEY = 'memorize_word_deleted_scenarios';

/**
 * 推断一个自定义词属于哪种学习目标语言。
 * 历史上 Word 没有 language 字段，生词本里日语词和英语词是混在一起的，
 * 这里用「是否含假名/汉字」做兜底判断，用于旧数据归一化。
 */
export const inferWordLanguage = (
  word: Pick<Word, 'headword' | 'reading' | 'phonetic'>
): Language => {
  const text = `${word.headword || ''}${word.reading || ''}`;
  // 假名（平假名/片假名/片假名语音扩展/半角片假名）——最可靠信号
  if (/[\u3040-\u30ff\u31f0-\u31ff\uff66-\uff9f]/.test(text)) return 'ja';
  // 汉字
  if (/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(text)) return 'ja';
  return 'en';
};

export const DEFAULT_WEBDAV_CONFIG: WebDavConfig = {
  enabled: false,
  serverUrl: 'https://app.koofr.net/dav/Koofr/',
  username: '',
  password: '',
  remotePath: '/MemorizeWord/memorize_word_backup.json',
  autoSync: false,
  useServerPreset: true,
  lastSyncAt: null,
  lastSyncStatus: 'idle',
};


export const DEFAULT_SETTINGS: UserSettings = {
  uiLanguage: 'zh-CN',
  learningLang: 'ja',
  selectedDeckId: 'ja-jlpt-n5',
  dailyNewWords: 20,
  dailyReviewLimit: 50,
  includeCustomWords: true,
  autoSpeak: true,

  speechRate: 1.0,
  audioSource: 'online_first',
  enAccent: 'us',
  reminderTime: '20:00',
  onboardingCompleted: false,
  assessedLevel: null,
};

export const INITIAL_ACHIEVEMENTS: Achievement[] = [
  {
    id: 'first_step',
    title: '初试锋芒',
    description: '完成第一次单词学习会话',
    icon: 'Sparkles',
    unlockedAt: null,
    progress: 0,
    maxProgress: 1,
  },
  {
    id: 'streak_3',
    title: '持之以恒',
    description: '连续学习打卡 3 天',
    icon: 'Flame',
    unlockedAt: null,
    progress: 0,
    maxProgress: 3,
  },
  {
    id: 'streak_7',
    title: '七日之约',
    description: '连续学习打卡 7 天',
    icon: 'Zap',
    unlockedAt: null,
    progress: 0,
    maxProgress: 7,
  },
  {
    id: 'word_50',
    title: '五十连破',
    description: '累计学习并掌握 50 个单词',
    icon: 'BookmarkCheck',
    unlockedAt: null,
    progress: 0,
    maxProgress: 50,
  },
  {
    id: 'word_200',
    title: '二百词斩',
    description: '累计学习并掌握 200 个单词',
    icon: 'Trophy',
    unlockedAt: null,
    progress: 0,
    maxProgress: 200,
  },
  {
    id: 'ai_explorer',
    title: 'AI 语境大师',
    description: '完成 3 次 AI 场景多轮口语造句实战',
    icon: 'Bot',
    unlockedAt: null,
    progress: 0,
    maxProgress: 3,
  },
  {
    id: 'dictation_pro',
    title: '听音辨词',
    description: '在听写模式中全对累计 20 次',
    icon: 'Headphones',
    unlockedAt: null,
    progress: 0,
    maxProgress: 20,
  },
];

export const DEFAULT_PRESET_SCENARIOS: CustomAiScenario[] = [
  // 核心语法变形与分类特训 (Core Grammar & Conjugation)
  {
    id: 'ja_verb_conjugation',
    title: '动词变形',
    icon: 'Sparkles',
    desc: '五段/一段/サ变カ变动词的ます形、て形、ない形、た形、可能形、使役形及被动态实战特训',
    language: 'ja',
    rolePersona: '你是一位极其严谨亲切的日语语法特训专家。当前场景是【日语动词变形特训】。你的任务是针对用户当前学习的重点动词（若没有指定动词，则由你指定一个典型动词，如「行く」「食べる」「書く」「話す」「する」「来る」等），考察或引导用户进行各种形态的变换：例如【ます形、て形、ない形、た形、可能形、使役形、被动态（受身）、假定形（ば形）、意向形（よう形）、命令形/禁止形】。当用户给出变形时，请严格判断其正确性：若完全正确，给予热情肯定并解释该形态的经典接续和日常实用例句；若有细微错误（如促音变、拨音变、う段改い段/あ段规律混淆），请极其清晰、条理分明地指出错误点，列出记忆口诀或分类规则，并给出一个新的变形挑战。输出请严格符合系统 JSON 结构。',
    openingGreeting: {
      ja: 'こんにちは！「動詞活用・変化マスター」特訓へようこそ！日本語の動詞には、五段動詞（一類）、一段動詞（二類）、サ変・カ変動詞（三類）があり、て形・ない形・可能形・受身形など多彩な変化があります。今日の練習として、まずは使い勝手抜群の【て形】と【ない形】に変形してみてください！',
      en: 'Welcome to the Japanese Verb Conjugation Master! Let us practice transforming verbs into Te-form, Nai-form, Potential, Passive, and more. Try transforming the target word into its Te-form and Nai-form!',
      translation: '你好！欢迎来到「日语动词活用与变形特训」！日语动词分为五段（一类）、一段（二类）与サ变/カ变（三类），掌握变形是流利表达的核心。针对当前词汇或你想练习的动词，请先试着写出它的【て形】和【ない形】吧！',
    },
    challengePrompt: '写出目标动词的「て形」与「ない形」，或询问 AI 其他活用形式的变换规律。',
    isCustom: false,
    createdAt: 1700000000000,
  },
  {
    id: 'ja_adj_conjugation',
    title: '形容词变形',
    icon: 'Sparkles',
    desc: 'い形容词（去い加く/かった/くない）与な形容词（加な/に/で/でした）的时态、否定、连接式、副词化与假定形',
    language: 'ja',
    rolePersona: '你是一位精通日语语法体系的专业导师。当前场景是【日语形容词变形特训】。你的任务是带领用户系统练习一类形容词（い形容词）与二类形容词（な形容词/形容动词）的全部变形活用规则：包括【现在肯定、现在否定（〜くない / 〜ではない）、过去肯定（〜かった / 〜でした）、过去否定（〜くなかった / 〜ではありませんでした）、て形连接式（〜くて / 〜で）、副词化（〜く / 〜に）、假定形（〜ければ / 〜なら）】。注意特殊词「いい（良い）」的特殊变法（よくない、よかった等）。当用户回答时，精准辨析判断其词性分类与形态是否正确，提供地道的例句拓展和下一个变形挑战。输出请严格符合系统 JSON 结构。',
    openingGreeting: {
      ja: 'こんにちは！「形容詞の活用・変形マスター」へようこそ！日本語の形容詞には「い形容詞」と「な形容詞」があり、否定（〜くない／〜ではない）、過去（〜かった／〜でした）、副詞化（〜く／〜に）など表情豊かな変形があります。練習したい形容詞（例えば「高い」「静か」「いい」など）の【過去形】と【否定形】を答えてみてください！',
      en: 'Welcome to the Japanese Adjective Conjugation Trainer! Practice I-adjectives and Na-adjectives across affirmative, negative, past, te-form, and adverbial forms. Try conjugating your adjective into past and negative forms!',
      translation: '你好！欢迎来到「形容词活用与变形特训」！日语形容词分为「い形容词」与「な形容词」，有着否定、过去、连接式与副词化等丰富变形。请试着写出你想要练习的形容词（或当前词）的【过去式】与【否定形式】吧！',
    },
    challengePrompt: '写出形容词的过去肯定或否定式（如：おいしかった、静かではない），或练习副词化造句。',
    isCustom: false,
    createdAt: 1700000000001,
  },
  {
    id: 'ja_verb_type_quiz',
    title: '出题判断三个类型动词',
    icon: 'HelpCircle',
    desc: 'AI 交互出题：一类动词（五段）、二类动词（一段/以いる・える结尾）与三类动词（する・来る）及特殊五段动词辨析',
    language: 'ja',
    rolePersona: '你是一位风趣、精准且极具互动感的日语动词分类主考官。当前场景是【动词三类型判断与出题实战】。你的核心教学目标是帮助用户彻底掌握动词的分类识别法则：\n1. 一类动词（五段动词）：词尾不是「る」，或词尾是「る」但倒数第二个假名不是「い/え段」（如「飲む」「行く」「話す」「わかる」「取る」），以及特殊五段动词（外观像一段但其实是五段，如「帰る」「走る」「入る」「切る」「知る」等）；\n2. 二类动词（一段动词）：词尾必为「る」，且倒数第二个假名在「い段」或「え段」（上一段/下一段，如「食べる」「見る」「起きる」「教える」）；\n3. 三类动词（不规则动词）：只有两个：「する」（サ变动词及「勉強する」等复合词）与「来る」（カ变动词）。\n在每轮互动中：先评判正误，解释该动词属于哪一类及其原因（特别是注意拆解特殊五段动词陷阱）；随后，立即主动为用户出下一道有趣的动词分类判断题（可以随机给出一个常见或易错的高频动词，让用户判断是属于一类/五段、二类/一段还是三类，并请用户顺带写出它的ます形验证）。输出请严格符合系统 JSON 结构。',
    openingGreeting: {
      ja: 'ようこそ「動詞3グループ識別クイズ」へ！日本語の動詞は【グループ1（五段動詞）】、【グループ2（一段動詞）】、【グループ3（サ変・カ変動詞）】の3種類に分かれます。動詞分類をマスターすると、あらゆる変形が一瞬でできるようになります！\n\nそれでは第1問です！次の3つの動詞はそれぞれどのグループでしょうか？\n①「食べる」\n②「帰る」\n③「運転する」\n\n番号とグループ名を答えてみてください！（ヒント：②はよくある罠動词です！）',
      en: 'Welcome to the Japanese Verb Classification Quiz! Japanese verbs fall into Group 1 (Godan), Group 2 (Ichidan), and Group 3 (Irregular: Suru & Kuru). Question 1: Classify these three verbs: ① 食べる, ② 帰る, ③ 運転する!',
      translation: '欢迎来到「动词三类型判断与出题特训」！日语动词分为【一类动词（五段动词）】、【二类动词（一段动词）】与【三类动词（サ变・カ变动词）】。掌握分类是搞定所有动词变形的关键！\n\n现在请接第1题：请判断以下三个动词分别属于哪一类？\n①「食べる」\n②「帰る」\n③「運転する」\n\n请回答序号与类别！（提示：②是一个经典陷阱词哦！）',
    },
    challengePrompt: '回答这三个动词所属的类型（如：①二类/一段、②一类/五段、③三类/サ变），AI 会立即为你详细解析并出下一道题！',
    isCustom: false,
    createdAt: 1700000000002,
  },
  // 建筑与工程实战场景 (Construction & Architecture)
  {
    id: 'arch_ja_ky',
    title: '建筑工地朝礼与KY安全活动',
    icon: 'HardHat',
    desc: '日本总包建筑工地晨会：安全帽与双钩安全带检查、指差し呼称及KY危险预知',
    language: 'ja',
    rolePersona: '你是一位日本大型综合建筑承包商（ゼネコン）的资深现场施工主任（主任技術者/職長）。你每天早上主持作业人员的安全朝礼（朝礼）并组织KY活动（危険予知活動）。你要求大家检查个人防护用具（ヘルメットのあご紐、フルハーネス安全帯、安全靴），执行指差し呼称「安全第一、ヨシ！」，并针对高空脚手架作业（足場作業）或起重机吊装作业（玉掛け・揚重）排查潜在危险点。你的语气严谨专业且充满关怀。',
    openingGreeting: {
      ja: '皆さん、おはようございます！本日も一日、ご安全に！朝礼を始めます。まず保護具の確認です。ヘルメットのあご紐よし！フルハーネス安全帯よし！本日は4階の足場解体とクレーン揚重作業が予定されています。作業中の転落や落下物事故を防ぐための危険予知（KY）ポイントを1点挙げてください！',
      en: 'Good morning everyone! Safety first! Let us begin the morning briefing. Check your PPE: hard hat straps and full-body harness secured! Today we have scaffolding dismantling on Level 4 and crane hoisting. Please identify one hazard prediction (KY) point for today.',
      translation: '大家早上好！今天一天也请注意安全！现在开始朝礼。首先确认个人防护用具：安全帽下颚带OK！全身双钩安全带OK！今天计划进行4层脚手架拆除和吊车吊运作业。请大家举出一个防范高空坠落或落物事故的KY（危险预知）要点！',
    },
    challengePrompt: '尝试用日语指出脚手架安全带挂扣（安全帯フック）、隔离区警示（立入禁止区域）或手指口述（指差し呼称）。',
    isCustom: false,
    createdAt: 1700000000000,
  },
  {
    id: 'arch_ja_blueprint',
    title: '建筑图纸与节点收口对接',
    icon: 'Ruler',
    desc: '与日本一级建筑士对接意匠图/结构图、梁柱净高、墨线放线与机电管线避让',
    language: 'ja',
    rolePersona: '你是一位资深日本一级建筑士兼项目设计监理。你正在工地事务所与施工员/现场总监核对建筑施工图（意匠図・構造図）与现场放线（墨出し）。你需要核对梁柱净高、楼板配筋保护层、门窗塞缝细部收口（納まり）以及机电管线预埋开洞（スリーブ孔）的干涉避让。用词严密专业，经常使用日本建筑工程术语。',
    openingGreeting: {
      ja: 'お疲れ様です！3階の基準階スラブと柱梁接合部の納まり図面をチェックしています。構造図の配筋ピッチと、設備図のエアコン配管用スリーブの位置が一部干渉している懸念があります。現場の墨出し状況を確認したいのですが、梁の主筋との離隔はどのくらい確保できそうですか？',
      en: 'Good work! I am reviewing the structural rebar and detail drawings for the Level 3 floor slab and beam connections. There seems to be a clash between rebar pitch and the MEP sleeve penetrations. Could you check the site layout markings?',
      translation: '辛苦了！我正在核对3层标准层楼板与梁柱节点细部施工图。目前有些担心结构图中的钢筋间距与机电暖通空调套管开洞位置存在干涉。想确认一下现场放线情况，目前管线与梁主筋能确保多少净距？',
    },
    challengePrompt: '用日语讨论尺寸公差（クリアランス）、套管（スリーブ）或按图纸修改（図面修正）。',
    isCustom: false,
    createdAt: 1700000000001,
  },
  {
    id: 'arch_ja_concrete',
    title: '商品混凝土打设立会与验收',
    icon: 'Truck',
    desc: '搅拌车到场配合比核查、坍落度筒试验、含气量检测与浇筑防冷缝监督',
    language: 'ja',
    rolePersona: '你是一位日本施工现场的质量安全管理工程师（品質管理担当）。正在进行商品混凝土（生コンクリート）进场抽样检验与大体积浇筑立会（打設立会）。你严格核对搅拌车纳品书的标号（呼び強度24、スランプ18cm、水セメント比）、坍落度筒试验、空气量测试（空気量4.5%±1.5%）与盐化物含量，并监督振捣棒（バイブレーター）作业防止蜂窝麻面与冷缝。',
    openingGreeting: {
      ja: '生コンクリートのミキサー車が現場に到着しました！納品書の配合報告書を確認します。呼び強度24、スランプ18、粗骨材最大寸法20mmで相違ありませんね。これから受入検査のスランプコーン試験と空気量測定を行います。試験器のキャリブレーションとスランプ測定の準備は整っていますか？',
      en: 'The ready-mix concrete truck has arrived on site! Checking delivery ticket: design strength 24, slump 18cm, max aggregate size 20mm. Let us begin the slump cone and air content tests. Are the testing instruments calibrated and ready?',
      translation: '商品混凝土搅拌车已经进场！我们来核实供货单配合比：设计标号24、坍落度18、粗骨料最大粒径20mm无误。接下来进行坍落度筒抽样和含气量检测。试验仪器的校准和测量工具准备就绪了吗？',
    },
    challengePrompt: '回答坍落度（スランプ値）、水灰比（水セメント比）或开始打设（打設開始）。',
    isCustom: false,
    createdAt: 1700000000002,
  },
  {
    id: 'arch_en_safety',
    title: 'Site Safety Toolbox Talk & Briefing',
    icon: 'HardHat',
    desc: 'International site safety officer briefing subcontractors on 100% tie-off PPE, cranes & OSHA rules',
    language: 'en',
    rolePersona: 'You are a certified Site Safety and Health Officer (SSHO) on a major commercial high-rise construction project. You run the morning Toolbox Talk with trade contractors, enforce OSHA and ISO 45001 safety guidelines, inspect mandatory 5-point PPE (hard hat, high-vis vest, steel-toe boots, safety glasses, gloves), check 100% tie-off fall protection for leading edge work, and manage crane drop zones.',
    openingGreeting: {
      en: "Good morning, team! Let's kick off our morning Toolbox Talk. Today we have critical operations: mobile crane picks for precast columns on Grid Line C, and formwork stripping on Level 5. Before anyone steps onto the active deck, let's verify PPE compliance and ensure all perimeter guardrails and drop-zone exclusion barriers are secure. Who can highlight the main hazard for today's crane pick?",
      ja: 'おはようございます！朝のツールボックストーク（安全ミーティング）を始めます。本日はC通りでのプレキャスト柱のクレーン揚重と、5階の型枠脱型作業があります。全員のPPE装着と落下防止区画のバリケードを確認しましょう。',
      translation: '大家早上好！现在开始今天早上的班前安全讲评（Toolbox Talk）。今天有重点高危作业：C轴预制立柱汽车吊起重吊装，以及5层模板拆除。在任何人踏上作业面之前，我们先检查PPE劳保防护合规，并确保隔离防护栏和落物禁区全部设置完毕。谁能指出今天起重吊装作业的首要危险源？',
    },
    challengePrompt: 'Mention fall arrest systems, crane swing radius, or high-vis PPE.',
    isCustom: false,
    createdAt: 1700000000003,
  },
  {
    id: 'arch_en_bim',
    title: 'Architectural Design Review & BIM Coordination',
    icon: 'Building2',
    desc: 'Weekly BIM clash detection resolution meeting between architects, structural steel & MEP engineers',
    language: 'en',
    rolePersona: 'You are a Principal Architectural Project Manager and Lead BIM Coordinator hosting an interdisciplinary coordination workshop between the structural engineer, mechanical/electrical/plumbing (MEP) engineers, and the general contractor. You navigate Navisworks / Revit 3D clash reports, verify ceiling soffit heights, fire barrier wall ratings, and code compliance (ADA / IBC).',
    openingGreeting: {
      en: "Welcome to this week's BIM Coordination and Design Review session. Looking at our latest Navisworks clash report for Level 3, we have a hard collision between the 24-inch chilled water HVAC supply duct and the W-flange structural transfer beam. What are our engineering options to either reroute through an engineered web penetration or lower the architectural ceiling soffit without violating clear head height?",
      ja: '今週のBIM協調設計レビュー会議へようこそ。3階のNavisworks干渉チェック結果では、冷水配管ダクトと構造鉄骨梁が干渉しています。梁のウェブ開口補強による貫通か、天井高を下げる案を検討しましょう。',
      translation: '欢迎参加本周的 BIM 协同与建筑方案评审会。根据地下机房最新的碰撞检查报告，24英寸冷冻水供水主管与结构钢转换梁发生了硬碰撞。大家有什么工程解决方案？是通过梁腹板补强开洞走管，还是在不牺牲净空高度的前提下下调吊顶？',
    },
    challengePrompt: 'Discuss pipe rerouting, structural web penetrations, or ceiling clearance.',
    isCustom: false,
    createdAt: 1700000000004,
  },
  {
    id: 'arch_en_civil',
    title: 'Civil & Foundation Inspection',
    icon: 'Hammer',
    desc: 'Deep foundation inspection: bored piles, rebar cage ultrasonic testing, slurry density & concrete tremie pour',
    language: 'en',
    rolePersona: 'You are a Senior Civil & Geotechnical Resident Engineer conducting deep foundation and substructure inspections. You inspect bored pile rebar cages, concrete tremie pours, soil compaction Proctor tests, and dewatering pumps, ensuring strict compliance with engineering drawings.',
    openingGreeting: {
      en: "Good afternoon. We are standing at Pier Cap 4 for the deep foundation inspection. The drilling rig completed boring to bedrock at 28 meters. We need to verify the ultrasonic test results for the bored pile, inspect the rebar cage splice welds, and ensure the slurry density meets specification before tremie pipe concrete pouring. How do the rebar clearances and centralizers look?",
      ja: 'お疲れ様です。第4橋脚の深礎基礎検査を行います。掘削機による支持層への削孔が深度28mで完了しました。超音波測定結果の確認、鉄筋かごの溶接継手検査、トレミー管によるコンクリート打設前の泥水比重測定を行います。',
      translation: '下午好。我们正在4号承台进行深基础检验。旋挖钻机已完成入岩钻孔至地下28米。在导管法水下浇筑混凝土前，我们需要核对桩基超声波检测报告、检查钢筋笼搭接焊接头，并确认泥浆比重合规。钢筋保护层垫块与对中定位看起来如何？',
    },
    challengePrompt: 'Report on rebar cover, slurry density, or pile verticality alignment.',
    isCustom: false,
    createdAt: 1700000000005,
  },
  // 日常与职场经典模板
  {
    id: 'life_ja_izakaya',
    title: '居酒屋地道点餐',
    icon: 'Utensils',
    desc: '在东京新宿暖帘居酒屋，体验地道日料点餐、店长推荐特色菜与日常寒暄',
    language: 'ja',
    rolePersona: '你是一位热情豪爽的东京传统居酒屋店长兼主厨。你会主动向客人推荐今日特选刺身（本日のおすすめ）、日本地酒与特色烧鸟串。言语自然、带有一点亲切的下町风情，鼓励客人用自然口语互动。',
    openingGreeting: {
      ja: 'いらっしゃい！毎度どうも！お一人様ですか？カウンターの奥どうぞ！まずは生ビールでよろしいですか？',
      en: 'Welcome! Welcome back! A table for one? Please take a seat at the back of the counter! Would you like a draft beer to start with?',
      translation: '欢迎光临！欢迎常来！一位吗？请往吧台里面坐！先来杯生啤酒可以吗？',
    },
    challengePrompt: '尝试用日语点一份自己喜欢的下酒菜或向店长询问今日推荐。',
    isCustom: false,
    createdAt: 1700000000006,
  },
  {
    id: 'career_en_interview',
    title: '外企技术外教模拟面试',
    icon: 'Briefcase',
    desc: '全英文技术架构与行为面试模拟，提升技术沟通与表达自信',
    language: 'en',
    rolePersona: 'You are a senior tech lead and engineering interviewer at an international top-tier software company. You are conducting a friendly but thorough behavioral and technical interview. You ask structured follow-up questions and assess fluency and technical clarity.',
    openingGreeting: {
      en: 'Hello! Thank you for joining today. Could you briefly introduce yourself and share a recent engineering challenge you solved?',
      ja: 'こんにちは！本日は面接にお越しいただきありがとうございます。簡単に自己紹介と、最近解決した技術的課題についてお話しいただけますか？',
      translation: '你好！感谢今天参加面试。请先做个简短自我介绍，并分享一个你近期攻克的工程技术挑战好吗？',
    },
    challengePrompt: 'Introduce your background and mention key technical skills.',
    isCustom: false,
    createdAt: 1700000000007,
  },
  {
    id: 'life_ja_akiba',
    title: '秋叶原中古手办淘物',
    icon: 'ShoppingBag',
    desc: '在秋叶原动漫店寻找绝版模型，向店员询问成色、配件与免税事宜',
    language: 'ja',
    rolePersona: '你是一位资深的秋叶原动漫手办专卖店店员，对各类手办限定版、盒况等级（未開封、箱イタミ）和免税流程了如指掌。你非常友善，乐于为顾客寻找稀有商品。',
    openingGreeting: {
      ja: 'こんにちは！ショーケースの中の商品をご覧になりたい時は、いつでもお声がけくださいね。何かお探しの作品はございますか？',
      en: 'Hello! Feel free to call me anytime if you would like to inspect the figures inside the showcase. Are you looking for any specific franchise or character?',
      translation: '你好！如果想看玻璃展柜里的手办，请随时叫我哦。今天有在找什么特定作品吗？',
    },
    challengePrompt: '向店员询问某款手办是否还有全新未拆封库存。',
    isCustom: false,
    createdAt: 1700000000008,
  },
  {
    id: 'life_en_clinic',
    title: '海外就医与症状描述',
    icon: 'HeartPulse',
    desc: '在海外诊所向全科医生清晰描述病情、持续时间与用药咨询',
    language: 'en',
    rolePersona: 'You are a compassionate general practitioner (family doctor) at an international health clinic. You listen carefully to the patient’s symptoms, ask about duration and severity, and provide clear medical explanations and advice.',
    openingGreeting: {
      en: 'Good morning, please have a seat. What brings you in today, and how long have you been feeling unwell?',
      ja: 'おはようございます、どうぞお掛けください。本日はどのような症状でお越しでしょうか？いつ頃から体調を崩されていますか？',
      translation: '早上好，请坐。今天感觉哪里不适？这种情况持续多久了？',
    },
    challengePrompt: 'Describe your symptoms clearly (e.g. fever, headache, duration).',
    isCustom: false,
    createdAt: 1700000000009,
  },
];

class StorageService {
  // 前端低频批次同步控制器：保护 Neon 免费 Compute Hours
  private syncController: ClientSyncController = new ClientSyncController({
    batchThreshold: 10,
    debounceMs: 20000,
    pullIntervalMs: 120000,
    onFlush: async (forceOverwrite?: boolean) => {
      const payload = this.getSyncPayload();
      await apiClient.pushCloudSyncState(payload, !!forceOverwrite);
    },
    onPull: async () => {
      await this.doCloudPull();
    },
  });

  // Settings
  public getSettings(): UserSettings {
    try {
      const data = localStorage.getItem(SETTINGS_KEY);
      if (data) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
      }
    } catch (e) {
      console.warn('Failed to read settings from storage', e);
    }
    return DEFAULT_SETTINGS;
  }

  public saveSettings(settings: Partial<UserSettings>): UserSettings {
    const current = this.getSettings();
    const updated: UserSettings = { ...current, ...settings, updatedAt: Date.now() };
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save settings', e);
    }
    this.markDirty(2);
    return updated;
  }

  // Word Progress Map (Key: wordId)
  public getProgressMap(): Record<string, WordProgress> {
    try {
      const data = localStorage.getItem(PROGRESS_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to read progress from storage', e);
    }
    return {};
  }

  public saveProgress(progress: WordProgress): void {
    const map = this.getProgressMap();
    map[progress.wordId] = progress;
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
    } catch (e) {
      console.error('Failed to save progress', e);
    }
    this.markDirty(1);
  }

  public saveBatchProgress(progressList: WordProgress[]): void {
    const map = this.getProgressMap();
    for (const p of progressList) {
      map[p.wordId] = p;
    }
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
    } catch (e) {
      console.error('Failed to save progress batch', e);
    }
    this.markDirty(1);
  }

  public toggleFavorite(wordId: string, language: Language = 'en'): boolean {
    const map = this.getProgressMap();
    const existing = map[wordId];
    if (existing) {
      existing.isFavorite = !existing.isFavorite;
      existing.updatedAt = Date.now();
      map[wordId] = existing;
    } else {
      map[wordId] = {
        id: crypto.randomUUID ? crypto.randomUUID() : `fav_${Date.now()}`,
        wordId,
        language,
        state: 0,
        due: Date.now(),
        stability: 1.0,
        difficulty: 5.0,
        step: 0,
        elapsedDays: 0,
        scheduledDays: 0,
        reps: 0,
        lapses: 0,
        lastReviewAt: null,
        updatedAt: Date.now(),
        isFavorite: true,
      };
    }
    try {
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
      return !!map[wordId].isFavorite;
    } catch (e) {
      console.error('Failed to toggle favorite', e);
      return false;
    }
  }

  public updateWordNotes(wordId: string, notes: string): void {
    const map = this.getProgressMap();
    if (map[wordId]) {
      map[wordId].userNotes = notes;
      map[wordId].updatedAt = Date.now();
      localStorage.setItem(PROGRESS_KEY, JSON.stringify(map));
    }
    this.markDirty(1);
  }

  // Study Logs
  public getStudyLogs(): StudyLog[] {
    try {
      const data = localStorage.getItem(LOGS_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to read study logs', e);
    }
    return [];
  }

  public addStudyLog(log: StudyLog): void {
    const logs = this.getStudyLogs();
    logs.push(log);
    // Keep last 10,000 logs
    if (logs.length > 10000) {
      logs.splice(0, logs.length - 10000);
    }
    try {
      localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
    } catch (e) {
      console.error('Failed to save study log', e);
    }
    this.markDirty(1);
    this.checkAchievements();
  }

  // Custom Words
  public getCustomWords(lang?: Language): Word[] {
    try {
      const data = localStorage.getItem(CUSTOM_WORDS_KEY);
      if (data) {
        const parsed: Word[] = JSON.parse(data);
        // 兼容历史数据：没有 language 字段的词按假名/汉字推断
        const normalized = parsed.map((w) =>
          w.language ? w : { ...w, language: inferWordLanguage(w) }
        );
        if (!lang) return normalized;
        return normalized.filter((w) => w.language === lang);
      }
    } catch (e) {
      console.warn('Failed to read custom words', e);
    }
    return [];
  }

  /**
   * 一次性把历史自定义词补上 language 字段并落盘。
   * 必须在首次云端同步之前调用，否则推上云的数据里仍是缺失 language 的旧词，
   * 其他设备拉下来依旧无法区分日语/英语，生词本还是混在一起。
   */
  public ensureCustomWordsLanguage(): void {
    try {
      const data = localStorage.getItem(CUSTOM_WORDS_KEY);
      if (!data) return;
      const parsed: Word[] = JSON.parse(data);
      let changed = false;
      const fixed = parsed.map((w) => {
        if (w.language) return w;
        changed = true;
        return { ...w, language: inferWordLanguage(w) };
      });
      if (changed) {
        localStorage.setItem(CUSTOM_WORDS_KEY, JSON.stringify(fixed));
        this.markDirty(3);
      }
    } catch (e) {
      console.warn('Failed to normalize custom words language', e);
    }
  }

  public addCustomWord(word: Word): void {
    const words = this.getCustomWords();
    const enriched: Word = { ...word, updatedAt: Date.now(), deletedAt: null };
    words.unshift(enriched);
    try {
      localStorage.setItem(CUSTOM_WORDS_KEY, JSON.stringify(words));
    } catch (e) {
      console.error('Failed to save custom word', e);
    }
    this.markDirty(5);
  }

  // Achievements
  public getAchievements(): Achievement[] {
    try {
      const data = localStorage.getItem(ACHIEVEMENTS_KEY);
      if (data) {
        const stored: Achievement[] = JSON.parse(data);
        // Merge with initial in case new achievements were added
        return INITIAL_ACHIEVEMENTS.map(initial => {
          const found = stored.find(s => s.id === initial.id);
          return found || initial;
        });
      }
    } catch (e) {
      console.warn('Failed to read achievements', e);
    }
    return INITIAL_ACHIEVEMENTS;
  }

  public checkAchievements(): Achievement[] {
    const achievements = this.getAchievements();
    const logs = this.getStudyLogs();
    const progressMap = this.getProgressMap();
    const streak = this.getStreakDays();

    const totalWordsMastered = Object.values(progressMap).filter(p => p.state === 1 && p.stability > 7).length;
    const aiSessions = logs.filter(l => l.mode === 'placement').length; // or custom AI tracker
    const dictationCorrect = logs.filter(l => l.mode === 'dictation' && l.correct).length;

    let changed = false;
    const now = Date.now();

    for (const ach of achievements) {
      if (ach.unlockedAt) continue;

      if (ach.id === 'first_step') {
        ach.progress = logs.length > 0 ? 1 : 0;
        if (logs.length > 0) {
          ach.unlockedAt = now;
          changed = true;
        }
      } else if (ach.id === 'streak_3') {
        ach.progress = Math.min(3, streak);
        if (streak >= 3) {
          ach.unlockedAt = now;
          changed = true;
        }
      } else if (ach.id === 'streak_7') {
        ach.progress = Math.min(7, streak);
        if (streak >= 7) {
          ach.unlockedAt = now;
          changed = true;
        }
      } else if (ach.id === 'word_50') {
        ach.progress = Math.min(50, totalWordsMastered);
        if (totalWordsMastered >= 50) {
          ach.unlockedAt = now;
          changed = true;
        }
      } else if (ach.id === 'word_200') {
        ach.progress = Math.min(200, totalWordsMastered);
        if (totalWordsMastered >= 200) {
          ach.unlockedAt = now;
          changed = true;
        }
      } else if (ach.id === 'dictation_pro') {
        ach.progress = Math.min(20, dictationCorrect);
        if (dictationCorrect >= 20) {
          ach.unlockedAt = now;
          changed = true;
        }
      }
    }

    if (changed) {
      try {
        localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(achievements));
      } catch (e) {
        console.error('Failed to save achievements', e);
      }
    }

    return achievements;
  }

  public recordAiSession(): void {
    const achievements = this.getAchievements();
    const target = achievements.find(a => a.id === 'ai_explorer');
    if (target && !target.unlockedAt) {
      target.progress = (target.progress || 0) + 1;
      if (target.progress >= target.maxProgress) {
        target.unlockedAt = Date.now();
      }
      localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(achievements));
    }
  }

  // Analytics Helpers
  public getStreakDays(): number {
    const logs = this.getStudyLogs();
    if (logs.length === 0) return 0;

    // Collect set of unique active days (YYYY-MM-DD in local time)
    const activeDays = new Set<string>();
    for (const log of logs) {
      const d = new Date(log.timestamp);
      activeDays.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }

    let streak = 0;
    const checkDate = new Date();

    // Check today first
    const todayStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
    const studiedToday = activeDays.has(todayStr);

    if (studiedToday) {
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      // Check if studied yesterday; if so, streak isn't broken yet
      checkDate.setDate(checkDate.getDate() - 1);
      const yesterdayStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
      if (!activeDays.has(yesterdayStr)) {
        return 0;
      }
      streak++;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    while (true) {
      const dateStr = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, '0')}-${String(checkDate.getDate()).padStart(2, '0')}`;
      if (activeDays.has(dateStr)) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return streak;
  }

  public getTodayLogs(): StudyLog[] {
    const logs = this.getStudyLogs();
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startMs = startOfToday.getTime();
    return logs.filter(l => l.timestamp >= startMs);
  }

  // Custom AI Scenarios
  public getCustomScenarios(): CustomAiScenario[] {
    try {
      const data = localStorage.getItem(CUSTOM_SCENARIOS_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Prepend core grammar presets to the front if not already present
          const coreIds = ['ja_verb_conjugation', 'ja_adj_conjugation', 'ja_verb_type_quiz'];
          const missingCore = DEFAULT_PRESET_SCENARIOS.filter(
            (s) => coreIds.includes(s.id) && !parsed.some((p: any) => p.id === s.id)
          );
          if (missingCore.length > 0) {
            const combined = [...missingCore, ...parsed];
            localStorage.setItem(CUSTOM_SCENARIOS_KEY, JSON.stringify(combined));
            return combined;
          }
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to read custom scenarios', e);
    }
    // Return rich default preset scenarios so user has grammar, construction & daily roleplays out of the box
    return DEFAULT_PRESET_SCENARIOS;
  }

  public getPresetScenarios(): CustomAiScenario[] {
    return DEFAULT_PRESET_SCENARIOS;
  }

  public resetToDefaultScenarios(): CustomAiScenario[] {
    try {
      localStorage.setItem(CUSTOM_SCENARIOS_KEY, JSON.stringify(DEFAULT_PRESET_SCENARIOS));
    } catch (e) {
      console.error('Failed to reset default scenarios', e);
    }
    return DEFAULT_PRESET_SCENARIOS;
  }

  public saveCustomScenario(scenario: CustomAiScenario): void {
    const list = this.getCustomScenarios();
    const enriched: CustomAiScenario = { ...scenario, isCustom: true, updatedAt: Date.now(), deletedAt: null };
    const idx = list.findIndex((s) => s.id === scenario.id);
    if (idx >= 0) {
      list[idx] = enriched;
    } else {
      list.push(enriched);
    }
    localStorage.setItem(CUSTOM_SCENARIOS_KEY, JSON.stringify(list));
    this.markDirty(5);
  }

  public deleteCustomScenario(id: string): void {
    const list = this.getCustomScenarios().filter((s) => s.id !== id);
    localStorage.setItem(CUSTOM_SCENARIOS_KEY, JSON.stringify(list));
    // 写入墓碑，确保删除操作可跨设备同步
    this.recordScenarioTombstone(id);
    this.markDirty(5);
  }

  // ===== 场景墓碑（跨设备删除同步） =====
  public getDeletedScenarioTombstones(): { id: string; deletedAt: number }[] {
    try {
      const data = localStorage.getItem(DELETED_SCENARIOS_KEY);
      if (data) return JSON.parse(data);
    } catch (e) {
      console.warn('Failed to read deleted scenario tombstones', e);
    }
    return [];
  }

  private recordScenarioTombstone(id: string): void {
    const list = this.getDeletedScenarioTombstones();
    const existing = list.find((t) => t.id === id);
    if (existing) {
      existing.deletedAt = Math.max(existing.deletedAt, Date.now());
    } else {
      list.push({ id, deletedAt: Date.now() });
    }
    localStorage.setItem(DELETED_SCENARIOS_KEY, JSON.stringify(list));
  }

  // Snapshots (快照存档管理 - 全网成熟防丢失方案)
  public getSnapshots(): LocalSnapshot[] {
    try {
      const data = localStorage.getItem(SNAPSHOTS_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch (e) {
      console.warn('Failed to read snapshots', e);
    }
    return [];
  }

  public createSnapshot(name?: string): LocalSnapshot {
    const snapshots = this.getSnapshots();
    const progressMap = this.getProgressMap();
    const totalWords = Object.keys(progressMap).length;
    const learnedWords = Object.values(progressMap).filter((p) => p.reps > 0).length;
    const streak = this.getStreakDays();

    const fullData = this.exportData();
    const sizeKb = Math.round((fullData.length / 1024) * 10) / 10;

    const snapshotId = `snap_${Date.now()}`;
    const autoName = name && name.trim()
      ? name.trim()
      : `快照 ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

    const newSnapshot: LocalSnapshot = {
      id: snapshotId,
      name: autoName,
      timestamp: Date.now(),
      wordCount: totalWords,
      learnedCount: learnedWords,
      streak,
      sizeKb,
    };

    // Store raw data for this snapshot
    localStorage.setItem(`memorize_word_snap_data_${snapshotId}`, fullData);

    // Keep at most 10 snapshots (FIFO)
    snapshots.unshift(newSnapshot);
    if (snapshots.length > 10) {
      const removed = snapshots.pop();
      if (removed) {
        localStorage.removeItem(`memorize_word_snap_data_${removed.id}`);
      }
    }

    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots));
    return newSnapshot;
  }

  public restoreSnapshot(snapshotId: string): boolean {
    const rawData = localStorage.getItem(`memorize_word_snap_data_${snapshotId}`);
    if (!rawData) return false;
    const res = this.importData(rawData, 'overwrite');
    return res.success;
  }

  public deleteSnapshot(snapshotId: string): void {
    const snapshots = this.getSnapshots().filter((s) => s.id !== snapshotId);
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snapshots));
    localStorage.removeItem(`memorize_word_snap_data_${snapshotId}`);
  }

  // Backup Inspection & Export/Import
  public inspectBackup(jsonString: string): {
    valid: boolean;
    error?: string;
    version?: number;
    exportedAt?: number;
    progressCount: number;
    customWordsCount: number;
    scenariosCount: number;
    logsCount: number;
  } {
    try {
      const data = JSON.parse(jsonString);
      if (!data || typeof data !== 'object') {
        return { valid: false, error: '文件不是合法的 JSON 对象', progressCount: 0, customWordsCount: 0, scenariosCount: 0, logsCount: 0 };
      }
      return {
        valid: true,
        version: data.version || 1,
        exportedAt: data.exportedAt,
        progressCount: data.progress ? Object.keys(data.progress).length : 0,
        customWordsCount: Array.isArray(data.customWords) ? data.customWords.length : 0,
        scenariosCount: Array.isArray(data.customScenarios) ? data.customScenarios.length : 0,
        logsCount: Array.isArray(data.logs) ? data.logs.length : 0,
      };
    } catch (e: any) {
      return { valid: false, error: e.message || 'JSON 解析失败', progressCount: 0, customWordsCount: 0, scenariosCount: 0, logsCount: 0 };
    }
  }

  public exportData(): string {
    const exportObject = {
      version: 2,
      exportedAt: Date.now(),
      settings: this.getSettings(),
      progress: this.getProgressMap(),
      customWords: this.getCustomWords(),
      customScenarios: this.getCustomScenarios(),
      logs: this.getStudyLogs(),
      achievements: this.getAchievements(),
    };
    return JSON.stringify(exportObject, null, 2);
  }

  /**
   * Export to Anki / Excel compatible TSV format
   */
  public exportAnkiTsv(words: Word[], language: Language = 'en'): string {
    const headers = ['Headword', 'Reading / Phonetic', 'POS', 'Meaning', 'Examples', 'Level'];
    const lines = [headers.join('\t')];

    for (const w of words) {
      const headword = w.headword.replace(/\t/g, ' ');
      const reading = (language === 'ja' ? w.reading : w.phonetic) || '';
      const pos = w.pos || '';
      const meaning = (w.meanings?.[0]?.def || '').replace(/\t/g, ' ').replace(/\n/g, ' / ');
      const example = (w.examples?.[0]?.text || '').replace(/\t/g, ' ').replace(/\n/g, ' ');
      const exampleTrans = (w.examples?.[0]?.translation || '').replace(/\t/g, ' ');
      const fullExample = exampleTrans ? `${example} (${exampleTrans})` : example;
      const level = w.level || '';

      lines.push([headword, reading, pos, meaning, fullExample, level].join('\t'));
    }

    return lines.join('\n');
  }

  public importData(
    jsonString: string,
    mode: 'merge' | 'overwrite' = 'merge'
  ): { success: boolean; message: string; count: number } {
    try {
      const imported = JSON.parse(jsonString);
      if (!imported || typeof imported !== 'object') {
        return { success: false, message: '无效的备份文件格式', count: 0 };
      }

      if (mode === 'overwrite') {
        if (imported.progress) localStorage.setItem(PROGRESS_KEY, JSON.stringify(imported.progress));
        if (imported.customWords) localStorage.setItem(CUSTOM_WORDS_KEY, JSON.stringify(imported.customWords));
        if (imported.customScenarios) localStorage.setItem(CUSTOM_SCENARIOS_KEY, JSON.stringify(imported.customScenarios));
        if (imported.logs) localStorage.setItem(LOGS_KEY, JSON.stringify(imported.logs));
        if (imported.achievements) localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(imported.achievements));
        if (imported.settings) this.saveSettings(imported.settings);
        const count = imported.progress ? Object.keys(imported.progress).length : 0;
        this.syncToCloud(true).catch((e) => console.warn('Post-import cloud overwrite failed:', e));
        return { success: true, message: `已完全覆盖还原备份！包含 ${count} 个进度条目。`, count };
      }

      // Merge mode
      let count = 0;
      if (imported.progress && typeof imported.progress === 'object') {
        const currentMap = this.getProgressMap();
        for (const [key, item] of Object.entries(imported.progress as Record<string, WordProgress>)) {
          if (!currentMap[key] || (item.updatedAt || 0) > (currentMap[key].updatedAt || 0)) {
            currentMap[key] = item;
            count++;
          }
        }
        localStorage.setItem(PROGRESS_KEY, JSON.stringify(currentMap));
      }

      if (Array.isArray(imported.customWords)) {
        const currentCustom = this.getCustomWords();
        const existingIds = new Set(currentCustom.map((w) => w.id));
        for (const w of imported.customWords) {
          if (!existingIds.has(w.id)) {
            currentCustom.push(w);
          }
        }
        localStorage.setItem(CUSTOM_WORDS_KEY, JSON.stringify(currentCustom));
      }

      if (Array.isArray(imported.customScenarios)) {
        const currentScenarios = this.getCustomScenarios();
        const existingIds = new Set(currentScenarios.map((s) => s.id));
        for (const s of imported.customScenarios) {
          if (!existingIds.has(s.id)) {
            currentScenarios.push(s);
          }
        }
        localStorage.setItem(CUSTOM_SCENARIOS_KEY, JSON.stringify(currentScenarios));
      }

      if (imported.settings) {
        this.saveSettings(imported.settings);
      }

      // Merge imported data with cloud state instead of replacing newer remote data.
      this.markDirty(1);
      this.syncToCloud(false).catch((e) => console.warn('Post-import cloud merge failed:', e));
      return { success: true, message: `成功导入并合并 ${count} 个单词的进度与相关数据！`, count };
    } catch (err: any) {
      return { success: false, message: `导入失败: ${err.message}`, count: 0 };
    }
  }

  // WebDAV Cloud Sync Configuration
  public getWebDavConfig(): WebDavConfig {
    try {
      const data = localStorage.getItem(WEBDAV_KEY);
      if (data) {
        return { ...DEFAULT_WEBDAV_CONFIG, ...JSON.parse(data) };
      }
    } catch (e) {
      console.warn('Failed to read webdav config', e);
    }
    return DEFAULT_WEBDAV_CONFIG;
  }

  public saveWebDavConfig(config: Partial<WebDavConfig>): WebDavConfig {
    const current = this.getWebDavConfig();
    const updated: WebDavConfig = { ...current, ...config };
    localStorage.setItem(WEBDAV_KEY, JSON.stringify(updated));
    return updated;
  }

  public clearAllData(): void {
    // 仅清理当前浏览器 localStorage，绝不清空云端 PostgreSQL 与 WebDAV 备份
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(PROGRESS_KEY);
    localStorage.removeItem(LOGS_KEY);
    localStorage.removeItem(CUSTOM_WORDS_KEY);
    localStorage.removeItem(ACHIEVEMENTS_KEY);
    localStorage.removeItem(SNAPSHOTS_KEY);
    localStorage.removeItem(CUSTOM_SCENARIOS_KEY);
    localStorage.removeItem(WEBDAV_KEY);
    localStorage.removeItem(DELETED_SCENARIOS_KEY);

    // 清理所有快照明细数据（memorize_word_snap_data_*）
    try {
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('memorize_word_snap_data_')) {
          toRemove.push(k);
        }
      }
      for (const k of toRemove) localStorage.removeItem(k);
    } catch (e) {
      console.warn('Failed to clean snapshot data keys', e);
    }

    // 本地数据已清空，不主动推送空数据上云；重置脏标记，避免误推
  }

  // ===== Cloud Sync (Vercel + Neon PostgreSQL) 对外接口 =====

  public getSyncPayload(includeAllLogs = false): LearningSyncPayload {
    const settings = this.getSettings();
    const logs = this.getStudyLogs();
    // customScenarios：仅 isCustom===true 的用户自建场景（内置预设不入库）
    const userScenarios = this.getCustomScenarios()
      .filter((s) => s.isCustom === true)
      .map((s) => ({ ...s, deletedAt: s.deletedAt ?? null }));

    // 把本地的场景墓碑也带进 payload，作为删除标记同步给其他设备
    const tombstones = this.getDeletedScenarioTombstones().map((t) => ({
      id: t.id,
      title: '',
      icon: 'Trash2',
      desc: '',
      language: 'all' as const,
      rolePersona: '',
      openingGreeting: { en: '', ja: '', translation: '' },
      isCustom: true,
      createdAt: t.deletedAt,
      updatedAt: t.deletedAt,
      deletedAt: t.deletedAt,
    }));

    return {
      settings,
      progress: this.getProgressMap(),
      customWords: this.getCustomWords(),
      customScenarios: [...userScenarios, ...tombstones],
      logs: includeAllLogs ? logs : logs.slice(-CLOUD_SYNC_LOG_LIMIT),
      achievements: this.getAchievements(),
      updatedAt: settings.updatedAt || Date.now(),
    };
  }

  public applySyncPayload(payload: LearningSyncPayload): void {
    if (!payload) return;

    // 直接写回合并后的进度 / 日志 / 成就 / 自定义词
    if (payload.progress) localStorage.setItem(PROGRESS_KEY, JSON.stringify(payload.progress));
    if (payload.logs) localStorage.setItem(LOGS_KEY, JSON.stringify(payload.logs));
    if (payload.achievements) localStorage.setItem(ACHIEVEMENTS_KEY, JSON.stringify(payload.achievements));
    if (payload.customWords) localStorage.setItem(CUSTOM_WORDS_KEY, JSON.stringify(payload.customWords));

    // 设置：直接写，不走 saveSettings（避免触发新一轮 markDirty 与 updatedAt 改写）
    if (payload.settings) {
      const merged = { ...DEFAULT_SETTINGS, ...payload.settings };
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
    }

    // 自定义场景：内置预设 + 用户自建场景（含墓碑）组合去重写回
    if (payload.customScenarios) {
      const received = payload.customScenarios;
      const receivedIds = new Set(received.map((s) => s.id));
      // 内置预设中未被用户覆盖/删除的保留
      const presets = DEFAULT_PRESET_SCENARIOS.filter((p) => !receivedIds.has(p.id));
      // 收到的非墓碑场景合并进主列表；墓碑单独落到 DELETED_SCENARIOS_KEY
      const liveScenarios = received.filter((s) => s.isCustom === true && !s.deletedAt);
      const deletedMarkers = received.filter((s) => s.isCustom === true && s.deletedAt);

      // 主场景列表 = 预设 + 用户场景
      const combined = [...presets, ...liveScenarios];
      localStorage.setItem(CUSTOM_SCENARIOS_KEY, JSON.stringify(combined));

      // 同步墓碑到本地
      const localTombstones = this.getDeletedScenarioTombstones();
      const tombMap = new Map(localTombstones.map((t) => [t.id, t]));
      for (const d of deletedMarkers) {
        const existing = tombMap.get(d.id);
        if (!existing || (d.deletedAt || 0) > existing.deletedAt) {
          tombMap.set(d.id, { id: d.id, deletedAt: d.deletedAt as number });
        }
      }
      localStorage.setItem(DELETED_SCENARIOS_KEY, JSON.stringify(Array.from(tombMap.values())));

      // 应用墓碑：从主列表移除已删除场景
      if (deletedMarkers.length > 0) {
        const deletedIds = new Set(deletedMarkers.map((s) => s.id));
        const cleaned = combined.filter((s) => !deletedIds.has(s.id));
        localStorage.setItem(CUSTOM_SCENARIOS_KEY, JSON.stringify(cleaned));
      }
    }
  }

  private async doCloudPull(): Promise<void> {
    const remote = await apiClient.getCloudSyncState();
    if (!remote.exists || !remote.stateData) return; // 云端尚无数据
    const local = this.getSyncPayload(true);
    const merged = mergeLearningPayload(local, remote.stateData, LOCAL_SYNC_LOG_LIMIT);
    this.applySyncPayload(merged);
  }

  // 从云端拉取并合并（启动时 / 切回前台时调用）
  public async pullFromCloud(): Promise<void> {
    await this.syncController.pull();
  }

  // 推送本地变更到云端（可强制覆盖，用于导入/恢复后）
  public async syncToCloud(forceOverwrite = false): Promise<void> {
    await this.syncController.flush(forceOverwrite);
  }

  // 双向同步：先拉取云端合并到本地，再把合并后的本地全集推回云端。
  // 用于登录后首次同步——确保老设备的本地历史数据被完整迁移上云，
  // 否则只读取本地、不写入时 isDirty 恒 false，本地数据永远不会推送。
  // markDirty(1) 只置脏标记（权重 1 < 阈值，不立即触发），紧接着 flush(false)
  // 因 isDirty=true 会真正推送，且走服务端 merge 合并，不会覆盖并发写入。
  public async bidirectionalSync(): Promise<void> {
    await this.pullFromCloud();
    this.syncController.markDirty(1);
    await this.syncToCloud(false);
  }

  public getSyncStatus(): { status: CloudSyncStatus; lastSyncedAt: number | null; errorMessage: string | null } {
    return {
      status: this.syncController.getStatus(),
      lastSyncedAt: this.syncController.getLastSyncedAt(),
      errorMessage: this.syncController.getErrorMessage(),
    };
  }

  public subscribeSyncStatus(
    listener: (status: CloudSyncStatus, lastSyncedAt: number | null, errorMessage: string | null) => void
  ): () => void {
    return this.syncController.subscribe(listener);
  }

  // 暴露给外部的脏标记接口（UI 学习结束 / 设置变更后由 storage 内部已自动调用，
  // 也允许外部手动触发，例如 Navbar 点击同步）
  public markDirty(weight = 1): void {
    this.syncController.markDirty(weight);
  }
}

export const storage = new StorageService();

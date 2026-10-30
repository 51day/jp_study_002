import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Bot,
  Coffee,
  Plane,
  Briefcase,
  GraduationCap,
  MessageCircle,
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
  Check,
} from 'lucide-react';
import { CustomAiScenario, Language } from '../types';
import { storage } from '../services/storage';
import { useI18n } from '../i18n';

interface AiScenarioModalProps {
  initialScenario?: CustomAiScenario | null;
  currentLang: Language;
  onClose: () => void;
  onSaved: (scenario: CustomAiScenario) => void;
}

const AVAILABLE_ICONS = [
  { id: 'HardHat', icon: HardHat, label: '工地施工' },
  { id: 'Ruler', icon: Ruler, label: '图纸尺寸' },
  { id: 'Building2', icon: Building2, label: '建筑BIM' },
  { id: 'Hammer', icon: Hammer, label: '土木结构' },
  { id: 'Truck', icon: Truck, label: '材料运输' },
  { id: 'Briefcase', icon: Briefcase, label: '职场面试' },
  { id: 'Utensils', icon: Utensils, label: '居酒屋美食' },
  { id: 'ShoppingBag', icon: ShoppingBag, label: '商场购物' },
  { id: 'HeartPulse', icon: HeartPulse, label: '医疗健康' },
  { id: 'Coffee', icon: Coffee, label: '咖啡餐饮' },
  { id: 'Plane', icon: Plane, label: '机场旅行' },
  { id: 'GraduationCap', icon: GraduationCap, label: '学术校园' },
  { id: 'Building', icon: Building, label: '房产中介' },
  { id: 'MessageCircle', icon: MessageCircle, label: '日常闲聊' },
  { id: 'Sparkles', icon: Sparkles, label: '自由定制' },
];

export interface ScenarioPresetItem {
  id: string;
  name: string;
  category: 'architecture' | 'life';
  lang: Language;
  icon: string;
  desc: string;
  role: string;
  greeting: string;
  trans: string;
  challenge: string;
}

// Mature industry-standard templates for quick setup
export const SCENARIO_PRESETS: ScenarioPresetItem[] = [
  // 建筑与工程实战 (Architecture & Construction)
  {
    id: 'arch_ja_ky',
    name: '建筑工地朝礼与KY安全活动',
    category: 'architecture',
    lang: 'ja',
    icon: 'HardHat',
    desc: '日本建筑总包晨会：安全帽与双钩安全带检查、指差し呼称及KY危险预知',
    role: '你是一位日本大型综合建筑承包商（ゼネコン）的资深现场施工主任（主任技術者/職長）。你每天早上主持作业人员的安全朝礼（朝礼）并组织KY活动（危険予知活動）。你要求大家检查个人防护用具（ヘルメットのあご紐、フルハーネス安全帯、安全靴），执行指差し呼称「安全第一、ヨシ！」，并针对高空脚手架作业（足場作業）或起重机吊装作业（玉掛け・揚重）排查潜在危险点。你的语气严谨专业且充满关怀。',
    greeting: '皆さん、おはようございます！本日も一日、ご安全に！朝礼を始めます。まず保護具の確認です。ヘルメットのあご紐よし！フルハーネス安全帯よし！本日は4階の足場解体とクレーン揚重作業が予定されています。作業中の転落や落下物事故を防ぐための危険予知（KY）ポイントを1点挙げてください！',
    trans: '大家早上好！今天一天也请注意安全！现在开始朝礼。首先确认个人防护用具：安全帽下颚带OK！全身双钩安全带OK！今天计划进行4层脚手架拆除和吊车吊运作业。请大家举出一个防范高空坠落或落物事故的KY（危险预知）要点！',
    challenge: '尝试用日语指出脚手架安全带挂扣（安全帯フック）、隔离区警示（立入禁止区域）或手指口述（指差し呼称）。',
  },
  {
    id: 'arch_ja_blueprint',
    name: '建筑图纸与节点收口对接',
    category: 'architecture',
    lang: 'ja',
    icon: 'Ruler',
    desc: '与日本一级建筑士对接意匠图/结构图、梁柱净高、墨线放线与机电管线避让',
    role: '你是一位资深日本一级建筑士兼项目设计监理。你正在工地事务所与施工员/现场总监核对建筑施工图（意匠図・構造図）与现场放线（墨出し）。你需要核对梁柱净高、楼板配筋保护层、门窗塞缝细部收口（納まり）以及机电管线预埋开洞（スリーブ孔）的干涉避让。用词严密专业，经常使用日本建筑工程术语。',
    greeting: 'お疲れ様です！3階の基準階スラブと柱梁接合部の納まり図面をチェックしています。構造図の配筋ピッチと、設備図のエアコン配管用スリーブの位置が一部干渉している懸念があります。現場の墨出し状況を確認したいのですが、梁の主筋との離隔はどのくらい確保できそうですか？',
    trans: '辛苦了！我正在核对3层标准层楼板与梁柱节点细部施工图。目前有些担心结构图中的钢筋间距与机电暖通空调套管开洞位置存在干涉。想确认一下现场放线情况，目前管线与梁主筋能确保多少净距？',
    challenge: '用日语讨论尺寸公差（クリアランス）、套管（スリーブ）或按图纸修改（図面修正）。',
  },
  {
    id: 'arch_ja_concrete',
    name: '商品混凝土打设立会与验收',
    category: 'architecture',
    lang: 'ja',
    icon: 'Truck',
    desc: '搅拌车到场配合比核查、坍落度筒试验、含气量检测与浇筑防冷缝监督',
    role: '你是一位日本施工现场的质量安全管理工程师（品質管理担当）。正在进行商品混凝土（生コンクリート）进场抽样检验与大体积浇筑立会（打設立会）。你严格核对搅拌车纳品书的标号（呼び強度24、スランプ18cm、水セメント比）、坍落度筒试验、空气量测试（空気量4.5%±1.5%）与盐化物含量，并监督振捣棒（バイブレーター）作业防止蜂窝麻面与冷缝。',
    greeting: '生コンクリートのミキサー車が現場に到着しました！納品書の配合報告書を確認します。呼び強度24、スランプ18、粗骨材最大寸法20mmで相違ありませんね。これから受入検査のスランプコーン試験と空気量測定を行います。試験器のキャリブレーションとスランプ測定の準備は整っていますか？',
    trans: '商品混凝土搅拌车已经进场！我们来核实供货单配合比：设计标号24、坍落度18、粗骨料最大粒径20mm无误。接下来进行坍落度筒抽样和含气量检测。试验仪器的校准和测量工具准备就绪了吗？',
    challenge: '回答坍落度（スランプ値）、水灰比（水セメント比）或开始打设（打設開始）。',
  },
  {
    id: 'arch_en_safety',
    name: '现场安全早会与PPE检查',
    category: 'architecture',
    lang: 'en',
    icon: 'HardHat',
    desc: '国际工程安全官早间讲评：高空防坠、塔吊回转禁区与OSHA合规',
    role: 'You are a certified Site Safety and Health Officer (SSHO) on a major commercial high-rise construction project. You run the morning Toolbox Talk with trade contractors, enforce OSHA and ISO 45001 safety guidelines, inspect mandatory 5-point PPE (hard hat, high-vis vest, steel-toe boots, safety glasses, gloves), check 100% tie-off fall protection for leading edge work, and manage crane drop zones.',
    greeting: "Good morning, team! Let's kick off our morning Toolbox Talk. Today we have critical operations: mobile crane picks for precast columns on Grid Line C, and formwork stripping on Level 5. Before anyone steps onto the active deck, let's verify PPE compliance and ensure all perimeter guardrails and drop-zone exclusion barriers are secure. Who can highlight the main hazard for today's crane pick?",
    trans: '大家早上好！现在开始今天早上的班前安全讲评（Toolbox Talk）。今天有重点高危作业：C轴预制立柱汽车吊起重吊装，以及5层模板拆除。在任何人踏上作业面之前，我们先检查PPE劳保防护合规，并确保隔离防护栏和落物禁区全部设置完毕。谁能指出今天起重吊装作业的首要危险源？',
    challenge: 'Mention fall hazards, crane swing radius, or 100% tie-off fall protection.',
  },
  {
    id: 'arch_en_bim',
    name: '建筑方案与BIM审图技术交底',
    category: 'architecture',
    lang: 'en',
    icon: 'Building2',
    desc: '主建筑师与机电工程师多专业协同：Navisworks硬碰撞消解与净高核算',
    role: 'You are a Principal Architectural Project Manager and Lead BIM Coordinator hosting an interdisciplinary coordination workshop between the structural engineer, mechanical/electrical/plumbing (MEP) engineers, and the general contractor. You navigate Navisworks / Revit 3D clash reports, verify ceiling soffit heights, fire barrier wall ratings, and code compliance (ADA / IBC).',
    greeting: "Welcome to this week's BIM Coordination and Design Review session. Looking at our latest Navisworks clash report for Level 3, we have a hard collision between the 24-inch chilled water HVAC supply duct and the W-flange structural transfer beam. What are our engineering options to either reroute through an engineered web penetration or lower the architectural ceiling soffit without violating clear head height?",
    trans: '欢迎参加本周的 BIM 协同与建筑方案评审会。根据地下机房最新的碰撞检查报告，24英寸冷冻水供水主管与结构钢转换梁发生了硬碰撞。大家有什么工程解决方案？是通过梁腹板补强开洞走管，还是在不牺牲净空高度的前提下下调吊顶？',
    challenge: 'Discuss duct rerouting, structural web penetrations, or soffit clearance.',
  },
  {
    id: 'arch_en_civil',
    name: '岩土基础与地基验收巡检',
    category: 'architecture',
    lang: 'en',
    icon: 'Hammer',
    desc: '深基坑灌注桩、钢筋笼超声波探伤、泥浆比重测试与导管混凝土浇筑',
    role: 'You are a Senior Civil & Geotechnical Resident Engineer conducting deep foundation and substructure inspections. You inspect bored pile rebar cages, concrete tremie pours, soil compaction Proctor tests, and dewatering pumps, ensuring strict compliance with engineering drawings.',
    greeting: "Good afternoon. We are standing at Pier Cap 4 for the deep foundation inspection. The drilling rig completed boring to bedrock at 28 meters. We need to verify the ultrasonic test results for the bored pile, inspect the rebar cage splice welds, and ensure the slurry density meets specification before tremie pipe concrete pouring. How do the rebar clearances and centralizers look?",
    trans: '下午好。我们正在4号承台进行深基础检验。旋挖钻机已完成入岩钻孔至地下28米。在导管法水下浇筑混凝土前，我们需要核对桩基超声波检测报告、检查钢筋笼搭接焊接头，并确认泥浆比重合规。钢筋保护层垫块与对中定位看起来如何？',
    challenge: 'Report on rebar cover, slurry density, or pile verticality alignment.',
  },
  // 日常与职场经典模板 (Life & Career)
  {
    id: 'life_ja_izakaya',
    name: '居酒屋地道点餐',
    category: 'life',
    lang: 'ja',
    icon: 'Utensils',
    desc: '在东京新宿暖帘居酒屋，体验地道日料点餐、店长推荐与日常寒暄',
    role: '你是一位热情豪爽的东京传统居酒屋店长兼主厨。你会主动向客人推荐今日特选刺身（本日のおすすめ）、日本地酒与特色烧鸟串。言语自然、带有一点亲切的下町风情，鼓励客人用自然口语互动。',
    greeting: 'いらっしゃい！毎度どうも！お一人様ですか？カウンターの奥どうぞ！まずは生ビールでよろしいですか？',
    trans: '欢迎光临！欢迎常来！一位吗？请往吧台里面坐！先来杯生啤酒可以吗？',
    challenge: '尝试用日语点一份自己喜欢的下酒菜或向店长询问今日推荐',
  },
  {
    id: 'career_en_interview',
    name: '外企技术外教模拟面试',
    category: 'life',
    lang: 'en',
    icon: 'Briefcase',
    desc: '全英文技术架构与行为面试模拟，提升技术沟通与表达自信',
    role: 'You are a senior tech lead and engineering interviewer at an international top-tier software company. You are conducting a friendly but thorough behavioral and technical interview. You ask structured follow-up questions and assess fluency and technical clarity.',
    greeting: 'Hello! Thank you for joining today. Could you briefly introduce yourself and share a recent engineering challenge you solved?',
    trans: '你好！感谢今天参加面试。请先做个简短自我介绍，并分享一个你近期攻克的工程技术挑战好吗？',
    challenge: 'Introduce your background and mention key technical skills.',
  },
  {
    id: 'life_ja_akiba',
    name: '秋叶原中古手办店淘物',
    category: 'life',
    lang: 'ja',
    icon: 'ShoppingBag',
    desc: '在秋叶原动漫店寻找绝版模型，向店员询问成色、配件与免税事宜',
    role: '你是一位资深的秋叶原动漫手办专卖店店员，对各类手办限定版、盒况等级（未開封、箱イタミ）和免税流程了如指掌。你非常友善，乐于为顾客寻找稀有商品。',
    greeting: 'こんにちは！ショーケースの中の商品をご覧になりたい時は、いつでもお声がけくださいね。何かお探しの作品はございますか？',
    trans: '你好！如果想看玻璃展柜里的手办，请随时叫我哦。今天有在找什么特定作品吗？',
    challenge: '向店员询问某款手办是否还有全新未拆封库存',
  },
  {
    id: 'life_en_clinic',
    name: '海外就医与症状描述',
    category: 'life',
    lang: 'en',
    icon: 'HeartPulse',
    desc: '在海外诊所向医生清晰描述病情、既往病史与用药需求',
    role: 'You are a compassionate general practitioner (family doctor) at an international health clinic. You listen carefully to the patient’s symptoms, ask about duration and severity, and provide clear medical explanations and advice.',
    greeting: 'Good morning, please have a seat. What brings you in today, and how long have you been feeling unwell?',
    trans: '早上好，请坐。今天感觉哪里不适？这种情况持续多久了？',
    challenge: 'Describe your symptoms clearly (e.g. fever, headache, duration).',
  },
];

export const AiScenarioModal: React.FC<AiScenarioModalProps> = ({
  initialScenario,
  currentLang,
  onClose,
  onSaved,
}) => {
  const { t } = useI18n();

  const [title, setTitle] = useState(initialScenario?.title || '');
  const [icon, setIcon] = useState(initialScenario?.icon || 'Sparkles');
  const [language, setLanguage] = useState<'all' | 'en' | 'ja'>(
    initialScenario?.language || (currentLang === 'ja' ? 'ja' : 'en')
  );
  const [desc, setDesc] = useState(initialScenario?.desc || '');
  const [rolePersona, setRolePersona] = useState(initialScenario?.rolePersona || '');
  const [greetingText, setGreetingText] = useState(
    initialScenario?.openingGreeting?.ja || initialScenario?.openingGreeting?.en || ''
  );
  const [greetingTrans, setGreetingTrans] = useState(
    initialScenario?.openingGreeting?.translation || ''
  );
  const [challengePrompt, setChallengePrompt] = useState(
    initialScenario?.challengePrompt || ''
  );
  const [presetCategory, setPresetCategory] = useState<'all' | 'architecture' | 'life'>('all');
  const [error, setError] = useState('');

  const filteredPresets = SCENARIO_PRESETS.filter((p) => {
    if (presetCategory === 'all') return true;
    return p.category === presetCategory;
  });

  const applyPreset = (preset: (typeof SCENARIO_PRESETS)[0]) => {
    setTitle(preset.name);
    setLanguage(preset.lang);
    setIcon(preset.icon);
    setDesc(preset.desc);
    setRolePersona(preset.role);
    setGreetingText(preset.greeting);
    setGreetingTrans(preset.trans);
    setChallengePrompt(preset.challenge);
    setError('');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('请输入场景名称');
      return;
    }
    if (!rolePersona.trim()) {
      setError('请设定 AI 扮演的角色与指导提示');
      return;
    }
    if (!greetingText.trim()) {
      setError('请提供场景开场白');
      return;
    }

    const scenario: CustomAiScenario = {
      id: initialScenario?.id || `scenario_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: title.trim(),
      icon,
      desc: desc.trim() || title.trim(),
      language,
      rolePersona: rolePersona.trim(),
      openingGreeting: {
        en: language === 'ja' ? '' : greetingText.trim(),
        ja: language === 'en' ? '' : greetingText.trim(),
        translation: greetingTrans.trim(),
      },
      challengePrompt: challengePrompt.trim() || undefined,
      isCustom: true,
      createdAt: initialScenario?.createdAt || Date.now(),
    };

    storage.saveCustomScenario(scenario);
    onSaved(scenario);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {initialScenario ? '编辑自定义 AI 实战场景' : '添加自定义 AI 实战场景'}
              </h3>
              <p className="text-xs text-slate-400">
                配置独有人设、开场台词与交流语境，与 Gemini 3.8 进行地道口语实战
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-5 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Quick Presets */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                <span>成熟实战模板一键套用：</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPresetCategory('all')}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition ${
                    presetCategory === 'all'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  全部 ({SCENARIO_PRESETS.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPresetCategory('architecture')}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition ${
                    presetCategory === 'architecture'
                      ? 'bg-amber-600 text-white'
                      : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                  }`}
                >
                  🏗️ 建筑工程 (6)
                </button>
                <button
                  type="button"
                  onClick={() => setPresetCategory('life')}
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold transition ${
                    presetCategory === 'life'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  ☕ 生活职场 (4)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-1">
              {filteredPresets.map((p) => {
                const IconComp = AVAILABLE_ICONS.find((i) => i.id === p.icon)?.icon || Sparkles;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="p-2 text-left rounded-xl bg-slate-50 dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 transition text-xs font-medium text-slate-700 dark:text-slate-300 group"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <IconComp className="w-3.5 h-3.5 text-indigo-500 shrink-0 group-hover:scale-110 transition-transform" />
                      <div className="truncate font-semibold text-[11px]">{p.name}</div>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="uppercase">{p.lang === 'ja' ? '🇯🇵 日语' : '🇬🇧 英语'}</span>
                      {p.category === 'architecture' && (
                        <span className="px-1 py-0.2 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[9px] font-bold">
                          工程
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                场景名称 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="例: 日本居酒屋点餐"
                className="w-full text-base md:text-sm p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                适用语种
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as any)}
                className="w-full text-base md:text-sm p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ja">日本语 (ja)</option>
                <option value="en">English (en)</option>
                <option value="all">双语通用</option>
              </select>
            </div>
          </div>

          {/* Icon Picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              场景图标
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_ICONS.map((item) => {
                const IconComponent = item.icon;
                const isSelected = icon === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setIcon(item.id)}
                    title={item.label}
                    className={`p-2.5 rounded-xl border flex items-center justify-center transition ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <IconComponent className="w-4 h-4" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* AI Role Persona Prompt */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              AI 角色设定与系统指导词 <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={rolePersona}
              onChange={(e) => setRolePersona(e.target.value)}
              placeholder="例: 你是一位东京传统居酒屋店长，热情向客人推荐今日特选刺身与烧鸟，言语风趣亲切..."
              className="w-full text-base md:text-sm p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Opening Greeting */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              开场台词与中文对照 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={greetingText}
              onChange={(e) => setGreetingText(e.target.value)}
              placeholder="外语开场白 (例: いらっしゃい！何名様ですか？ / Welcome! How can I help you today?)"
              className="w-full text-base md:text-sm p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="text"
              value={greetingTrans}
              onChange={(e) => setGreetingTrans(e.target.value)}
              placeholder="中文翻译 (例: 欢迎光临！请问几位？)"
              className="w-full text-base md:text-sm p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Starter Challenge / Suggestion */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              本轮练习目标或建议
            </label>
            <input
              type="text"
              value={challengePrompt}
              onChange={(e) => setChallengePrompt(e.target.value)}
              placeholder="例: 尝试向对方表达今日推荐，或说明人数并入座"
              className="w-full text-base md:text-sm p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-2xl text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold transition"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-sm transition"
            >
              <Check className="w-4 h-4" />
              <span>保存实战场景</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

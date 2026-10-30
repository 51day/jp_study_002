# 背单词 (MemorizeWord) - 科学背单词与 AI 语境实战

基于原项目 [memorize-word-1](https://github.com/laboss2020/memorize-word-1) 导入、跨端重构并全面升级二开的离线优先背单词与语言学习系统。

---

## 🌟 核心特色与二开升级 (v2 Highlights)

### 1. 科学记忆调度：FSRS-5 (Free Spaced Repetition Scheduler)
- 完全实现了先进的科学间隔重复算法（FSRS-5），告别简陋的固定间隔。
- 综合考量词汇记忆半衰期（Stability）、记忆难度（Difficulty 1~10）、遗忘次数（Lapses）与复习次数（Reps）。
- 实时给出四个反馈按钮对应的预期复习天数（「遗忘 1分」、「困难 10分」、「良好 1天」、「简单 3天」等）。

### 2. 权威全量双语离线词库 (27,734 词)
- **英语 (English)**：CEFR A1、A2、B1、B2、C1、C2 全阶考纲（源自 ECDICT 权威词源）。
- **日语 (日本語)**：JLPT N5、N4、N3、N2、N1 五级全覆盖（源自 JMdict + OpenJLPT 词源）。
- **例句语境**：全部配套 Tatoeba 双语高质量真实例句。
- **发音系统**：基于 Web Speech API 系统 TTS 引擎，支持英美发音与日本语原生发音，可调语速（0.7x ~ 1.3x），无需外部音频网络。

### 3. 多种沉浸式复习模式
- **新词闪卡 (Flashcard)**：正面词头音标发音，背面释义例句与笔记，点击翻转并进行 4 级 FSRS 判定。
- **词义选择 (Choice)**：同级词库智能干扰项选择，即时正误反馈。
- **听音拼写 (Dictation)**：纯音频播放拼写；日语模式配备**五十音假名软键盘**（平假名/片假名自由切换输入）。
- **语境填空 (Cloze)**：提取真实双语例句进行缺词填空，支持首字母提示。

### 4. 🤖 重点二开功能：AI 场景对话与多轮口语实战 (Gemini 2.5 Flash)
- **建筑与工程专属实战场景**（中/英/日三语支持）：
  - 🏗️ **建筑工地朝礼与KY安全活动 (朝礼・KY活動)**：ゼネコン晨会、安全帽与双钩安全带检查、指差し呼称及KY危险预知
  - 📐 **建筑施工图纸与尺寸标高对接 (図面・寸法・納まり)**：一级建筑士对接意匠图/结构图、梁柱净高、墨线放线与机电套管管线避让
  - 🚚 **商品混凝土打设立会与验收 (生コン受入検査)**：搅拌车配合比核查、坍落度筒试验、含气量检测与防冷缝浇筑立会
  - 🦺 **Construction Site Toolbox Talk & Daily Briefing**：欧美高层项目班前安全讲评、高空防坠（100% tie-off）、起重吊装与 OSHA 合规
  - 🏛️ **Architectural Design Review & BIM Coordination**：多专业 BIM 协同、Revit / Navisworks 暖通与钢构硬碰撞消解、净空高审核
  - 🔨 **Civil & Geotechnical Foundation Inspection**：深基坑旋挖灌注桩、钢筋笼超声波探伤、泥浆比重测试与导管混凝土浇筑
- **经典生活与职场成熟模板**：
  - 🍶 **居酒屋地道点餐**（东京新宿暖帘居酒屋特色菜与生啤交互）
  - 💼 **外企外教技术模拟面试**（英文系统架构与技术挑战深度交流）
  - 🛍️ **秋叶原中古手办店淘物**（限定版、成色询问与免税交流）
  - 🩺 **海外就医与症状描述**（全科医生问诊与用药交流）
- **自定义场景编辑器**：支持自由配置 AI 人设、专属开场白、翻译及挑战任务。

---

---

## 🚀 部署到 Vercel + Neon

项目已开箱支持 Vercel 部署：前端走 CDN 静态托管，`api/[...path].ts` 处理一级 API，`api/router.ts` 通过 Vercel rewrite 接收嵌套 API 并调用共用的 `server.ts` Express 路由，数据落在 Neon PostgreSQL。

**四步就能上线**：

1. 推到 GitHub 私有仓库
2. Neon 建库（区域选 Singapore），复制**池化**连接串
3. Vercel 导入仓库，配 4 个环境变量
4. Deploy，然后跑一遍验收清单

必填环境变量只有四个：

| 变量 | 作用 |
|---|---|
| `ACCESS_PASSWORD` | 进入 App 的全局密码 |
| `DATABASE_URL` | Neon 池化连接串（主机名带 `-pooler`） |
| `AI_CONFIG_ENCRYPTION_KEY` | 加密库内 AI Key，生成一次后固定不变 |
| `GEMINI_API_KEY` | 可选，也能登录后在界面里填 |

> ⚠️ 两个最容易踩的坑：
> ① 用了**直连**连接串而不是池化串 → 随机 `too many connections`；
> ② 改了环境变量没点 **Redeploy** → 线上还是旧值。

📖 **完整步骤、验证清单、12 类报错对照表、回滚与成本说明，见 [`docs/部署指南-Vercel-Neon.md`](./docs/部署指南-Vercel-Neon.md)**

### 本地开发

```bash
cp .env.example .env     # 填入 ACCESS_PASSWORD 等
npm install
npm run dev              # http://localhost:3000
```

手机同一局域网访问 `http://<电脑内网IP>:3000` 即可测试多端同步。

---

## 🛠️ 技术架构

- **前端**：React 19 + TypeScript + Vite + Tailwind CSS v4 (CSS-first) + Lucide + Motion
- **服务端**：Node.js 22 + Express（`server.ts`，本地与 Serverless 共用同一份路由）
- **函数入口**：`api/[...path].ts` 处理一级 API；`api/router.ts` 接收 `vercel.json` 重写的嵌套 API 并还原 Express 路径
- **数据库**：PostgreSQL / Neon，`pg` 连接池（`max: 2`，面向 Serverless）
- **AI**：`@google/genai` + Vercel AI SDK（Gemini / DeepSeek / OpenAI / 自定义兼容端点），全部服务端代理，Key 不入前端
- **同步**：离线优先，localStorage 为真源，20s 防抖推送 + 切后台 flush + last-write-wins 合并 + 墓碑删除

### 目录结构

```
├── src/                 前端源码（components / services / i18n / types）
├── public/data/         词库 JSON（27,734 词，CDN 直发）
├── server.ts            Express 主服务（认证 / 同步 / AI 代理 / WebDAV）
├── api/[...path].ts     Vercel 一级 API 入口
├── api/router.ts        Vercel 嵌套 API rewrite 入口
├── docs/                架构与部署文档
├── vercel.json          构建与函数配置
└── .env.example         环境变量模板（真实 .env 不入库）
```

### 常用命令

```bash
npm run dev        # 全栈开发服务器（Vite 中间件模式）
npm run build      # 编译前端到 dist/
npm run typecheck  # tsc --noEmit
npm start          # 生产模式跑 Express（自建服务器用）
```

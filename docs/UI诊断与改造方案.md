# 背单词 App — UI 代码审计诊断与改造方案

> 审计方式：逐行阅读 `src/App.tsx` 与 `src/components/` 全部 17 个 .tsx（约 7000 行），结合渲染截图交叉验证。
> 环境：Tailwind **v4.3.3**（CSS-first，无 `tailwind.config.js`），React + TS + Vite。

---

## 一、为什么"截图看不全"——三个动态根因

这三个问题只有在真机操作时才暴露，静态截图永远看不出来，但它们是"手机不舒服"的主要来源。

### ① 页面高度算错，永远多出 64px

| 位置 | 代码 | 计算 |
|------|------|------|
| `src/App.tsx:336` | `<main className="flex-1 pb-20 md:pb-12">` | 底部留白 80px |
| `src/components/AiChatView.tsx:305` | `h-[calc(100vh-80px)]` | 内容区 = 视口 − 80 |
| `src/components/StudyView.tsx:288` | `min-h-[calc(100vh-80px)]` | 同上 |
| `src/components/Navbar.tsx:81` | `sticky top-0`（高 64px） | 导航栏占 64px |

**文档总高 = 64（导航） + (100vh − 80)（内容） + 80（留白） = 100vh + 64px**

结果：页面必然产生 64px 的纵向滚动。在 AI 实战页表现为**输入框被推到折叠线以下**，打字时要不停往下拉；学习页同理。

同时手机浏览器地址栏收起/展开会让 `100vh` 变化，导致抖动。

**改法**：`100vh` → `100dvh`；高度改由 CSS 变量统一定义（导航高度 + tab bar 高度），或改成 `flex-1 min-h-0` 让父容器分配，不再硬编码 `80px`。

### ② 底部导航没有留 iOS 安全区

`src/components/Navbar.tsx:241`
```jsx
<div className="md:hidden fixed bottom-0 left-0 right-0 z-40 ... px-2 py-1.5">
```
`src/index.html:5`
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```
缺 `viewport-fit=cover`，即使写了安全区变量也取不到非零值。iPhone X 及以上的 Home 横条（34px）直接压在最下排 tab 的文字上。

**改法**：viewport 加 `viewport-fit=cover`；tab bar 容器加 `pb-[calc(0.375rem+env(safe-area-inset-bottom))]`，每个按钮加 `min-h-[44px]`。

### ③ 触控区与字号不达标

| 位置 | 元素 | 当前尺寸 | 标准 |
|------|------|----------|------|
| `LibraryView.tsx:264-283` | 发音 🔊 / 收藏 ☆ | **32px**（p-2 + w-4） | ≥44px |
| `AiChatView.tsx:341-348` | 重点词朗读 🔊 | **22px**（p-1 + w-3.5） | ≥44px |
| `WordDetailModal.tsx:196-203` | 例句朗读 🔊 | **22px** | ≥44px |
| `AiChatView.tsx:540` | 聊天输入框 `text-sm` | **14px** | ≥16px |
| `AddWordModal.tsx` 多处 | 表单输入 `text-sm p-3` | **14px** | ≥16px |
| `AiScenarioModal.tsx` 多处 | 表单输入 `text-sm` | **14px** | ≥16px |

iOS Safari 聚焦 `font-size < 16px` 的输入框会**自动放大整个页面**，且失焦后不还原——这是手机上最烦人的行为之一。

**改法**：所有图标按钮 `min-h-[44px] min-w-[44px] inline-flex items-center justify-center`；所有输入框 `text-base md:text-sm`。

---

## 二、静态问题清单（截图 + 代码）

### 🔴 严重

| # | 位置 | 问题 |
|---|------|------|
| 1 | `SettingsView.tsx:773` | Tab 栏 `sticky top-0 z-10`，但 Navbar 是 `z-40` → 滚动时 Tab 被导航覆盖，等于假吸顶 |
| 2 | `StudyView.tsx:641` | FSRS 四档按钮 `grid-cols-4`，375px 屏每格约 76px，评级文字+间隔会挤到换行 |
| 3 | `StatsView.tsx:268-281` | 热力图 `min-w-max`（16 周），iPhone SE 320px 必然横向溢出；格子 14px 也点不到 |
| 4 | `LibraryView.tsx:108`、`StatsView.tsx:268` | `scrollbar-none` **是无效类**（Tailwind v4 无 config、无 `@utility`）→ 滚动条实际还在，却没有任何"可横滑"提示 |
| 5 | `AiChatView.tsx:393,409` | 两个 `<select>` 用 `truncate` + `max-w`，但原生 select 不支持省略号，长单词被硬裁不可读；iOS 深色模式下 `<option>` 不继承背景色会是白底黑字 |
| 6 | 6 个 Modal | `WordDetailModal:89`、`AiScenarioModal:273`、`AddWordModal:144`、`LoginModal:43`、`PlacementModal:92`、`SettingsView:549/623/698` 都未锁 body 滚动 → 手机上拖动 modal 背景会跟着滚 |

### 🟡 中等

| # | 位置 | 问题 |
|---|------|------|
| 7 | 主容器宽度四处不一致 | Navbar `max-w-5xl` / Home·Library·Stats `max-w-4xl` / Settings `max-w-3xl` / AiChat `px-3` → 桌面端导航与卡片**边缘对不齐**，AI 页边距还比别处窄 4px |
| 8 | `Navbar.tsx:107-126` | 桌面 tab `px-3.5 py-1.5 text-xs` 约 28px 高，iPad 竖屏（768px）走 md 分支时偏小；无 `focus-visible` 焦点环 |
| 9 | `Navbar.tsx:130-237` | 375px 屏右侧四块（品牌+同步+语言+语种）横向排布，品牌副标题未隐藏，会挤压 |
| 10 | `HomeView.tsx:261`、`LibraryView.tsx:241`、`SettingsView.tsx:1197` | `line-clamp-1` 用在宽度不确定的容器，320-375px 下只剩约 20 字符，日语长释义几乎必被截断 |
| 11 | `KanaKeyboard.tsx:109-121` | 假名键盘 `grid-cols-5` + `h-9`（36px），15 行约 600px，`max-h-52` 内滚动易误触 |
| 12 | 全局 | 未设置 `touch-action: manipulation`，移动端点击存在 300ms 延迟 |
| 13 | `index.html:2` | `<html lang="en">` 但界面是中文，影响屏幕阅读器与浏览器翻译 |
| 14 | `HomeView.tsx:97` | 进度环 `w-20 h-20`（80px）内放 `text-lg` 数字 + `text-[10px]` 标签，小屏下 4 字标签会撞环边 |
| 15 | `StudyView.tsx:292-300,524-544` | 退出按钮、获取提示、假名键盘开关均无 min-height |

### 🟢 轻微

| # | 位置 | 问题 |
|---|------|------|
| 16 | SettingsView 大量 | 数十处中文文案硬编码未走 i18n（备份弹窗、发音引擎、WebDAV、AI 模型区等） |
| 17 | `i18n/locales/*.ts` | 部分 key 定义但未使用（`settings.speech_title`、`common.pronunciation` 等） |
| 18 | z-index | modal `z-50` 与语言下拉 `z-50` 同级，同屏时可能互斥 |
| 19 | `AiChatView.tsx:425` | "自定场景" 硬编码 |

> 说明：截图里看到的"进入场景对活"错字，源码 `zh-CN.ts:44` 实际是 `进入场景对话`（正确），截图应是缓存未刷新。

---

## 三、三套改造方案

### 方案 A — 根因专项修复（推荐先做）

**目标**：先解决"手机上不舒服"的 90%，改动集中、风险低。

| 改动 | 文件 |
|------|------|
| 100vh → 100dvh + CSS 变量统一高度 | App.tsx, AiChatView.tsx, StudyView.tsx, index.css |
| viewport-fit=cover + iOS 安全区 | index.html, Navbar.tsx |
| 全站触控区 ≥44px | LibraryView, AiChatView, WordDetailModal, StudyView |
| 输入框 text-base（≥16px） | AiChatView, AddWordModal, AiScenarioModal, SettingsView |
| 补 `scrollbar-none` 的 `@utility` 实现 + 横滑暗示 | index.css, LibraryView, StatsView |
| Settings Tab sticky 改 top-16 z-30 | SettingsView.tsx |
| `<html lang="zh-CN">` | index.html |
| 全局 `touch-action: manipulation` | index.css |

**工作量**：约半天 ~ 1 天
**效果**：① ② ③ 三个根因 + 严重项 #1 #4 #6 全部解决

### 方案 B — A + 布局与一致性打磨

**目标**：在 A 基础上让桌面和手机"都舒服"。

| 改动 | 文件 |
|------|------|
| FSRS 四档 `grid-cols-2 md:grid-cols-4` | StudyView.tsx |
| 热力图手机显示近 8 周 / 桌面 16 周，格子自适应 | StatsView.tsx |
| 主容器统一 `max-w-4xl px-4 sm:px-6` | 全部 View |
| **AiChatView 桌面侧栏化**（左场景/模型 288px + 右聊天区） | AiChatView.tsx |
| Modal 锁 body 滚动 + `overscroll-contain` | 6 个 Modal |
| `line-clamp-1` → `line-clamp-2` | HomeView, LibraryView, SettingsView |
| 假名键盘 h-11 + 容器 dvh | KanaKeyboard.tsx |
| 桌面 tab 加大 + focus-visible 焦点环 | Navbar.tsx |

**工作量**：额外 1 ~ 2 天
**效果**：手机不再 headache，桌面端空间利用率明显提升

### 方案 C — B + PWA + Vercel/Neon 部署就绪

**目标**：为上线做准备，手机上接近原生 app。

| 改动 | 说明 |
|------|------|
| PWA manifest + favicon | 手机可"添加到主屏幕"，全屏运行无浏览器 UI |
| Service Worker | 缓存 shell + 静态资源；**离线可用**（配合已实现的本地优先同步） |
| `vercel.json` | SPA rewrites → `/api/[...path].ts`，构建/输出目录配置 |
| 环境变量清单文档 | DATABASE_URL、ACCESS_PASSWORD、AI_CONFIG_ENCRYPTION_KEY、WEBDAV_* |
| bundle 代码分割 | 当前 547KB，按路由 lazy load 首页/AI/设置，优化移动端首屏 |
| Neon 连接池调优 | Vercel Serverless 场景下的 max 连接数与超时 |

**工作量**：额外约 1 天
**效果**：可直接部署到 Vercel + Neon，手机上有原生 app 观感

---

## 四、建议路线

```
第 1 步：方案 A（根因修复）→ 你在 iPhone / iPad / 桌面各验证一遍
第 2 步：方案 B（布局打磨）→ 确认 A 的效果后继续
第 3 步：方案 C（部署就绪）→ 准备上线时做
```

每一步都独立可验证，不会出现"改了一大堆但不知道哪个生效"的情况。

---

## 五、尚需你决策的事项

1. **手机导航信息架构**：现在 6 项太密（每项约 60px）
   - 选项 1：精简为 4 项（首页 / 学习 / AI实战 / 我的），合并词库+统计+设置到"我的"
   - 选项 2：精简为 5 项（首页 / 学习 / AI实战 / 词库 / 我的）
   - 选项 3：保持 6 项，仅加大触控区与图标
2. **桌面是否要侧栏**：AI 实战页桌面端左右留白很多，做成"左侧场景栏 + 右侧聊天"是否合口味
3. **是否走 PWA**：要不要手机可安装 / 离线可用

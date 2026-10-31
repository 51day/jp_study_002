# 部署指南：GitHub → Vercel → Neon

> 适用范围：把 MemorizeWord 部署成公网可访问、手机电脑随时同步的正式站点。
> 全程约 20 分钟，不需要买服务器，Vercel 与 Neon 都先走免费额度。

---

## 0. 先看清楚你要部署的是什么

这个项目不是一个纯静态网页，它是「静态前端 + 一个服务端函数 + 一个数据库」的三件套：

```
        浏览器（手机 / 电脑）
                │
                │ 1. 打开页面：拿 dist 里的 HTML/CSS/JS
                ▼
┌───────────────────────────────┐
│  Vercel                       │
│                               │
│  ┌─────────────────────────┐  │
│  │ CDN 静态托管 dist/      │  │  ← 页面、词库 JSON（11 MB）
│  └─────────────────────────┘  │
│                               │
│  ┌─────────────────────────┐  │
│  │ Serverless 函数         │  │  ← api/[...path].ts / api/router.ts，共用 server.ts
│  │ /api/auth/*  登录       │  │
│  │ /api/sync/*  同步读写   │  │
│  │ /api/ai/*    AI 代理    │  │
│  │ /api/webdav/*  网盘备份  │  │
│  └─────────────────────────┘  │
└───────────────┬───────────────┘
                │ 2. 只搬用户数据（进度、日志、生词本、AI 配置）
                ▼
┌───────────────────────────────┐
│  Neon PostgreSQL              │
│  user_ai_configs   AI 密钥    │
│  app_universal_sync  学习数据 │
└───────────────────────────────┘
```

三条关键设计，决定了部署方式：

1. **词库不进数据库**，它是 `public/data/decks/*.json` 静态文件，由 CDN 直接发。所以换词库、加词库不需要动数据库。
2. **前端是离线优先**，所有学习动作先写 localStorage，再后台合并上云。断网、后端挂了都不影响你背单词。
3. **服务端只做三件事**：校验密码、代理 AI 调用（Key 不落前端）、合并同步数据。所以它很小，Serverless 完全够用。

---

## 1. 仓库里有什么、没有什么

部署前先明确：**只有源码进仓库，依赖和密钥不进**。

### 会进 GitHub（约 11.2 MB）

| 路径 | 内容 | 说明 |
|---|---|---|
| `src/` | 39 个前端源码文件 | 全部界面与业务逻辑 |
| `public/data/` | 9 个词库 JSON，共 10.6 MB | 最大 `en-cefr-c2.json` 2.8 MB，远低于 GitHub 100 MB 单文件上限，不需要 LFS |
| `server.ts` | Express 主服务 | 本地和 Serverless 共用同一份路由 |
| `api/[...path].ts` / `api/router.ts` | Vercel 函数入口 | 一级 API 直达；嵌套 API 由 rewrite 转发，见第 10 节 |
| `package.json` / `package-lock.json` | 依赖声明与锁定 | Vercel 靠它 `npm install` |
| `tsconfig.json` / `vite.config.ts` / `vercel.json` | 构建与部署配置 | |
| `index.html` / `README.md` | 入口页与说明 | |
| `.env.example` | 环境变量模板 | **只有占位符**，可以公开 |
| `docs/` | 架构与方案文档 | 记录「为什么这么写」 |

### 不会进 GitHub

| 路径 | 体积 | 原因 |
|---|---|---|
| `.env` | 1.5 KB | 🚨 含 Neon 连接串、加密密钥、访问密码。已在 `.gitignore` 首行拦截 |
| `node_modules/` | 244 MB | Vercel 会自己 `npm install` |
| `dist/` | 12 MB | Vercel 会自己 `npm run build` |
| `.workbuddy/` | 25 KB | 🚨 本地助手记忆，含本地明文密码 |
| `.vercel/` | — | 本地部署状态 |
| `*.log` | — | 运行日志 |

> 判断标准可以记成一句话：**能用命令重新生成的（依赖、构建产物），和只在本机有效的（密钥、日志、本地状态），都不进仓库。**

---

## 2. 第一步：把代码推到 GitHub

本地仓库已经初始化并完成了首次提交，你现在只差一个远程地址。

### 2.1 在 GitHub 建仓库

1. 打开 <https://github.com/new>
2. **Repository name** 填 `memorize-word`
3. **Visibility** 选 **Private**（强烈建议：虽然代码里没有密钥，但词库和文档没必要公开）
4. **不要**勾选 "Add a README file"、"Add .gitignore"、"Choose a license"——勾了会产生冲突性的首次提交
5. 点 **Create repository**

### 2.2 在本地关联并推送

在项目根目录执行（把 `<你的用户名>` 换成实际账号）：

```bash
git remote add origin https://github.com/<你的用户名>/memorize-word.git
git branch -M main
git push -u origin main
```

如果弹出登录框，用 **Personal Access Token** 当密码（GitHub 已不支持账号密码直接推送）：
GitHub → 右上头像 → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token，勾选 `repo` 即可。

### 2.3 推送后务必自查一次

这是最重要的一步，确认没有把密钥推上去：

```bash
# 应该只能看到源码、配置、文档、词库，不应出现 .env / node_modules / .workbuddy
git ls-files | grep -E "^\.env$|node_modules|\.workbuddy|server_run\.log"
# 上面这条命令应该没有任何输出，有输出说明忽略了，立刻处理
```

再确认整体体积正常（应在 11~12 MB 量级）：

```bash
git ls-files -z | xargs -0 du -ch | tail -1
```

---

## 3. 第二步：在 Neon 建数据库

Neon 是 Serverless PostgreSQL，免费额度对本项目完全够用（单用户，数据量 KB~MB 级）。

### 3.1 创建项目

1. 打开 <https://neon.com>，用 GitHub 账号登录最省事
2. **Create project**
3. **Project name**：`memorize-word`
4. **Postgres version**：默认即可（16 或 17）
5. **Region**：⭐ **选 `Asia Pacific (Singapore)` / `ap-southeast-1`**
   > 原因：Vercel 的 Serverless 函数我们配置在新加坡（`sin1`）。数据库和函数同区，一次 SQL 往返只要 1~3 ms；跨区（比如库在美国）每次查询 150~250 ms，同步会明显发涩。
   > 如果你更希望函数在香港/日本，就把 Neon 建在对应区域，然后同步修改 `vercel.json` 的 `regions`。
6. 点 **Create**

### 3.2 拿到连接串（关键：要用 Pooled）

创建完成后，页面上会给你一个 **Connect** 按钮 / Connection string 面板。你会看到两种连接串，**必须用带 `-pooler` 的那个**：

```
✅ 池化（Pooled）—— 用这个
postgresql://neondb_owner:xxxx@ep-cool-name-123456-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require

❌ 直连（Direct）—— 不要用在 Vercel 上
postgresql://neondb_owner:xxxx@ep-cool-name-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

为什么必须池化：
Vercel 的每个 Serverless 实例都会各自建连接池（本项目代码里 `max: 2`）。流量一上来实例数会横向扩，直连模式下很容易把 Neon 的连接数上限打满，表现为随机 `too many connections`。Pooled 连接串走 Neon 自带的 PgBouncer，会把大量短连接复用掉。

两条硬性要求：
- 连接串末尾**保留 `?sslmode=require`**，去掉会连不上
- 密码里如果出现 `@`、`#`、`/` 等特殊字符，需要 URL 编码（Neon 面板给的是已编码好的，直接复制即可）

### 3.3 不用手动建表

服务端第一次被访问时会自动执行 `CREATE TABLE IF NOT EXISTS`，把两张表建好：

| 表 | 作用 | 说明 |
|---|---|---|
| `user_ai_configs` | 存 AI 服务商配置，API Key 用 AES-256-GCM 加密 | 单行 `global_default` |
| `app_universal_sync` | 存学习进度、日志、生词本、设置 | 单行 JSONB（`namespace='memorize_word'`） |

如果你更喜欢手动建（比如公司环境禁 DDL），可以在 Neon 的 SQL Editor 里跑：

```sql
CREATE TABLE IF NOT EXISTS user_ai_configs (
  id VARCHAR(64) PRIMARY KEY,
  active_provider VARCHAR(32) NOT NULL DEFAULT 'gemini',
  gemini_api_key TEXT,
  gemini_model VARCHAR(64) DEFAULT 'gemini-3.8-flash',
  deepseek_api_key TEXT,
  deepseek_model VARCHAR(64) DEFAULT 'deepseek-chat',
  openai_api_key TEXT,
  openai_model VARCHAR(64) DEFAULT 'gpt-4o-mini',
  custom_base_url TEXT,
  custom_api_key TEXT,
  custom_model VARCHAR(64) DEFAULT 'gpt-4o-mini',
  updated_at BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_universal_sync (
  namespace VARCHAR(64) NOT NULL DEFAULT 'memorize_word',
  owner_id VARCHAR(64) NOT NULL DEFAULT 'default_owner',
  sync_version BIGINT NOT NULL DEFAULT 1,
  state_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  PRIMARY KEY (namespace, owner_id)
);
```

> 单用户场景下这个设计是"整包 JSON"：一次同步 = 读/写一行。数据量到几万词、几十万条日志仍然只有几 MB，完全够。真到需要拆表那天，也是把 `state_data` 里的数组拆成独立表，前端契约不用改。

### 3.4 记下两个东西

- `DATABASE_URL`（池化连接串，第 4 步要用）
- 建议顺手把 Neon 连接串备份到你自己的密码管理器里

---

## 4. 第三步：在 Vercel 部署

### 4.1 导入仓库

1. 打开 <https://vercel.com/new>
2. 首次使用先点 **Continue with GitHub** 授权
3. 在仓库列表里找到 `memorize-word`，点 **Import**
   > 如果列表里没有，点 **Adjust GitHub App Permissions**，把该仓库授权给 Vercel

### 4.2 构建配置（一般不用改）

Vercel 读到 `vercel.json` 和 `package.json` 后会自动填好：

| 项 | 值 | 说明 |
|---|---|---|
| Framework Preset | **Vite** | 自动识别 |
| Build Command | `npm run build` | 只跑 `vite build`，不打包服务端 |
| Output Directory | `dist` | 前端产物 |
| Install Command | `npm install` | |
| Root Directory | `./` | 不要改 |

> 如果页面上这几项和上表不一致，手动改成上表的值。**不要**把 Build Command 改成 `tsc && vite build`——`tsc --noEmit` 只是类型检查，不影响产物，但会让构建多花时间。

### 4.3 环境变量（部署能否成功的关键）

展开 **Environment Variables**，按顺序添加。四个必填项，其余按需：

| 变量名 | 必填 | 说明 | 示例 |
|---|---|---|---|
| `ACCESS_PASSWORD` | ✅ | 进入 App 的全局密码。用 12 位以上、含大小写+数字。**改它会让所有已登录设备重新登录** | `Mw-2026#kR7pQz` |
| `DATABASE_URL` | ✅ | 3.2 拿到的**池化**连接串 | `postgresql://neondb_owner:...@ep-xxx-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require` |
| `AI_CONFIG_ENCRYPTION_KEY` | ✅ | 加密数据库里 AI Key 的密钥。**必须固定**：换了以后库里已存的 Key 全部解不开，要去设置页重新填 | 见下方生成命令 |
| `GEMINI_API_KEY` | ⬜ | 也可以不填，登录后在「设置 → AI」界面里填（同样会加密入库） | `AIza...` |
| `OPENAI_API_KEY` | ⬜ | 同上 | `sk-...` |
| `DEEPSEEK_API_KEY` | ⬜ | 同上 | `sk-...` |
| `WEBDAV_SERVER_URL` | ⬜ | 配了以后，所有设备登录时自动带出网盘地址与账号 | `https://dav.jianguoyun.com/dav/` |
| `WEBDAV_USERNAME` | ⬜ | 网盘账号 | `you@example.com` |
| `WEBDAV_PASSWORD` | ⬜ | 网盘**应用授权密码**（不是登录密码） | |
| `WEBDAV_REMOTE_PATH` | ⬜ | 备份文件路径 | `/MemorizeWord/backup.json` |
| `APP_URL` | ⬜ | 你的正式域名，用于生成自检链接 | `https://mw.example.com` |

生成加密密钥（在你本地终端跑一条即可，**生成一次就固定下来**）：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

生成后请存进密码管理器。它一旦丢失，无法恢复已加密的 AI Key（但学习数据不受影响，因为学习数据不加密）。

> 每个变量都有 **Production / Preview / Development** 三个环境开关。全部勾 **Production**；如果你也想在 Preview 部署里测试，再勾 Preview。三者值不同会导致"线上正常、预览 401"，排查时先想到这一点。

### 4.4 函数区域（很重要，影响同步速度）

`vercel.json` 里已经写好函数时限：

```json
"functions": {
  "api/[...path].ts": { "maxDuration": 60 },
  "api/router.ts": { "maxDuration": 60 }
}
```

函数 CPU / 内存使用 Vercel 项目设置；启用 Fluid Compute 时不要在 `vercel.json` 单独设置函数内存。

但**函数区域不在 vercel.json 里配，而在项目设置里配**：

1. 项目 → **Settings** → **Functions** → **Function Region**
2. 选 **Singapore (sin1)** —— 与第 3 步的 Neon 区域保持一致
3. 保存

> 如果 Vercel 界面里没有这一项（不同套餐/时期 UI 略有差异），也可以在项目 Settings → General → Region 里改。原则只有一条：**函数区域 = 数据库区域**。
> 默认区域是美国东部 `iad1`，国内访问每次请求都要绕一圈，同步会明显变慢。

### 4.5 部署

点 **Deploy**，等 1~2 分钟。成功后你会拿到一个 `https://<项目名>.vercel.app` 的地址。

### 4.6 自定义域名（可选但推荐）

`*.vercel.app` 在国内访问经常不稳定，甚至被墙。长期用建议：

1. 项目 → **Settings** → **Domains** → Add
2. 填你的域名（如 `mw.example.com`），按提示在域名商处加 CNAME 记录指向 `cname.vercel-dns.com`
3. 证书 Vercel 自动签发

---

## 5. 第四步：验证清单（逐条打勾，别跳过）

### 5.1 接口连通性

浏览器直接打开：

```
https://<你的域名>/api/auth/status
```

期望返回：

```json
{"authenticated":false,"requiresPassword":true,"isProduction":true,"webdavConfigured":false}
```

- 返回 **500 / 502 / FUNCTION_INVOCATION_FAILED** → 去看项目 **Deployments → 最新一次 → Functions 日志**
- 返回 **404** → 检查最新部署是否包含 `api/[...path].ts`、`api/router.ts` 和 `vercel.json` 中的 API rewrite；单层路径如 `/api/login`、`/api/logout` 与多层路径如 `/api/auth/status` 都应由 `api/router.ts` 处理

### 5.2 数据库真的连上了

登录后（输入 `ACCESS_PASSWORD`），进「设置 → 同步」，看云端状态。

或者直接在浏览器打开（需已登录，带着 Cookie）：

```
https://<你的域名>/api/sync/state
```

- 返回 `{"exists":false,...}` → 说明**数据库连通**，只是还没有云端记录，正常
- 返回 `503 DATABASE_NOT_CONFIGURED` → `DATABASE_URL` 没生效，见 6.1

### 5.3 端到端同步（真正要验的）

1. 电脑上背 5 个词，等 20 秒（同步有防抖）
2. 手机上打开同一域名，输入同一个密码
3. 首页「已学」数字应与电脑一致
4. 反过来在手机上背 3 个，电脑刷新（或切后台再切回）应看到 +3

若手机显示 0：先确认电脑端「设置 → 同步」里显示已推送，再检查两端的 `DATABASE_URL` 是否指向同一个库。

### 5.4 AI 对话

进「AI 实战」，随便发一句。若报错：

- `未配置 AI Key` → 去「设置 → AI」填 Key，或检查 `GEMINI_API_KEY` 是否注入
- `解密失败` / `临时会话密钥` 警告 → `AI_CONFIG_ENCRYPTION_KEY` 缺失或被改动过

### 5.5 WebDAV 备份（可选）

「设置 → 同步 → WebDAV」，若配了 `WEBDAV_*` 环境变量，应显示为已预设、无需手输账号。点「测试连接」应返回成功并列出备份文件。

---

## 6. 出问题先看这张表

| 现象 | 真实原因 | 处理 |
|---|---|---|
| `503 DATABASE_NOT_CONFIGURED` | 环境变量里没有 `DATABASE_URL`，或加到了 Preview 而不是 Production | Settings → Environment Variables 检查环境勾选，然后 **Redeploy** |
| 改了环境变量但线上没变化 | Vercel 环境变量只在**部署时**注入 | Deployments → 最新 → 右上 `⋯` → **Redeploy** |
| `500 SYNC_WRITE_ERROR` | 连接串错、密码特殊字符未编码、Neon 项目被暂停 | 用 `psql` 或 Neon SQL Editor 直连验证；Neon 免费项目长期无访问会挂起，首次请求会自动唤醒（慢几秒） |
| 随机 `too many connections` | 用了直连串而非池化串 | 换成带 `-pooler` 的连接串 |
| 登录成功，一刷新又要登录 | 自定义域名下 Cookie 的 Secure 属性判定异常，或访问的是 `http://` | 必须走 `https://`；`api/auth/login` 依据 `x-forwarded-proto` 判定，Vercel 会自动带 |
| `FUNCTION_INVOCATION_TIMEOUT` | AI 请求超过 60 秒 | 换更快的模型；`vercel.json` 的 `maxDuration` 在 Hobby 套餐最高 60 |
| 页面能开但所有接口 404 | `api/` 目录没被识别 | 确认文件名是 `[...path].ts`（方括号），且 `vercel.json` 未被改坏 |
| 页面白屏 | `dist` 产物缺失 | 看构建日志是否 `vite build` 失败；本地 `npm run build` 应无报错 |
| 上传大文件/大备份报 413 | Vercel 请求体上限 **4.5 MB** | 本项目同步包是几十 KB 量级，正常不会触发；若手动导入超大词库请走静态文件 |
| AI 回复被截断 | 同上，或模型侧超时 | 缩短提问、换模型 |

**看日志的正确位置**：项目 → **Deployments** → 点最新一次 → **Functions** 标签 → 查看 `api/[...path]` 或 `api/router`。`console.error` 的内容都在这里。

---

## 7. 日常更新流程

```bash
# 改完代码
git add -A
git commit -m "描述这次改了什么"
git push
```

推上去后 Vercel 会自动构建并部署，1~2 分钟生效，旧版本保留可随时回滚。

**发布新版本后，手机端要硬刷新**（Safari 清后台重进 / Chrome 下拉刷新），否则还在跑旧 JS。

### 回滚

项目 → **Deployments** → 找到上一个正常版本 → `⋯` → **Promote to Production**。
注意：如果那次部署之后你**改过数据库表结构**，回滚代码可能不兼容新数据。本项目 `state_data` 是 JSONB，加字段是向后兼容的，一般安全。

---

## 8. 成本与配额（截至当前版本，实际以官网为准）

| 项 | 免费额度 | 本项目的实际消耗 |
|---|---|---|
| Vercel Hobby 带宽 | 100 GB/月 | 词库 10.6 MB，首次加载后浏览器缓存；个人用每月几百 MB |
| Vercel 函数调用 | 100 GB-Hours | 每次同步几十毫秒，AI 请求几秒，个人用远不到 1% |
| Neon Free 存储 | 0.5 GB | 学习数据 + 日志，个人一年也就几 MB |
| Neon Free 计算 | 约 190 小时/月 | 每次请求毫秒级，且有自动挂起，用得极少 |

结论：**个人自用永久免费**。唯一需要留意的是 Neon 免费项目长时间无访问会挂起，下一次请求会冷启动慢 2~5 秒，属正常。

---

## 9. 安全清单（部署完对着核一遍）

- [ ] GitHub 仓库是 **Private**
- [ ] `git ls-files | grep -E "\.env$|node_modules|\.workbuddy"` 无输出
- [ ] `ACCESS_PASSWORD` ≥ 12 位，不是生日/手机号
- [ ] `AI_CONFIG_ENCRYPTION_KEY` 已存进密码管理器，且不会随手更换
- [ ] 站点走 `https://`（Vercel 默认给证书，别用 http 访问）
- [ ] 开启 GitHub 与 Vercel 的 **2FA**
- [ ] Neon 的 `neondb_owner` 密码没有出现在任何文档、截图、聊天记录里
- [ ] 知道「退出所有设备」的方法：改 `ACCESS_PASSWORD` → Redeploy

---

## 10. 部署结构备忘（给未来的你）

| 问题 | 答案 |
|---|---|
| 为什么有 `api/router.ts`？ | Vercel 将单层和嵌套 API rewrite 到共享函数；入口从 `__vercel_api_path` 还原 `/api/...`，再交给 Express。 |
| 为什么 import 写 `'../server.js'`？ | `package.json` 是 `"type": "module"`，产物是 ESM，Node 要求 import 带扩展名；运行时文件是编译后的 `server.js`，TS 编译期会自动映射回 `server.ts` 做类型检查。 |
| 为什么本地 `npm run dev` 和线上行为一致？ | 两边跑的是同一份 `server.ts`。本地走 Vite 中间件渲染，线上 `server.ts` 检测到 `process.env.VERCEL` 就不 `listen`，把 `app` 交给 Vercel 调用。 |
| 为什么词库不放进数据库？ | 27,734 条 JSON 由 CDN 发，命中缓存几乎零成本；进数据库反而每次都要查、要序列化，还占额度。 |
| 加新词库怎么上线？ | 往 `public/data/decks/` 放 JSON 并在 `public/data/decks.json` 注册，`git push`。前端按需加载，不需要数据库参与。 |

---

## 附：相关文档

- [`同步功能使用说明.md`](./同步功能使用说明.md) —— 同步功能怎么用、有哪些开关
- [`同步功能技术实现文档.md`](./同步功能技术实现文档.md) —— 合并算法、冲突处理、表结构设计
- [`响应式适配方案.md`](./响应式适配方案.md) —— 手机/桌面布局的技术取舍
- [`UI诊断与改造方案.md`](./UI诊断与改造方案.md) —— 这轮 UI 重构的根因分析与方案对比

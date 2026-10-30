/**
 * Vercel Serverless 入口（catch-all）。
 *
 * 为什么文件名是 [...path] 而不是 index：
 *   - 用 `api/index.ts` 时，所有 /api/* 请求会被重写到 /api，
 *     Express 拿到的 req.url 已经不是原始路径，/api/sync/state 这类路由会 404。
 *   - 用 catch-all 动态路由，Vercel 按文件系统匹配 /api/任意层级，
 *     req.url 保留原始路径，Express 内部的完整路由表可以直接生效。
 *
 * 为什么是 '../server.js' 而不是 '../server' 或 '../server.ts'：
 *   package.json 声明了 "type": "module"，构建产物是 ESM。
 *   Node 的 ESM 要求 import 必须带扩展名；而运行时文件是编译后的 server.js。
 *   TypeScript 在 moduleResolution: bundler 下会把 .js 映射回 server.ts 做类型检查。
 *
 * 本地开发不走这里：`npm run dev` 直接运行 server.ts，用 Vite 中间件渲染前端。
 */
import app from '../server.js';

export default app;

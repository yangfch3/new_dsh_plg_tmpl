# .new_dsh_plg_tmpl — dsh 树外插件开发模板

复制本目录后交给 AI 开发新插件，可快速、少踩坑。沉淀自 dsh-mcp-mgr 实战（含一次完整踩坑→修复循环）。

## 结构

```
.new_dsh_plg_tmpl/
├── skeleton/                     ← 可构建的最小插件骨架（复制即用）
│   ├── tsconfig.host.json         workspace root marker + protocol paths
│   ├── gen.mjs                    Typert 产物生成（自动发现 host 包）
│   ├── packages/
│   │   ├── platform.ts / tsdown.client.ts   client 构建基础设施（复刻自 dsh）
│   │   ├── dsh-hello-plugin/      host 插件骨架（Config + 示例 Remote 服务 + cordis.patch.yml bundle 声明）
│   │   ├── dsh-hello-plugin-ui/   UI 插件骨架（settings tab + Remote 消费）
│   │   └── vendor-typert-protocol/  ⚠️ 必需：Typert 分析只认 workspace 内符号
│   └── scripts/install.mjs / uninstall.mjs   本地安装/卸载（幂等，含构建产物预检）
└── docs/
    ├── core-knowledge.md          最小必要知识：架构/插件/Typert/cordis 服务
    ├── pitfalls.md                实测踩坑合集（按频率排序）
    └── best-practices.md          开发顺序/验证清单/快速恢复
```

## 使用步骤

1. `cp -R .new_dsh_plg_tmpl/skeleton <新插件目录>`（或直接复制整个模板）
2. 全局替换骨架占位名：`dsh-hello-plugin` → 你的包名、`hello` → 你的 Remote namespace、`Hello` → 类名
3. `gen.mjs` 顶部替换 dsh checkout 绝对路径
4. 按需增删包（不需要 UI 就删 `-ui` 包；不需要 Remote 就删 `./typert`/`./remote` 导出与 gateway）
5. 建 node_modules 链接（见 core-knowledge "构建链"；首次需把 `@deepseek-ai/*` 依赖链接进根 node_modules）
6. 开发：先纯函数核心 + verify，再接 Remote + UI
7. 交付前跑完 best-practices 的验证清单，`install.mjs` → `--dump-config` 预检 → 重启

## 关键纪律（违反必踩坑，详见 docs/pitfalls.md）

- ❌ 不写 `export default`（loader unwrap 会剥离 Config）
- ❌ Remote 方法不叫 `remove`/`has`/`empty` 等保留名
- ❌ 不 inject 自己 mount 的服务（死锁）——用 `ctx.get`
- ❌ 改 wire 字段（`types.ts`）后不重跑 `gen.mjs` + UI bundle——严格 codec 会静默剥离未知字段
- ❌ tsconfig 不 extends 仓库 base
- ✅ 可选服务用 `ctx.get`；`super(ctx, 'key')` 用字面量；改链接后清 tsbuildinfo
- ✅ scoped context 里查注册/工具列表用 `scopeOf(ctx)` 视图，别用全局视图
- ✅ 发布走 npm：host 包 `dsh.bundle.patch` + UI 包放 host dependencies（见 docs/best-practices "发布形态"）

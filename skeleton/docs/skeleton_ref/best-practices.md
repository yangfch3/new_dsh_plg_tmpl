# dsh 插件开发：最佳实践

## 开发顺序（从快到慢反馈）

1. **纯函数核心先行**：解析/状态/生命周期写成无 ctx 依赖的模块（如 `parse.ts`/`sync.ts`），用 `verify.mjs` 的 fake 注入直接测——不启动 dsh 也能覆盖 80% 逻辑
2. **host 插件 + Remote**：tsc → gen.mjs → 用真实 cordis ctx + Typert registry 验证产物可挂载（`verify.mjs`）
3. **端到端**：真实依赖 + 真实服务（如真 MCP server）跑通（`e2e/`）
4. **UI 最后**：Remote 通道稳定后再写 tab

## 本地安装/卸载机制（已内置 scripts/）

- `install.mjs`：自动发现 `packages/` 下包 → symlink 进 `$DSH_HOME/profiles/node_modules` + patch insert（**幂等**，文本块增删，不碰用户其他 patch）
- `uninstall.mjs`：删 symlink + 精确移除 patch 行（只剩自己的行时恢复模板 `[]`）
- 安装后**必做预检**：`pnpm dsh --profile web --dump-config`（组合树应含新行；不启动即可发现 patch 语法/解析错误）

## 快速启用 / 出错恢复

```
改动 → 重建 → 装/更新 → 预检 → 重启
```

| 场景 | 恢复动作 |
|---|---|
| 启动即崩（插件加载失败） | 看报错栈（loader 会把插件名+原因打出）→ 修 → 重建 → 重启；**等不及可先 `uninstall.mjs` 恢复** |
| UI 行为异常 | **F12 console** 是最快定位（client 侧错误只在浏览器） |
| 改了 client bundle | 刷新浏览器即可（无需重启 host） |
| 改了 patch / package.json / host 代码 | 必须重启 dsh web |
| 怀疑缓存 | 删 `packages/*/tsconfig.tsbuildinfo` + `lib` 全量重建 |

## 验证清单（每轮交付前）

- [ ] `verify.mjs` 全绿（解析/状态机/产物形状/registry 挂载）
- [ ] e2e 真实链路 PASS
- [ ] loader 路径回归（`import → unwrapExports → ctx.plugin(plugin, undefined)`——捕获 Config 剥离类问题）
- [ ] `--dump-config` 组合树含新行
- [ ] **codec 新鲜度**：改过 `types.ts`（wire 字段）→ 确认 `gen.mjs` + UI bundle 重打过，且 UI 端真能收到新字段（pitfalls #11）
- [ ] UI 错误态显示具体错误信息（不要把异常吞成通用文案——排障靠它）

## 发布形态（npm bundle）

开发期用 `install.mjs` 本地装即可；对外发布走 npm：

- host 包 manifest 加 `dsh.bundle.patch` 指向仓库内 `cordis.patch.yml`（bundle 层声明，随包分发），`files` 白名单收进产物 + patch
- **UI 包作为 host 包的 dependency**（如 `dependencies: { "dsh-xxx-ui": ">=0.1.0" }`），随 host 一起装，避免用户单独装 UI
- 用户侧安装：`npx @deepseek-ai/dsh plugin --profile web add <host包名>@latest <host包名>-ui@latest`（内部走 `dsh.bundle.patch` 插入 bundle 行）
- `cordis.patch.yml` 里两行：host + UI 的 loader 行（id 去 `dsh-` 前缀）

## 排障三问（按顺序）

1. **是 host 还是 client 的问题**？host 错 → 终端日志；client 错 → 浏览器 console
2. **是配置还是代码**？先 `--dump-config` 看组合树（配置层），再怀疑代码
3. **是不是老产物**？确认构建链跑全（tsc → gen → tsdown），tsbuildinfo 清了

## 命名与结构约定

- host 包 `dsh-<name>`，UI 包 `dsh-<name>-ui`（patch id = 去 `dsh-` 前缀）
- Remote 方法名避开保留名（pitfalls #3）；服务 key 用字面量
- 所有"可调值"进 Config schema（dsh 硬性规范）

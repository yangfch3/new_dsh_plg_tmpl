# dsh 插件开发：核心知识（最小必要集）

## 架构三件套

```
$DSH_HOME/profiles/<name>/     profile：可启动组合
  ├── package.json             dsh.profile.bundles（bundle 清单）
  ├── cordis.yml               组合根（空列表，勿手改）
  └── cordis.patch.yml         用户 patch 层 ← 插件从这里 insert 行
$DSH_HOME/profiles/node_modules/   跨 profile 扁平 fallback 解析目录（out-of-tree 插件放这）
$DSH_HOME/cordis.patch.yml     home 级（所有 profile 共享）
```

**配置组合顺序**（后层覆盖前层）：bundle patches → profile patch → home patch → `--patch` overlays。

## 插件本质

- 插件 = 导出 `apply(ctx, config)` 的模块（函数/对象/类三形式）；loader 按配置行 `- id / name / config` 加载
- `inject` 声明服务依赖（框架等待）；`ctx.effect` 注册的资源自动随卸载清理
- **模块加载**：`unwrapExports` 取 `exports.default ?? exports` → **别写 default 导出**
- **config schema**：`Config` 接口 + `Schema`（schemastery）同名导出；可调值必须进 schema

## 两类插件包

| 类型 | 用途 | 结构 |
|---|---|---|
| host 插件 | 业务逻辑 / 服务 / Remote | `exports .` 指向编译产物 |
| client 插件（UI） | 浏览器端（settings tab 等） | `dsh.client` manifest + `exports ./client` 指向 bundle |

client 插件加载链：profile patch 行 → client-modules 扫描 `dsh.client` → `window.__DSH_BOOT__` → 浏览器经 `/plugins/<id>/client.js` 拉取。

## Typert Remote（host ↔ UI 通信通道）

```
host 包：
  class XxxGateway extends TypertRemoteService { super(ctx, 'ns')  // 字面量
    @Remote('method') method() {...} }
  → 生成 lib/typert.host.js + lib/typert.remote-client.js（exports ./typert + ./remote）

client 包：
  await ctx.remote.$mount(TYPERT_REMOTE)   // apply 内 await，先于 slots 注册
  ctx.get('remote.ns')                      // 自 mount 的服务用 get 读（勿 inject）
```

- host 分发：gateway 按 namespace 找 ctx 服务 + `remoteMethods` 反射（或 typert-loader 注册的 strict 定义）
- **方法名避开 `RemoteNamespaceService` 保留名**（见 pitfalls #3）
- client 侧 `ctx.remote.ns.method` 经 traceable 转发为 `ctx['remote.ns']`（受 inject 守卫）

## cordis 服务访问三条路

| 方式 | 语义 |
|---|---|
| `inject: ['svc']` + `ctx.svc` | 必需依赖，框架等待；属性访问受守卫（未注入即抛） |
| `ctx.get('svc')` | 显式查询，未提供返回 undefined，**不受守卫**（可选服务用） |
| 不声明直接 `ctx.svc` | ❌ 抛 "cannot get property without inject" |

## 构建链（本模板）

```
tsc -p packages/<pkg>          # 编译 host 包（lib/types + d.ts）
node gen.mjs                   # Typert 产物（typert.host/remote-client）
tsc -p packages/<pkg>-ui       # 编译 client 包
tsdown --config-loader tsx --env.DSH_BUILD_FACE client   # client bundle（ui 包目录）
```

- host 包产物 = tsc 输出（exports `.` 指向 `lib/types/index.js`）
- client bundle = `__ModuleLoader__.load` closure；platform 模块（react 等）external，其余 inline
- gen.mjs 需 dsh checkout 的 generator（`packages/typert/generator/lib`）或发布版依赖

### 依赖解析（peerDependencies + 手动链接）

- host/ui 的 `@deepseek-ai/*` 都是 **peerDependencies**（运行期由 dsh 提供，不随包安装），开发期靠**手动链接**进根 `node_modules/@deepseek-ai/` 才能被 tsc/tsdown 解析：`ln -s <dsh checkout>/packages/<pkg> node_modules/@deepseek-ai/<name>`（或首次用脚本批量建）
- 链接名 = 包名去 `@deepseek-ai/` 前缀（`@deepseek-ai/dsh-scope` → `dsh-scope`）
- host ↔ ui 包互相依赖（host `dependencies` 带 ui；ui `peerDependencies` 带 host）——复制骨架后两个包名要一起替换
- 改链接后**删 `packages/*/tsconfig.tsbuildinfo`** 全量重建（增量缓存会残留旧解析身份）

## 作用域（scoped Context）

- web 宿主把插件跑在 **scoped context**（`createScope(root, 'web-host')`）里：工具/服务注册在 scope 层，agent 子 scope 继承可见
- **查询注册状态/工具列表要用 scope 视图**：`tools.schemas(scopeOf(ctx))`；从 gateway 自身 ctx 的全局视图查会 miss（见 pitfalls #12）
- `scopeOf(ctx)` 读最近 scope 标签；插件通常只需这一个函数 → stub 只声明它，保持 Typert 分析 program 最小

## 安装与生效

```
node scripts/install.mjs       # symlink → profiles/node_modules + patch insert 两行
pnpm dsh --profile web --dump-config   # 预检组合（不启动）
pnpm dsh web                   # 启动（patch/声明变更必须重启；bundle 变更刷新即可）
node scripts/uninstall.mjs     # 回滚
```

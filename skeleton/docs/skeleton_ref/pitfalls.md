# dsh 插件开发：常见坑（实测踩坑合集）

按踩坑频率排序。每条 = 症状 → 根因 → 正确做法。

## 1. 启动即崩：`cannot get property "xxx" without inject`

- **症状**：插件 apply 里访问未声明服务 → 抛错 → dsh 启动失败
- **根因**：cordis 的 Context 是 Proxy，未 `inject` 的服务**属性访问直接抛错**（不是 undefined）
- **正确做法**：
  - 必需服务 → 加进 `inject`（框架等待就绪）
  - 可选服务（如 web-only 的 `workspaceRegistry`）→ **`ctx.get(name)`**（未提供返回 undefined，不抛；官方先例：agent-instructions 对 `ctx.fs`）

## 2. 启动即崩：`Cannot read properties of undefined (reading '<config字段>')`

- **症状**：apply 的 config 参数是 undefined
- **根因**：loader 的 `unwrapExports`（vendor/loader/src/index.ts）执行 `exports.default ?? exports` —— **有 default 导出时取 default**，模块命名空间上的 `Config` schema 被剥离
- **正确做法**：**不要 `export default`**。命名导出 `name` / `apply` / `Config`，loader 拿到整个命名空间 = cordis 对象形式插件

## 3. 启动即崩：`method "xxx/remove" conflicts with its namespace service`

- **症状**：client 挂载 Remote contribution 时抛错，连带整个 loader 失败
- **根因**：Remote 方法名与 `RemoteNamespaceService` 保留名冲突（`packages/api/gateway/src/client/index.ts`）：`ctx / empty / invokeRemote / methods / name / namespace` + prototype 方法（`remove / has / installDirect / installScoped / assertMethodAvailable`…）
- **正确做法**：Remote 方法名避开上述名字（如 `removeServer`）

## 4. 插件永不激活：`pending (waiting for service: remote.xxx)`

- **症状**：UI 插件 boot 时 pending 死锁
- **根因**：inject 了**自己 mount 的服务**（`$mount` 在 apply 里才创建 `remote.xxx`）→ 等待自己 → 死锁
- **正确做法**：
  - 别人提供的 namespace 服务（如 api-remotes 装的 `remote.pluginInventory`）→ 可 inject `'remote.pluginInventory'`
  - **自己 mount 的** → 不 inject，用 `ctx.get('remote.xxx')` 读取

## 5. UI 报错：`cannot get property "remote.mcpMgr" without inject`

- **症状**：tab 出现但读数据失败，错误为完整键名
- **根因**：`ctx.remote.mcpMgr` 的访问经 cordis traceable 机制**转发为 `ctx['remote.mcpMgr']`**（utils.ts createTraceable），受 inject 守卫
- **正确做法**：服务已提供（mount 完成）后属性访问可通；但自 mount 场景统一用 `ctx.get`（见 #4）

## 6. Typert 生成失败：`Gateway service key must be a string literal`

- **根因**：`super(ctx, SOME_CONST)` —— 分析器要求字面量
- **正确做法**：`super(ctx, 'mcpMgr')` 直接写字面量

## 7. 依赖 dsh 包时：Tspert 分析把仓库 d.ts 拉进 program 报错

- **症状**：`TypertLookupMap values must be TypertLookup<Host, Wire>` 等跨包声明检查失败（错误定位在**仓库** d.ts）
- **根因**：import 的 dsh 包（如 mcp-client）d.ts 链里有 `declare module '@deepseek-ai/dsh-typert-protocol'` 等增强，其符号解析到仓库（workspace 外）→ `registrationForFile` 不认
- **正确做法**：**stub 类型隔离**——`tsconfig paths` 把该包映射到本地 stub.d.ts（运行时 import 不变，Node 解析真实包）；或确保依赖链不携带此类 d.ts

## 8. `@Remote` 装饰器不被识别（生成产物空）

- **症状**：`generate()` 返回空 / `discover` 有包但 `generate` 空
- **根因**：`isTypeMetaSymbol` 只认 **workspace 内 registration** 的符号——`Remote`/`TypertRemoteService` 必须来自**本仓库 packages/ 下的包**（vendor 化）
- **正确做法**：vendor 一份 `@deepseek-ai/dsh-typert-protocol` 源码到 `packages/vendor-typert-protocol/`（协议包无运行时依赖，复制 src 即可）；**删掉其 types.ts 里的 `declare module` 块**（避免 TS2717 冲突 + 被误判 surface）

## 9. 依赖解析身份分裂（两个 protocol 模块实例）

- **症状**：client 编译时 `mcpMgr` 类型不存在 / declare module 合并无效
- **根因**：同一 specifier 经不同 node_modules 链接解析成两个身份（vendor vs 仓库包）
- **正确做法**：**host 分析/编译走 vendor（tsconfig paths）**；**client 编译走仓库包身份（根 node_modules 链接指向仓库）**；改完链接后**删 tsbuildinfo 全量重建**（增量缓存会残留旧身份）

## 10. 构建/安装杂项

- **tsconfig 不要 extends 仓库 base**：其 paths 把 `@deepseek-ai/*` 映射回仓库源码 → TS6059 / 身份分裂。自写最小 compilerOptions
- **tsconfig `paths` 无 `baseUrl` 时按 cwd 解析**（TS5 行为，TS6 又弃用 baseUrl）→ 包级 tsconfig **不要用 paths**，依赖根 node_modules 链接；分析器专用的 paths 只放根 `tsconfig.host.json`（gen.mjs 固定从根目录跑）
- **node_modules 链接名** = 包名去 scope 前缀（`@deepseek-ai/dsh-x` → `dsh-x`），放在根 `node_modules/@deepseek-ai/` 下
- **web profile HMR 关闭**：改 patch / package.json 声明 → 必须重启；只改 browser bundle（client.js）→ 刷新浏览器即可
- **`--dump-config` 预检 ≠ 真实启动**：client-modules 的 `dsh.client` manifest 校验只在启动时跑
- **mcp.json（类 Claude 格式）**：http 服务必须显式 `"type": "http"`（缺省按 stdio）
- **mcp-client `cwd: ''`** = host 进程 cwd，不是工作区——stdio server 要显式传 cwd

## 11. 改了 wire 字段 UI 却不更新：typert codec 过期静默剥离未知字段

- **症状**：host 侧已返回新字段（直接读 host 状态能看到），但 UI 永远拿不到——如 `connected` 丢失 → UI 永远显示"已注册"，且只有通过 Remote 返回的数据受影响，直接读 host 状态看不出来
- **根因**：改 `src/types.ts`（wire 字段）后只重跑了 host 的 tsc，**没重跑 `gen.mjs`、没重打 UI bundle**——严格 codec 对未知字段**静默剥离**，不报错
- **正确做法**：改 wire 字段后跑完整构建链 `tsc host → gen.mjs → tsc ui → tsdown`；UI 侧异常先确认新字段真的到达（打印快照/网络面板），别直接怀疑 host 逻辑

## 12. 作用域(scope)内查询 miss：全局视图 ≠ scope 视图

- **症状**：gateway 挂进 scoped context（web 宿主如此）后，探针查不到 scope 层注册的工具——`connected` 恒为 false
- **根因**：工具/服务注册在 scope 层（agent 子 scope 继承可见），但 gateway 从自身 ctx 的**全局视图**查（如 `tools.schemas()`）→ 看不到 scope 层的注册
- **正确做法**：按作用域视图查询——`tools.schemas(scopeOf(ctx))`（`@deepseek-ai/dsh-scope` 只提供 `scopeOf` 读取最近 scope 标签即可，stub 保持最小）；插件在 scoped context 里运行时，任何"注册状态/工具列表"类查询都要显式传 scope

## 13. 状态类 UI：明确"探测状态"语义，刷新 ≠ 重新探测

- **症状**：UI 显示"已连接"但实际调用失败；点"刷新"按钮状态毫无变化
- **根因**：状态是**探针/快照**语义（如"工具已注册"），不是实时网络连通；刷新按钮只拉 host 内存里的最近快照，不触发重新探测
- **正确做法**：UI 把状态语义写清楚（tooltip 说明"已连接 = 已注册，非实时连通"），刷新只承诺刷新快照；真实重连走后台自动重试（指数退避），窗口期内保留旧注册防抖丢工具

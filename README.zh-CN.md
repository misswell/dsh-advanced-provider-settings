# Advanced Provider Settings for DeepSeek Harness（简体中文）

**Advanced Provider Settings** 是一个 **DeepSeek Harness**（DSH）的 WebUI 插件，它把
OpenAI 兼容 Provider 那些原本只能手改 YAML 的配置项，变成看得见、点得到的界面。你不必再编辑
`~/.dsh/settings.yaml`——在每张 Provider 卡片下就会多出 **Provider Settings** 控制面板，覆盖
请求 **Headers**、**User-Agent**、**Retry Policy**、**Timeout** 与传输方式、**Vision** 与图片预算、
**Reasoning** 与思考档位、**Compatibility** 兼容性开关，以及按模型的能力声明。所有写入都走
DeepSeek Harness 自己的、带版本号的 settings 传输通道，因此你的 YAML 会保留注释，而每一个你没有
动过的字段都会原样保留。

> **状态：**`v0.1.0`，已在 DeepSeek Harness `0.1.5-rc.2` 上验证。

---

## 目录

- [为什么需要它](#为什么需要它)
- [可以配置什么](#可以配置什么)
- [安装](#安装)
- [卸载](#卸载)
- [使用方法](#使用方法)
- [三个容易踩的坑](#三个容易踩的坑)
- [兼容性矩阵](#兼容性矩阵)
- [安全设计](#安全设计)
- [开发](#开发)
- [已知问题](#已知问题)
- [许可证](#许可证)

---

## 为什么需要它

DeepSeek Harness 的 Provider schema 设计得相当完整，但「模型」页面只编辑常见字段：Base URL、
凭据、模型列表。剩下的那些字段——决定一个不稳定的网关第三次重试能否成功的、决定企业代理是否
接受你这个客户端的、决定图片过多的 prompt 是否在发出前就被拒的——只存在于 `settings.yaml` 里。

本插件把这些字段呈现出来，同时做到：**不改 Harness 一行源码**、**不 patch `node_modules` 里
任何文件**、**不保存第二份配置**。UI 通过「模型」页面**已声明的扩展槽位**接入，配置读写通过框架
公开的 settings API 操作 `llm-pi-ai` 命名空间。

## 可以配置什么

| 区域 | 内容 |
|---|---|
| **Headers** | Provider 级与全局请求头，带校验、密钥掩码与重名检测。 |
| **User-Agent** | 预设（Chrome、Safari、Firefox、opencode、Codex CLI、Claude CLI）加自由输入，用于做客户端白名单的网关。 |
| **重试策略** | Harness 默认 / 保守 / 激进 三档预设，或完全自定义：模式、最大重试次数、可重试错误码、初始延迟、最大延迟、抖动。 |
| **网络** | 传输方式（`sse`、`websocket`、`websocket-cached`、`auto`）、请求超时、流空闲超时、WebSocket 连接超时、缓存保留策略。 |
| **视觉能力** | 默认输入模态、单请求图片总字节上限、像素预算、单张图片字节上限——用 MiB 等单位而不是原始字节数。 |
| **推理** | 思考档位（`off` … `max`）与各档 token 预算。 |
| **兼容性** | 全部 26 个 `compat` 开关，并按该路由协议**实际会读取的**字段过滤；模型级过滤更严，因为在模型级写错字段在 Harness 里是硬错误。 |
| **模型** | 按模型的输入模态、按模型的 reasoning effort 映射、按模型的兼容性覆盖。 |
| **测试 Provider** | 使用**表单中当前**（无论是否已保存）的 Headers 去请求端点的模型列表——验证白名单 Header 是否生效最快的方法。 |
| **生效配置** | 逐层展示该 Provider 实际会发出什么，敏感值已掩码。 |
| **诊断** | 只读的兼容性报告，可直接粘贴进 issue；以及从已停止维护的 `dsh-custom-provider-settings` 一键导入。 |

## 安装

需要 DeepSeek Harness `0.1.5-rc.2` 或兼容版本，以及 Node.js 20+。

```bash
# 从 GitHub Release 的 tgz 安装
dsh plugin --profile web add https://github.com/misswell/dsh-advanced-provider-settings/releases/download/v0.1.0/dsh-advanced-provider-settings-0.1.0.tgz

# 发布到 npm 后
dsh plugin --profile web add dsh-advanced-provider-settings

# 直接从仓库安装（需要可构建的 git 安装路径，见「已知问题」）
dsh plugin --profile web add github:misswell/dsh-advanced-provider-settings
```

然后重启 Web UI：

```bash
dsh web
```

## 卸载

```bash
dsh plugin --profile web remove dsh-advanced-provider-settings
```

移除包会一并移除界面并注销插件自己的设置命名空间。**你的 Provider 配置不受影响**——高级字段写
在 Harness 自己的 `llm-pi-ai` 命名空间里，本插件从不独占它。若也想清掉本插件设置的字段，请先在
各 Provider 卡片上点「重置全部高级设置」，或手动删除 `~/.dsh/settings.yaml` 中
`providers.<id>` 下的相应键。

## 使用方法

1. 打开 **设置 → 模型**。
2. 展开任意 OpenAI 兼容 Provider 卡片，其下会出现 **Provider 高级设置**。
3. 每个区块的折叠标题上都有状态徽标，一眼就能看出哪些字段被覆盖、哪些仍在继承 Harness 默认值。
4. 修改后点 **保存**。改动会以「路径操作 + 你所读到的命名空间版本号」的方式写入，并发修改会被拒绝
   而不是被静默覆盖。
5. **全局 Headers** 与诊断在独立页面：**设置 → Provider 高级设置**。

## 三个容易踩的坑

以下都是 DeepSeek Harness `0.1.5-rc.2` 的真实行为。本插件的做法是把它们**显示出来**，而不是藏
起来——每一条都会在相关位置给出提示。

### 1. Provider 级的 `User-Agent` 会被丢弃

Harness 的 pi-ai 适配器会把 Provider profile 里名为 `user-agent` 的 Header 剥掉，然后发送自己的
归属标识（`deepseek-harness/<版本> (+https://github.com/deepseek-ai/deepseek-harness)`）。
`user-agent` 是**唯一**的保留名。

因此本插件在你于 Provider 级设置它时会给出警告，并把 User-Agent 预设放在**全局** Header 列表上
——全局层由本插件自己的传输层包装在 Harness 构造完 Header 之后应用，是唯一能让 User-Agent 真正
生效的地方。

### 2. 自己配的 `authorization` 会顶掉 API Key

在 OpenAI 兼容协议上，你配置的 Header 会覆盖 Harness 解析出的凭据。这偶尔正是你想要的（网关要求
用它自己的 token），但更多时候是个谜题（「我的 key 怎么突然不工作了」）。本插件会在该 Header 旁
给出警告。

### 3. 重试是按 Provider 路由配置的，不是按模型

`retryPolicy` 配在路由上。既没有按模型的重试，也没有全局重试。本插件在「重试策略」区块里直接说明
这一点，而不是让你去找一个并不存在的开关。

## 兼容性矩阵

| DeepSeek Harness | 状态 | 说明 |
|---|---|---|
| `0.1.5-rc.2` | **已验证** | 本版本中每个常量与代码路径都读自该构建，并针对它跑过测试。 |
| 其它 `0.1.5-rc.*` | 预期可用 | 同一 patch 系列内历史上未改动 Provider schema，但未实测。 |
| `0.1.4` 及更早 | 不支持 | 本插件依赖的 `settings.models.provider-card` 扩展槽位与客户端 `settingsScope` 写入 API 尚不存在。 |
| `0.2.x` 及以后 | 未知 | 请看诊断面板：它会报告探测到的 Harness 版本与各能力是否解析成功。 |

对任意一次安装，权威答案都在**诊断面板**：它报告探测到的 Harness 版本、本插件命名空间与
`llm-pi-ai` 命名空间是否可用、是否支持带版本号的写入、Header 桥是否装载成功，以及「模型」页扩展包
是否解析成功。

## 安全设计

- **不修改 Harness 源码。** 本包之外的文件一个都不改，`node_modules` 不做任何 patch。UI 通过
  「模型」页面自行声明的槽位注册接入。
- **不抓 DOM。** 上一代同类插件靠匹配中英文文案和 `aria-label` 找 Provider 卡片。本插件注册进
  `settings.models.provider-card`，由框架把 owner props 交给它，从不读取页面。
- **你的 YAML 保留注释与未知字段。** 写入是有序的路径操作（`{op: 'set'|'unset', path}`），不是整
  文件重写。你没有动过的字段——包括未来 Harness 新增而本插件完全不了解的键——从不会被点名，因此
  永远不会被改。这两点都有测试覆盖。
- **「Harness 默认」= 删除覆盖项。** 选择默认会删掉该键，而不是写入今天的默认值，因此未来 Harness
  改了默认值时你会自动继承，而不是被钉死在旧值上。
- **API Key 绝不进明文设置。** 本插件不读、不写、不显示、不记录任何凭据。它只把凭据**引用**
  （`apiKeyEnv`）当作「模型」页面已有的字段看待——也就是说，它并不碰这个字段。
- **预览里没有密钥。** 生效 Header 预览在 Host 侧就把敏感值掩码后才返回，敏感值没有理由到达浏览器。
- **无动态代码执行。** 源码中不存在 `eval`、`new Function` 与字符串形式的 `setTimeout`，并有 lint
  规则拦截。
- **`fetch` 包装在 LLM 请求之外完全惰性。** 全局 Header 需要一个传输层切入点，而 DSH 并未提供。
  本插件用 `AsyncLocalStorage` 做请求级作用域，并只安装一个带引用计数的 `fetch` 替代实现；没有请求
  在飞行时它原样转发。并发请求之间互不可见——为此有专门的 100 并发测试。
- **同源路由。** Host 侧的 RPC 路由要求：对端为回环地址、Host 为回环、Origin 同源、写入必须为 JSON
  content-type，请求体上限 128 KiB。而且 Host 侧**从不写**设置。

## 开发

```bash
npm install
npm run build        # 打包 lib/index.js + lib/client.js，并输出 lib/types/
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm test             # vitest
npm pack --dry-run   # 打包检查
```

两半都必须**预先构建产物**。DSH 的 `dsh plugin` 只是一个 `pnpm` 转发器、没有构建步骤，而 pnpm 10+
会阻止 git 依赖的 `prepare` 脚本，因此 `lib/index.js` 与 `lib/client.js` 是**提交进仓库的**，由
`npm run build` 重新生成。`.gitattributes` 已把它们标记为生成物以免污染 diff，`prepack` 会在每次发布
打包前重新构建。
客户端产物包在 shell 期望的 `window.__ModuleLoader__.load({ id, factory })` 信封里，其 `require`
只能使用 shell 的静态模块表：

`react`、`react/jsx-runtime`、`react-dom`、`react-dom/client`、`@deepseek-ai/cordis`、
`@deepseek-ai/dsh-client-store`、`@deepseek-ai/dsh-client-ui-slots`、
`@deepseek-ai/dsh-client-ui-primitives`、`@deepseek-ai/dsh-client-ui-dockkit`。

本插件**刻意不** require `dsh-client-locale` 与 `dsh-client-ui-settings`——它们不在该表里。locale
与 settings 是作为 cordis 服务访问的。有测试针对构建产物断言这一点。

### 目录结构

```
src/shared/    读自 Harness schema 的常量、校验、diff、摘要
src/host/      命名空间注册、Header 桥、模型发现、诊断、RPC 路由
src/client/    槽位注册、Provider 卡片面板、设置页、多语言、样式
tests/         单元测试，以及针对构建产物的集成测试
docs/recon/    本实现所依据的源码级调研报告
```

## 已知问题

- **`npm pack` 与 `git` 安装会从源码构建。** 发布用 tgz 中已包含 `lib/`。直接从 git URL 安装需要
  一条可构建的安装路径，而 pnpm 10 的 `allowBuilds` 策略可能拒绝它。请优先使用 Release tgz 或 npm 包。
- **Harness 的 UI 内部结构可能在小版本间变化。** 若将来某个版本重命名槽位或改变其 owner props，
  受影响的接入点会**渲染为空**而不是抛错——但该功能会消失，直到本插件跟进。诊断面板会让这一点可见。
- **协议读不到的「路由级」兼容性字段是提示而非阻断。** Harness 会静默忽略它们；本插件会标出来让
  错误可见，但仍允许你保存。**模型级**的不匹配会被拒绝，因为 Harness 视其为硬错误。
- **少数技术位置保留英文。** 兼容性开关名（`supportsStore`、`thinkingFormat` 等）是标识符，按原样
  显示而不翻译；其说明为英文 tooltip。除此之外的所有界面文案均已本地化（英文与简体中文）。
- **Provider 故障转移不在范围内。** 该能力被明确推迟，本版本不做。
- **`transport: 'auto'` 原样透传。** 本插件不替适配器做选择，也不校验你所选的传输方式是否被端点支持。
- **加载器定位不到的包会被静默跳过。** 如果插件的 `exports` 无法解析，它的浏览器半就永远不会加载——
  没有报错、没有日志、没有任何诊断。本插件同时导出 `exports['.']` 与 `exports['./package.json']`，
  使加载器的两条发现路径都不会漏掉它。如果你 fork 之后 UI 消失而 console 里什么都没有，先查这里。
- **本 Harness 构建中 `dsh.client.immediately` 不起作用。** 加载器会校验并保存该标志，但从不读取它：
  所有声明 `dsh.client` 的包都会进入 application 批次并预加载。声明 `immediately: false` 并不能延后
  任何加载，也没有插件能做到「不加载」。详见 `docs/recon/client-runtime.md`。

## 许可证

[MIT](./LICENSE)

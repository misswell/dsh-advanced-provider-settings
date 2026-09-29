# Advanced Provider Settings for DeepSeek Harness（简体中文）

[English](./README.md) · [简体中文](./README.zh-CN.md)

**Advanced Provider Settings** 是一个 **DeepSeek Harness**（DSH）的 WebUI 插件，它把
OpenAI 兼容 Provider 那些原本只能手改 YAML 的配置项，变成看得见、点得到的界面。你不必再编辑
`~/.dsh/profiles/<profile>/cordis.patch.yml`——在它自己的设置页上、也在每张 Provider 卡片下，都会多出
**Provider 高级设置** 控制面板。面板以**模型**为主角：先选一个模型，单独给它开输入模态、reasoning effort
映射和兼容性开关（若该路由用的是内置目录，还能单独改它的名称、上下文窗口与输出 token 上限）；
其余只能整体生效的东西——请求 **Headers**、**User-Agent**、**Retry Policy**、
**Timeout** 与传输方式、**Vision** 图片预算、**Reasoning** 思考档位、**Compatibility** 路由级开关
——放在 Provider 级的卡片里，并且每一张都写明为什么它不在模型里。所有写入都走 DeepSeek Harness
自己的、带版本号的 settings 传输通道，因此你的 YAML 会保留注释，而每一个你没有动过的字段都会
原样保留。

它最想解决的，恰恰是 DSH 开箱状态最不擅长的场景：把 Harness 指向一个**第三方 DeepSeek 端点**——
云上的聚合网关、公司代理、nginx 后面的自建 vLLM 或 llama.cpp。这类端点从 URL 上完全看不出「背后
的模型是按 DeepSeek 那套说思考的」：兼容性是按 Provider id 与 baseURL 探测的，于是这样的路由会
静默拿到一套 OpenAI 形状的默认值——你选的**思考档位**被打包成端点看不懂的形状、输出上限写成了
另一个字段名、厂商根本没实现的请求字段照发不误。本插件让你按路由、按模型把方言声明清楚，把思考
档位阶梯和各档 token 预算配好，并在请求中途失败之前就看清到底会发出什么。

> **状态：**`v0.4.0`，已在 DeepSeek Harness `0.1.7-alpha.1` 上验证。

---

## 目录

- [为什么需要它](#为什么需要它)
- [一览](#一览)
- [可以配置什么](#可以配置什么)
- [安装](#安装)
- [卸载](#卸载)
- [使用方式](#使用方式)
- [深入：思考等级](#深入思考等级)
- [示例](#示例)
  - [示例 1 —— 接入第三方 DeepSeek 端点](#示例-1--接入第三方-deepseek-端点)
  - [示例 2 —— 同样的模型走内置目录路由](#示例-2--同样的模型走内置目录路由)
  - [示例 3 —— 有客户端白名单的网关](#示例-3--有客户端白名单的网关)
- [几个容易踩的坑](#几个容易踩的坑)
- [兼容性矩阵](#兼容性矩阵)
- [安全设计](#安全设计)
- [开发](#开发)
- [已知问题](#已知问题)
- [许可证](#许可证)

---

## 为什么需要它

DeepSeek Harness 的 Provider schema 设计得相当完整，但「模型」页面只编辑常见字段：Base URL、
凭据、模型列表。剩下的那些字段——决定一个不稳定的网关第三次重试能否成功的、决定企业代理是否
接受你这个客户端的、决定图片过多的 prompt 是否在发出前就被拒的，以及决定一个 DeepSeek 兼容端点
究竟有没有收到你选的那个思考档位的——只存在于那份 profile YAML 里。

最后一条最要命，因为它失败的时候一声不响。`thinkingFormat`、`supportsReasoningEffort` 与
`maxTokensField` 都是按 baseURL 探测的，而只有 URL 里含 `deepseek.com` 的主机才会被认成 DeepSeek。
其它所有提供 DeepSeek 模型的主机——火山方舟、云上的聚合网关、你自己反代出来的 vLLM——都会被当作
**OpenAI 本身**：思考参数按 OpenAI 的形状拼、该发 `max_tokens` 的地方发了
`max_completion_tokens`、`store` 发给了根本不吃这个字段的服务端。配置的时候不会报任何错，只是请求
并没有按你选的档位去做。

本插件把这些字段呈现出来，同时做到：**不改 Harness 一行源码**、**不 patch `node_modules` 里
任何文件**、**不保存第二份配置**。UI 通过「模型」页面**已声明的扩展槽位**接入，配置读写通过框架
公开的 settings API 操作 `llm-pi-ai` 命名空间。

## 一览

- **思考档位真的能落到线上。** 完整阶梯——`off`、`minimal`、`low`、`medium`、`high`、`xhigh`、
  `max`——既能当路由默认值，也能按模型做**档位 → 线上字符串的映射**，并配各档 token 预算。
- **第三方 DeepSeek 手动声明。** `thinkingFormat: deepseek`、`reasoning_effort` 支持、`max_tokens`
  的拼法、DeepSeek 式的思考重放、以及你的网关不接受的字段——全都能按路由、按模型开关，因为 URL
  探测不会替你做这件事。
- **两条按模型通道，分开处理，不会用错。** 自己声明了 `models` 列表的路由就地编辑；用内置目录的
  路由走 `modelOverrides.<id>`。
- **不只会配推理。** 请求头、User-Agent、带退避曲线的重试策略、超时与传输方式、图片字节预算、
  缓存保留，以及全部 26 个兼容性开关——每个都标明它改变什么，并按你的协议**实际会读取的**字段过滤。
- **结构上就是安全的。** 按路径最小写入、基于版本号冲突检测、不抓 DOM、不改 Harness 源码、预览里
  没有密钥。

## 可以配置什么

配置有两个层级：**模型**级一次只改一个模型，**Provider**级对其下所有模型一致。这不是界面取舍，
而是 Harness schema 的边界。路由自己声明了 `models` 列表时，条目只接受 `input`、`reasoningEfforts`、
`compat` 三个字段；路由直接提供内置目录时，按模型配置走 schema 的另一条通道 `modelOverrides.<id>`，
那里接受六个字段。其余字段——请求头、重试、网络、图片字节预算、缓存策略——只存在于路由级，写在模型
条目上会被逐个点名拒绝。

| 区域 | 层级 | 内容 |
|---|---|---|
| **按模型配置** | 模型 | 选中一个模型后逐项开：这个模型接受什么输入（文本/图片）、它实际发到线上的**思考档位 → 线上取值映射**、以及它的 `compat` 覆盖。每面开关都会显示未覆盖时沿用的路由级取值。目录路由上，同一个编辑器还负责该模型的显示名称、上下文窗口与最大输出 token——因为那条通道没有别的编辑器。 |
| **Headers** | Provider / 全局 | Provider 级与全局请求头，带校验、密钥掩码与重名检测。 |
| **User-Agent** | 全局 | 预设（Chrome、Safari、Firefox、opencode、Codex CLI、Claude CLI）加自由输入，用于做客户端白名单的网关。 |
| **重试策略** | Provider | Harness 默认 / 保守 / 激进 三档预设，或完全自定义：模式、最大重试次数、可重试错误码、初始延迟、最大延迟、抖动。 |
| **网络** | Provider | 传输方式（`sse`、`websocket`、`websocket-cached`、`auto`）、请求超时、流空闲超时、WebSocket 连接超时、缓存保留策略。 |
| **视觉能力** | Provider | 未声明输入类型的模型的默认输入模态、单请求图片总字节上限、像素预算、单张图片字节上限——用 MiB 等单位而不是原始字节数。 |
| **推理** | Provider | 该路由的默认**思考档位**（`off` … `max`）与各档 token 预算。某个模型上每个档位变成什么，在「按模型配置」里设置。 |
| **兼容性** | Provider | 全部 26 个 `compat` 开关，并按该路由协议**实际会读取的**字段过滤——包括**思考方言**（`openai`、`deepseek`、`openrouter`、`qwen`、`chat-template` 等）与承载思考预算的字段名。模型级的那部分在「按模型配置」里，过滤更严，因为在模型级写错字段在 Harness 里是硬错误。 |
| **测试 Provider** | Provider | 使用**表单中当前**（无论是否已保存）的 Headers 去请求端点的模型列表——验证白名单 Header 是否生效最快的方法。 |
| **生效配置** | Provider | 逐层展示该 Provider 实际会发出什么，敏感值已掩码。 |
| **诊断** | 全局 | 只读的兼容性报告，可直接粘贴进 issue；以及从已停止维护的 `dsh-custom-provider-settings` 一键导入。 |

## 安装

需要 DeepSeek Harness `0.1.7` 或兼容版本，以及 Node.js 20+。

```bash
# 从 GitHub Release 的 tgz 安装
dsh plugin --profile web add https://github.com/misswell/dsh-advanced-provider-settings/releases/download/v0.4.0/dsh-advanced-provider-settings-0.4.0.tgz

# 发布到 npm 后
dsh plugin --profile web add dsh-advanced-provider-settings

# 直接从仓库安装 —— 无需构建，也无需发布 npm
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

移除包会一并移除界面，以及插件自己的设置命名空间：在 0.1.7 上，命名空间**就是** profile 条目自己的
`Config`，条目没了，挂在它下面的全局 Header 列表和界面偏好也就没了。**你的 Provider 配置不受影响**
——高级字段写在 Harness 自己的 `llm-pi-ai` 条目里，本插件从不独占它。两者都存在当前 profile 的用户
层 `~/.dsh/profiles/<profile>/cordis.patch.yml`；若也想清掉本插件设置的字段，请先在各 Provider 卡片上
点「重置全部高级设置」，或手动删除 `llm-pi-ai` 条目下 `providers.<id>` 的相应键。

## 使用方式

1. 打开 **设置 → Provider 高级设置**，展开 **Provider 配置**，选一个 Provider；或者打开 **设置 →
   模型**，展开任意兼容 OpenAI 的 Provider 卡片。两处编辑的是同一份配置。
2. **两级折叠默认都是合上的**：设置页的三张卡（全局 Headers、Provider 配置、诊断），以及编辑器里的
   每个区块。每张卡的标题右侧带着状态标签——「2 项」「无限重试」「high」「自定义」「默认」——所以不点开
   也能知道哪里已经有配置、配了多少项，只展开你要改的那一张。
3. 改完点 **保存**。写入是按路径的最小操作，并基于你正在阅读的那一版命名空间；并发修改会被
   拒绝，而不是静默覆盖。
4. **Provider 高级设置** 页面还管着两件跨 Provider 的事：每个请求都会带上的**全局 Header**，
   以及诊断。

### 怎么读这些控件

- **先选模型，再改这个模型。** 「按模型配置」顶部是一排模型胶囊：带 **图** 标记的表示它声明了
  图片输入，右侧的小圆点表示这个模型身上已经有覆盖。列表超过 8 个模型会出现筛选框。一次只编辑
  一个模型，编辑器顶部直接写着它的 id，旁边是「清除该模型的全部覆盖」。
- **当前在编辑哪条通道，界面会直说。** 自己声明了 `models` 列表的路由就地编辑；用内置目录的路由
  走 `modelOverrides.<id>`，卡片会写明这一点，模型胶囊列出目录里实际提供的模型，读不到目录时则
  指出是哪一层失败。已经不在目录里的覆盖仍然会出现并带警告，以便清除，而不是变成看不见的 YAML。
- **模型里没有的控件，是 Harness 不给的。** 列表里的模型条目只接受输入模态、reasoning effort
  映射和 `compat`，所以请求头、重试、网络、图片字节预算和缓存策略只在 Provider 级出现，模型编辑器
  底部就把这条边界说明出来，而不是放一排点了会报错的按钮。名称、上下文窗口与最大输出 token 在目录
  覆盖里可以改，但在列表模型上刻意留给「模型」页面：一条路径只有一个写入方。
- **一行只讲一件事。** 每张卡片里用一条细分隔线分开各行，每行是一个标题、最多一句解释、一个控件。
  你自己设过值的行，左缘会有一道主色竖条——它是唯一一个逐字段的状态标记，所以真正的警告仍然跳得出来。
- **单位写在数字框里面**，继承来的默认值作为占位符显示，而不是再多一个控件。**继承** 按钮只出现在
  确实覆盖了取值的行上，点它是移除覆盖、让取值重新跟随 DeepSeek Harness，而不是被钉死在今天的数字上。
- **模型级的兼容开关会说明它沿用谁。** 没有被这个模型覆盖的开关，解释里直接接一句「当前沿用路由级：
  支持」，不必再切回 Provider 级那一堆去对照。
- **时长和预算都用人话说一遍**：`2 分钟`、`5 分钟`、`10 MiB`——差 1000 倍这种错误会一眼看出来，
  而不是看起来很合理。只有像素预算那一行会重述自己的数值，因为把它换算成 `≈ 1448 × 1448 像素`
  说的是框里说不出口的事。
- **带底色的方框一律代表要你拿主意。** 解释性文字就是普通文本；只有警告、阻断错误的处理结果和操作
  结果才有底色。
- **思考档位用胶囊按钮**，归并关系直接用文字说明。`xhigh` 与 `max` 虽然 schema 接受，但在请求发出前
  会被归并为 `high`，这一行会直接说明，而不是给出一档实际不存在的粒度。完全不推理的模型
  （`reasoningEfforts: false`，只有模型级才有、Provider 级没有对应值）也能在同一个编辑器里声明，
  点「继承」即可撤销。
- **退避曲线**把重试策略画出来：每次重试一根柱子，长度对应真实等待时间，并给出累计等待。
  「重试 4 次、500 毫秒、翻倍、上限 8 秒」是一种形状，看成一张图更容易判断是否合理。
- **兼容性开关**按影响面分组——请求字段、流式响应、思考与推理、工具调用、缓存——每个都有中文名
  和一句解释。原始标识符作为等宽小字保留，便于对照服务商文档；列表变长后会出现筛选框。每个开关
  保留三态：**继承**不等于**关闭**，因为继承是把决定权留给适配器。

## 深入：思考等级

Harness 里的推理配置永远是两层，分别回答两个不同的问题：**我们要哪一档**，以及**这个端点管这一档
叫什么**。本插件把两层都露出来。

### 阶梯

`off` → `minimal` → `low` → `medium` → `high` → `xhigh` → `max`。最后两档 schema 虽然接受，但在请求
发出前会被归并到 `high` 的预算上，所以真正需要填的只有 `high` 一档；「推理」卡片就在胶囊旁边用文字
说明这一点。预算有 `minimal`、`low`、`medium`、`high` 四档（Harness 默认 `1024`、`2048`、`8192`、
`16384`），并且**会被钳到这次请求留给答案的空间**——输出上限只有 8000 的请求，配 32000 的预算最终
就是 8000。

预算要真的发出去，路由还必须说明用哪个字段承载：在「兼容性」里选 **预算字段名**
（`thinking_token_budget`、`thinking_budget`、`thinking_budget_tokens`）或打开对应别名开关，因为没有任何
适配器能猜出这件事。把预算写进自己的 chat template 的服务端，则由 `chat-template` 系列方言负责。

### 路由级默认档

**推理 → 思考档位** 设置的是：请求自己没有指定档位时，这条路由用哪一档。它是路由级默认值，而 Harness
会拿它跟**实际收到请求的那个模型**做校验：模型把它标为不支持的档位不会被降级，而是直接以
`UNSUPPORTED_REASONING_EFFORT` 报错。因此在同时挂了推理模型与非推理模型的路由上，请把它留在「继承」，
让每个模型自己的映射去决定（见[第 4 条](#4-路由级思考档位必须是该路由上每个模型都能接受的档位)）。

### 按模型的映射

**按模型配置 → 模型档位映射** 每一档一个输入框，框里的字符串就是这一档发出去的值。留空的档位表示
**该模型不支持这一档**，于是选中它会被点名拒绝，而不是被悄悄丢掉。具体含义值得写清楚：

| 映射里留什么 | 含义 |
|---|---|
| `low: low`、`high: high` | 该模型有这些档，发出去就是这两个字符串。 |
| 某一档留空 | 标记为不支持：该档从模型的档位列表里消失，请求点名它会得到一个带名字的错误。 |
| `off` 留空（打开「可选但不发送」开关） | `off` 仍然可选，而不是被标成不支持；至于「不想思考」这句话怎么说，由方言自己决定。 |
| `off` 填了字符串 | `off` 可选，并把该字符串当作思考参数发出去。 |
| `reasoningEfforts: false`（「无推理（false）」） | 声明该模型不推理：Harness 完全不再报告推理能力，也不发任何相关字段。只有模型级可以这样声明，Provider 级没有对应值。 |

映射并非随便写：Harness 会拒绝空映射、拒绝「除了 `off` 之外没有任何档位」、拒绝除 `off` 以外任何
档位留空、拒绝空字符串。编辑器的网格产不出这些形状，而如果你手改 YAML 改坏了，草稿校验会点名。

### 方言怎么处理它

选中的档位要经过你的 `compat` 开关，而「第三方 DeepSeek 能不能用」就取决于它们。当
`thinkingFormat: deepseek` 且 `supportsReasoningEffort: true` 时，请求 `high` 会带上
`thinking: {type: "enabled"}` 以及 `reasoning_effort: "high"`；而不要求思考的请求会带上
`thinking: {type: "disabled"}`——这是该方言表达「别想」的方式。用默认的 `openai` 格式时，同一档只会
变成一个光秃秃的 `reasoning_effort`，而「不思考」表现为**根本没有推理字段**——所以一个需要显式
「禁用」标记的 DeepSeek 兼容端点，必须由你告诉它自己说的是哪种方言。

## 示例

### 示例 1 —— 接入第三方 DeepSeek 端点

**场景。** 一个 OpenAI 兼容端点提供 DeepSeek 模型：`deepseek-reasoner` 会思考，`deepseek-chat` 不会。
它的主机是云上的聚合网关或公司代理——和 `api.deepseek.com` 毫无相似之处——所以 Harness 认不出它背后
是什么。

**为什么必须手工配。** 兼容性是按 Provider id 与 baseURL 探测的。认不出的 URL 会被当成 **OpenAI
本身**，在这个场景里恰好错在五个具体的地方：

| 认不出 URL 时的假设 | DeepSeek 兼容端点期望的 |
|---|---|
| `thinkingFormat: openai`——光发一个 `reasoning_effort` | `thinkingFormat: deepseek`——显式的 `thinking` 标记加上 `reasoning_effort` |
| `maxTokensField: max_completion_tokens` | `max_tokens`，DeepSeek 官方 API 与大多数镜像用的拼法 |
| `supportsStore: true`——会发 `store` | DeepSeek 官方 API 不吃 `store`——Harness 本来就把它当非标准端点——大多数镜像也一样 |
| `supportsDeveloperRole: true`——把指令放进 `developer` 角色 | DeepSeek 系服务端期望指令放在 `system` 角色里 |
| `requiresReasoningContentOnAssistantMessages: false` | 需要重放 DeepSeek 轮次的服务端，期望助手消息带上空的 `reasoning_content` |

**第 1 步 —— 在「模型」页面声明路由。** 身份、端点、凭据和模型列表属于 DSH 自己的页面，本插件刻意
不碰它们。

```yaml
# 设置 → 模型
displayName: Third-party DeepSeek
apiKeyEnv: THIRDPARTY_DEEPSEEK_API_KEY   # 凭据的名字，绝不是密钥本身
api: openai-completions
baseURL: https://llm-gateway.example.com/v1
models:
  - id: deepseek-reasoner
    name: DeepSeek R1
    contextWindow: 131072
    maxTokens: 65536
  - id: deepseek-chat
    name: DeepSeek V3
```

因为这条路由声明了 `models` 列表，该列表会**取代**内置目录，按模型配置的通道就是这些条目本身——
「按模型配置」卡片就地编辑它们，按位置寻址。

**第 2 步 —— 「兼容性」，路由级。** 上面这些错配，对应下面几个开关：

- *推理参数的线上格式* → **DeepSeek**
- *识别 `reasoning_effort`* → **支持**
- *输出上限字段名* → **`max_tokens`（旧版）**
- *发送 `store`* → **不支持**
- *使用 `developer` 角色* → **不支持**
- *回放空推理字段* → **支持**

**第 3 步 —— 「推理」，路由级。** 这里把「思考档位」留在**继承**：两个模型的阶梯并不一样，而路由
默认值一旦某个模型接受不了，请求时就会被拒。改配预算——它是路由级、且安全的：

- *低* `2048`，*中* `8192`，*高* `32768`

**第 4 步 —— 按模型配置。** 选中 `deepseek-reasoner`，把档位映射网格填上：

| 档位 | 填什么 | 含义 |
|---|---|---|
| 关闭 | 打开「可选但不发送」开关 | `off` 仍可选；方言会把它表达成 `thinking: {type: "disabled"}` |
| 低 | `low` | 发出 `reasoning_effort: low` |
| 中 | `medium` | 发出 `reasoning_effort: medium` |
| 高 | `high` | 发出 `reasoning_effort: high` |
| 极高 / 最大 | 留空 | 标记为不支持——反正 Harness 也会把它们归并到 `high` |

再选中 `deepseek-chat`，按下 **无推理（false）**：该模型声明 `reasoningEfforts: false`，Harness 因此不再为它
提供任何推理控件，也不发任何相关字段。

**插件写下的内容。** 只有你动过的路径；文件里的其它一切原样不动。

```yaml
# ~/.dsh/profiles/web/cordis.patch.yml
- id: llm-pi-ai
  name: "@deepseek-ai/dsh-llm-pi-ai"
  config:
    providers:
      thirdparty-deepseek:
        # ---- 在「模型」页面声明（这些归 DSH 管）------------------------
        displayName: Third-party DeepSeek
        apiKeyEnv: THIRDPARTY_DEEPSEEK_API_KEY
        api: openai-completions
        baseURL: https://llm-gateway.example.com/v1
        models:
          - id: deepseek-reasoner
            name: DeepSeek R1
            contextWindow: 131072
            maxTokens: 65536
            # ---- 按模型配置 → 模型档位映射 ------------------------------
            reasoningEfforts:
              off: null          # 仍然提供；「不想考」怎么说由方言决定
              low: low
              medium: medium
              high: high
          - id: deepseek-chat
            name: DeepSeek V3
            reasoningEfforts: false   # 按模型配置 →「不推理」
        # ---- 「兼容性」卡片，路由级 ------------------------------------
        compat:
          thinkingFormat: deepseek
          supportsReasoningEffort: true
          maxTokensField: max_tokens
          supportsStore: false
          supportsDeveloperRole: false
          requiresReasoningContentOnAssistantMessages: true
          # 仅当你的端点确实提供下列字段之一时才配：
          thinkingTokenBudgetField: thinking_budget_tokens
        # ---- 「推理」卡片 ----------------------------------------------
        thinkingBudgets:
          low: 2048
          medium: 8192
          high: 32768
```

**最终发出去的东西。** 配上上面的 compat 之后，对 `deepseek-reasoner`：

| 请求要的档位 | 请求体里带的 |
|---|---|
| `high` | `"thinking": {"type": "enabled"}, "reasoning_effort": "high", "max_tokens": 65536` |
| `medium` | 同样的形状，`"reasoning_effort": "medium"`，外加你设定的那一档预算 |
| 不要思考（`off`） | `"thinking": {"type": "disabled"}`——没有 `reasoning_effort` |
| `xhigh` / `max` | 请求还没构造完就被拒，因为映射把它们标成了不支持 |
| 任意档位，对 `deepseek-chat` | 完全没有推理字段；该模型已声明为不推理 |

### 示例 2 —— 同样的模型走内置目录路由

如果你的网关背后挂的模型 id 恰好是内置目录已经描述过的，这条路由就不声明 `models` 列表，Harness 直接
提供目录，按模型的通道随之变成 `modelOverrides.<id>`。编辑器还是同一个，通道不一样，而差别恰恰重要：

```yaml
        # 这条路由没有 models 列表 → 提供的是内置目录
        modelOverrides:
          deepseek-reasoner:
            contextWindow: 65536      # 这条通道没有别的编辑器……
            maxTokens: 32768          # ……所以身份与容量也在这里
            reasoningEfforts:         # 按模型配置 → 模型档位映射
              off: null
              low: low
              high: high
        reasoning: high               # 「推理」卡片：这里安全，因为每个模型都推理
```

这条通道附带两条规矩。Harness 会拒绝目录描述不了的 id——只有你的网关认识的 id 请改用 `models` 列表。
而非空的 `models` 列表会直接拒绝 `modelOverrides`，所以「声明模型列表来解锁按模型配置」等于用一个目录
换一个座位；卡片编辑的始终是路由实际拥有的那条通道。

### 示例 3 —— 有客户端白名单的网关

只跟已批准客户端说话的网关，或者单纯不稳定的网关，是本插件的另一半。两张列表彼此独立，而且都重要：

```yaml
# 本插件自己的命名空间 —— 全局层，每个请求都带
- id: advanced-provider-settings
  config:
    globalHeaders:
      user-agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) … Chrome/131.0.0.0 Safari/537.36
      x-client-version: 2.14.0
```

再看路由本身：

```yaml
# llm-pi-ai → providers.<id>
        headers:
          x-portal-token: …            # Provider 级；同名时覆盖全局
        retryPolicy:
          mode: normal
          maxRetries: 4
          retryableCodes: [RATE_LIMIT, SERVER, TIMEOUT, TRANSPORT, EMPTY_RESPONSE]
          backoff:
            initialDelayMs: 500
            maxDelayMs: 8000
            jitterRatio: 0.2
        timeoutMs: 120000
        streamIdleTimeoutMs: 60000
```

- **User-Agent 只能放在全局列表。** Harness 会把 Provider profile 里名为 `user-agent` 的 Header 剥掉，
  再发它自己的归属标识；全局层是本插件的传输层包装在 Harness 构造完 Header **之后**应用的，因此是
  唯一能让这个字段生效的地方。你在 Provider 级设置它时卡片会警告。
- **自己配的 `authorization` 会顶掉 API Key**（OpenAI 兼容协议）。这偶尔正是你要的，更多时候是个
  bug；卡片会在这行旁边警告。
- **重试永远是路由级的，绝不是模型级。** 退避曲线把数字画成形状——每次重试一根柱子，长度对应真实等待
  ——而「无限重试」会被明确警告，而不是藏起来。
- **测试 Provider** 用**表单中当前**的 Headers（无论是否保存）去问端点的模型列表。这是保存之前就验证
  白名单 Header 是否生效的最快方式。

## 几个容易踩的坑

以下都是 DeepSeek Harness `0.1.7-alpha.1` 的真实行为。本插件的做法是把它们**显示出来**，而不是藏
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

### 3. 重试永远不是模型级的，而「最细一层」取决于路由

`retryPolicy`、请求头、传输方式与超时、图片字节预算、缓存保留策略全都配在 Provider 路由上——既没有
按模型的重试，也没有全局重试。在本插件里，这条边界是**显示出来**的：各 Provider 级卡片的说明里都会
强调「对其下所有模型一致」，模型编辑器底部则点名哪些字段写在模型条目上会被拒绝。

按模型的通道有两条，走哪条取决于路由，而且差别不是外观问题。带非空 `models` 列表的路由会**取代**
内置目录，条目本身就是模型，接受 `input`、`reasoningEfforts`、`compat`。没有 `models` 列表的路由
提供的是内置目录，按模型配置走 `modelOverrides.<id>`——以目录必须认识的模型 id 为键——那条通道接受
六个字段：上面三个，再加 `name`、`contextWindow`、`maxTokens`。两者在 schema 里互斥：非空的 `models`
列表会直接拒绝 `modelOverrides`。所以卡片编辑的是路由实际拥有的那条通道，也绝不会建议你「声明模型
列表来解锁按模型配置」——那等于用目录换一个座位。

### 4. 路由级思考档位必须是该路由上每个模型都能接受的档位

「推理」卡片里的档位是路由级默认值。Harness 会拿这次请求最终点名的档位跟**真正收到请求的模型**做
校验；模型不支持的档位不会被降级，而是直接抛出一个点名的 `UNSUPPORTED_REASONING_EFFORT`。同一条路由
上 `reasoningEfforts: false` 的模型只支持 `off`，所以路由默认值设成 `high` 会让那个模型的请求全部
失败。混合路由上请把路由级档位留在**继承**，让每个模型自己的映射说明它能做什么。

### 5. 思考方言只属于某一个协议

`thinkingFormat`、`supportsReasoningEffort`、`thinkingTokenBudgetField` 都是 Chat Completions 的字段。
路由的 `api` 若是 `openai-responses` 或 `anthropic-messages`，「兼容性」卡片只提供该协议读取的字段
——也就是说，一个你用 Responses API 访问的第三方 DeepSeek 端点，教不会 `deepseek` 方言，它的推理行为
只能是该协议自己的行为。想让档位准确落地，就在端点支持的前提下选 `openai-completions`。

## 兼容性矩阵

| DeepSeek Harness | 状态 | 说明 |
|---|---|---|
| `0.1.7-alpha.1` | **已验证** | 本版本中每个常量与代码路径都读自该构建，并针对它跑过测试。 |
| 其它 `0.1.7-*` | 预期可用 | 同一 patch 系列内历史上未改动 Provider schema，但未实测。 |
| `0.1.6` 及更早 | 不支持 | 0.1.7 重写了本插件赖以工作的设置层：命名空间改由 profile 条目自己的 `Config` 推导，浏览器侧改写走 `configForms` 与 `remote.settings`。这两者在 0.1.7 之前都不存在——请改装 `v0.2.1`。 |
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
src/host/      条目 Config schema、Header 桥、模型发现、诊断、RPC 路由
src/client/    槽位注册、Provider 卡片面板、设置页、多语言、样式
tests/         单元测试，以及针对构建产物的集成测试
docs/recon/    本实现所依据的源码级调研报告——按 Harness 版本撰写，写的是 0.1.5-rc.2。
               0.3.0 与 0.4.0 在其上改了什么见各自的 changelog 条目；那些报告是历史，不是当前 API。
```

## 已知问题

- **`npm pack` 与 `git` 安装会从源码构建。** 发布用 tgz 中已包含 `lib/`。直接从 git URL 安装需要
  一条可构建的安装路径，而 pnpm 10 的 `allowBuilds` 策略可能拒绝它。请优先使用 Release tgz 或 npm 包。
- **Harness 的 UI 内部结构可能在小版本间变化。** 若将来某个版本重命名槽位或改变其 owner props，
  受影响的接入点会**渲染为空**而不是抛错——但该功能会消失，直到本插件跟进。诊断面板会让这一点可见。
- **协议读不到的「路由级」兼容性字段是提示而非阻断。** Harness 会静默忽略它们；本插件会标出来让
  错误可见，但仍允许你保存。**模型级**的不匹配会被拒绝，因为 Harness 视其为硬错误。
- **思考 token 预算不受 Harness schema 校验。** 上游 `thinkingBudgets` 接受任意数字；本插件的数字框
  要求整数、非负，并拒绝未知档位，但手写或用别的工具写入的值，只在请求时才被钳制。
- **映射里填的字符串只校验形状，不校验对错。** 形状错误 Harness 会拒绝；被模型标记为不支持的档位会在
  请求时抛出点名的错误（见[第 4 条](#4-路由级思考档位必须是该路由上每个模型都能接受的档位)）——但
  **你的端点**是否接受你敲进去的字符串，任何编辑器都无法知道。「生效配置」预览会告诉你实际会发什么；
  端点自己的文档才是它能接受什么的权威。
- **属于线上协议语法的枚举「取值」保留字面拼写。** 思考格式显示为 `deepseek`、
  `chat_template_kwargs`，因为服务端收到的就是这个字符串，服务商文档也是这么写的；翻译它反而会
  切断这种对应关系。字段**名称**、所属分组、每个取值的说明以及所有档位均已本地化。
- **目录路由的按模型编辑器需要 Host 能列出目录。** 胶囊里的模型 id 来自该路由的实时目录，通过
  `catalog-models` RPC 取得。若 Host 的 `llm` 服务列不出路由模型——Host 版本偏旧，或该路由没有注册到
  适配器——卡片会区分这两种情况并保持为空，因为覆盖是以一个别处给不出的 id 为键的。这种路由要配置，
  得先在「模型」页面声明模型。
- **目录已经不再包含的 `modelOverrides` id 无法保存。** Harness 会用目录校验 id 并拒绝写入；卡片仍然
  显示这条已有条目，带警告和「清除」按钮，不会让它变成看不见的配置。
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

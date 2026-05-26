# Model Client 模块

## 概述

model_client/ 子模块实现了与各个 LLM 提供商的交互。它定义了统一的客户端接口，并提供了 OpenAI 和 Anthropic 的具体实现。框架设计允许轻松扩展支持其他提供商。

## 模块结构

`
model_client/
├── base.py              # 客户端接口与 StreamEvent
├── openai_client.py     # OpenAI 实现
├── anthropic_client.py  # Anthropic 实现
├── registry.py          # 客户端注册表
└── __init__.py          # 公开 API
`

## StreamEvent（流事件）

`python
@dataclass(frozen=True, slots=True)
class StreamEvent:
    """provider-agnostic 的流事件。"""

    text_delta: str | None = None             # 文本增量
    tool_call_id: str | None = None           # 工具调用 ID
    tool_name: str | None = None              # 工具名称
    tool_args_delta: str | None = None        # 工具参数增量
    reasoning_delta: str | None = None        # 推理/thinking 增量（Anthropic）
    reasoning_signature_delta: str | None = None  # thinking 签名增量（Anthropic）
    reasoning_block_type: str | None = None   # thinking 块类型
`

表示流式响应中的单个事件。这是提供商无关的统一格式。

**字段组合语义：**

| 场景 | 使用字段 |
|---|---|
| 文本增量 | 	ext_delta |
| 工具调用开始 | 	ool_call_id + 	ool_name |
| 工具参数增量 | 	ool_args_delta |
| 推理/thinking | reasoning_delta / reasoning_block_type |
| thinking 签名 | reasoning_signature_delta |

---

## ChatModelClient 协议

`python
class ChatModelClient(Protocol):
    async def create(
        self,
        *,
        model_name: str,
        payloads: list[LLMPayload],
        tools: list[Tool],
        request_name: str,
        model_set: Any,
        stream: bool,
    ) -> tuple[str | None, list[dict[str, Any]] | None, AsyncIterator[StreamEvent] | None, list[ReasoningText] | None]:
        """发起一次聊天请求。

        返回四元组：
        - message: 非流时的完整文本；流式则为 None
        - tool_calls: 非流时解析出的工具调用列表；流式则为 None
        - stream_iter: 流式迭代器；非流则为 None
        - reasoning: thinking/reasoning 内容列表；无则为 None
        """
`

定义了所有聊天模型客户端必须实现的接口。

---

## OpenAIChatClient

OpenAI 的具体实现。依赖 openai>=2.x。

### 功能特性
- 异步聊天补全（流式和非流式）
- 工具调用（function calling）
- 多模态支持（文本 + 图像）
- 客户端缓存（按 api_key/base_url）
- 自动重试禁用（由 policy 层控制）

### 使用示例

`python
models = [{
    "client_type": "openai",
    "model_identifier": "gpt-4",
    "api_key": "sk-...",
    "base_url": "https://api.openai.com/v1",
}]

request = LLMRequest(model_set=models)
request.add_payload(LLMPayload(ROLE.USER, Text("Hello!")))
response = await request.send()
`

---

## AnthropicChatClient

Anthropic 的具体实现。依赖 nthropic SDK。

### 功能特性
- 异步聊天补全（流式和非流式）
- 工具调用（tool use）
- Thinking/Reasoning 内容支持（Claude 的扩展思考）
- ReasoningText 提取
- 客户端缓存（按 api_key/base_url/thinking 配置）
- 自定义 httpx 超时配置

### Reasoning / Thinking 支持

Anthropic 的 Claude 模型支持 extended thinking，客户端会自动提取 thinking 内容作为 ReasoningText：

`python
# 响应中自动包含推理内容
response = await request.send()
message = await response

# 推理内容可通过 payloads 中的 ReasoningText 访问
`

### 配置示例

`python
models = [{
    "client_type": "anthropic",
    "model_identifier": "claude-sonnet-4-20250514",
    "api_key": "sk-ant-...",
    "temperature": 0.7,
    "max_tokens": 4096,
    "extra_params": {
        "thinking": {"type": "enabled", "budget_tokens": 1024}
    },
}]

request = LLMRequest(model_set=models)
request.add_payload(LLMPayload(ROLE.USER, Text("Solve this complex problem...")))
response = await request.send()
`

### Payload 转换

Anthropic 客户端会将 LLMPayload 转换为 Anthropic 的 Messages API 格式：
- ROLE.SYSTEM → system prompt（支持多个 system payload 拼接）
- ROLE.USER → user message（支持多模态 content blocks）
- ROLE.ASSISTANT → assistant message
- ROLE.TOOL → tools 声明
- ROLE.TOOL_RESULT → tool_result content block

---

## ModelClientRegistry

`python
@dataclass(slots=True)
class ModelClientRegistry:
    openai: ChatModelClient | None = None
    claude: ChatModelClient | None = None
    gemini: ChatModelClient | None = None
    bedrock: ChatModelClient | None = None
`

管理不同提供商的客户端实例。

### 核心方法

#### get_client_for_model / get_chat_client_for_model

`python
def get_client_for_model(self, model: dict[str, Any]) -> ChatModelClient:
    """根据单个模型配置决定使用哪个 provider。"""

def get_chat_client_for_model(self, model: dict[str, Any]) -> ChatModelClient:
    """获取聊天客户端。"""
`

client_type 映射：
| client_type | 客户端 |
|---|---|
| "openai" | OpenAIChatClient |
| "anthropic" / "claude" | AnthropicChatClient |
| "gemini" | Gemini 客户端（需注册） |
| "bedrock" | Bedrock 客户端（需注册） |

#### get_embedding_client_for_model

`python
def get_embedding_client_for_model(self, model: dict[str, Any]):
    """获取 Embedding 客户端。"""
`

用于 EmbeddingRequest 发起向量嵌入请求。

#### get_rerank_client_for_model

`python
def get_rerank_client_for_model(self, model: dict[str, Any]):
    """获取 Rerank 客户端。"""
`

用于 RerankRequest 发起文档重排序请求。

### 注册自定义客户端

`python
from src.kernel.llm.model_client import ModelClientRegistry

registry = ModelClientRegistry()
registry.claude = AnthropicChatClient()
registry.gemini = GeminiClient()

request = LLMRequest(model_set=models, clients=registry)
`

---

## 扩展新提供商

### 步骤 1：实现 ChatModelClient 协议

`python
from src.kernel.llm.model_client import StreamEvent
from src.kernel.llm import LLMPayload, ReasoningText
from typing import AsyncIterator

class MyProviderClient:
    async def create(
        self, *, model_name, payloads, tools, request_name, model_set, stream
    ) -> tuple[str | None, list[dict] | None, AsyncIterator[StreamEvent] | None, list[ReasoningText] | None]:
        # 转换 payloads 为提供商格式
        # 发起请求
        # 返回四元组
        pass
`

### 步骤 2：实现 Embedding 和 Rerank 接口（可选）

`python
class MyProviderClient:
    # ... ChatModelClient 实现 ...

    async def create_embedding(self, *, model_name, inputs, request_name, model_set):
        # 返回 list[list[float]]
        pass

    async def create_rerank(self, *, model_name, query, documents, top_n, request_name, model_set):
        # 返回 list[dict]（每项含 index/score/document）
        pass
`

### 步骤 3：在注册表中注册

`python
registry = ModelClientRegistry()
# 聊天
registry.__dict__["my_provider"] = MyProviderClient()

# 或在 get_client_for_model 中添加 client_type 分支
`

---

## 常见问题

### Q: OpenAI 和 Anthropic 客户端能否混用？

A: 可以。使用多模型配置和策略：
`python
models = [
    {"client_type": "openai", "model_identifier": "gpt-4", ...},
    {"client_type": "anthropic", "model_identifier": "claude-sonnet-4-20250514", ...},
]
`

### Q: 重试在哪一层控制？

A: 客户端内部禁用 SDK 级别重试，由 policy 层统一控制。

### Q: Anthropic thinking 如何配置？

A: 在 extra_params 中设置：
`python
"extra_params": {"thinking": {"type": "enabled", "budget_tokens": 1024}}
`

### Q: 客户端是否线程安全？

A: OpenAIChatClient 和 AnthropicChatClient 均使用 	hreading.Lock 保护缓存，是线程安全的。

---

## 相关文档

- [Request 模块](../request.md)
- [Response 模块](../response.md)
- [Embedding 模块](../embedding.md)
- [Rerank 模块](../rerank.md)
- [Policy 模块](../policy/README.md)

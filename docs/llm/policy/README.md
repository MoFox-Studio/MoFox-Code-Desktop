# Policy 模块

## 概述

policy/ 子模块实现了负载均衡和重试策略。它决定了在多个模型之间如何轮流尝试、何时重试、如何处理错误等。提供两种内置策略和自定义策略扩展能力。

## 模块结构

`
policy/
├── base.py           # 策略接口定义
├── round_robin.py    # 轮询策略实现
├── load_balanced.py  # 动态负载均衡策略
└── __init__.py       # 公开 API
`

## 核心接口

### ModelStep（步骤信息）

`python
@dataclass(frozen=True, slots=True)
class ModelStep:
    """下一步执行计划。
    
    - model=None 表示策略耗尽，应停止重试并把最后一次异常抛给上层。
    - delay_seconds 由 policy 决定（例如 retry_interval）。
    """
    
    model: dict[str, Any] | None       # 下一个要尝试的模型配置
    delay_seconds: float = 0.0          # 延迟时间（秒）
    meta: dict[str, Any] | None = None # 元数据（模型索引、重试次数等）
`

表示策略决定的下一步行动。

---

### PolicySession 协议

`python
class PolicySession(Protocol):
    def first(self) -> ModelStep:
        """获取初始的模型步骤。"""
        ...
    
    def next_after_error(self, error: BaseException) -> ModelStep:
        """基于错误获取下一步。"""
        ...

    def record_success(self, *, latency: float = 0.0, tokens: int = 0) -> None:
        """记录成功结果，用于策略学习。"""
        ...
`

表示单次请求的策略会话。

---

### Policy 协议

`python
class Policy(Protocol):
    def new_session(self, *, model_set: Any, request_name: str) -> PolicySession:
        """为新请求创建会话。"""
        ...
`

---

## RoundRobinPolicy（轮询策略）

`python
class RoundRobinPolicy(Policy):
    """简单轮询：在 model_set（list[dict]）上循环选择。"""
`

默认的负载均衡策略，按轮询方式在模型间切换。

### 工作原理

1. **初始选择**：从当前轮询位置开始
2. **重试**：在当前模型上重试 max_retry 次
3. **切换**：重试耗尽后切换到下一个模型
4. **终止**：所有模型都耗尽时停止

### 使用示例

`python
from src.kernel.llm.policy import RoundRobinPolicy

request.policy = RoundRobinPolicy()
`

---

## LoadBalancedPolicy（动态负载均衡策略）

`python
class LoadBalancedPolicy(Policy):
    """基于负载均衡和失败惩罚的动态模型选择策略。
    
    核心特性：
    - 综合考虑 token 使用量、延迟、失败惩罚等多个维度
    - 动态更新使用惩罚以实现短期负载均衡
    - 对失败的模型施加惩罚，自动规避不可靠的模型
    """
`

### 评分公式

每次选择模型时，综合计算评分（分数越低越优先）：

`
score = total_tokens 
      + penalty × penalty_weight
      + (usage_penalty + request_count) × usage_penalty_weight
      + avg_latency × latency_weight
`

### 配置参数

`python
LoadBalancedPolicy(
    critical_penalty_multiplier: float = 5.0,   # 严重错误的惩罚倍数
    default_penalty_increment: float = 1.0,      # 默认惩罚增量
    latency_weight: float = 200.0,               # 延迟权重
    penalty_weight: float = 300.0,               # 失败惩罚权重
    usage_penalty_weight: float = 1000.0,        # 使用惩罚权重
)
`

### 惩罚机制

| 错误类型 | 惩罚策略 |
|---|---|
| 网络连接错误 / 超时 | critical_penalty_multiplier 倍惩罚 |
| 服务器错误 | 2 倍惩罚 |
| 其他错误 | 默认 default_penalty_increment |

### 使用惩罚

- 模型被选中时，usage_penalty += 1
- 请求完成后，usage_penalty -= 1
- 有助于短期内将请求分散到不同模型

### 使用示例

`python
from src.kernel.llm.policy import LoadBalancedPolicy

policy = LoadBalancedPolicy(
    critical_penalty_multiplier=5.0,
    latency_weight=200.0,
    penalty_weight=300.0,
    usage_penalty_weight=1000.0,
)

request = LLMRequest(model_set=models, policy=policy)
`

### 多请求共享状态

LoadBalancedPolicy 实例跨请求共享模型使用统计，实现全局级别的负载均衡：

`python
policy = LoadBalancedPolicy()

# 所有请求共享同一个 policy 实例
request1 = LLMRequest(model_set=models, policy=policy)
request2 = LLMRequest(model_set=models, policy=policy)

# request1 和 request2 将根据共享的负载状态分配模型
`

---

## 策略对比

| 特性 | RoundRobinPolicy | LoadBalancedPolicy |
|---|---|---|
| 选择策略 | 固定轮询 | 动态评分 |
| 失败处理 | 切换下一个 | 惩罚 + 切换 |
| 负载感知 | 否 | 是 |
| 延迟感知 | 否 | 是 |
| 跨请求共享 | 否 | 是 |
| 配置复杂度 | 低 | 中 |

---

## 使用模式

### 模式 1：基础故障转移

`python
models = [
    {"client_type": "openai", "model_identifier": "gpt-4", "api_key": "key1", "max_retry": 2},
    {"client_type": "openai", "model_identifier": "gpt-3.5-turbo", "api_key": "key2", "max_retry": 2},
]

request = LLMRequest(model_set=models)  # 默认 RoundRobinPolicy
response = await request.send()
`

### 模式 2：智能负载均衡

`python
policy = LoadBalancedPolicy()
request = LLMRequest(model_set=models, policy=policy)
response = await request.send()
`

### 模式 3：自定义策略

`python
from src.kernel.llm.policy import Policy, PolicySession, ModelStep

class MyPolicy(Policy):
    def new_session(self, *, model_set, request_name):
        return MySession(model_set)

class MySession(PolicySession):
    def first(self) -> ModelStep:
        ...
    def next_after_error(self, error) -> ModelStep:
        ...
    def record_success(self, *, latency=0.0, tokens=0):
        ...
`

---

## 常见问题

### Q: 如何禁用重试？

A: 设置 max_retry: 0

### Q: 何时使用 LoadBalancedPolicy？

A: 当有多个功能相近的模型实例，需要根据实时性能动态分配时。

### Q: 策略能否跨请求共享？

A: LoadBalancedPolicy 支持跨请求共享状态，实现全局级别负载均衡。

---

## 相关文档

- [Request 模块](../request.md)
- [Response 模块](../response.md)
- [Exceptions 模块](../exceptions.md)

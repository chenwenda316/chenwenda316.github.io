---
category:
  - 杂记
---

# 03 模型结构

模型定义在 [`src/chicken_seld/model.py`](../../src/chicken_seld/model.py)，类名是
`ResNetConformerMultiAccdoa`。有效改进配置下共有 **1,467,291 个可训练参数**。

## 1. 模型为什么分成三段

```text
ResNet：    从频谱图中提取局部声学与空间模式
Conformer：沿时间轴理解事件前后关系
输出头：   把每个时间帧变成多轨、分类别的三维向量
```

可以把它类比成：ResNet 看每一小段声音的“纹理”，Conformer 把这些片段连成时间上下文，
输出头负责按任务需要整理答案。

## 2. 总体形状变化

| 阶段 | 操作 | 输出形状 |
|---|---|---|
| 输入 | 标准化特征 | `[B, 7, 64, 501]` |
| ResBlock 1 | channels 7→32，频率 /2 | `[B, 32, 32, 501]` |
| ResBlock 2 | channels 32→64，频率 /2 | `[B, 64, 16, 501]` |
| ResBlock 3 | channels 64→128，频率 /2 | `[B, 128, 8, 501]` |
| 频率池化 | 对 8 个频率位置取均值 | `[B, 128, 501]` |
| 转置 | 时间移到序列维 | `[B, 501, 128]` |
| 时间对齐 | 线性插值到 100 帧 | `[B, 100, 128]` |
| 投影 | Linear 128→128 | `[B, 100, 128]` |
| Conformer ×3 | 时间建模 | `[B, 100, 128]` |
| 输出头 | Linear 128→27 + tanh | `[B, 100, 27]` |
| reshape | 3 tracks × 3 classes × xyz | `[B, 100, 3, 3, 3]` |

卷积只在频率维下采样，时间 stride 始终为 1。这样 ResNet 不会在早期粗暴丢掉事件时间。

## 3. ResidualBlock

每个残差块有主分支和捷径分支：

```text
                 ┌─ 3×3 Conv(stride=(2,1)) ─ BN ─ ReLU ─ 3×3 Conv ─ BN ─┐
input ───────────┤                                                        + ─ ReLU
                 └─ 1×1 Conv(stride=(2,1)) ─ BN ─────────────────────────┘
```

主分支学习新的频谱模式；捷径分支帮助梯度传播，并在通道数或尺寸变化时用 1×1 卷积对齐。
两支相加后再 ReLU。

三个块把频率维从 64 压到 8，同时把通道从 7 提升到 128。通道变多意味着模型能表达
更多抽象模式；频率位置减少则控制计算量。

## 4. 为什么先把 501 帧变成 100 帧

特征每 20 ms 一帧，所以是 501 帧；标签每 100 ms 一帧，所以是 100 帧。模型在进入
self-attention 前使用一维线性插值对齐：

```python
F.interpolate(..., size=output_frames, mode="linear")
```

这样有两个好处：输出和标签能直接比较；self-attention 的计算复杂度约与时间长度平方
相关，从 501 帧降到 100 帧能显著省显存和时间。

这里不是简单每 5 帧取一帧，而是线性重采样整个时间序列。

## 5. 一个 ConformerBlock 内部

每层顺序是：

```text
x
│
├─ x + 0.5 × FeedForward(x)
├─ + MultiHeadSelfAttention(LayerNorm(x))
├─ + ConformerConvolution(x)
├─ + 0.5 × FeedForward(x)
└─ LayerNorm → output
```

### 5.1 两个 FeedForwardModule

```text
LayerNorm → Linear(128, 512) → SiLU → Dropout
          → Linear(512, 128) → Dropout
```

中间维度扩张为 4 倍。两个前馈模块各乘 0.5，属于 Conformer 的 Macaron 风格残差结构。

### 5.2 多头自注意力

`MultiheadAttention(128, 4)` 使用 4 个头，每头可理解为在 32 维子空间中关注不同的时间
关系。它能把较远时间帧的信息直接关联起来，例如同一叫声的起音、持续段和结束段。

当前实现使用 PyTorch 默认的绝对内容注意力，没有加入 Conformer 论文中常见的相对位置
编码。这是一个轻量基线选择。

### 5.3 卷积模块

卷积模块沿时间工作：

```text
LayerNorm
→ 转成 [B, 128, T]
→ 1×1 Conv: 128→256
→ GLU: 256→128
→ depthwise Conv1d(kernel=15)
→ BatchNorm + SiLU
→ 1×1 Conv: 128→128
→ Dropout
→ 转回 [B, T, 128]
```

自注意力擅长全局依赖，深度卷积擅长附近约 15 个标签帧的局部连续模式。因为标签步长
为 0.1 s，卷积核 15 大致覆盖 1.5 s 的局部上下文。

## 6. Multi-ACCDOA 输出头

最后一个线性层把每个时间帧的 128 维表示映射到：

```text
tracks × classes × xyz = 3 × 3 × 3 = 27
```

`tanh` 把每个坐标限制在 `[-1, 1]`，然后 reshape。注意 `tanh` 限制的是单个坐标，
不是整个向量的模长，所以原始向量模长理论上可到 `sqrt(3)`。损失中的活动模长分支会把
用于活动监督的模长截到 1；推理时则先按模长判活，再归一化得到方向。

## 7. `forward()` 的伪代码

```python
def forward(features, output_frames):
    x = resnet(features)             # [B, 128, 8, 501]
    x = x.mean(frequency_dimension)  # [B, 128, 501]
    x = x.transpose(1, 2)            # [B, 501, 128]
    x = interpolate_time(x, 100)     # [B, 100, 128]
    x = projection(x)                # [B, 100, 128]
    x = conformer(x)                 # [B, 100, 128]
    x = tanh(head(x))                # [B, 100, 27]
    return x.view(B, 100, 3, 3, 3)
```

## 8. 配置怎样进入模型

`scripts/train.py::build_components()` 同时创建特征器和模型。实际输入通道数来自
`extractor.output_channels`：启用 SALSA-Lite 时是 7，否则是 4。

因此 YAML 中的 `model.input_channels` 当前没有被直接使用；真正决定输入通道的是
`features.use_salsa_lite`。这是阅读配置时需要知道的实现细节。

## 9. 初学者改模型时如何保持形状正确

修改 `resnet_channels` 或 `conformer_layers` 通常不改变最终输出协议。若修改以下任意项，
则要同步检查数据、loss 和指标：

- `tracks`：target 的轨道数和 ADPIT 当前固定的三轨逻辑也要改；
- `classes`：输出头维度和类别映射会自动变化，但数据目录与标签必须对应；
- 最后一维 3：代表 xyz，不应单独修改；
- 标签步长：会改变 output_frames 和时间含义。

修改后先运行 `tests.test_core.ModelTests.test_output_shape`，再跑 smoke 训练。

---
category:
  - 杂记
---

# 04 损失与训练

## 1. 为什么普通 MSE 不够

假设同一帧有两个 `Healthy` 声源，方向分别为 A 和 B。标签可能把 A 放在 track 0、B 放在
track 1，但模型完全可能反过来输出。物理结果相同，轨道编号却不同。

若直接逐轨计算 MSE，会把这种正确的交换当成错误。ADPIT 的作用就是：枚举等价轨道
排列，只对其中误差最小的一种计分。

## 2. ADPIT 的输入

[`adpit_loss()`](../../src/chicken_seld/losses.py) 要求预测与标签形状完全相同：

```text
[B, T, 3, C, 3]
```

代码先换成 `[B, T, C, track, xyz]`，这样每个“batch × 时间 × 类别”位置都可以独立处理。
目标向量模长大于 0.5 时被视为活动，并统计该类当前有 0、1、2 或 3 个声源。

## 3. 四种活动数量怎样算 loss

### 3.1 零个声源

目标是所有输出轨道都接近零：

```text
loss = mean(prediction²)
```

### 3.2 一个声源

ADPIT 把唯一方向 A 复制到三条辅助轨道：

```text
[A, A, A]
```

这让所有轨道都能收到正样本梯度，评估时再把接近的重复方向合并。

### 3.3 两个声源

两个方向 A、B 需要其中一个被辅助复制，代码枚举六种候选：

```text
[A,A,B] [A,B,A] [B,A,A]
[B,B,A] [B,A,B] [A,B,B]
```

分别计算预测与六个候选的均方误差，取最小值。

### 3.4 三个声源

三个方向 A、B、C 正好填满三轨，枚举 `3! = 6` 种排列并取最小误差。

这就是 permutation invariant：loss 不要求模型记住人为的 track 编号。

## 4. 活动帧加权

大多数“帧 × 类别”位置可能无声。如果所有位置同权，模型容易学成总输出零，因为零向量
在数量上占优势。

当前配置：

```yaml
active_loss_weight: 6.0
```

有活动声源的位置权重为 6，无活动位置权重为 1。最终使用加权和除以权重总和，不会因
batch 中正样本数量变化而让 loss 尺度剧烈漂移。

## 5. 活动模长辅助损失

向量回归 loss 之外，代码还显式监督输出向量模长：

```text
predicted_activity = clamp(||prediction||, max=1)
desired_activity   = 1 if this class has any source else 0
```

只要该帧该类有声源，三条 ADPIT 辅助轨道的期望模长都是 1；否则为 0。该辅助项也使用
活动权重 6，并乘：

```yaml
activity_norm_loss_weight: 0.25
```

总损失为：

```text
total_loss = weighted_ADPIT_vector_MSE + 0.25 × weighted_activity_MSE
```

这项损失专门缓解全零输出问题。

## 6. 有效的改进训练配置

[`configs/improved.yaml`](../../configs/improved.yaml) 通过 `extends: default.yaml` 继承完整
配置，并覆盖：

| 参数 | 有效值 |
|---|---:|
| batch size | 16 |
| epochs | 40 |
| initial learning rate | 0.0007 |
| weight decay | 0.0001（继承） |
| dropout | 0.15 |
| gradient clipping | 5.0（代码固定） |
| checkpoint directory | `checkpoints/improved` |

`load_config()` 做递归字典合并，未覆盖字段继续使用父配置。注意默认配置会随项目调整，
所以复现实验时应同时保存解析后的配置或 checkpoint 内的 `config` 字段。

## 7. DataLoader 做了什么

训练入口创建两个数据集：

```python
train_set = ChickenSeldDataset(..., "train", augment=True)
validation_set = ChickenSeldDataset(..., "validation")
```

训练 loader 开启 `shuffle=True`，验证 loader 不打乱。每个 batch 返回：

```text
features:  [B, 7, 64, 501]
target:    [B, 100, 3, 3, 3]
scene_ids: 长度为 B 的字符串列表
```

`num_workers=0` 表示数据读取在主进程完成，在 Windows 上更稳定，但大规模训练时可能成为
吞吐瓶颈。

## 8. 一次 `run_epoch()` 的完整步骤

1. 根据是否传入 optimizer 决定训练或验证模式；
2. `model.train(True/False)` 控制 Dropout 和 BatchNorm；
3. 把 features、target 移到 CPU 或 CUDA；
4. CUDA 时启用 autocast 混合精度；
5. 前向计算，并把模型时间输出对齐到 target 的 100 帧；
6. 计算 ADPIT + 活动模长 loss；
7. 训练模式下清空旧梯度；
8. `GradScaler` 缩放 loss 并反向传播；
9. 反缩放后，把全模型梯度范数裁到 5.0；
10. AdamW 更新权重，GradScaler 更新缩放系数；
11. 将预测移回 CPU，累计帧级 SELD 指标；
12. 返回按数据集样本数平均的 loss 和指标字典。

CPU 时 GradScaler 和 autocast 自动禁用，逻辑仍可运行。

## 9. 优化器与学习率

模型使用 AdamW。40 轮训练时：

```text
warmup_epochs = min(5, max(1, 40 // 10)) = 4
```

前 4 轮学习率因子依次从 `1/4` 增长到 `4/4`；之后按余弦函数衰减到接近 0：

```text
0.5 × [1 + cos(progress × π)]
```

warmup 减少训练初期大梯度造成的不稳定；余弦衰减让后期用更小步长精修参数。

## 10. checkpoint 如何保存

每轮完成训练和验证后：

- 若验证 `seld_score` 创历史新低，覆盖 `best.pt`；
- 无论是否提升，都覆盖 `last.pt`；
- 训练结束写 `history.json`。

checkpoint 包含：

```text
epoch, best_score, model, optimizer, scheduler, config
```

`best.pt` 用于最终评估和推理；`last.pt` 更适合中断续训。当前改进模型的固定阈值最佳点
是零起始 epoch 30，也就是第 31 轮。

使用 `--resume` 时会恢复模型、优化器、调度器和最佳分数。不过当前实现重新创建空的
`history` 列表，因此新生成的 `history.json` 只记录恢复后的轮次；做长期实验时要注意另行
合并旧历史。

## 11. 为什么 10 轮基线后来提升明显

最关键的诊断是输入尺度不平衡：log-mel 的波动远大于 SALSA-Lite。训练集统计标准化让
能量与空间通道都进入更适合优化的数值范围。随后配合：

- 更充分的 40 轮训练；
- 训练专用 SpecAugment；
- 合理的 warmup + cosine 学习率；
- 验证集活动阈值校准。

测试 Macro F1 从 0.0592 提升至 0.3488，定位误差从 46.67° 降至 20.94°。完整数字见
[`RESULTS.md`](../../RESULTS.md)。

## 12. 初学者的最小训练实验

先用 smoke 配置确认代码能跑：

```powershell
$python = "C:\Users\chenwenda\AppData\Local\Programs\Python\Python312\python.exe"
& $python scripts/generate_dataset.py --config configs/smoke.yaml
& $python scripts/prepare_features.py --config configs/smoke.yaml
& $python scripts/compute_feature_stats.py data/smoke_static
& $python scripts/train.py --config configs/smoke.yaml
```

smoke 数据只有 12 个场景，结果没有统计意义，它的用途是检查形状、依赖和训练流程。

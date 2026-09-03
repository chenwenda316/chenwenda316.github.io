---
category:
  - 杂记
---

# 00 第一次写模型：30 分钟快速入门

如果你第一次自己写模型，不要从 300 多行的仿真代码开始逐行啃。最快的路线是先建立
“输入是什么、模型变了什么、输出代表什么、怎样知道它学会了”这四个锚点。

## 1. 先把任务说成人话

模型听到的是四个麦克风同时录下的 10 秒声音。它每隔 0.1 秒回答两个问题：

1. 这一帧是什么声音：`Healthy`、`Noise` 还是 `Unhealthy`？
2. 这个声音从哪个三维方向来？

因为同一时刻可能有两只同类鸡从不同方向发声，所以每个类别准备 3 条输出轨道。

## 2. 只记住一个核心张量

模型最终输出：

```text
[B, 100, 3, 3, 3]
 │   │   │  │  └─ x、y、z 三个坐标
 │   │   │  └──── 3 个类别
 │   │   └─────── 3 条同类声源轨道
 │   └─────────── 10 秒内的 100 个时间帧
 └─────────────── batch 中的场景数
```

例如向量 `[0.8, 0.0, 0.0]`：模长是 0.8，可理解为活动置信度；方向归一化后是
`[1, 0, 0]`，表示阵列局部坐标的正 x 方向。`[0, 0, 0]` 表示该轨道没有事件。

## 3. 第一次读代码，只读这五处

按下面顺序打开：

1. [`configs/improved.yaml`](../../configs/improved.yaml)：先看本次实验改了哪些参数。
2. [`scripts/train.py::build_components`](../../scripts/train.py)：看特征器和模型怎样被组装。
3. [`src/chicken_seld/model.py::forward`](../../src/chicken_seld/model.py)：看输入怎样变成输出。
4. [`src/chicken_seld/losses.py::adpit_loss`](../../src/chicken_seld/losses.py)：看预测怎样和答案比较。
5. [`scripts/train.py::run_epoch`](../../scripts/train.py)：看一次训练迭代怎样完成。

先不用理解所有数学细节。第一次阅读的目标只是找到：数据进入的位置、模型调用的位置、
loss 计算的位置、反向传播的位置。

## 4. 一个 batch 在训练时经历什么

下面是 `run_epoch()` 的核心逻辑，去掉了指标和混合精度细节：

```python
for features, target, scene_id in train_loader:
    prediction = model(features, output_frames=target.shape[1])
    loss = adpit_loss(prediction, target)

    optimizer.zero_grad()
    loss.backward()
    optimizer.step()
```

把它理解成五步：

1. `DataLoader` 取一个 batch；
2. 模型前向计算 `prediction`；
3. loss 衡量预测和 target 的差距；
4. `backward()` 计算每个参数应该往哪个方向改；
5. `optimizer.step()` 真正更新参数。

实际代码额外使用自动混合精度、梯度裁剪和学习率调度，但主干仍是这五步。

## 5. 最值得先做的三个观察练习

### 练习 A：验证模型输入输出形状

在项目根目录执行：

```powershell
$python = "C:\Users\chenwenda\AppData\Local\Programs\Python\Python312\python.exe"
& $python -m unittest discover -s tests -p "test_core.py" -v
```

其中的 `test_output_shape` 会构造一个小模型，并确认输入 `[2, 7, 64, 51]` 得到
`[2, 10, 3, 3, 3]`；其余测试同时检查标签、损失和几何。这是最安全的模型结构入门点。

### 练习 B：查看一个真实 target

```powershell
& $python -c "import numpy as np; x=np.load('data/simulated_static/targets/train/train_000000.npy'); print(x.shape); print('active=', (np.linalg.norm(x, axis=-1)>0.5).sum())"
```

你会看到 target 形状是 `(100, 3, 3, 3)`。把最后一维求模后，就能判断每条轨道是否
活动。

### 练习 C：看一个场景的音频、事件和位置

```powershell
& $python scripts/visualize_scene.py data/simulated_static test_000000
```

输出 `runs/scene_preview.png`，包含四通道波形、事件时间线和房间俯视图。先建立直觉，
再阅读空间仿真代码会快很多。

## 6. 第一次修改模型，改哪里最安全

建议按风险从低到高练习：

1. 修改 [`configs/improved.yaml`](../../configs/improved.yaml) 中的 batch、epoch 或 dropout；
2. 修改 `resnet_channels`，观察参数量和显存变化；
3. 修改 `conformer_layers`，观察长时间依赖建模的变化；
4. 最后再改输出结构或 ADPIT loss，因为它们必须和标签、指标同时保持一致。

每次只改一个变量，用新的 checkpoint 目录保存。例如：

```yaml
extends: improved.yaml

model:
  conformer_layers: 4

training:
  checkpoint_dir: checkpoints/experiment_conformer4
```

这样不会覆盖当前最佳模型，也容易判断提升来自哪个改动。

## 7. 怎样判断训练是否正常

训练输出中优先看四项：

- `train_loss` 和 `validation_loss`：是否整体下降；
- `macro_f1`：越高越好；
- `localization_error_deg`：越低越好；
- `seld_score`：综合指标，越低越好，代码按它保存 `best.pt`。

若训练 loss 持续下降而验证 SELD 变差，通常是过拟合。若输出几乎全为零，先检查正样本
权重、活动模长辅助损失和特征标准化，不要只盲目增加 epoch。

## 8. 推荐的学习节奏

```text
第一遍：只看形状和数据流
第二遍：理解每个模块解决的问题
第三遍：理解 ADPIT 为何要枚举轨道排列
第四遍：自己改一个配置，跑 smoke 实验并比较指标
第五遍：再尝试改模型代码
```

看到不熟悉的 PyTorch 层时，先问三个问题：输入形状是什么、输出形状是什么、它沿哪个
维度工作。只要这三个问题能回答，大多数模型代码就已经读懂了一半。

---
category:
  - 杂记
---

# 02 特征与标签

这一章解释模型真正看到的输入和监督答案。初学时最重要的是始终盯住维度。

## 1. 从波形到 STFT

[`LogMelSalsaLite`](../../src/chicken_seld/features.py) 接受：

```text
[4, samples] 或 [B, 4, samples]
```

10 秒、24 kHz 音频有 240,000 个样本。当前参数为：

| 参数 | 数值 | 直觉 |
|---|---:|---|
| `n_fft` | 960 | FFT 长度，产生 481 个非负频率点 |
| `window_samples` | 960 | 40 ms Hann 窗 |
| `hop_samples` | 480 | 每 20 ms 前进一步 |
| `center` | True | 两侧自动填充，因此 10 秒产生 501 帧 |

`torch.stft()` 后形状为：

```text
[B, 4, 481, 501]
```

它是复数张量，每个点同时包含幅度和相位。

## 2. 四通道 log-mel

先计算功率谱：

```python
power = stft.abs().square()
```

再用 Slaney 规范的 mel 滤波器把 481 个线性频率点压到 64 个 mel 频带，范围是
50–9000 Hz：

```text
[B, 4, 481, 501] → [B, 4, 64, 501]
```

最后取自然对数：

```python
log_mel = torch.log(mel_power.clamp_min(1e-8))
```

`clamp_min` 防止对零取对数。四个通道分别保留每个麦克风收到的频谱能量。

## 3. 三通道 SALSA-Lite

定位依赖麦克风间的到达时间差，而时间差会表现成相位差。代码以麦克风 0 为参考，计算
麦克风 1、2、3 相对它的相位：

```python
phase_difference = angle(stft[:, 1:] * conj(stft[:, :1]))
```

因此产生 3 路相位差，而不是 4 路。每个频率上的理论最大相位尺度为：

```text
maximum_phase = 2π × frequency × reference_distance / speed_of_sound
```

当前参考距离为 0.20 m，声速为 343 m/s。相位差除以该尺度并截到 `[-1, 1]`，然后也
映射到 64 个 mel 频带：

```text
[B, 3, 481, 501] → [B, 3, 64, 501]
```

直觉上，log-mel 更擅长回答“是什么声音”，SALSA-Lite 更擅长提供“声音从哪里来”的
跨通道线索。两者拼接得到：

```text
[B, 7, 64, 501]
```

这里是工程化的轻量 SALSA 特征，不包含完整 SALSA 中的所有空间特征。

## 4. 为什么必须做特征标准化

预计算特征中，log-mel 和 SALSA-Lite 的数值尺度相差很大。若直接送进同一卷积层，
较小的空间特征容易被能量特征淹没。

[`scripts/compute_feature_stats.py`](../../scripts/compute_feature_stats.py) 只遍历训练集缓存，
对每个“通道 × mel 频带”统计全部时间帧的均值和标准差：

```text
mean/std 原始统计形状：[7, 64]
保存形状：             [7, 64, 1]
```

最后一维保留为 1，便于沿时间维广播：

```python
normalized = (features - mean) / std
```

验证集和测试集只使用训练集统计量，不参与统计，避免数据泄漏。

## 5. 特征缓存和在线回退

[`scripts/prepare_features.py`](../../scripts/prepare_features.py) 把每个场景的特征保存为
float16 `.npy`。训练读取时再转换为 float32。这样避免每个 epoch 重复 STFT，当前 972
个缓存共约 0.436 GB。

`ChickenSeldDataset.__getitem__()` 的选择逻辑是：

1. 若缓存存在且缓存通道数等于当前特征器输出通道数，读取缓存；
2. 否则读取 WAV 并现场计算特征；
3. 若存在 `feature_normalization.npz`，执行标准化；
4. 训练集可执行 SpecAugment；
5. 读取 target，返回 `(features, target, scene_id)`。

logmel-only 配置需要 4 通道特征，现有 7 通道缓存不会被误用，而是自动回退到在线计算。

## 6. 训练时的 SpecAugment

`augment=True` 只用于训练集。代码独立进行两种随机遮挡：

- 50% 概率遮挡 1–8 个连续 mel 频带；
- 50% 概率遮挡 1–25 个连续时间帧。

遮挡时所有特征通道同时置零，避免破坏跨麦克风通道之间的对应关系。验证和测试不增强。

## 7. 从事件到 Multi-ACCDOA 标签

[`encode_multi_accdoa()`](../../src/chicken_seld/labels.py) 把事件列表编码成：

```text
[frames, tracks, classes, xyz] = [100, 3, 3, 3]
```

10 秒除以 0.1 秒标签步长得到 100 帧。对事件时间：

```text
start_frame = floor(onset / 0.1)
end_frame   = ceil(offset / 0.1)
```

使用左闭右开区间 `target[start_frame:end_frame]`。例如 onset=0.15、offset=0.36，会覆盖
帧 1、2、3。

## 8. ACCDOA 为什么能同时表示活动和方向

对一个活动声源，标签写入阵列局部坐标中的单位向量：

```text
d = [x, y, z]，且 ||d|| = 1
```

无声时写零向量。于是：

- 向量模长接近 0：不活动；
- 向量模长较大：活动；
- 向量方向：DOA。

模型输出不需要单独的分类概率头和方向回归头，这就是 activity-coupled Cartesian DOA
的核心思想。

## 9. 为什么需要 Multi-ACCDOA

单轨 ACCDOA 对每类每帧只有一个方向。如果两只 `Healthy` 鸡同时从左右两侧叫，单个
向量不能同时指向两个方向。Multi-ACCDOA 为每个类别提供 3 条轨道：

```text
Healthy:   track 0, track 1, track 2
Noise:     track 0, track 1, track 2
Unhealthy: track 0, track 1, track 2
```

当前每个场景总声源数最多为 3，因此 3 tracks 足够。事件按类别和 event_id 排序后，
在各类别内部依次分配轨道。

## 10. 一眼检查标签

对某帧某类的 target：

```python
vectors = target[frame_index, :, class_index]  # [3, 3]
active = np.linalg.norm(vectors, axis=-1) > 0.5
```

`active.sum()` 就是该帧该类的活动声源数。CSV 标签保存相同信息，并额外包含角度、距离、
event_id，适合人工检查；模型训练直接使用 `.npy`。

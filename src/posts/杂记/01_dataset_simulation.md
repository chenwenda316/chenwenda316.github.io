---
category:
  - 杂记
---

# 01 数据集与空间仿真

## 1. 输入数据和类别

入口配置在 [`configs/default.yaml`](../../configs/default.yaml)。原始数据目录按三类组织：

```text
Chicken_Audio_Dataset/
├── Healthy/*.wav
├── Noise/*.wav
└── Unhealthy/*.wav
```

`src/chicken_seld/splits.py::discover_sources()` 扫描这些目录；
`load_source_split()` 再读取已有的 `source_splits.json`，检查每个文件：

- 必须实际存在于源数据目录；
- 只能属于 train、validation、test 中的一个集合；
- 346 个已发现 WAV 都必须包含在划分中。

这是源文件级隔离。后续训练场景只会使用训练源，验证和测试同理，可避免同一段原始
鸡叫经过不同混响后同时出现在训练和测试中。

## 2. 场景规模与比例

配置请求 972 个 10 秒场景：

| 划分 | 场景数 | 占比 | 实际 1/2/3 声源场景 |
|---|---:|---:|---:|
| Train | 720 | 74.07% | 303 / 271 / 146 |
| Validation | 108 | 11.11% | 48 / 41 / 19 |
| Test | 144 | 14.81% | 64 / 53 / 27 |
| 合计 | 972 | 100% | 415 / 365 / 192 |

配置中的 1、2、3 声源抽样概率是 `0.45 / 0.35 / 0.20`，实际比例受随机种子影响，
最终约为 `42.70% / 37.55% / 19.75%`。

数据包含 2.7 小时四通道音频。包含缓存特征后，当前验证大小为 2.325 GB，低于配置的
20 GB 上限，也远低于用户要求的 100 GB。

## 3. 生成入口

[`scripts/generate_dataset.py`](../../scripts/generate_dataset.py) 只负责参数解析：

1. `load_config()` 读取 YAML；
2. `--estimate-only` 调用 `estimate_dataset_bytes()`，只估算、不写数据；
3. 正式生成时调用 `generate_dataset()`；
4. `--resume` 会读取现有 JSONL 清单并跳过已有场景。

真正的仿真逻辑集中在 [`src/chicken_seld/simulator.py`](../../src/chicken_seld/simulator.py)。

## 4. 每个场景的随机化步骤

### 4.1 固定可复现种子

场景种子为：

```text
base_seed + split_offset × 1,000,000 + scene_index
```

同一配置和场景编号会得到相同的随机参数。train、validation、test 使用不同的百万级
偏移，避免随机序列重叠。

### 4.2 选择声源数和源文件

`generate_dataset()` 先按概率选 1–3 个声源。每个场景有一个 coverage anchor：

```text
anchor = split_sources[scene_index % number_of_split_sources]
```

这个循环锚点保证在场景数足够时覆盖所有原始文件。`choose_sources()` 再补齐其余声源。
当声源数不少于 2 时，有 45% 概率尽量强制选成同一类别，这是引入 Multi-ACCDOA 的
关键原因：普通单轨 ACCDOA 无法同时表示同类的多个方向。

### 4.3 随机房间

首先按权重选择房间类型：

| 房间 | 权重 | 长 × 宽 × 高范围（m） |
|---|---:|---|
| compact_coop | 0.75 | 10–18 × 6–12 × 3–4.5 |
| long_barn | 0.25 | 24–42 × 8–15 × 3.2–5 |

实际生成 734 个 compact_coop 和 238 个 long_barn。混响时间 `RT60` 在 0.25–1.0 s
均匀采样，实测均值约 0.640 s。

`pyroomacoustics.inverse_sabine()` 根据 RT60 和房间尺寸反推墙面吸声系数与镜像源阶数；
镜像源阶数最终被 `image_source_max_order=18` 截断。房间使用 `pra.ShoeBox` 构建。

### 4.4 随机四麦阵列

阵列是正四面体。`geometry.py::tetrahedral_positions()` 从四个顶点
`(±1, ±1, ±1)` 的特定组合开始，缩放到指定边长，再做 Z-Y-X 欧拉旋转。

随机项包括：

- 边长：0.12–0.24 m；
- 阵列中心高度：1.4–2.4 m，同时留出房顶边界；
- 水平位置：距离墙面至少约 1.2 m；
- yaw：`[-π, π]`；
- pitch、roll：各约 `[-0.2, 0.2]` rad。

返回的麦克风坐标形状是 `[3, 4]`，即三维坐标 × 四个麦克风。

### 4.5 随机静止声源位置

每个声源位置需要满足：

- 高度 0.25–2.5 m，并受房顶高度限制；
- 距阵列中心 0.8–12.0 m；
- 不贴墙，水平面至少留 0.6 m；
- 与其他声源至少相距 0.5 m。

若 2000 次抽样仍找不到合法点，代码会报错而不是生成异常场景。当前数据实测声源距离
为 0.858–11.973 m，均值约 5.704 m。整个事件期间位置不变，所以 `motion=static`。

### 4.6 截取事件和安排时间

每个选中的源文件贡献一个事件：

1. 从原 WAV 随机截取 0.5–4.0 s；
2. 多通道源先平均为单通道；
3. 若采样率不是 24 kHz，使用 `resample_poly()` 重采样；
4. 补零或截断到目标长度；
5. 去直流、峰值归一化；
6. 加 20 ms 淡入淡出；
7. 随机施加 -9–0 dB 增益；
8. 随机选择事件 onset。

若场景中已经有同类事件，新事件有 85% 概率被安排成与它真实时间重叠，且尽量保证
至少 0.25 s 或允许范围内的一半事件长度。最终 401 个场景含多个同类声源，其中 372 个
存在帧级同类时间重叠。

### 4.7 坐标变换和方向标签来源

房间坐标中的相对位置为：

```text
relative_room = source_position - microphone_center
```

阵列可能随机旋转，因此不能直接把房间方向作为监督信号。代码使用旋转矩阵的逆变换：

```text
relative_array = rotation_matrix(yaw, pitch, roll).T @ relative_room
```

随后计算：

```text
unit_direction = relative_array / ||relative_array||
azimuth = atan2(y, x)
elevation = asin(z / distance)
```

这样，同一种跨通道相位模式始终对应一致的阵列局部方向。距离只写入元数据，不是当前
模型输出目标。

### 4.8 声学渲染和传感器噪声

每个点声源通过 `room.add_source(position, signal, delay=onset)` 放入房间，然后
`room.simulate(recompute_rir=True)` 使用镜像源法产生四个麦克风信号。

渲染完成后：

1. 音频被补齐或截到 240,000 样本；
2. 根据场景信号 RMS 和随机 24–42 dB SNR 加高斯传感器噪声；
3. 整个四通道场景共同峰值归一化到 0.95；
4. 保存为 24 kHz、四通道、PCM-16 WAV。

共同归一化保留通道间幅度关系，但会消除场景之间的绝对声压差异。

## 5. 每个场景生成什么

以 `train_000000` 为例，输出包括：

```text
data/simulated_static/
├── audio/train/train_000000.wav       # 四通道混响音频
├── targets/train/train_000000.npy     # [100, 3, 3, 3]
├── labels/train/train_000000.csv      # 人可读逐帧标签
├── scenes/train/train_000000.json     # 房间、阵列、事件和随机参数
└── metadata/train.jsonl               # 训练场景总清单中的一行
```

数据根目录还包含：

- `source_split.json`：相对路径形式的源文件划分；
- `summary.json`：生成规模和声源数分布；
- `quality_report.json`：完整性、泄漏和随机化统计；
- `features/`：预计算特征；
- `feature_normalization.npz`：只由训练特征计算的均值和标准差。

## 6. 数据质量检查

[`scripts/inspect_dataset.py`](../../scripts/inspect_dataset.py) 会验证：

- 每个音频是否为四通道且采样率、时长正确；
- target 是否为 `[100, 3, 3, 3]` 且没有 NaN/Inf；
- 原始源文件是否跨集合泄漏；
- 346 个源文件是否全部覆盖；
- 房间、类别、RT60、距离、时长、SNR 和同类重叠的实际分布。

当前 `quality_report.json` 中 `errors=[]`、`source_leaks={}`、`valid=true`。

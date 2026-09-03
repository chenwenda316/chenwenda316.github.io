---
category:
  - 杂记
---

# 05 评估与推理

## 1. 从模型向量到事件

模型对每个时间、轨道和类别输出一个 xyz 向量。评估首先按向量模长判断活动：

```python
active = np.linalg.norm(vector) >= activity_threshold
```

验证集校准得到的阈值是 0.60。阈值较低通常提高召回但增加误报；阈值较高通常减少误报，
也可能漏掉较弱事件。

## 2. 合并 ADPIT 辅助重复轨道

一个真实声源在训练 target 中可能被复制到多条轨道。评估不能把这些辅助副本算成多个
声源，所以 `deduplicate_vectors()`：

1. 按向量模长从大到小排序；
2. 逐个与已有簇中心计算夹角；
3. 夹角不超过 15° 就放进同一簇；
4. 每簇输出平均向量。

例如三个预测方向为 2°、7°、90°，前两个会合并，第三个保留为独立声源。

## 3. 预测与标签怎样匹配

评估按“每个时间帧、每个类别”独立处理。对于预测方向集合 P 和标签方向集合 R：

1. 把每个向量归一化；
2. 用点积和 `arccos` 得到两两角距离矩阵；
3. 使用匈牙利算法 `linear_sum_assignment()` 找总角误差最小的一对一匹配；
4. 匹配角度不超过 20° 时记为检测 true positive；
5. 未有效匹配的预测记 false positive，标签记 false negative。

20° 来自 `training.doa_threshold_deg`。

## 4. 当前代码中的指标定义

### 4.1 Macro F1

每个类别先计算：

```text
precision = TP / (TP + FP)
recall    = TP / (TP + FN)
F1        = 2PR / (P + R)
```

再对三个类别取平均。由于 TP 同时要求类别正确且方向误差不超过 20°，这里的 F1 不是单纯
声音分类 F1，而是带定位条件的事件检测 F1。

### 4.2 Error Rate

把全类别 FP 和 FN 汇总：

```text
S = min(total_FP, total_FN)
D = max(0, total_FN - total_FP)
I = max(0, total_FP - total_FN)
ER = (S + D + I) / total_reference_events
```

### 4.3 Localization Error（LE）

对匈牙利算法配成对的预测和标签计算平均夹角，再对类别取宏平均。当前实现会把已配对的
角度都计入 LE，不要求其先小于 20°。

### 4.4 Localization Recall（LR）

```text
LR = localized_pairs / reference_events
```

再对类别取宏平均。这里的 localized pair 指匈牙利算法建立的预测—标签对。

### 4.5 SELD score

四项归一化后等权平均：

```text
SELD = [ER + (1-F1) + LE/180 + (1-LR)] / 4
```

越低越好。训练按验证 SELD score 选择最佳 checkpoint。

这是一套项目内实现的简化帧级指标，不等同于官方 DCASE SELD 评测包。若用于论文横向
对比，应额外接入对应挑战年份的官方指标并注明 segment 长度与匹配规则。

## 5. 为什么只能在验证集调阈值

[`scripts/tune_threshold.py`](../../scripts/tune_threshold.py) 一次性缓存验证预测，然后扫描
0.10–0.80，默认步长 0.05。对每个阈值重新计算指标，选择 SELD score 最低者。

测试集代表未知数据。如果看完测试结果再选择阈值，相当于把测试答案用于调参，会让结果
过于乐观。正确顺序是：

```text
训练集更新模型
→ 验证集选择 checkpoint 和阈值
→ 冻结所有选择
→ 测试集只做最终评估
```

当前验证集选择阈值 0.60，验证 SELD 0.4767。冻结后测试结果为：

| 指标 | 测试结果 |
|---|---:|
| Macro F1 | 0.3488 |
| Error rate | 0.6396 |
| Localization error | 20.94° |
| Localization recall | 0.5576 |
| SELD score | 0.4624 |

## 6. `evaluate.py` 的执行步骤

1. 加载配置；
2. 自动选择 CUDA 或 CPU；
3. 按配置构建相同特征器和模型；
4. 载入 checkpoint 中的 `model` 权重；
5. 构建 validation 或 test DataLoader；
6. 无梯度前向计算；
7. 按指定活动阈值累计指标；
8. 保存总指标及每场景诊断信息到 JSON。

示例：

```powershell
& $python scripts/evaluate.py checkpoints/improved/best.pt `
  --config configs/improved.yaml `
  --split test `
  --activity-threshold 0.60 `
  --output runs/improved_test_evaluation.json
```

注意：输出 JSON 中 `predictions[].active_vectors` 当前固定使用 0.5 做诊断计数，即使指标
使用 `--activity-threshold 0.60`。最终 `metrics` 是按传入阈值计算的，诊断计数不要误当成
0.60 阈值下的数量。

## 7. 单文件推理

[`scripts/infer.py`](../../scripts/infer.py) 接受一个四通道 WAV：

```powershell
& $python scripts/infer.py `
  data/simulated_static/audio/test/test_000000.wav `
  checkpoints/improved/best.pt `
  --config configs/improved.yaml `
  --output runs/inference.json
```

它会检查输入必须是 24 kHz、四通道，然后：

1. 提取 7 通道特征；
2. 若数据根目录有训练统计量，执行标准化；
3. 按音频时长和 0.1 s 标签步长计算输出帧数；
4. 模型前向；
5. 按模长筛选活动向量；
6. 合并 15° 内的辅助重复轨道；
7. 把单位向量转成方位角和俯仰角；
8. 写出逐帧事件 JSON。

每个事件包含：

```json
{
  "frame_index": 12,
  "time_s": 1.2,
  "class_name": "Healthy",
  "track": 0,
  "activity": 0.83,
  "unit_direction": [0.71, -0.69, 0.14],
  "azimuth_deg": -44.2,
  "elevation_deg": 8.0
}
```

## 8. 推理方向如何解释

输出方向位于阵列局部坐标系：

- `+x`：阵列局部前方；
- `+y`：阵列局部左/侧向；
- `+z`：上方；
- azimuth 使用 `atan2(y, x)`；
- elevation 为相对水平面的仰角。

仿真元数据知道阵列姿态，所以可转换回房间坐标。真实部署若要得到绝对方位，必须知道
阵列安装姿态，并把局部向量乘相应旋转矩阵。

## 9. 当前推理阈值注意事项

`infer.py` 当前直接读取配置中的 `training.activity_threshold`。`configs/improved.yaml` 继承的
值仍是 0.5，而实验校准值是 0.60。因此复现实验推理时，应使用一个把
`activity_threshold` 明确覆盖为 0.60 的部署配置；不要误以为阈值调优 JSON 会被自动读取。

## 10. 从逐帧输出变成完整事件

当前推理输出是逐帧记录，没有把相邻帧自动连接成事件。真实应用一般还要增加：

- 同类、相近方向的相邻帧关联；
- 最短持续时间过滤；
- 短间隔事件合并；
- 活动强度平滑；
- 轨迹或静止方向的时间平滑。

这些属于后处理层，不需要改变模型输出协议。

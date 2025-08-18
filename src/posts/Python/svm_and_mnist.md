---
icon: logos:python
date: 2025-8-13 13:00:00
category:
  - python
title: SVM 相关
---


## SVM 是什么

支持向量机是一种基于统计学习理论的监督学习算法，用于解决分类问题。

原生 SVM 只能处理双分类问题，可以通过构建多个 SVM 来实现多分类问题。

支持向量机的优化问题可以表达为，$$\min_{W,b}{\dfrac{1}{2}\left\lVert w \right\rVert} \\ s.t.\quad y_i(w^T\rm{x}+b) \geq1$$

**软间隔和硬间隔**

在现实世界的数据中，往往存在一些噪声或者数据点无法被一个完美的线性超平面完全分隔。
这时就需要引入软间隔支持向量机。它允许一些数据点位于分类超平面的错误一侧或者在间隔内。
为了处理这种情况，引入了松弛变量 $ξi$​，它表示第 $i$ 个数据点违反约束的程度。

软间隔支持向量机的优化问题可以表达为，$$\min_{W,b}{\dfrac{1}{2}\left\lVert w \right\rVert} +C\sum{ξi}\\ s.t.\quad y_i(w^T\rm{x}+b) \geq1 -ξi\quad (ξi​≥0)$$


**非线性支持向量机**

**核技巧**

当数据集不是线性可分的时候，可以通过核技巧将原始数据映射到高维空间中，使得在高维空间的数据可能变为线性可分的。

## 手写数字识别

参考 LeNet，两个卷积层。


```python
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import datasets, transforms
from torch.utils.data import DataLoader


class LeNetLike(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv2d(1, 6, kernel_size=5,
                               padding=2)   
        self.pool1 = nn.AvgPool2d(2, stride=2)
        self.conv2 = nn.Conv2d(6, 16, kernel_size=5)  
        self.pool2 = nn.AvgPool2d(2, stride=2)        

        self.fc1 = nn.Linear(16 * 5 * 5, 120)
        self.fc2 = nn.Linear(120, 84)
        self.fc3 = nn.Linear(84, 10)

    def forward(self, x):
        x = self.pool1(torch.sigmoid(self.conv1(x))) 
        x = self.pool2(torch.sigmoid(self.conv2(x))) 
        x = x.view(x.size(0), -1)                   
        x = torch.sigmoid(self.fc1(x))               
        x = torch.sigmoid(self.fc2(x))               
        x = self.fc3(x)                             
        return x


transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize((0.1307,), (0.3081,))   # MNIST 均值方差，作用是使得更快的拟合
])

train_set = datasets.MNIST(root='./data', train=True,
                           download=True, transform=transform)
test_set = datasets.MNIST(root='./data', train=False,
                          download=True, transform=transform)

train_loader = DataLoader(train_set, batch_size=64, shuffle=True)
test_loader = DataLoader(test_set,  batch_size=1000, shuffle=False)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = LeNetLike().to(device)

optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
criterion = nn.CrossEntropyLoss()


def train(epochs=3):
    model.train()
    for epoch in range(epochs):
        for x, y in train_loader:
            x, y = x.to(device), y.to(device)
            optimizer.zero_grad()
            out = model(x)
            loss = criterion(out, y)
            loss.backward()
            optimizer.step()
        print(f"Epoch {epoch+1}/{epochs}  loss={loss.item():.4f}")


@torch.no_grad()
def test():
    model.eval()
    correct, total = 0, 0
    for x, y in test_loader:
        x, y = x.to(device), y.to(device)
        pred = model(x).argmax(1)
        correct += (pred == y).sum().item()
        total += y.size(0)
    print(f"Test accuracy: {100.*correct/total:.2f}%")


if __name__ == "__main__":
    train(epochs=3)
    test()
```

运行结果：
```
Epoch 1/3  loss=0.3237
Epoch 2/3  loss=0.0983
Epoch 3/3  loss=0.0369
Test accuracy: 96.58%
```









---
icon: logos:python
date: 2025-6-30 02:49:00
category:
  - python
title: Python 快速上手
---

> 人生苦短，我用 Python。

python 是一门解释性语言，代码简洁，经常用来做脚本、胶水语言、脚手架或轻量型框架。python 本身代码运行速度很慢，但得益于它能和别的编程语言高效交互，可以用c/c++来写高性能模块，来弥补速度的不足。简洁易懂的语法和高性能使得python在ai时代基本是首选语言。

这个教程，旨在于能使没有接触过 python 语法，但有编程语言基础的读者能快速上手python并且能用python写东西。

## 环境的搭建

首先是python类型的选择，一般选择 CPython 3.x。

对于初学者和需要管理多个项目依赖的用户，推荐使用 [Anaconda](https://www.anaconda.com/products/distribution) 或 [Miniconda](https://docs.conda.io/en/latest/miniconda.html) 进行 Python 版本和包的管理。Anaconda/Miniconda 都内置了 conda 这个开源的包管理和环境管理工具，可以方便地创建、切换和删除独立的 Python 环境，避免不同项目间的依赖冲突。

Anaconda 适合需要完整科学计算环境的用户，Miniconda 更加精简，适合按需安装。conda 用法可参考官方文档。

## 基础变量

虽然python中不用定义变量，但是也要先赋值再调用。

### 字符串

```python
a_str = "abc"

# 拼接字符串
b_str = a_str + "def"  # 结果为 "abcdef"

# 重复字符串
c_str = a_str * 3      # 结果为 "abcabcabc"

# 获取字符串长度
length = len(a_str)    # 结果为 3

# 字符串切片
sub_str = a_str[1:3]   # 结果为 "bc"

# 分割字符串
split_str = a_str.split("b")  # 结果为 ["a", "c

# 合并字符串
join_str = "-".join(["a", "b", "c"])  # 结果为 "a-b-c"

# 字符串格式化
name = "Tom"
greet = f"Hello, {name}!"  # 结果为 "Hello, Tom!"

# 大小写转换
upper_str = a_str.upper()  # 结果为 "ABC"
lower_str = a_str.lower()  # 结果为 "abc"
title_str = a_str.title()  # 结果为 "Abc"，每个单词首字母大写

# 查找子串
index = a_str.find("b")    # 结果为 1，找不到返回 -1

# 替换子串
new_str = a_str.replace("a", "z")  # 结果为 "zbc"
```

### 数字

```python
# 整数和浮点数
a_int = 10         # 整数
a_float = 3.14     # 浮点数

# 四则运算
add = a_int + 2         # 加法，结果为 12
sub = a_int - 3         # 减法，结果为 7
mul = a_int * 5         # 乘法，结果为 50
div = a_int / 3         # 除法，结果为 3.333...

# 整除和取余
floordiv = a_int // 3   # 整除，结果为 3
mod = a_int % 3         # 取余，结果为 1

# 幂运算
power = a_int ** 2      # 10 的平方，结果为 100

# 绝对值、取整、四舍五入
abs_val = abs(-7)       # 结果为 7
int_val = int(3.99)     # 结果为 3
round_val = round(3.56) # 结果为 4

# 浮点数精度
b = 0.1 + 0.2           # 结果为 0.30000000000000004，不是精确的 0.3

# IEEE 754
# Python 的 float 类型遵循 IEEE 754 标准，浮点数运算存在精度误差。
# 如果需要高精度计算，可以使用 decimal 模块：
from decimal import Decimal
c = Decimal('0.1') + Decimal('0.2')  # 结果为 Decimal('0.3')
```

## 基本操作

### 切片

切片是 Python 的一大特色，可以方便地截取字符串、列表等序列的部分内容。

```python
# 字符串切片
s = "abcdefg"
sub1 = s[1:4]    # 取索引1到3，结果为 "bcd"
sub2 = s[:3]     # 从头到索引2，结果为 "abc"
sub3 = s[3:]     # 从索引3到结尾，结果为 "defg"
sub4 = s[-3:]    # 倒数第3个到结尾，结果为 "efg"
sub5 = s[::2]    # 步长为2，结果为 "aceg"
sub6 = s[::-1]   # 反转字符串，结果为 "gfedcba"
```

切片同样适用于列表、元组等序列类型。

### 打印

打印是 Python 最常用的输出方式，使用 `print()` 函数。`print()` 会自动调用对象的 `str()` 方法（即特殊的 `__str__` 函数），将对象转换为字符串后输出。

```python
a = 123
b = "hello"
print(a)      # 输出 123
print(b)      # 输出 hello

# 同时打印多个变量
x = 1
y = 2
print(x, y)   # 输出 1 2

# 打印表达式结果
print(x + y)  # 输出 3

# 格式化输出
print(f"{x} + {y} = {x + y}")  # 输出 "1 + 2 = 3"

# 不换行
print("Hello", end=" ")  # 输出 Hello 而不换行
print("World")            # 输出 World，结果为 "Hello World"
```

## 流程控制

### 条件语句
```python
# 条件语句
a = int(input())
if a > 0:
    print("正数")
elif a < 0:
    print("负数")
else:
    print("零")
```

### 循环语句
```python
# for 循环
for i in range(5):  # 0 到 4
    print(i)

# while 循环
i = 0
while i < 5:
    print(i)
    i += 1

# 循环遍历列表(或其他可迭代对象，如字符串、元组等)
my_str = "hello"
for char in my_str:
    print(char)

```

## 稍复杂点的变量类型

### 列表
列表是 Python 中最常用的数据结构之一，可以存储多个元素，支持动态大小。

```python
# 创建一个空列表
my_list = []

# 创建一个包含整数的列表
my_list = [1, 2, 3, 4, 5]

# 创建一个包含不同类型元素的列表
mixed_list = [1, "hello", 3.14, True]

# 访问列表元素
first_element = my_list[0]  # 访问第一个元素，结果为 1
last_element = my_list[-1]  # 访问最后一个元素，结果为

# for 循环遍历列表
for item in my_list:
    print(item)

# 列表的常用操作
my_list.append(6)          # 添加元素 6 到列表末尾
my_list.insert(0, 0)      # 在索引 0 处插入元素 0
my_list.remove(3)         # 移除列表中的元素 3
my_list.pop()             # 移除并返回列表的最后一个元素
last_element = my_list.pop()  # 移除并返回最后一个元素，结果为 5
updated_list = my_list + [7, 8]  # 列表拼接，结果为 [0, 1, 2, 4, 6, 7, 8]
my_list.sort()           # 对列表进行排序
my_list.reverse()        # 反转列表

```


### 元组
元组是 Python 中的另一种序列类型，与列表类似，但元组是不可变的。
这里就不再赘述，和列表类似。

### 字典
字典是 Python 中的键值对集合，类似于其他语言中的哈希表或映射。
```python
# 创建一个空字典
my_dict = {}
# 创建一个包含键值对的字典
my_dict = {"name": "Alice", "age": 30, "city": "New York"}
# 访问字典元素
name = my_dict["name"]  # 结果为 "Alice"
# 添加或更新字典元素
my_dict.update({"country": "USA", "city": "Los Angeles"})  # 添加或更新多个键值对
my_dict["age"] = 31  # 更新 age 的值为 31
# 删除字典元素
del my_dict["city"]  # 删除键为 "city" 的元素
# 遍历字典
for key, value in my_dict.items():
    print(f"{key}: {value}")

# 用数字作为键时
num_dict = {1: "one", 2: "two", 3: "three"}
print(num_dict[2])  # 输出 "two"

# 字典的键可以是任意不可变类型（如整数、字符串、元组等）
```

### 集合
集合是 Python 中的无序不重复元素的集合，类似于数学中的集合。
```python
# 创建一个空集合
my_set = set()
# 创建一个包含元素的集合
my_set = {1, 2, 3, 4, 5}
# 添加元素
my_set.add(6)  # 添加元素 6
# 删除元素
my_set.remove(3)  # 删除元素 3
# 集合运算
another_set = {4, 5, 6, 7, 8}
union_set = my_set | another_set  # 并集，结果为 {1, 2, 4, 5, 6, 7, 8}
intersection_set = my_set & another_set  # 交集，结果为 {4, 5, 6}
difference_set = my_set - another_set  # 差集，结果为 {1, 2}
symmetric_difference_set = my_set ^ another_set  # 对称差集，结果为 {1, 2, 7, 8}    
# 遍历集合
for item in my_set:
    print(item)
```

## 函数与lambda表达式
函数是 Python 中的基本构建块，用于封装可重用的代码块。函数可以接受参数并返回值。

```python
# 定义一个简单的函数
def greet(name):
    return f"Hello, {name}!"

# 调用函数
result = greet("Alice")  # 结果为 "Hello, Alice!"

# 定义一个带默认参数的函数
def greet(name="World"):
    return f"Hello, {name}!"

# 调用函数，使用默认参数
result = greet()  # 结果为 "Hello, World!"  

# 定义一个带可变参数的函数
def add(*args):
    return sum(args)

# 调用函数，传入多个参数
result = add(1, 2, 3, 4)  # 结果为 10

# 定义一个带关键字参数的函数
def person_info(name, age, **kwargs):
    info = {"name": name, "age": age}
    info.update(kwargs)
    return info

# 调用函数，传入关键字参数
result = person_info("Alice", 30, city="New York", country="USA")
# 结果为 {'name': 'Alice', 'age': 30, 'city': 'New York', 'country': 'USA'}

# 等效的函数调用
result = person_info(name="Alice", age=30, city="New York", country="USA")

```

### lambda表达式
lambda 表达式是 Python 中的一种匿名函数，可以用来创建简单的函数。

```python
# 定义一个简单的 lambda 表达式
add = lambda x, y: x + y
# 调用 lambda 表达式
# map 操作
mylist = [1, 2, 3, 4, 5]
squared_list = list(map(lambda x: x**2, mylist))  # 结果为 [1, 4, 9, 16, 25]

# filter 操作
even_list = list(filter(lambda x: x % 2 == 0, mylist))  # 结果为 [2, 4]

# sorted 操作
sorted_list = sorted(mylist, key=lambda x: -x)  # 结果为 [5, 4, 3, 2, 1]

```

## 类
类是 Python 中的面向对象编程的核心概念，用于封装数据和行为。

```python
# 定义一个简单的类
class Dog:
    def __init__(self, name, age):
        # self 是显示 this 指针，指向当前实例
        self.name = name  # 实例变量
        self.age = age    # 实例变量

    def bark(self):
        return f"{self.name} says Woof!"
# 创建一个 Dog 类的实例
my_dog = Dog("Buddy", 3)

# 静态方法
class MathUtils:
    @staticmethod
    def add(x, y):
        return x + y
# 调用静态方法
result = MathUtils.add(3, 5)  # 结果为 8

# 静态变量
class Counter:
    count = 0  # 静态变量

    def __init__(self):
        Counter.count += 1  # 每创建一个实例，计数器加1

# 继承&多态
class Animal:
    def __init__(self, name):
        self.name = name

    def speak(self):
        return f"{self.name} makes a sound."

class Dog(Animal):
    def __init__(self, name, age):
        super().__init__(name)  # 调用父类的构造函数
        self.age = age

    def speak(self):
        return f"{self.name} barks."

# 创建 Dog 类的实例
my_dog = Dog("Buddy", 3)
# 调用 Dog 类的方法
print(my_dog.speak())  # 输出 "Buddy barks."

# 抽象类
from abc import ABC, abstractmethod
class Shape(ABC):
    @abstractmethod
    def area(self):
        pass
    
# 私有变量
class Person:
    def __init__(self, name, age):
        self.__name = name  # 私有变量
        self.__age = age    # 私有变量

    def get_name(self):
        return self.__name

    def get_age(self):
        return self.__age

# 创建 Person 类的实例
person = Person("Alice", 30)
# 访问私有变量
print(person.get_name())  # 输出 "Alice"
print(person.get_age())   # 输出 30
```

## 模块与包
Python 的模块和包是组织代码的方式，可以将相关的函数、类和变量封装在一起，便于管理和重用。

### 模块
模块是一个 Python 文件，可以包含函数、类和变量。可以使用 `import` 语句导入模块。

```python   
# 创建一个名为 my_module.py 的模块
def greet(name):
    return f"Hello, {name}!"
# 在另一个 Python 文件中导入模块
import my_module
# 调用模块中的函数
result = my_module.greet("Alice")  # 结果为 "Hello, Alice!"
# 使用别名导入模块
import my_module as mm
result = mm.greet("Bob")  # 结果为 "Hello, Bob!"
# 从模块中导入特定函数
from my_module import greet
result = greet("Charlie")  # 结果为 "Hello, Charlie!"
# 从模块中导入所有内容
from my_module import *
```

### 包
出于篇幅考虑，这里不再赘述包的内容，包是一个包含多个模块的目录，通常包含一个 `__init__.py` 文件。

重点介绍python常用的标准库和第三方库。

## 常用标准库

先列出，之后再补充。

### os
`os` 模块提供了与操作系统交互的功能，如文件和目录操作

### sys
`sys` 模块提供了访问 Python 解释器的变量和函数，如命令行参数、标准输入输出等。

### datetime
`datetime` 模块提供了处理日期和时间的类和函数。

### json
`json` 模块提供了处理 JSON 数据的函数，可以将 Python 对象转换为 JSON 字符串，或将 JSON 字符串解析为 Python 对象。

### re
`re` 模块提供了正则表达式的支持，可以用于字符串匹配和替换。

### random
`random` 模块提供了生成随机数和随机选择的函数。

### math
`math` 模块提供了数学函数和常量，如三角函数、对数函数、平方根等。

## 文件操作

### 读写文件
Python 提供了简单的文件读写操作，可以使用内置的 `open()`
函数打开文件，并使用 `read()`、`write()` 等方法进行读写。

```python
# 打开文件进行读写
with open("example.txt", "w") as f:
    f.write("Hello, World!")  # 写入内容

# 打开文件进行读取
with open("example.txt", "r") as f:
    content = f.read()  # 读取内容
    print(content)  # 输出 "Hello, World!"

# 追加内容到文件
with open("example.txt", "a") as f:
    f.write("\nThis is a new line.")  # 追加内容    

# 不用 with 语句打开文件
f = open("example.txt", "r")
content = f.read()  # 读取内容
f.close()  # 记得关闭文件
```

### 文件路径
Python 提供了 `os.path` 模块来处理文件路径，可以方便地进行路径拼接、分离等操作。

## 异常处理
异常处理是 Python 中处理错误和异常情况的机制，可以使用 `try`、`except`、`finally` 等语句来捕获和处理异常。

```python
# 异常处理示例
try:
    result = 10 / 0  # 可能会引发除以零异常
except ZeroDivisionError as e:
    print(f"发生异常: {e}")  # 输出 "发生异常: division by zero"
except Exception as e:
    print(f"发生其他异常: {e}")
else:
    print(f"结果是: {result}")
finally:
    print("无论是否发生异常，都会执行这段代码。")

```

## 杂项

### 列表推导式
列表推导式是 Python 的一大特色，可以用简洁的语法创建列表
```python
# 创建一个包含 0 到 9 的平方数的列表
squares = [x**2 for x in range(10)]  # 结果为 [0, 1, 4, 9, 16, 25, 36, 49, 64, 81]
# 创建一个包含偶数的列表
evens = [x for x in range(10) if x % 2 == 0]  # 结果为 [0, 2, 4, 6, 8]
# 创建一个包含字符串长度的列表
lengths = [len(word) for word in ["hello", "world", "python"]]  # 结果为 [5, 5, 6]
```

### 解构
解构是 Python 中的一种语法糖，可以方便地将序列或字典的元素赋值给多个变量。

```python   
# 解构列表
a, b, c = [1, 2, 3]  # a=1, b=2, c=3
```

### 生成器
生成器是 Python 中的一种特殊迭代器，可以使用 `yield` 关键字定义。生成器可以按需生成数据，节省内存。

```python
# 定义一个生成器函数
def count_up_to(n):
    count = 1
    while count <= n:
        yield count  # 使用 yield 返回一个值
        count += 1

# 使用生成器
for number in count_up_to(5):
    print(number)  # 输出 1, 2, 3, 4, 5

# 使用生成器表达式
squares = (x**2 for x in range(10))  # 创建一个生成器表达式
for square in squares:
    print(square)  # 输出 0, 1, 4, 9, 16, 25, 36, 49, 64, 81
```

### 装饰器
装饰器是 Python 中的一种特殊函数，可以用来修改或增强其他函数的行为。装饰器通常用于日志记录、权限检查、缓存等场景。

```python
# 定义一个简单的装饰器
def my_decorator(func):
    def wrapper(*args, **kwargs):
        print("Before calling the function.")
        result = func(*args, **kwargs)  # 调用原函数
        print("After calling the function.")
        return result
    return wrapper
# 使用装饰器
@my_decorator
def say_hello(name):
    print(f"Hello, {name}!")

# 调用被装饰的函数
say_hello("Alice")  # 输出 "Before calling the function." "Hello, Alice!" "After calling the function."
```

### 上下文管理器
上下文管理器是 Python 中的一种特殊对象，可以使用 `with` 语句来管理资源的获取和释放。常用于文件操作、数据库连接等场景。

```python
# 定义一个上下文管理器
class MyContextManager:
    def __enter__(self):
        print("Entering the context.")
        return self  # 返回上下文管理器对象

    def __exit__(self, exc_type, exc_value, traceback):
        print("Exiting the context.")
        if exc_type:
            print(f"An exception occurred: {exc_value}")
        return True  # 如果返回 True，表示异常已被处理

# 使用上下文管理器
with MyContextManager() as cm:
    print("Inside the context.")
# 输出 "Entering the context." "Inside the context." "Exiting the context."

```

## 结语
以上是 Python 的快速上手教程，看完应该能对 Python 的基本语法和常用功能有一个初步的了解。语言的学习在于实践，用的多了自然就熟悉了。Python 的生态非常丰富，社区活跃，有很多优秀的第三方库和框架可以使用。建议在学习过程中多动手实践，尝试编写一些小项目来巩固所学知识。
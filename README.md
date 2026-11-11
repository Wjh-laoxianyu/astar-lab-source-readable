# 寻路小队 · A* 互动实验室

一个从动画演示到 Python 源码的 A* 寻路教学项目。通过迷你例题、逐行执行、变量快照、回溯练习和 A* / Dijkstra 同图竞速，理解算法如何选择下一格、更新路线并找到最短路径。

当前为第四版：从看动画到读懂 Python。页面使用原生 HTML、CSS 和 JavaScript，可直接在本地浏览器运行；另附可独立执行的 Python 示例。

## 快速开始

### 打开互动页面

下载或克隆仓库后，用浏览器打开 [`dist/index.html`](dist/index.html)。保留整个 `dist` 目录及其内部结构，页面需要同目录下的脚本、样式和图片。

浏览页面无需安装 Node.js、Python 或第三方依赖，也无需构建。`dist` 中的文件就是可直接运行和编辑的页面源码。

如需通过本地 HTTP 服务访问，在仓库根目录运行：

```bash
python -m http.server 8000 --bind 127.0.0.1 --directory dist
```

然后打开 <http://127.0.0.1:8000>，按 `Ctrl+C` 停止服务。

### 运行 Python 示例

使用 Python 3.7+，无需第三方库。在仓库根目录运行：

```bash
python dist/astar.py
```

示例与网页的 15 格迷你地图一致，最短路线为 **8 步**。`astar(grid, start, goal)` 返回包含起点、终点的坐标列表；终点不可达时返回 `None`。

## 学习顺序与主要功能

建议按页面顺序学习：**A* 简介 → 15 格迷你例题 → 亲手执行代码 → 互动实验室 → 回溯练习 → 博士竞速**。

| 环节 | 可以学到或操作的内容 |
| --- | --- |
| A* 简介 | 理解已走步数 `g`、预估剩余步数 `h` 和候选评分 `f = g + h`。 |
| 15 格迷你例题 | 在 3 × 5 地图上按轮查看搜索记录，预测下一次选择。 |
| 亲手执行代码 | 练习更短路线、保留旧路线、首次发现三种情境；答对后执行，区分临时试算 `new_g` 与保存记录 `g`。 |
| 互动实验室 | 编辑 12 × 9 地图，设置障碍、起点和终点；播放、暂停、单步前进或后退、调整速度、拖动进度，并猜测下一格。 |
| 程序的记事本 | 对照本行执行前后的 `opened`、`closed`、`current`、`nb`、`new_g`、`path` 及每格的 `g`、`f`、`parent`；黄色标出变化值。 |
| 代码阅读 | 点击代码行或聚焦后按 Enter / 空格查看白话解释，展开辅助函数，复制或下载完整 Python。 |
| 回溯练习 | 从终点逐个查找 `parent`、加入列表，再执行 `reverse`；实验室回放也逐步展示这些操作。 |
| 博士竞速 | 在同一地图上比较 A* 与 Dijkstra，查看选点前的候选评分，预测并核对下一回合。 |

实验室提供绕过围墙、曲折走廊、空白地图和无路可走四种场景。开始执行前可点击或拖动编辑地图；需要重新编辑时先重置。代码高亮表示该行已经执行，地图与记事本显示执行后的状态。

### 博士同图竞速

从页首点击「博士竞速」。蓝队 A* 与橙队 Dijkstra 共用赛场、起点与终点，可以选择场景、点击编辑，或使用「使用实验室当前地图」导入上方地图。支持开始 / 暂停、上一回合、下一回合、速度调整、进度回放和重置。

每回合两队各选出一个搜索节点，选中终点也计入搜索回合；找到最短路线后，每回合沿路线走一格：

```text
到达回合 = 搜索回合 + 路径步数
```

这是教学计时，不代表真实运行耗时。搜索时博士留在起点，边框指示当前搜索节点。两队均求最短路，A* 不保证在每张地图上领先。决策表展示本轮选点前的候选和评分，行走阶段会清空。

## 算法与坐标约定

- 只允许上、右、下、左四方向移动，每步代价为 1；`h` 使用曼哈顿距离。
- A* 先比较 `f`，再比较 `h`，完全同分时保留先加入的格子。Dijkstra 按 `g`、加入顺序选择。
- Python 的 `opened` 是保留插入顺序的字典，`None` 仅为占位值；网页算法使用保留插入顺序的 JavaScript `Set`。
- 为便于阅读，候选选择采用线性查找。邻居遍历顺序统一为上、右、下、左，确保 Python 与 JavaScript 的路径选择一致。

| 使用位置 | 坐标或编号约定 | 示例 |
| --- | --- | --- |
| 地图显示标签 | `(列, 行)`，从 1 开始 | `(2, 5)` 表示第 2 列、第 5 行 |
| Python 与程序记事本 | `(行, 列)`，从 0 开始 | 同一格为 `(4, 1)` |
| JavaScript 内部格子编号 | 从 0 开始，从左到右、从上到下 | `编号 = 行 × 地图宽度 + 列`，行列均从 0 开始 |

Python 的 `grid` 是非空矩形二维列表，`0` 表示空地，`1` 表示墙；起点和终点需为地图内可通行的格子。

## 源码导航

| 文件 | 职责 |
| --- | --- |
| [`dist/index.html`](dist/index.html) | 页面结构与脚本入口。 |
| [`dist/astar.js`](dist/astar.js) | 浏览器端 A* 算法；`buildEvents` 生成搜索记录，`recordStep` 保存教学步骤快照。 |
| [`dist/app.js`](dist/app.js) | 实验室地图编辑、播放、代码高亮、问答，以及 18 行 `TEACHING_CODE`。 |
| [`dist/walkthrough.js`](dist/walkthrough.js) | 将同一算法的搜索记录按轮组织为 15 格例题。 |
| [`dist/learning.js`](dist/learning.js) | 变量记事本、逐行解释、执行练习、回溯练习及 Python 展示。 |
| [`dist/astar.py`](dist/astar.py) | 可独立运行的完整 Python 示例，也是网页完整 Python 源码的唯一来源。 |
| [`dist/python-source.js`](dist/python-source.js) | 由同步脚本生成的 Python 内嵌源码，支持直接打开本地 HTML，无需 `fetch`。 |
| [`dist/race-engine.js`](dist/race-engine.js) | 独立于页面的双算法快照与竞速计时。 |
| [`dist/race.js`](dist/race.js) | 竞速地图、博士动画、控制、决策表与结果展示。 |
| `dist/style.css`、`walkthrough.css`、`learning.css`、`race.css` | 页面及各教学模块的样式，均位于 `dist`。 |
| [`dist/assets/`](dist/assets/) | 页面插画与透明底博士跑步素材；生成提示保存在 `doctor-run.prompt.txt`。 |
| [`sync-python.cjs`](sync-python.cjs) | 将 Python 源文件同步到网页内嵌版本。 |

阅读算法时，建议先看 `dist/astar.py` 的 `astar` 主流程，再看 `h`、`init`、`neighbors`、`trace`；了解网页回放时，从 `dist/astar.js` 的 `buildEvents` 开始。

## 修改与校验

维护脚本使用 Node.js 内置模块，无需 `npm install`。建议使用 Node.js 18+；跨语言检查还需要 `python` 命令可用。

### 同步 Python 源码

修改 `dist/astar.py` 后，在仓库根目录运行：

```bash
node sync-python.cjs
```

将更新后的 `dist/astar.py` 与生成的 `dist/python-source.js` 一并提交，不要直接编辑生成文件。网页的 18 行教学主流程单独定义在 `dist/app.js` 的 `TEACHING_CODE` 中；修改教学流程时，还需同步检查 `dist/astar.js` 的 `recordStep` 行号映射与 `dist/learning.js` 中对应的逐行解释。

### 运行检查

在仓库根目录运行：

```bash
node check.cjs
node check-race.cjs
node check-learning.cjs
node check-learning-ui.cjs
```

| 脚本 | 环境要求 | 检查内容 |
| --- | --- | --- |
| `check.cjs` | Node.js | 100 张随机地图的 A* 最短步数与独立 BFS 结果、路线合法性、无路提示和候选优先级。 |
| `check-race.cjs` | Node.js | 100 张随机地图及平局、无路、单列、起终点相同等边界；验证两队最短路径、A* 与教学搜索次序一致性、行走回合与快照独立性。 |
| `check-learning.cjs` | Node.js + Python | 103 张地图的 Python / JavaScript 完整路径一致性、回溯快照、选点前候选评分表及内嵌 Python 源码同步。 |
| `check-learning-ui.cjs` | Node.js | 使用轻量 DOM 替身验证答题、重做、回溯和记事本状态切换。 |

交互状态检查不替代真实浏览器的布局检查。修改页面或样式后，应打开 `dist/index.html` 检查显示与实际操作。

如果 `check-learning.cjs` 提示「修改 Python 后请运行 node sync-python.cjs」，先运行同步命令再重试。该检查会逐字符比较源文件与内嵌文本，Windows 检出时的 CRLF / LF 换行转换也可能触发此提示。

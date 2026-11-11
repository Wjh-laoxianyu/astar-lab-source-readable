# 寻路小队 · 第四版：从看动画到读懂 Python

解压后用浏览器打开 `dist/index.html`。页面可以直接运行，无需安装依赖。

## 阅读顺序

1. 在页面中按 **A* 简介 → 15 格迷你例题 → 亲手执行代码 → 互动实验室 → 回溯练习 → 博士竞速** 的顺序学习：先理解 g、h、f，再预测变量变化，最后对照真实地图验证。
2. **`dist/astar.js`**：看 `buildEvents`。它用候选表找最短路线，并用 `recordStep` 记录每个教学步骤。辅助函数分别负责计算距离、选择候选格、查找邻居和回溯路线。
3. **`dist/walkthrough.js`**：读取同一份搜索记录，把它按轮展示成 15 格例题。
4. **`dist/app.js`**：负责完整实验室的地图编辑、播放、代码高亮和问答。
5. **`dist/index.html`、`dist/style.css`、`dist/walkthrough.css`**：页面结构和样式。插画在 `dist/assets`。

页面显示的 Python 教学代码由 `app.js` 中的 `TEACHING_CODE` 定义，浏览器执行的算法在 `astar.js`。两者通过 `recordStep` 的行号对应。

## 第四版新增教学环节

- **程序的记事本**：同步展示本行执行前后的 opened、closed、current、nb、new_g、path，以及每格的 g、f、parent；黄色标记发生变化的值。上一步、重置、进度拖动都会同步更新。
- **亲手执行代码**：独立练习一次邻居检查，覆盖更短路线、保留旧路线、首次发现三种情境。答对后才执行，明确区分临时试算 new_g 与保存记录 g。
- **逐行白话解释**：代码行支持点击或 Enter / 空格查看说明。辅助函数可展开阅读，完整 Python 可复制、下载。
- **回溯练习**：从终点查 parent、逐个加入列表，再执行 reverse。实验室的真实回放也逐步显示查表、添加、反转，而不是直接播放已算好的路线。
- **竞速决策表**：显示各队本轮选点前的完整候选和评分，突出实际选中者；可先猜下一回合，分别选格、核对，再推进地图。行走阶段清空决策表，避免把上一轮选择误认为当前选择。

新增文件：`dist/learning.js`（教学交互）、`dist/learning.css`（样式）、`dist/astar.py`（完整 Python）。

## 运行和阅读 Python

```text
python dist/astar.py
```

使用 Python 3.7+，无第三方依赖。内置 15 格地图的最短路线为 8 步。建议先读 astar 主流程，再按需要读 h、init、neighbors、trace；每个函数都有参数和返回值注释。

Python 用 `(行, 列)` 零基坐标；地图标签用 `(列, 行)` 一基坐标。例如地图 `(2, 5)` 对应 Python `(4, 1)`。记事本采用 Python 坐标。

opened 在 Python 中是有插入顺序的字典，None 为占位值；网页算法使用保留插入顺序的 JavaScript Set。两者都先比较 f、再比较 h，完全同分则保留先加入的格子。邻居顺序都为上、右、下、左。

`dist/astar.py` 是完整示例的唯一来源。修改后运行 `node sync-python.cjs` 更新网页内嵌的 `dist/python-source.js`；这种内嵌方式支持直接打开本地 HTML，无需 fetch 或服务器。18 行教学主流程仍在 `app.js`，调整流程时须同步行号映射。

格子编号从 0 开始，从左到右、从上到下。页面给读者看的坐标从 1 开始。地图只允许上下左右移动，每走一格的代价为 1。

## 校验算法

如果已安装 Node.js，可以在解压目录中运行：

```text
node check.cjs
node check-race.cjs
node check-learning.cjs
node check-learning-ui.cjs
```

脚本会将 A* 和广度优先搜索在 100 张地图上的结果进行比较。

第四版检查还会对照 Python 与 JavaScript 的完整路径，校验回溯快照、候选评分表和 Python 内嵌源码一致性。`check-learning-ui.cjs` 使用轻量 DOM 替身验证答题、回溯和记事本状态切换，不替代真实浏览器的布局检查。

## 博士同图竞速

从页首点击「博士竞速」。蓝队 A* 与橙队 Dijkstra 共用一个赛场、起点与终点，可以选择场景、点击编辑，或导入上方实验室当前地图。支持开始 / 暂停、上一回合、下一回合、倍速、进度回放和重赛。

每回合两队各选出一个搜索节点（含选出的终点）；各自找到最短路线后，每回合沿路线走一格。到达回合 = 搜索回合 + 路径步数，只是公平的教学计时，不代表真实运行耗时。搜索时博士留在起点，边框指示当前搜索节点。两队均求最短路，A* 不保证在每张地图上领先。

- `dist/race-engine.js`：独立于页面的双算法快照与竞速计时。A* 按 f、h、加入顺序选择，Dijkstra 按 g、加入顺序选择。
- `dist/race.js`、`dist/race.css`：同图显示、博士动画、控制与结果。
- `dist/assets/doctor-run.png`：内置 imagegen 生成的透明底博士跑步素材；原始生成提示见 `dist/assets/doctor-run.prompt.txt`。

运行 `node check-race.cjs` 校验两种算法的最短路径、教学 A* 一致性、行走回合、无路及平局。

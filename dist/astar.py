"""A* 入门示例：Python 3.7+，无需安装第三方库。

坐标统一采用 (行, 列)，从 0 开始。grid 中 0 是空地，1 是墙。
只允许上下左右移动，每步代价为 1；用曼哈顿距离估计剩余步数。
运行：python astar.py
"""

from math import inf


def h(cell, goal):
    """计算忽略墙时的剩余步数。

    参数 cell、goal：当前格和终点的 (行, 列) 元组。
    返回值：非负整数，即横向距离加纵向距离。
    """
    row_distance = abs(cell[0] - goal[0])
    column_distance = abs(cell[1] - goal[1])
    return row_distance + column_distance


def init(start, goal):
    """建立起点的记录；start、goal 都是 (行, 列) 元组。

    返回 g、f、parent 三个字典，以及 closed 集合。
    g 记录目前找到的最好步数，f 记录 g+h，parent 记录来路。
    """
    g = {start: 0}
    f = {start: h(start, goal)}
    parent = {}
    closed = set()
    return g, f, parent, closed


def neighbors(grid, current):
    """列出一步可达的格子，顺序固定为上、右、下、左。

    参数 grid：非空矩形地图（由 0、1 组成的二维列表）。
    参数 current：地图内的 (行, 列) 元组。
    返回值：排除了越界位置和墙的坐标列表。
    """
    row, column = current
    height = len(grid)
    width = len(grid[0])
    possible_cells = [
        (row - 1, column),
        (row, column + 1),
        (row + 1, column),
        (row, column - 1),
    ]
    walkable_cells = []
    for next_row, next_column in possible_cells:
        inside_map = 0 <= next_row < height and 0 <= next_column < width
        if inside_map and grid[next_row][next_column] == 0:
            walkable_cells.append((next_row, next_column))
    return walkable_cells


def trace(parent, goal):
    """沿来路记录倒推，再反转成从起点出发的路径。

    参数 parent：格子到前一个格子的字典，由 astar 建立。
    参数 goal：已经找到的终点坐标。
    返回值：包含起点、终点的坐标列表。
    """
    current = goal
    path = [goal]
    while current in parent:
        current = parent[current]
        path.append(current)
    path.reverse()
    return path


def astar(grid, start, goal):
    """返回最短路径；不可达时返回 None。

    参数 grid：非空矩形地图，0 可走，1 不可走。
    参数 start、goal：地图内可通行的 (行, 列) 元组。
    opened 使用有插入顺序的字典，值 None 只是占位。
    min 先比较 f，再比较 h；完全相同时保留先加入的格子。
    这里采用直观的线性查找，便于阅读和与网页逐步对照。
    """
    opened = {start: None}
    g, f, parent, closed = init(start, goal)
    while opened:
        current = min(opened, key=lambda cell: (f[cell], h(cell, goal)))
        if current == goal:
            return trace(parent, goal)
        del opened[current]
        closed.add(current)
        for nb in neighbors(grid, current):
            if nb in closed:
                continue
            new_g = g[current] + 1
            # 没有旧记录时，inf（无穷大）让第一次到达也能通过比较。
            if new_g < g.get(nb, inf):
                parent[nb] = current
                g[nb] = new_g
                f[nb] = new_g + h(nb, goal)
                opened[nb] = None
    return None


if __name__ == "__main__":
    # 与网页的 15 格迷你例题一致：3 行、5 列。
    example_grid = [
        [0, 0, 0, 1, 0],
        [0, 0, 1, 1, 0],
        [0, 0, 0, 0, 0],
    ]
    result = astar(example_grid, start=(0, 0), goal=(0, 4))
    if result is None:
        print("终点不可达")
    else:
        print("最短路线：", result)
        print("步数：", len(result) - 1)

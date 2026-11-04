/**
 * A* 搜索和教学步骤。这个文件独立于界面，可以先单独阅读。
 *
 * 格子编号从 0 开始，从左到右、从上到下递增。
 * 例如宽度为 5 时，第二行第一列的编号是 5。
 */

/**
 * 将一维编号转换为方便读者查看的坐标，从 1 开始计数。
 * @param {number} cell 格子编号。
 * @param {number} width 地图的列数。
 * @returns {string} 格式为「(列, 行)」的坐标。
 */
function formatCoordinate(cell, width) {
    const column = cell % width + 1;
    const row = Math.floor(cell / width) + 1;
    return `(${column}, ${row})`;
}

/**
 * 计算横向距离加纵向距离，也就是曼哈顿距离。
 * @param {number} from 出发格的编号。
 * @param {number} to 目标格的编号。
 * @param {number} width 地图的列数。
 * @returns {number} 忽略墙时至少需要走的步数。
 */
function manhattanDistance(from, to, width) {
    const columnDistance = Math.abs(from % width - to % width);
    const rowDistance = Math.abs(Math.floor(from / width) - Math.floor(to / width));
    return columnDistance + rowDistance;
}

/**
 * 挑出下一轮要检查的格子。候选集合必须非空。
 * @param {Iterable<number>} candidates 按加入顺序保存的候选格。
 * @param {Object<number, number>} totalCosts 每个候选格的 f 值。
 * @param {number} target 终点格的编号。
 * @param {number} width 地图的列数。
 * @returns {number} 本轮选中的格子编号。
 */
function chooseNextCell(candidates, totalCosts, target, width) {
    let bestCell = null;
    for (const cell of candidates) {
        if (bestCell === null || totalCosts[cell] < totalCosts[bestCell]) {
            bestCell = cell;
        } else if (totalCosts[cell] === totalCosts[bestCell]) {
            const remaining = manhattanDistance(cell, target, width);
            const bestRemaining = manhattanDistance(bestCell, target, width);
            if (remaining < bestRemaining) {
                bestCell = cell;
            }
            // f 和 h 都一样时，保留先加入的候选格。
        }
    }
    return bestCell;
}

/**
 * 列出可以从当前格一步走到的邻格。
 * @param {number} cell 当前格编号。
 * @param {number} width 地图的列数。
 * @param {number} height 地图的行数。
 * @param {Set<number>} barriers 墙的格子编号。
 * @returns {number[]} 按上、右、下、左顺序排列的可通行邻格。
 */
function getWalkableNeighbors(cell, width, height, barriers) {
    const row = Math.floor(cell / width);
    const column = cell % width;
    const neighbors = [];

    if (row > 0) neighbors.push(cell - width);
    if (column < width - 1) neighbors.push(cell + 1);
    if (row < height - 1) neighbors.push(cell + width);
    if (column > 0) neighbors.push(cell - 1);

    return neighbors.filter(neighbor => !barriers.has(neighbor));
}

/**
 * 顺着每格记下的来路，从终点倒推回起点。
 * @param {Object<number, number>} parents 每格对应的前一个格子。
 * @param {number} origin 起点格的编号。
 * @param {number} target 终点格的编号。
 * @returns {number[]} 从起点到终点的完整路线，包含两端。
 */
function reconstructPath(parents, origin, target) {
    const route = [target];
    let cell = target;
    while (cell !== origin) {
        cell = parents[cell];
        route.push(cell);
    }
    return route.reverse();
}

/**
 * 在四方向、每步代价为 1 的地图上运行 A*，记录可回放的步骤。
 * @param {object} map 地图参数。
 * @param {number} map.origin 起点格的编号。
 * @param {number} map.target 终点格的编号。
 * @param {Set<number>} map.barriers 墙的格子编号。
 * @param {number} map.width 地图的列数。
 * @param {number} map.height 地图的行数。
 * @returns {object[]} 按执行顺序排列的快照。末帧的 path 是最短路线，无路时为空。
 */
function buildEvents({ origin, target, barriers, width, height }) {
    const events = [];
    const candidates = new Set();
    const checkedCells = new Set();
    const costsFromStart = {};
    const totalCosts = {};
    const parents = {};
    const displayedPath = [];
    let currentCell = null;
    let focusedCell = null;

    /**
     * 记录当前状态。复制表和集合，后续的搜索就不会改写之前的步骤。
     * @param {number} line 页面里 Python 教学代码的行号。
     * @param {string} title 本步操作的标题。
     * @param {string} text 显示在页面上的解说。
     */
    function recordStep(line, title, text) {
        events.push({
            line,
            title,
            text,
            current: currentCell,
            focus: focusedCell,
            open: [...candidates],
            closed: [...checkedCells],
            g: { ...costsFromStart },
            f: { ...totalCosts },
            parent: { ...parents },
            path: [...displayedPath],
        });
    }

    candidates.add(origin);
    recordStep(2, '把起点放进待探索集合',
        '先把起点放进蓝色候选名单。候选格子只是可能走到的位置，还不是最终路线。');

    costsFromStart[origin] = 0;
    totalCosts[origin] = manhattanDistance(origin, target, width);
    recordStep(3, '起点的实际代价是 0',
        '还没有迈出一步，所以 g = 0；起点的 f 等于到终点的曼哈顿距离。');

    while (candidates.size > 0) {
        recordStep(4, '还有候选格，继续寻找',
            `待探索集合里有 ${candidates.size} 格。只要候选名单不为空，就继续搜索。`);

        // 核心一：每一轮都比较整张候选表，而不是只看当前格的邻居。
        currentCell = chooseNextCell(candidates, totalCosts, target, width);
        focusedCell = currentCell;
        const currentLabel = formatCoordinate(currentCell, width);
        const currentEstimate = manhattanDistance(currentCell, target, width);
        recordStep(5, '选出预计总代价最小的一格',
            `在所有蓝色候选格中，选择 f 最小的 ${currentLabel}：`
            + `g=${costsFromStart[currentCell]}，h=${currentEstimate}，f=${totalCosts[currentCell]}。`
            + '平局时优先 h 较小的，再按加入顺序。');

        const reachedTarget = currentCell === target;
        recordStep(6, '检查：到补给站了吗？', reachedTarget
            ? '到达目标！现在沿父节点回溯路线。'
            : '还没到终点，接下来从这格向四周探索。');

        // 核心二：终点被选中时，再沿记录好的来路取出完整路径。
        if (reachedTarget) {
            const route = reconstructPath(parents, origin, target);
            for (const cell of route) {
                displayedPath.push(cell);
                recordStep(7, '沿着路标，还原最短路径',
                    `每次更新代价时留下的父节点，就是回程路标。最短路径一共 ${route.length - 1} 步。`);
            }
            return events;
        }

        candidates.delete(currentCell);
        recordStep(8, '从待探索名单中取出', '已经选定当前格，将它从蓝色候选名单中移除。');
        checkedCells.add(currentCell);
        recordStep(9, '标记为已探索', '当前格变为绿色，表示它已经被正式探索。');

        const neighbors = getWalkableNeighbors(currentCell, width, height, barriers);
        for (const neighbor of neighbors) {
            focusedCell = neighbor;
            const neighborLabel = formatCoordinate(neighbor, width);
            recordStep(10, '查看一个可通行的邻居',
                `查看 ${neighborLabel}。只能上下左右走，不能穿过灰色障碍。`);

            const alreadyChecked = checkedCells.has(neighbor);
            recordStep(11, '这个邻居已经探索过吗？', alreadyChecked
                ? '它已经是绿色的已探索格，直接跳过。'
                : '它还没有被正式探索，继续计算到达它的代价。');
            if (alreadyChecked) continue;

            // 核心三：只有发现更短的来路，才覆盖邻格原来的 g 和来路记录。
            const newCost = costsFromStart[currentCell] + 1;
            const oldCost = costsFromStart[neighbor];
            recordStep(12, '试算：再走一步的代价',
                `从当前格走到邻居只需 1 步：new_g = ${costsFromStart[currentCell]} + 1 = ${newCost}。`);

            const firstVisit = oldCost === undefined;
            const improvesRoute = firstVisit || newCost < oldCost;
            let comparison;
            if (firstVisit) {
                comparison = '第一次发现这个位置，可以记录这条路线。';
            } else if (improvesRoute) {
                comparison = `新代价 ${newCost} 小于原代价 ${oldCost}，更新路线。`;
            } else {
                comparison = `新代价 ${newCost} 不小于原代价 ${oldCost}，保留已有路线。`;
            }
            recordStep(13, '新路线，会不会更便宜？', comparison);
            if (!improvesRoute) continue;

            parents[neighbor] = currentCell;
            recordStep(14, '记下从哪里走来',
                `把 ${currentLabel} 记作这个邻居的父节点，以后靠它回溯路径。`);

            costsFromStart[neighbor] = newCost;
            recordStep(15, '记录实际走过的代价',
                `到达 ${neighborLabel} 的已知最小代价 g 更新为 ${newCost}。`);

            const estimate = manhattanDistance(neighbor, target, width);
            totalCosts[neighbor] = newCost + estimate;
            recordStep(16, '估计这条路线的总长度',
                `f = g + h = ${newCost} + ${estimate} = ${totalCosts[neighbor]}。`
                + 'h 忽略障碍，按横向距离加纵向距离估算。');

            candidates.add(neighbor);
            recordStep(17, '加入候选，稍后比较',
                '把这个邻居加入蓝色待探索集合。下一轮会在所有候选中重新比较，而非只看当前格的邻居。');
        }
    }

    currentCell = null;
    focusedCell = null;
    recordStep(18, '没有路可以到达补给站',
        '待探索集合已经为空，仍未到达终点。这张地图没有可通行路线。点击 ↺ 后试着拆掉几块障碍。');
    return events;
}

// 浏览器按 HTML 中的顺序加载脚本。Node.js 用同一份算法做校验。
if (typeof module === 'object') {
    module.exports = { buildEvents, chooseNextCell, manhattanDistance };
}

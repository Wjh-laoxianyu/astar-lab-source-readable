const assert = require('node:assert/strict');
const { buildEvents } = require('./dist/astar.js');

const WIDTH = 12;
const HEIGHT = 9;
const CELL_COUNT = WIDTH * HEIGHT;
let seed = 71;

/**
 * 生成可重复的伪随机数。固定种子让每次校验使用同一批地图。
 * @returns {number} 大于等于 0、小于 1 的小数。
 */
function nextRandom() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
}

/**
 * 用广度优先搜索独立计算答案。每一步代价相同，按步数一层层找即可。
 * @param {number} start 起点格编号。
 * @param {number} goal 终点格编号。
 * @param {Set<number>} walls 不可通行格的编号集合。
 * @returns {number} 最少步数，无路时返回 -1。
 */
function shortestDistanceByBfs(start, goal, walls) {
    const queue = [{ cell: start, steps: 0 }];
    const visited = new Set([start]);

    for (let index = 0; index < queue.length; index++) {
        const { cell, steps } = queue[index];
        if (cell === goal) return steps;

        const column = cell % WIDTH;
        const row = Math.floor(cell / WIDTH);
        const adjacentCoordinates = [
            [column, row - 1], [column + 1, row],
            [column, row + 1], [column - 1, row],
        ];
        for (const [x, y] of adjacentCoordinates) {
            if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) continue;
            const neighbor = y * WIDTH + x;
            if (walls.has(neighbor) || visited.has(neighbor)) continue;
            visited.add(neighbor);
            queue.push({ cell: neighbor, steps: steps + 1 });
        }
    }
    return -1;
}

/** 用 100 张地图比较 A* 与 BFS，并检查路线、无路提示和候选优先级。 */
function checkRandomMaps() {
    for (let test = 0; test < 100; test++) {
        const start = Math.floor(nextRandom() * CELL_COUNT);
        let goal = Math.floor(nextRandom() * CELL_COUNT);
        if (start === goal) goal = (goal + 1) % CELL_COUNT;

        const walls = new Set();
        for (let cell = 0; cell < CELL_COUNT; cell++) {
            if (cell !== start && cell !== goal && nextRandom() < 0.28) walls.add(cell);
        }

        const events = buildEvents({
            origin: start, target: goal, barriers: walls, width: WIDTH, height: HEIGHT,
        });
        const last = events.at(-1);
        const expected = shortestDistanceByBfs(start, goal, walls);
        const actual = last.path.length > 0 ? last.path.length - 1 : -1;
        assert.equal(actual, expected);
        if (expected < 0) {
            assert.equal(last.line, 18);
        } else {
            assert.equal(last.path[0], start);
            assert.equal(last.path.at(-1), goal);
            for (let index = 1; index < last.path.length; index++) {
                const previous = last.path[index - 1];
                const current = last.path[index];
                const columnChange = Math.abs(previous % WIDTH - current % WIDTH);
                const rowChange = Math.abs(Math.floor(previous / WIDTH) - Math.floor(current / WIDTH));
                assert.equal(columnChange + rowChange, 1);
                assert.ok(!walls.has(current));
            }
        }

        for (const event of events.filter(step => step.line === 5)) {
            assert.ok(event.open.includes(event.current));
            assert.equal(event.f[event.current], Math.min(...event.open.map(cell => event.f[cell])));
        }
    }
    console.log('通过：100 张随机地图的最短步数与 BFS 一致。');
}

checkRandomMaps();

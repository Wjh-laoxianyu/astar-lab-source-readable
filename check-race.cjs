const assert = require('node:assert/strict');
const { buildRaceFrames } = require('./dist/race-engine.js');
const { buildEvents } = require('./dist/astar.js');

// 独立 BFS 作为最短路径基准，不使用竞速引擎的邻居或优先级实现。
function bfs(map) {
    const queue = [[map.start, 0]];
    const visited = new Set([map.start]);
    for (const [cell, steps] of queue) {
        if (cell === map.goal) return steps;
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
            const x = cell % map.width + dx;
            const y = Math.floor(cell / map.width) + dy;
            const next = y * map.width + x;
            if (x < 0 || x >= map.width || y < 0 || y >= map.height
                || map.walls.has(next) || visited.has(next)) continue;
            visited.add(next);
            queue.push([next, steps + 1]);
        }
    }
    return -1;
}

function verify(map) {
    const original = [...map.walls];
    const frames = buildRaceFrames(map);
    const expected = bfs(map);
    assert.deepEqual([...map.walls], original, '不修改输入地图');
    assert.ok(frames.length <= map.width * map.height * 2 + 1, '搜索和行走必须结束');
    const teaching = buildEvents({ origin: map.start, target: map.goal,
        barriers: map.walls, width: map.width, height: map.height });
    const teachingOrder = teaching.filter(step => step.line === 5).map(step => step.current);
    assert.deepEqual(frames.at(-1)[0].closed, teachingOrder, '竞速 A* 与教学 A* 的搜索次序一致');
    for (const team of frames.at(-1)) {
        assert.equal(team.route.length ? team.route.length - 1 : -1, expected);
        assert.equal(team.phase, expected < 0 ? 'unreachable' : 'arrived');
        assert.equal(team.position, expected < 0 ? map.start : map.goal);
        assert.equal(new Set(team.closed).size, team.closed.length);
        if (expected >= 0) {
            assert.equal(team.arrivedAt, team.foundAt + expected);
            assert.equal(team.foundAt, team.closed.length);
            assert.equal(team.route[0], map.start);
            assert.equal(team.route.at(-1), map.goal);
        } else assert.equal(team.arrivedAt, null);
        for (let i = 1; i < team.route.length; i++) {
            const a = team.route[i - 1], b = team.route[i];
            assert.equal(Math.abs(a % map.width - b % map.width)
                + Math.abs(Math.floor(a / map.width) - Math.floor(b / map.width)), 1);
            assert.ok(!map.walls.has(b));
        }
    }
    for (let tick = 1; tick < frames.length; tick++) {
        for (let i = 0; i < 2; i++) {
            const before = frames[tick - 1][i], after = frames[tick][i];
            assert.ok(after.closed.length - before.closed.length <= 1, '每回合最多选出一格');
            if (before.phase === 'searching') assert.equal(after.position, map.start, '搜索阶段角色留在起点');
            if (before.phase === 'running') assert.equal(after.walked, before.walked + 1);
            if (before.phase === 'arrived' || before.phase === 'unreachable') assert.deepEqual(after, before);
        }
    }
    assert.equal(frames[0][0].closed.length, 0, '历史快照保持独立');
    return frames;
}

let seed = 20261110;
const random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
for (let i = 0; i < 100; i++) {
    const start = Math.floor(random() * 108), goal = Math.floor(random() * 108);
    const walls = new Set();
    for (let cell = 0; cell < 108; cell++) {
        if (cell !== start && cell !== goal && random() < .3) walls.add(cell);
    }
    verify({ width: 12, height: 9, start, goal, walls });
}
const tie = verify({ width: 5, height: 1, start: 0, goal: 4, walls: new Set() });
assert.equal(tie.at(-1)[0].arrivedAt, tie.at(-1)[1].arrivedAt);
verify({ width: 3, height: 1, start: 0, goal: 2, walls: new Set([1]) });
verify({ width: 1, height: 5, start: 0, goal: 4, walls: new Set() });
verify({ width: 1, height: 1, start: 0, goal: 0, walls: new Set() });
const empty = verify({ width: 12, height: 9, start: 49, goal: 58, walls: new Set() });
assert.ok(empty.at(-1)[0].closed.length < empty.at(-1)[1].closed.length);
console.log('通过：竞速 100 张随机地图、平局、无路、单列及同点边界；路径与 BFS 一致，A* 搜索次序与教学一致。');

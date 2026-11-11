/** 校验跨语言一致性、真实回溯步骤及竞速的选点前快照。 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { spawnSync } = require('node:child_process');
const { buildEvents } = require('./dist/astar.js');
const { buildRaceFrames } = require('./dist/race-engine.js');

const source = fs.readFileSync(path.join(__dirname, 'dist/astar.py'), 'utf8');
const embedded = vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'dist/python-source.js'), 'utf8') + '\nPYTHON_SOURCE');
assert.equal(embedded, source, '修改 Python 后请运行 node sync-python.cjs');

let seed = 412;
function random() {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
}
const maps = [
    { width: 5, height: 3, origin: 0, target: 4, walls: [3, 7, 8] },
    { width: 1, height: 1, origin: 0, target: 0, walls: [] },
    { width: 3, height: 1, origin: 0, target: 2, walls: [1] },
];
for (let index = 0; index < 100; index++) {
    const width = 8;
    const height = 6;
    const origin = Math.floor(random() * width * height);
    const target = Math.floor(random() * width * height);
    const walls = [];
    for (let cell = 0; cell < width * height; cell++) {
        if (cell !== origin && cell !== target && random() < 0.25) walls.push(cell);
    }
    maps.push({ width, height, origin, target, walls });
}

const expectedPaths = maps.map(map => {
    const events = buildEvents({ ...map, barriers: new Set(map.walls) });
    const original = JSON.stringify(events[0]);
    const trace = events.filter(event => event.line === 7);
    if (trace.length) {
        assert.deepEqual(trace[0].path, [map.target]);
        assert.equal(trace.at(-1).traceCode, 'path.reverse()');
        assert.deepEqual(trace.at(-1).path, [...trace.at(-2)?.path || [map.target]].reverse());
        for (let index = 1; index < trace.length - 1; index++) {
            const event = trace[index];
            const previous = trace[index - 1];
            if (event.traceCode === 'current = parent[current]') {
                assert.equal(event.traceCell, event.parent[previous.traceCell]);
                assert.deepEqual(event.path, previous.path, '查表不能提前添加列表');
            } else {
                assert.deepEqual(event.path, [...previous.path, event.traceCell]);
            }
        }
    }
    for (const event of events) {
        if (event.line === 12) assert.equal(event.new_g, event.g[event.current] + 1);
        if (event.line === 14) assert.equal(event.parent[event.neighbor], event.current);
    }
    assert.equal(JSON.stringify(events[0]), original);

    const frames = buildRaceFrames({ ...map, start: map.origin, goal: map.target, walls: new Set(map.walls) });
    for (let round = 1; round < frames.length; round++) {
        frames[round].forEach((team, index) => {
            if (!team.decision.length) return;
            assert.deepEqual(team.decision.map(candidate => candidate.cell), frames[round - 1][index].open);
            const sorted = [...team.decision].sort((a, b) => a.f - b.f || a.h - b.h);
            assert.equal(team.chosen, sorted[0].cell);
            team.decision.forEach(candidate => {
                assert.equal(candidate.f, candidate.g + candidate.h);
                if (index === 1) assert.equal(candidate.h, 0);
            });
        });
    }
    return events.at(-1).path.length ? events.at(-1).path : null;
});

// 只运行仓库自己的 Python；参数用独立 argv 传递，不拼接 shell 命令。
const runner = `
import json, sys
sys.path.insert(0, 'dist')
from astar import astar
answers = []
for item in json.load(sys.stdin):
    width, height = item['width'], item['height']
    walls = set(item['walls'])
    grid = [[int(row * width + column in walls) for column in range(width)] for row in range(height)]
    result = astar(grid, divmod(item['origin'], width), divmod(item['target'], width))
    answers.append(None if result is None else [row * width + column for row, column in result])
print(json.dumps(answers))
`;
const python = spawnSync('python', ['-B', '-c', runner], {
    cwd: __dirname, encoding: 'utf8', input: JSON.stringify(maps),
});
assert.equal(python.status, 0, python.error?.message || python.stderr);
assert.deepEqual(JSON.parse(python.stdout), expectedPaths);
console.log('通过：103 张地图的 Python/JS 路径一致；回溯快照、选点前候选表和内嵌源码一致。');

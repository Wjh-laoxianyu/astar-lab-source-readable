/** 同图竞速：一回合选出一个搜索节点，找到路线后每回合走一格。
 * 与逐行教学独立计时，避免把代码行数误当成算法搜索效率。
 */
(function (root) {
    'use strict';

    function buildRaceFrames({ width, height, start, goal, walls }) {
        const distance = cell => Math.abs(cell % width - goal % width)
            + Math.abs(Math.floor(cell / width) - Math.floor(goal / width));
        const create = algorithm => ({
            algorithm, open: new Set([start]), closed: new Set(),
            g: { [start]: 0 }, parent: {}, current: null,
            phase: 'searching', route: [], position: start, walked: 0,
            foundAt: null, arrivedAt: null,
            decision: [], chosen: null,
        });
        const teams = [create('astar'), create('dijkstra')];
        const snapshot = team => ({
            algorithm: team.algorithm, open: [...team.open], closed: [...team.closed],
            current: team.current, phase: team.phase, route: [...team.route],
            position: team.position, walked: team.walked,
            foundAt: team.foundAt, arrivedAt: team.arrivedAt,
            decision: team.decision.map(candidate => ({ ...candidate })), chosen: team.chosen,
        });
        const frames = [];
        const record = () => frames.push(teams.map(snapshot));
        const finished = team => team.phase === 'arrived' || team.phase === 'unreachable';
        record();

        for (let round = 1; !teams.every(finished); round++) {
            for (const team of teams) {
                team.decision = [];
                team.chosen = null;
                if (finished(team)) continue;
                if (team.phase === 'running') {
                    team.position = team.route[++team.walked];
                    if (team.position === goal) {
                        team.phase = 'arrived';
                        team.arrivedAt = round;
                    }
                    continue;
                }

                // Set 保留加入顺序。A* 比 f，再比 h；Dijkstra 只比 g。
                let best = null;
                const h = cell => team.algorithm === 'astar' ? distance(cell) : 0;
                // 保存选点前的完整候选表，避免把扩展后的新邻居误当成本轮候选。
                team.decision = [...team.open].map(cell => ({
                    cell, g: team.g[cell], h: h(cell), f: team.g[cell] + h(cell),
                }));
                for (const cell of team.open) {
                    if (best === null || team.g[cell] + h(cell) < team.g[best] + h(best)
                        || (team.g[cell] + h(cell) === team.g[best] + h(best) && h(cell) < h(best))) {
                        best = cell;
                    }
                }
                if (best === null) {
                    team.phase = 'unreachable';
                    team.current = null;
                    continue;
                }
                team.current = best;
                team.chosen = best;
                team.open.delete(best);
                team.closed.add(best);
                if (best === goal) {
                    team.route = [goal];
                    while (team.route[0] !== start) team.route.unshift(team.parent[team.route[0]]);
                    team.foundAt = round;
                    team.phase = start === goal ? 'arrived' : 'running';
                    if (start === goal) team.arrivedAt = round;
                    continue;
                }

                const x = best % width;
                const y = Math.floor(best / width);
                const neighbors = [];
                if (y > 0) neighbors.push(best - width);
                if (x < width - 1) neighbors.push(best + 1);
                if (y < height - 1) neighbors.push(best + width);
                if (x > 0) neighbors.push(best - 1);
                for (const neighbor of neighbors) {
                    if (walls.has(neighbor) || team.closed.has(neighbor)) continue;
                    const cost = team.g[best] + 1;
                    if (cost >= (team.g[neighbor] ?? Infinity)) continue;
                    team.g[neighbor] = cost;
                    team.parent[neighbor] = best;
                    team.open.add(neighbor);
                }
                if (team.open.size === 0) {
                    team.phase = 'unreachable';
                    team.current = null;
                }
            }
            record();
        }
        return frames;
    }

    if (typeof module === 'object' && module.exports) module.exports = { buildRaceFrames };
    else root.PathRace = { buildRaceFrames };
})(typeof globalThis === 'object' ? globalThis : this);

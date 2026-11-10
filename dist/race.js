/* 竞速界面使用独立地图快照；导入实验室地图后，两队共享这份快照。 */
(function () {
    'use strict';
    const find = id => document.getElementById(`race-${id}`);
    const width = LAB_WIDTH;
    const height = LAB_HEIGHT;
    let map;
    let frames = [];
    let round = 0;
    let timer = null;
    const grid = find('grid');
    const board = find('board');
    const keys = ['a', 'd'];
    const names = ['A*', 'Dijkstra'];

    function pause() {
        clearInterval(timer);
        timer = null;
        board.classList.remove('is-playing');
    }

    function reset() {
        pause();
        round = 0;
        frames = PathRace.buildRaceFrames(map);
        render();
    }

    function importMap() {
        map = { width, height, start: lab.start, goal: lab.goal, walls: new Set(lab.walls) };
        find('scene').value = 'custom';
        reset();
        find('map-hint').textContent = '已导入实验室当前地图。两位博士将使用同一份地图快照。';
    }

    function loadMap(scene) {
        map = { width, height, start: DEFAULT_START, goal: DEFAULT_GOAL, walls: new Set() };
        if (scene === 'intro') {
            for (let y = 1; y < 8; y++) if (y !== 6) map.walls.add(y * width + 5);
        } else if (scene === 'maze') {
            for (let y = 0; y < 8; y++) map.walls.add(y * width + 4);
            for (let y = 1; y < 9; y++) map.walls.add(y * width + 8);
        } else if (scene === 'blocked') {
            map.walls = new Set([map.goal - width, map.goal + width, map.goal - 1, map.goal + 1]);
        }
        reset();
    }

    function edit(cell) {
        if (round !== 0 || timer !== null) return;
        const tool = find('tool').value;
        if (cell === map.start || cell === map.goal) {
            find('map-hint').textContent = '请选一个其他格子；起点与终点不能重合，也不能变成障碍。';
            return;
        }
        if (tool === 'start' || tool === 'goal') {
            map[tool] = cell;
            map.walls.delete(cell);
        } else if (map.walls.has(cell)) map.walls.delete(cell);
        else map.walls.add(cell);
        find('scene').value = 'custom';
        reset();
    }

    function advance() {
        if (round < frames.length - 1) round++;
        if (round === frames.length - 1) pause();
        render();
    }

    function startTimer() {
        clearInterval(timer);
        const delay = Number(find('speed').value);
        board.style.setProperty('--race-duration', `${Math.min(delay * .8, 240)}ms`);
        timer = setInterval(advance, delay);
        board.classList.add('is-playing');
    }

    function toggle() {
        if (timer !== null) {
            pause();
            render();
            return;
        }
        if (round === frames.length - 1) round = 0;
        // 单步教学和竞速不会在后台同时播放。
        pausePlayback();
        startTimer();
        advance();
    }

    function render() {
        const teams = frames[round];
        const searched = teams.map(team => new Set(team.closed));
        const running = timer !== null;
        const finished = round === frames.length - 1;
        const locked = round > 0 || running;

        for (let cell = 0; cell < grid.children.length; cell++) {
            const element = grid.children[cell];
            const classes = ['race-cell'];
            let description = '空地';
            if (map.walls.has(cell)) { classes.push('race-wall'); description = '障碍'; }
            if (searched[0].has(cell)) { classes.push('race-seen-a'); description += '，A* 已搜索'; }
            if (searched[1].has(cell)) { classes.push('race-seen-d'); description += '，Dijkstra 已搜索'; }
            teams.forEach((team, i) => {
                if (team.phase === 'searching' && team.current === cell) classes.push(`race-focus-${keys[i]}`);
            });
            let label = '';
            if (cell === map.start) { classes.push('race-start'); label = '起'; description += '，起点'; }
            if (cell === map.goal) { classes.push('race-goal'); label = '终'; description += '，终点'; }
            element.className = classes.join(' ');
            element.textContent = label;
            element.setAttribute('aria-label', `${formatCoordinate(cell, width)} ${description}`);
            element.setAttribute('aria-disabled', String(locked));
        }

        teams.forEach((team, i) => {
            const key = keys[i];
            const doctor = find(`doctor-${key}`);
            // 两位博士在同一格中错开，保证起点、重合路径和终点都可辨认。
            const offset = i === 0 ? -.18 : .18;
            doctor.style.left = `${(team.position % width + .5 + offset) / width * 100}%`;
            doctor.style.top = `${(Math.floor(team.position / width) + .52 + offset * .4) / height * 100}%`;
            doctor.classList.toggle('is-running', team.phase === 'running');
            doctor.classList.toggle('has-arrived', team.phase === 'arrived');
            doctor.classList.toggle('is-stranded', team.phase === 'unreachable');
            const previous = frames[Math.max(0, round - 1)][i].position;
            doctor.classList.toggle('faces-left', team.position % width < previous % width);
            const line = document.querySelector(`.race-route-${key}`);
            line.setAttribute('points', team.route.map(cell => `${cell % width + .5},${Math.floor(cell / width) + .5}`).join(' '));
            find(`count-${key}`).textContent = team.closed.length;
            find(`length-${key}`).textContent = team.route.length ? team.route.length - 1 : '—';
            find(`arrival-${key}`).textContent = team.arrivedAt ?? '—';
            let status = '等待发令 · 博士正在起点';
            if (round > 0) {
                if (team.phase === 'searching') status = `规划路线中 · 已搜索 ${team.closed.length} 格`;
                else if (team.phase === 'unreachable') status = '无路可走 · 已搜索完所有可达格子';
                else if (team.phase === 'arrived') status = `抵达补给站 · 第 ${team.arrivedAt} 回合`;
                else status = `第 ${team.foundAt} 回合找到路线 · 已跑 ${team.walked} / ${team.route.length - 1} 步`;
            }
            find(`status-${key}`).textContent = status;
        });

        let title = '博士，就位！';
        let explanation = '先找路，再出发。看看启发式估计能省下多少次搜索。';
        if (round > 0) {
            const arrivals = teams.map((team, i) => ({ name: names[i], at: team.arrivedAt }))
                .filter(team => team.at !== null).sort((a, b) => a.at - b.at);
            if (arrivals.length) {
                title = arrivals.length === 2 && arrivals[0].at === arrivals[1].at
                    ? '同时抵达，平局！' : `${arrivals[0].name} 博士率先抵达！`;
                explanation = finished
                    ? `A* 搜索 ${teams[0].closed.length} 格，Dijkstra 搜索 ${teams[1].closed.length} 格；两条最短路线均为 ${teams[0].route.length - 1} 步。`
                    : '另一位博士仍在规划或赶路，比赛会继续到双方结束。';
            } else if (finished) {
                title = '终点不可达，两队都未完赛';
                explanation = '所有可达格子都已检查。重置后移除障碍，或者换一张地图再试。';
            } else {
                title = running ? '竞速进行中' : '回合已暂停';
                explanation = '边框标出当前搜索格；博士先在起点规划，找到路线后才沿路线移动。';
            }
        }
        find('result').textContent = title;
        find('explanation').textContent = explanation;
        find('play').textContent = running ? 'Ⅱ 暂停竞速' : finished ? '↺ 再赛一次' : round ? '▶ 继续竞速' : '▶ 开始竞速';
        find('prev').disabled = round === 0;
        find('next').disabled = finished;
        find('tool').disabled = locked;
        find('scene').disabled = locked;
        find('timeline').max = frames.length - 1;
        find('timeline').value = round;
        find('progress').textContent = `第 ${round} 回合`;
        find('map-hint').textContent = locked
            ? '两队共享地图。重置后可以编辑；也可以直接导入实验室地图开始新一局。'
            : '点击格子切换障碍；两队始终使用相同的地图、起点与终点。';
    }

    for (let cell = 0; cell < width * height; cell++) {
        const button = document.createElement('button');
        button.type = 'button';
        button.addEventListener('click', () => edit(cell));
        grid.append(button);
    }
    find('import').addEventListener('click', importMap);
    find('scene').addEventListener('change', event => loadMap(event.target.value));
    find('reset').addEventListener('click', reset);
    find('play').addEventListener('click', toggle);
    find('next').addEventListener('click', () => { pause(); advance(); });
    find('prev').addEventListener('click', () => { pause(); round = Math.max(0, round - 1); render(); });
    find('timeline').addEventListener('input', event => {
        pause();
        round = Number(event.target.value);
        render();
    });
    find('speed').addEventListener('change', () => { if (timer !== null) startTimer(); });
    document.getElementById('play').addEventListener('click', () => { pause(); render(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); render(); } });
    importMap();
})( );

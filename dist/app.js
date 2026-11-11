// 完整实验室。寻路规则在 astar.js，本文件负责地图编辑、播放和显示。
const LAB_WIDTH = 12;
const LAB_HEIGHT = 9;
const DEFAULT_START = 49;
const DEFAULT_GOAL = 58;

// 这 18 行是页面展示的教学代码，行号与 astar.js 的 recordStep 对应。
const TEACHING_CODE = [
    'def astar(grid, start, goal):',
    '    opened = {start: None}',
    '    g, f, parent, closed = init(start, goal)',
    '    while opened:',
    '        current = min(opened, key=lambda cell: (f[cell], h(cell, goal)))',
    '        if current == goal:',
    '            return trace(parent, goal)',
    '        del opened[current]',
    '        closed.add(current)',
    '        for nb in neighbors(grid, current):',
    '            if nb in closed: continue',
    '            new_g = g[current] + 1',
    '            if new_g < g.get(nb, inf):',
    '                parent[nb] = current',
    '                g[nb] = new_g',
    '                f[nb] = new_g + h(nb, goal)',
    '                opened[nb] = None',
    '    return None',
];

const lab = {
    start: DEFAULT_START,
    goal: DEFAULT_GOAL,
    walls: new Set(),
    tool: 'wall',
    events: [],
    stepIndex: -1, // -1 表示尚未执行任何一行，此时可以修改地图。
    timer: null,
    guessing: false,
    inspectedCell: null,
    dragging: false,
    drawWall: true,
};

/**
 * 找到页面中的第一个匹配元素。
 * @param {string} selector CSS 选择器。
 * @returns {Element|null} 匹配到的元素，没有匹配时返回 null。
 */
function $(selector) {
    return document.querySelector(selector);
}

/**
 * 载入指定地图，并清空之前的演示进度。
 * @param {string} sceneName 地图选项，取值 intro、maze、empty 或 blocked。
 */
function loadScene(sceneName) {
    lab.start = DEFAULT_START;
    lab.goal = DEFAULT_GOAL;
    lab.walls.clear();

    if (sceneName === 'intro') {
        for (let row = 1; row < 8; row++) {
            if (row !== 6) lab.walls.add(row * LAB_WIDTH + 5);
        }
    } else if (sceneName === 'maze') {
        for (let row = 0; row < 8; row++) lab.walls.add(row * LAB_WIDTH + 4);
        for (let row = 1; row < 9; row++) lab.walls.add(row * LAB_WIDTH + 8);
    } else if (sceneName === 'blocked') {
        const goal = lab.goal;
        lab.walls = new Set([goal - LAB_WIDTH, goal + LAB_WIDTH, goal - 1, goal + 1]);
    }

    resetPlayback();
}

/**
 * 用当前工具修改格子。起点和终点必须处于不同的可通行格子。
 * @param {number} cell 被编辑的格子编号。
 * @returns {boolean} 是否可以刷新界面。位置冲突时保留错误提示。
 */
function editCell(cell) {
    const placingEndpoint = lab.tool === 'start' || lab.tool === 'goal';
    if (cell === lab.start || cell === lab.goal) {
        const sameEndpoint = lab.tool === 'start' ? cell === lab.start : cell === lab.goal;
        if (placingEndpoint && !sameEndpoint) {
            $('#mapHint').textContent = '起点与终点不能重合，请选择另一格。';
            return false;
        }
        return true;
    }

    if (lab.tool === 'start') {
        lab.start = cell;
        lab.walls.delete(cell);
    } else if (lab.tool === 'goal') {
        lab.goal = cell;
        lab.walls.delete(cell);
    } else if (lab.tool === 'erase' || !lab.drawWall) {
        lab.walls.delete(cell);
    } else {
        lab.walls.add(cell);
    }

    // 拖回进度条起点后仍可编辑地图。旧快照属于修改前的地图。
    lab.events = [];
    return true;
}

/**
 * 按当前模式处理一次选格，编辑地图、查看分数或回答练习。
 * @param {number} cell 被选中的格子编号。
 */
function handleCellSelection(cell) {
    lab.inspectedCell = cell;
    if (lab.guessing) {
        const step = getDisplayedStep();
        const feedback = $('#quizFeedback');
        if (!step.open.includes(cell)) {
            feedback.textContent = '请在蓝色待探索格中选择。';
            return;
        }

        const best = chooseNextCell(step.open, step.f, lab.goal, LAB_WIDTH);
        if (cell === best) {
            lab.guessing = false;
            feedback.textContent = `答对啦！${formatCoordinate(cell, LAB_WIDTH)} 是下一位候选。点击下一步继续。`;
        } else {
            const chosenEstimate = manhattanDistance(cell, lab.goal, LAB_WIDTH);
            const bestEstimate = manhattanDistance(best, lab.goal, LAB_WIDTH);
            feedback.textContent = `再比较一下：你选的 f=${step.f[cell]}、h=${chosenEstimate}；`
                + `最优候选 f=${step.f[best]}、h=${bestEstimate}。`;
        }
    } else if (lab.stepIndex < 0) {
        if (!editCell(cell)) return;
    }

    renderLab();
}

/**
 * 读取正在回放的状态。未开始时提供一份空状态供界面显示。
 * @returns {object} 当前教学步骤的快照。
 */
function getDisplayedStep() {
    return lab.events[lab.stepIndex] || {
        open: [], closed: [], path: [], g: {}, f: {}, parent: {},
    };
}

/** 停止自动播放，并恢复播放按钮。 */
function pausePlayback() {
    clearInterval(lab.timer);
    lab.timer = null;
    const finished = lab.stepIndex >= 0 && lab.stepIndex === lab.events.length - 1;
    $('#play').textContent = finished ? '↺ 再看一次' : '▶ 继续演示';
}

/** 清空演示进度和答题状态，保留地图上的墙、起点和终点。 */
function resetPlayback() {
    pausePlayback();
    lab.events = [];
    lab.stepIndex = -1;
    lab.guessing = false;
    lab.inspectedCell = null;
    $('#quizFeedback').textContent = '';
    $('#play').textContent = '▶ 开始演示';
    renderLab();
}

/** 执行下一步。首次执行时，先用当前地图生成完整的回放记录。 */
function advanceOneStep() {
    lab.guessing = false;
    if (lab.events.length === 0) {
        lab.events = buildEvents({
            origin: lab.start,
            target: lab.goal,
            barriers: lab.walls,
            width: LAB_WIDTH,
            height: LAB_HEIGHT,
        });
    }
    if (lab.stepIndex < lab.events.length - 1) {
        lab.stepIndex++;
    } else {
        pausePlayback();
    }
    renderLab();
}

/** 按当前速度开始自动播放，或替换已有的计时器。 */
function startPlaybackTimer() {
    clearInterval(lab.timer);
    const delayInMilliseconds = Number($('#speed').value);
    lab.timer = setInterval(advanceOneStep, delayInMilliseconds);
}

/** 响应播放按钮。已播完时从头播放，正在播放时暂停。 */
function togglePlayback() {
    if (lab.timer !== null) {
        pausePlayback();
        return;
    }
    if (lab.stepIndex >= 0 && lab.stepIndex === lab.events.length - 1) {
        resetPlayback();
    }
    advanceOneStep();
    if (lab.stepIndex < lab.events.length - 1) {
        $('#play').textContent = 'Ⅱ 暂停演示';
        startPlaybackTimer();
    }
}

/**
 * 根据当前快照绘制地图颜色、f 值及屏幕阅读器标签。
 * @param {object} step 当前教学步骤的快照。
 */
function renderGrid(step) {
    const open = new Set(step.open);
    const closed = new Set(step.closed);
    const path = new Set(step.path);
    const showValues = $('#values').checked;
    const cells = $('#grid').children;

    for (let cell = 0; cell < cells.length; cell++) {
        const element = cells[cell];
        const isStart = cell === lab.start;
        const isGoal = cell === lab.goal;
        const classes = ['cell'];
        let status = '空地';
        let label = '';

        if (lab.walls.has(cell)) {
            classes.push('wall');
            status = '障碍';
        }
        if (closed.has(cell)) {
            classes.push('closed');
            status = '已探索';
        }
        if (open.has(cell)) {
            classes.push('open');
            status = '待探索';
        }
        if (path.has(cell)) classes.push('path');
        if (step.current === cell) classes.push('current');
        if (lab.inspectedCell === cell) classes.push('selected-cell');
        if (lab.guessing && open.has(cell)) classes.push('exam');
        if (showValues && step.f[cell] !== undefined) label = step.f[cell];

        if (isStart) {
            classes.push('start');
            status = '起点';
            label = '⚑';
        } else if (isGoal) {
            classes.push('goal');
            status = '终点';
            label = '◆';
        }

        element.className = classes.join(' ');
        element.textContent = label;
        const score = step.f[cell] === undefined ? '' : ` f=${step.f[cell]}`;
        element.setAttribute('aria-label', `${formatCoordinate(cell, LAB_WIDTH)} ${status}${score}`);
    }
}

/**
 * 生成所选格子的 g、h、f 和来路说明。
 * @param {object} step 当前教学步骤的快照。
 * @param {number|null|undefined} cell 要查看的格子编号，没有选择时为空。
 * @returns {string} 显示在分数卡片上的说明。
 */
function describeCell(step, cell) {
    if (cell == null) return '点击地图中的格子，查看它的分数。';

    const coordinate = formatCoordinate(cell, LAB_WIDTH);
    if (lab.walls.has(cell)) return `${coordinate} · 障碍，不可通行`;
    if (step.g[cell] === undefined) {
        return step.parent[cell] === undefined
            ? `${coordinate} · 尚未记录到达代价`
            : `${coordinate} · 尚未记录到达代价 ← 来自 ${formatCoordinate(step.parent[cell], LAB_WIDTH)}`;
    }

    const estimate = manhattanDistance(cell, lab.goal, LAB_WIDTH);
    const total = step.f[cell] ?? '待计算';
    let description = `${coordinate} · g=${step.g[cell]} / h=${estimate} / f=${total}`;
    if (step.parent[cell] !== undefined) {
        description += ` ← 来自 ${formatCoordinate(step.parent[cell], LAB_WIDTH)}`;
    }
    return description;
}

/** 把当前快照同步到地图、代码高亮、解说和播放控制。 */
function renderLab() {
    const step = getDisplayedStep();
    renderGrid(step);
    document.querySelectorAll('.code-line').forEach((row, index) => {
        row.classList.toggle('active', index + 1 === step.line);
    });

    $('#stepTitle').textContent = step.title || '先认识这张地图';
    $('#narration').textContent = step.text
        || '从 ⚑ 出发，去 ◆ 补给站。你可以先修改地图，再点击「下一步」，看看算法如何思考。';
    $('#lineBadge').textContent = step.line ? `已执行 · 第 ${step.line} 行` : '等待执行';
    $('#visited').textContent = step.closed.length;
    $('#distance').textContent = step.traceCode === 'path.reverse()' ? step.path.length - 1 : '—';
    $('#nodeDetail').textContent = describeCell(step, lab.inspectedCell ?? step.focus);

    const hasStarted = lab.stepIndex >= 0;
    const finished = lab.events.length > 0 && lab.stepIndex === lab.events.length - 1;
    $('#timeline').max = lab.events.length;
    $('#timeline').value = lab.stepIndex + 1;
    $('#progress').textContent = hasStarted ? `${lab.stepIndex + 1} / ${lab.events.length}` : '准备就绪';
    $('#prev').disabled = !hasStarted;
    $('#next').disabled = finished;
    $('#quiz').disabled = step.line !== 4;
    document.querySelectorAll('[data-tool], #clear, #scene').forEach(button => {
        button.disabled = hasStarted;
    });
    $('#mapHint').textContent = hasStarted
        ? '演示中：点击格子查看分数；点击 ↺ 重置后可以编辑地图。'
        : '点击或拖动绘制障碍；起点与终点不能重合。每步只允许上下左右移动。';
    if (typeof renderNotebook === 'function') renderNotebook();
}

/**
 * 创建可用鼠标、触屏和键盘选中的格子。
 * @param {number} cell 格子编号。
 * @returns {HTMLButtonElement} 绑定好交互的格子按钮。
 */
function createGridCell(cell) {
    const button = document.createElement('button');
    button.className = 'cell';
    button.setAttribute('role', 'gridcell');
    button.addEventListener('pointerdown', event => {
        if (event.button !== 0) return;
        lab.dragging = event.pointerType === 'mouse';
        lab.drawWall = !lab.walls.has(cell);
        handleCellSelection(cell);
    });
    button.addEventListener('pointerenter', () => {
        const drawing = lab.tool === 'wall' || lab.tool === 'erase';
        if (lab.dragging && lab.stepIndex < 0 && drawing) {
            editCell(cell);
            renderLab();
        }
    });
    button.addEventListener('keydown', event => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        lab.drawWall = !lab.walls.has(cell);
        handleCellSelection(cell);
    });
    return button;
}

/** 建立地图和代码区，绑定控制按钮，最后显示默认场景。 */
function initializeLab() {
    TEACHING_CODE.forEach((text, index) => {
        const row = document.createElement('div');
        row.className = 'code-line';
        const lineNumber = document.createElement('span');
        lineNumber.className = 'ln';
        lineNumber.textContent = index + 1;
        const code = document.createElement('span');
        code.textContent = text;
        row.append(lineNumber, code);
        $('#code').append(row);
    });

    for (let cell = 0; cell < LAB_WIDTH * LAB_HEIGHT; cell++) {
        $('#grid').append(createGridCell(cell));
    }
    document.addEventListener('pointerup', () => { lab.dragging = false; });
    window.addEventListener('blur', () => { lab.dragging = false; });

    const toolButtons = document.querySelectorAll('[data-tool]');
    toolButtons.forEach(button => {
        button.onclick = () => {
            lab.tool = button.dataset.tool;
            toolButtons.forEach(other => other.classList.toggle('selected', other === button));
        };
    });
    $('#scene').onchange = event => loadScene(event.target.value);
    $('#clear').onclick = () => {
        lab.walls.clear();
        lab.events = [];
        renderLab();
    };
    $('#reset').onclick = resetPlayback;
    $('#next').onclick = () => {
        pausePlayback();
        advanceOneStep();
    };
    $('#prev').onclick = () => {
        pausePlayback();
        lab.guessing = false;
        lab.stepIndex--;
        renderLab();
    };
    $('#play').onclick = togglePlayback;
    $('#speed').onchange = () => {
        if (lab.timer !== null) startPlaybackTimer();
    };
    $('#timeline').oninput = event => {
        pausePlayback();
        lab.guessing = false;
        lab.stepIndex = Number(event.target.value) - 1;
        renderLab();
    };
    $('#values').onchange = renderLab;
    $('#quiz').onclick = () => {
        pausePlayback();
        lab.guessing = true;
        lab.inspectedCell = null;
        $('#quizFeedback').textContent = '轮到你了！选出下一轮会取出的格子。f 相同则比较 h，再按加入顺序。';
        renderLab();
    };
    $('#help').onclick = () => $('#helpDialog').showModal();
    $('#closeHelp').onclick = () => $('#helpDialog').close();
    loadScene('intro');
}

initializeLab();

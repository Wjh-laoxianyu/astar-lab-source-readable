/** 第四版教学界面：先解释数据，再预测一行代码，最后动手回溯。 */

/**
 * 把格子编号转成 Python 的零基 (行, 列) 坐标。
 * @param {number|null|undefined} cell 格子编号；空值表示尚未赋值。
 * @returns {string} 可直接对照 Python 元组的文字。
 */
function pythonCoordinate(cell) {
    if (cell == null) return '尚未赋值';
    return `(${Math.floor(cell / LAB_WIDTH)}, ${cell % LAB_WIDTH})`;
}

/**
 * 把有顺序的格子名单写成易读的坐标列表。
 * @param {number[]} cells 回放快照中的格子编号。
 * @returns {string} 列表文字；这里只展示字典 opened 的键。
 */
function coordinateList(cells) {
    return '[' + cells.map(pythonCoordinate).join(', ') + ']';
}

/**
 * 追加一行纯文本表格，突出与上一快照不同的值。
 * @param {HTMLElement} body 表格的 tbody。
 * @param {string[]} values 各列文字。
 * @param {number[]} changedColumns 需要标色的列号（从 0 开始）。
 */
function appendLearningRow(body, values, changedColumns = []) {
    const row = document.createElement('tr');
    values.forEach((value, index) => {
        const cell = document.createElement('td');
        cell.textContent = value;
        if (changedColumns.includes(index)) cell.className = 'changed';
        row.append(cell);
    });
    body.append(row);
}

/** 用当前与上一张快照绘制记事本。回放、重置与拖动进度时都调用。 */
function renderNotebook() {
    const body = document.getElementById('notebook-values');
    if (!body) return;
    const empty = { open: [], closed: [], g: {}, f: {}, parent: {}, path: [] };
    const after = getDisplayedStep();
    const before = lab.events[lab.stepIndex - 1] || empty;
    const fields = [
        ['current · 当前选中的格子', state => pythonCoordinate(state.current)],
        ['nb · 最近检查的邻居', state => pythonCoordinate(state.neighbor)],
        ['new_g · 最近一次试算结果', state => String(state.new_g ?? '尚未计算')],
        ['opened · 待检查名单（字典的键）', state => coordinateList(state.open)],
        ['closed · 已检查名单（集合）', state => coordinateList(state.closed)],
        ['path · 回溯中的列表', state => coordinateList(state.path)],
    ];
    body.replaceChildren();
    for (const [label, read] of fields) {
        const oldValue = read(before);
        const newValue = read(after);
        appendLearningRow(body, [label, oldValue, newValue], oldValue === newValue ? [] : [2]);
    }

    const records = document.getElementById('notebook-records');
    records.replaceChildren();
    const knownCells = new Set([
        ...Object.keys(before.g), ...Object.keys(after.g), ...Object.keys(after.parent),
    ]);
    for (const cell of [...knownCells].map(Number).sort((a, b) => a - b)) {
        const values = [pythonCoordinate(cell)];
        const changed = [];
        ['g', 'f', 'parent'].forEach((key, index) => {
            const oldValue = before[key][cell];
            const newValue = after[key][cell];
            const format = value => value === undefined ? '无记录'
                : key === 'parent' ? pythonCoordinate(value) : String(value);
            values.push(`${format(oldValue)} → ${format(newValue)}`);
            if (oldValue !== newValue) changed.push(index + 1);
        });
        appendLearningRow(records, values, changed);
    }
    if (knownCells.size === 0) appendLearningRow(records, ['尚未建立记录', '—', '—', '—']);

    document.getElementById('notebook-status').textContent = after.line
        ? `第 ${after.line} 行执行后：${after.title}。条件判断可能只改变下一步去哪里，不改写表格。`
        : '点击实验室的「下一步」开始；每次只核对这一行造成的变化。';
    document.getElementById('notebook-trace').textContent = after.traceCode
        ? `进入第 7 行调用的 trace：\n${after.traceCode}\n回溯指针 current = ${pythonCoordinate(after.traceCell)}\npath = ${coordinateList(after.path)}`
        : '找到终点后，这里逐行展开 trace 的查表与反转过程。';
}

// 与页面的 18 行主流程一一对应；辅助函数在下方提供完整实现。
const LINE_EXPLANATIONS = [
    '定义 astar 函数。grid 是地图，start 是起点，goal 是终点；调用函数后才开始搜索。',
    '建立待检查名单。字典的键是坐标，值 None 只是占位。字典保留加入顺序，用来处理完全同分的情况。',
    'init 建立 g、f、parent 和 closed。起点 g=0，f=h；来路表和已检查集合暂时为空。',
    '只要待检查名单不为空，就再做一轮。全部检查完还没到终点，就走到第 18 行。',
    'min 比较所有候选。lambda 给每格算出 (f, h)；Python 先比 f，再比 h，都相等时保留先加入者。并不是只选当前格的邻居。',
    '检查这次从候选名单取出的格子是不是终点。发现终点的邻居不等于已经可以停下。',
    '进入 trace：从终点查 parent，逐个放入列表，反转后返回整条路线。return 会结束这次函数调用。',
    '从待检查字典删除 current；此时尚未加入 closed，下一行才做。',
    '把 current 放进已检查集合。本地图的四方向单位步长与曼哈顿距离允许我们跳过这些已处理格子。',
    'neighbors 按上、右、下、左给出可走邻居，排除墙和越界。for 一次取一个，存在 nb 中。',
    '如果 nb 已经检查过，continue 直接去看下一个邻居，不执行下面的试算。',
    '先试算：到当前格的步数加 1。new_g 只是临时结果，尚未改写 g[nb]。',
    'g.get(nb, inf) 有旧记录就读取，没有就取无穷大。只有新步数严格更小，才执行第 14–17 行；相等也保留旧记录。',
    '把当前格记作 nb 的来路。parent[nb] = current 的方向是“目的格 → 从哪里来”。',
    '通过上一条比较后，才把更好的步数保存进 g。',
    '算出新评分 f = new_g + h。h 只看横向差加纵向差，忽略墙，是估计而非保证。',
    '把 nb 放入候选字典；已经在里面就保持位置，不会重复。下一轮与整个候选名单一起比较。',
    '候选名单耗尽，仍未返回路线：返回 None，表示终点不可达。',
];

/** 为代码行添加鼠标与键盘解释入口，并展示可复制的完整 Python。 */
function initializePythonReading() {
    document.querySelectorAll('#code .code-line').forEach((row, index) => {
        row.tabIndex = 0;
        row.setAttribute('role', 'button');
        row.setAttribute('aria-label', `解释第 ${index + 1} 行：${TEACHING_CODE[index].trim()}`);
        const explain = () => {
            document.getElementById('line-explanation').textContent = `第 ${index + 1} 行：${LINE_EXPLANATIONS[index]}`;
        };
        row.addEventListener('click', explain);
        row.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                explain();
            }
        });
    });
    document.getElementById('python-source').textContent = PYTHON_SOURCE;
    const helpers = document.getElementById('python-helpers');
    const names = { h: 'h：估计剩余步数', init: 'init：建立记录本', neighbors: 'neighbors：找可走的邻居', trace: 'trace：倒着查来路，再反转' };
    for (const [name, title] of Object.entries(names)) {
        const start = PYTHON_SOURCE.indexOf(`def ${name}(`);
        const next = PYTHON_SOURCE.indexOf('\ndef ', start + 1);
        const details = document.createElement('details');
        const summary = document.createElement('summary');
        summary.textContent = title;
        const code = document.createElement('pre');
        code.className = 'learning-code';
        code.textContent = PYTHON_SOURCE.slice(start, next < 0 ? undefined : next).trim();
        details.append(summary, code);
        helpers.append(details);
    }
    document.getElementById('python-copy').addEventListener('click', async () => {
        const status = document.getElementById('python-copy-status');
        try {
            await navigator.clipboard.writeText(PYTHON_SOURCE);
            status.textContent = '完整 Python 已复制，保存为 astar.py 即可运行。';
        } catch {
            const source = document.getElementById('python-source');
            source.parentElement.open = true;
            const range = document.createRange();
            range.selectNodeContents(source);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
            status.textContent = '浏览器未允许自动复制，已选中完整源码，请按 Ctrl+C；也可以下载文件。';
        }
    });
}

/** 独立的单次邻居检查练习；不修改真实地图或搜索快照。 */
function initializeCodePractice() {
    const find = suffix => document.getElementById(`practice-${suffix}`);
    let state;
    let stage;
    let answered;

    /** 根据情境恢复记录，保证重做时没有上一题的数据。 */
    function reset() {
        const scenario = find('case').value;
        const old = scenario === 'first' ? null : scenario === 'better' ? 5 : 1;
        state = { old, saved: old, parent: old === null ? '无记录' : '旧路口 X', trial: null };
        stage = 0;
        answered = false;
        find('feedback').textContent = '';
        render();
    }

    /** 返回本阶段的问题、候选答案和执行动作。 */
    function question() {
        const improves = state.old === null || 3 < state.old;
        if (stage === 0) return {
            line: 12, code: 'new_g = g[current] + 1', prompt: 'g[A] = 2。new_g 应该是多少？', choices: ['2', '3', '5'], answer: '3',
            apply: () => { state.trial = 3; }, explanation: '2 + 1 = 3。这里只算出了 new_g，右侧 g[B] 还没变。',
        };
        if (stage === 1) return {
            line: 13, code: 'if new_g < g.get(nb, inf):',
            prompt: `3 < ${state.old ?? 'inf（无穷大）'} 是否成立？`, choices: ['True：更新记录', 'False：保留旧记录'],
            answer: improves ? 'True：更新记录' : 'False：保留旧记录', apply: () => {},
            explanation: improves ? '条件成立，接下来执行缩进内的来路和步数更新。' : '条件不成立，跳过第 14–17 行。更长的走法不能覆盖旧记录。',
        };
        if (stage === 2) return {
            line: 14, code: 'parent[nb] = current', prompt: 'nb 是 B，current 是 A。应该记录哪个方向？',
            choices: ['parent[B] = A', 'parent[A] = B'], answer: 'parent[B] = A',
            apply: () => { state.parent = 'A'; }, explanation: 'B 记住“我是从 A 来的”。以后从 B 倒着查，就能找到 A。',
        };
        return {
            line: 15, code: 'g[nb] = new_g', prompt: '现在才保存新记录：g[B] 应该变成多少？', choices: ['2', '3', '5'], answer: '3',
            apply: () => { state.saved = 3; }, explanation: 'g[B] 现在变为 3。后续第 16–17 行会更新 f，并把 B 加入候选名单。',
        };
    }

    /** 显示一题；答错允许再试，答对后冻结选项，等待下一行。 */
    function render() {
        const complete = stage === 4;
        const item = complete ? null : question();
        find('progress').textContent = complete ? '本次邻居检查完成' : `对应实验室第 ${item.line} 行 · 先预测，再执行`;
        find('code').textContent = complete ? '# 继续检查下一个邻居' : item.code;
        find('question').textContent = complete ? '切换情境，对照“更新”“保留”“首次发现”三种结果。' : item.prompt;
        find('state').textContent = `current = A\nnb = B\ng[A] = 2\nnew_g = ${state.trial ?? '尚未计算'}\ng[B] = ${state.saved ?? '无记录'}\nparent[B] = ${state.parent}`;
        find('answers').replaceChildren();
        if (item) {
            for (const choice of item.choices) {
                const button = document.createElement('button');
                button.textContent = choice;
                button.disabled = answered;
                button.addEventListener('click', () => {
                    if (choice !== item.answer) {
                        find('feedback').textContent = '还没执行。再对照右侧记录和当前代码，算一次试试。';
                        return;
                    }
                    item.apply();
                    answered = true;
                    find('feedback').textContent = `答对，已执行！${item.explanation}`;
                    render();
                });
                find('answers').append(button);
            }
        }
        find('next').disabled = !answered || complete;
        find('next').textContent = stage === 3 || (stage === 1 && state.old !== null && state.old <= 3) ? '完成本题 →' : '执行下一行 →';
    }
    find('next').addEventListener('click', () => {
        if (!answered) return;
        stage = stage === 1 && state.old !== null && state.old <= 3 ? 4 : stage + 1;
        answered = false;
        find('feedback').textContent = '';
        render();
    });
    find('restart').addEventListener('click', reset);
    find('case').addEventListener('change', reset);
    reset();
}

/** 让学习者逐次查 parent，完整列表建立后才允许反转。 */
function initializeTracePractice() {
    const find = suffix => document.getElementById(`trace-${suffix}`);
    const parents = { '终点': 'C', C: 'B', B: '起点' };
    let path;
    let reversed;

    /** 同步来路问题与当前列表；不能在未回到起点时提前反转。 */
    function render() {
        const current = path.at(-1);
        const ready = !reversed && current === '起点';
        find('code').textContent = reversed ? 'path.reverse()  # 已执行，接着 return path'
            : ready ? '# 已回到起点，准备 path.reverse()'
                : `current = parent["${current}"]\npath.append(current)`;
        find('question').textContent = reversed ? '现在列表从起点到终点，路线还原完成。'
            : ready ? '已经查到起点。列表方向反了，执行反转试试。' : `当前在 ${current}。查 parent["${current}"]，会找到谁？`;
        find('answers').replaceChildren();
        if (!ready && !reversed) {
            for (const choice of ['起点', 'B', 'C', '终点']) {
                const button = document.createElement('button');
                button.textContent = choice;
                button.addEventListener('click', () => {
                    if (parents[current] !== choice) {
                        find('feedback').textContent = `再查一下字典：找键“${current}”右边对应的值。`;
                        return;
                    }
                    path.push(choice);
                    find('feedback').textContent = `parent["${current}"] = "${choice}"，已把 ${choice} 加入列表。`;
                    render();
                });
                find('answers').append(button);
            }
        }
        find('list').replaceChildren();
        path.forEach((cell, index) => {
            const chip = document.createElement('span');
            chip.textContent = `${index ? '→ ' : ''}${cell}`;
            find('list').append(chip);
        });
        find('reverse').disabled = !ready;
    }
    find('restart').addEventListener('click', () => {
        path = ['终点'];
        reversed = false;
        find('feedback').textContent = 'path = [goal]：先把终点放进列表。';
        render();
    });
    find('reverse').addEventListener('click', () => {
        path.reverse();
        reversed = true;
        find('feedback').textContent = '反转只改变列表顺序，不改变 parent 记录。现在可以返回路线了。';
        render();
    });
    find('restart').click();
}

initializePythonReading();
initializeCodePractice();
initializeTracePractice();
renderNotebook();

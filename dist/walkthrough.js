/** 把同一份 A* 搜索记录按轮分组，创建 15 格例题并绑定答题按钮。 */
function initWalkthrough() {
    const width = 5;
    const height = 3;
    const origin = 0;
    const target = 4;
    const barriers = new Set([3, 7, 8]);
    const labels = ['起点', 'A', 'C', '墙', '终点', 'B', 'D', '墙', '墙', 'I', 'E', 'F', 'G', 'H', 'J'];
    const trace = buildEvents({ origin, target, barriers, width, height });
    // 首次选中的是起点。从起点展开后的两个候选格开始做题。
    const rounds = trace.filter(event => event.line === 5).slice(1);
    const finish = trace.at(-1);
    let index = 0;
    let revealed = false;

    const grid = $('#walk-grid');
    const candidateList = $('#walk-candidates');
    const feedback = $('#walk-feedback');
    const action = $('#walk-action');
    const back = $('#walk-back');
    const cells = labels.map(label => {
        const cell = document.createElement('div');
        cell.textContent = label;
        grid.append(cell);
        return cell;
    });

    const prompts = {
        1: '从起点走一步能到 A 或 B。它们的 g 都是 1。忽略墙后，A 离终点还有 3 步，B 还有 5 步。点选你会先检查的格子。',
        2: '检查 A 后，发现了 C 和 D。B 虽然上一轮没被选中，仍留在候选表里。把三个 f 放在一起比一比。',
        6: 'C 前面和下方都是墙，左边的 A 已检查过，所以 C 没有带来新候选。现在看看剩下的 B 和 D。',
        5: 'D 找到了 F，候选表里也还留着 B。它们估计都离终点 5 步，但走到它们的代价不同。',
        11: 'B 找到了 E。接下来在候选表中比较 E 和 F。',
    };
    const explanations = {
        1: 'A 的 1 + 3 = 4，比 B 的 1 + 5 = 6 小。A 先检查，B 留在表里。',
        2: 'C 的 f 只有 4，先检查 C。它的 h 是 2，因为估算时把墙当成了空地。下一轮看看实际能否走通。',
        6: 'B 和 D 的 f 都是 6。本例在同分时优先检查 h 较小的格子，所以选 D。这个同分规则只影响检查顺序。',
        5: 'B 和 F 的 h 都是 5。走到 B 只花 1 步，走到 F 花 3 步，所以先检查 B。算法从候选表取出 B，并从起点到 B 的那条路继续算。',
        11: 'F 和 E 的 f 都是 8，F 的 h 更小。检查 F 时，也能走到 E，但这条走法要 4 步，表里已有 2 步的走法，所以保留 E 原来的来路。',
        4: '终点的 h 是 0，它排在候选表最前面。现在沿来路倒推，就能找回最短路线。',
    };

    /**
     * 比较学习者选的格子和 A* 实际选中的格子，给出本轮反馈。
     * @param {number} node 学习者选择的候选格编号。
     */
    function choose(node) {
        const round = rounds[index];
        const best = round.current;
        if (node !== best) {
            feedback.textContent = round.f[node] === round.f[best]
                ? '这两个格子的 f 一样。本例同分时再比 h，选 h 较小的。再试一次。'
                : `你选的 ${labels[node]} 的 f 是 ${round.f[node]}。表中还有更小的 f，再比一比。`;
            return;
        }
        revealed = true;
        render();
        action.focus();
    }

    /** 绘制当前轮的地图、候选分数与说明。最后一轮之后显示完整路线。 */
    function render() {
        const round = rounds[index];
        const done = !round;
        const snapshot = round || finish;
        const chosen = revealed && round ? round.current : null;
        cells.forEach((cell, node) => {
            let status = '空地';
            let style = '';
            if (barriers.has(node)) [status, style] = ['墙', 'wall'];
            else if (snapshot.path.includes(node)) [status, style] = ['最短路线', 'path'];
            else if (node === chosen) [status, style] = ['本轮选中', 'current'];
            else if (snapshot.open.includes(node) && !done) [status, style] = ['候选', 'open'];
            else if (snapshot.closed.includes(node)) [status, style] = ['检查过', 'closed'];
            cell.className = `walk-cell ${style}`;
            cell.setAttribute('aria-label', `${labels[node]}，${status}`);
        });
        back.disabled = index === 0;
        $('#walk-progress').textContent = done
            ? '任务完成 · 对应代码第 7 行'
            : `第 ${index + 1} / ${rounds.length} 轮 · 对应代码第 5 行`;
        candidateList.replaceChildren();
        if (done) {
            $('#walk-title').textContent = `补给站找到了，最短路线 ${finish.path.length - 1} 步`;
            $('#walk-description').textContent = finish.path.map(node => labels[node]).join(' → ');
            feedback.textContent = '起点的 h 只估了 4 步。实际要绕开墙，最后走了 8 步。每个格子记住自己的来路，沿着它们倒推就得到地图上的黄色路线。';
            action.textContent = '从头再试';
            return;
        }

        $('#walk-title').textContent = '这轮先检查哪一格？';
        $('#walk-description').textContent = prompts[round.current]
            || '用同一个规则往下走。把所有候选放在一起，先找 f 最小的，若同分再找 h 最小的。';
        round.open.forEach(node => {
            const option = document.createElement('button');
            option.type = 'button';
            option.className = 'walk-option';
            option.disabled = revealed;
            if (node === chosen) option.classList.add('picked');
            const remaining = manhattanDistance(node, target, width);
            option.textContent = `${labels[node]}　g ${round.g[node]} + h ${remaining} = f ${round.f[node]}`;
            option.addEventListener('click', () => choose(node));
            candidateList.append(option);
        });
        feedback.textContent = revealed
            ? explanations[chosen] || `先检查 ${labels[chosen]}（f = ${round.f[chosen]}），再把新发现的邻格加入表里。`
            : '点选一个候选格，或点击「看本轮答案」。';
        action.textContent = revealed ? '继续下一轮 →' : '看本轮答案';
    }

    back.addEventListener('click', () => {
        index--;
        revealed = false;
        render();
    });
    action.addEventListener('click', () => {
        if (!rounds[index]) {
            index = 0;
            revealed = false;
            render();
        } else if (revealed) {
            index++;
            revealed = false;
            render();
        } else {
            choose(rounds[index].current);
        }
    });
    render();
}

initWalkthrough();

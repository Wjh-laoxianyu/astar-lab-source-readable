/**
 * 无依赖的教学交互状态检查。DOM 替身仅提供这些控件实际使用的方法，
 * 用于发现答题、重做、回放的数据错误；不用于声称浏览器布局已验证。
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { buildEvents } = require('./dist/astar.js');

class Element {
    constructor() {
        this.children = [];
        this.listeners = {};
        this.textContent = '';
        this.value = '';
        this.disabled = false;
        this.attributes = {};
        this.style = { setProperty() {} };
        this.classList = { toggle() {}, add() {}, remove() {} };
    }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
    dispatch(type, event = {}) { for (const callback of this.listeners[type] || []) callback(event); }
    click() { if (!this.disabled) this.dispatch('click'); }
    get firstElementChild() { return this.children[0]; }
    get lastElementChild() { return this.children.at(-1); }
    set innerHTML(html) {
        for (const match of html.matchAll(/\bid="([^"]+)"/g)) elements[match[1]] = new Element();
    }
}

const html = fs.readFileSync(path.join(__dirname, 'dist/index.html'), 'utf8');
const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
assert.equal(new Set(ids).size, ids.length, '页面 ID 不应重复');
const elements = Object.fromEntries(ids.map(id => [id, new Element()]));
const rows = Array.from({ length: 18 }, () => new Element());
elements['practice-case'].value = 'better';
const lab = { events: [], stepIndex: -1 };
const context = vm.createContext({
    document: {
        getElementById: id => elements[id] || null,
        querySelectorAll: selector => selector === '#code .code-line' ? rows : [],
        querySelector: () => new Element(),
        createElement: () => new Element(),
        addEventListener() {},
    },
    LAB_WIDTH: 12, lab,
    TEACHING_CODE: Array(18).fill('teaching code'),
    getDisplayedStep: () => lab.events[lab.stepIndex] || { open: [], closed: [], g: {}, f: {}, parent: {}, path: [] },
});
for (const file of ['python-source.js', 'learning.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, 'dist', file), 'utf8'), context);
}

function answer(prefix, text) {
    const button = elements[`${prefix}-answers`].children.find(child => child.textContent === text);
    assert.ok(button, `找不到选项 ${prefix}: ${text}`);
    button.click();
}
function next() { elements['practice-next'].click(); }
function chooseCase(name) {
    elements['practice-case'].value = name;
    elements['practice-case'].dispatch('change');
}

// 答错不改数据、不放开下一行；答对才执行，而且不会提前覆盖 g。
answer('practice', '5');
assert.ok(elements['practice-next'].disabled);
assert.match(elements['practice-state'].textContent, /new_g = 尚未计算/);
for (const scenario of ['better', 'first']) {
    chooseCase(scenario);
    answer('practice', '3');
    assert.match(elements['practice-state'].textContent, /new_g = 3/);
    assert.match(elements['practice-state'].textContent, scenario === 'better' ? /g\[B\] = 5/ : /g\[B\] = 无记录/);
    next(); answer('practice', 'True：更新记录');
    next(); answer('practice', 'parent[B] = A');
    assert.match(elements['practice-state'].textContent, /parent\[B\] = A/);
    next(); answer('practice', '3'); next();
    assert.match(elements['practice-state'].textContent, /g\[B\] = 3/);
    assert.match(elements['practice-progress'].textContent, /完成/);
}
chooseCase('worse');
answer('practice', '3'); next(); answer('practice', 'False：保留旧记录'); next();
assert.match(elements['practice-state'].textContent, /g\[B\] = 1/);
assert.match(elements['practice-state'].textContent, /parent\[B\] = 旧路口 X/);
elements['practice-restart'].click();
assert.match(elements['practice-state'].textContent, /new_g = 尚未计算/);

assert.ok(elements['trace-reverse'].disabled);
answer('trace', '起点');
assert.equal(elements['trace-list'].children.length, 1);
for (const cell of ['C', 'B', '起点']) answer('trace', cell);
assert.equal(elements['trace-reverse'].disabled, false);
elements['trace-reverse'].click();
assert.deepEqual(elements['trace-list'].children.map(child => child.textContent), ['起点', '→ B', '→ C', '→ 终点']);
elements['trace-restart'].click();
assert.equal(elements['trace-list'].children.length, 1);
assert.ok(elements['trace-reverse'].disabled);

lab.events = buildEvents({ origin: 0, target: 2, width: 12, height: 2, barriers: new Set() });
lab.stepIndex = lab.events.findIndex(event => event.line === 15);
context.renderNotebook();
assert.ok(elements['notebook-records'].children.some(row => row.children[1].className === 'changed'));
lab.stepIndex = lab.events.length - 1;
context.renderNotebook();
assert.match(elements['notebook-trace'].textContent, /path.reverse\(\)/);
lab.stepIndex = -1;
context.renderNotebook();
assert.match(elements['notebook-status'].textContent, /开始/);
assert.equal(elements['notebook-records'].children.length, 1);
rows[4].dispatch('keydown', { key: 'Enter', preventDefault() {} });
assert.match(elements['line-explanation'].textContent, /先比 f，再比 h/);
assert.match(elements['python-source'].textContent, /def astar\(grid, start, goal\)/);
assert.equal(elements['python-helpers'].children.length, 4);

// 加载实际竞速界面，验证预测不会推进地图，答错可重试，回放会清除预测。
const PathRace = require('./dist/race-engine.js');
Object.assign(lab, { start: 49, goal: 58, walls: new Set() });
Object.assign(context, {
    PathRace, LAB_HEIGHT: 9, DEFAULT_START: 49, DEFAULT_GOAL: 58,
    pausePlayback() {}, clearInterval() {},
    formatCoordinate: cell => `(${cell % 12 + 1}, ${Math.floor(cell / 12) + 1})`,
});
vm.runInContext(fs.readFileSync(path.join(__dirname, 'dist/race.js'), 'utf8'), context);
const frames = PathRace.buildRaceFrames({ width: 12, height: 9, start: 49, goal: 58, walls: new Set() });
for (let round = 0; round < 3; round++) {
    elements['race-predict'].click();
    assert.equal(elements['race-progress'].textContent, `第 ${round} 回合`);
    for (const [index, key] of ['a', 'd'].entries()) {
        const chosen = frames[round + 1][index].chosen;
        const correct = context.formatCoordinate(chosen);
        const buttons = () => elements[`race-candidates-${key}`].children.map(row => row.firstElementChild.firstElementChild);
        const wrong = buttons().find(button => button.textContent !== correct);
        if (wrong) {
            wrong.click();
            assert.match(elements[`race-choice-${key}`].textContent, /还没选对/);
        }
        buttons().find(button => button.textContent === correct).click();
        assert.match(elements[`race-choice-${key}`].textContent, /答对/);
        assert.ok(buttons().every(button => button.disabled));
    }
    elements['race-next'].click();
    assert.equal(elements['race-progress'].textContent, `第 ${round + 1} 回合`);
    assert.match(elements['race-choice-a'].textContent, /选中/);
}
elements['race-predict'].click();
elements['race-prev'].click();
assert.doesNotMatch(elements['race-decision-note'].textContent, /先预测/);
elements['race-timeline'].dispatch('input', { target: { value: String(frames.length - 1) } });
assert.ok(elements['race-predict'].disabled);
elements['race-reset'].click();
assert.equal(elements['race-progress'].textContent, '第 0 回合');
assert.equal(elements['race-predict'].disabled, false);
console.log('通过：三种练习、答错保护、重做、回溯、记事本回放、键盘解释和真实竞速预测状态。');

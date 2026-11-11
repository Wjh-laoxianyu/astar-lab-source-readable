// 把唯一的 Python 源文件嵌入网页，保证双击 HTML 时也能查看完整代码。
// 修改 dist/astar.py 后运行：node sync-python.cjs
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, 'dist/astar.py'), 'utf8');
fs.writeFileSync(path.join(__dirname, 'dist/python-source.js'),
    '// 由 node sync-python.cjs 生成，请编辑 astar.py。\n'
    + 'const PYTHON_SOURCE = ' + JSON.stringify(source) + ';\n');

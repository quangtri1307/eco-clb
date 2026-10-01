// Nạp src/Logic.gs như một module Node để kiểm tra.
const fs = require('fs');
const path = require('path');
const Module = require('module');
const file = path.join(__dirname, '..', 'src', 'Logic.gs');
const m = new Module(file, module);
m.filename = file;
m._compile(fs.readFileSync(file, 'utf8'), file);
module.exports = m.exports;

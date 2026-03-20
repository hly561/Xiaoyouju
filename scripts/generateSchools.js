// 将三份 CSV 转换为 JSON 并写入 pages/school-selector/data 目录
const fs = require('fs');
const path = require('path');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function parseCSV(content) {
  // 简单CSV解析：按行拆分，首行作为表头；不处理引号包裹的逗号情况
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols.length < headers.length) continue; // 跳过格式异常行
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] || '').trim();
    });
    rows.push(obj);
  }
  return { headers, rows };
}

function groupBy(rows, keyField, valueField) {
  const map = {};
  for (const r of rows) {
    const key = r[keyField];
    const val = r[valueField];
    if (!key || !val) continue;
    if (!map[key]) map[key] = new Set();
    map[key].add(val);
  }
  // 转换为数组并排序
  const out = {};
  Object.keys(map).forEach((k) => {
    out[k] = Array.from(map[k]).sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));
  });
  return out;
}

function writeJSON(targetPath, obj) {
  fs.writeFileSync(targetPath, JSON.stringify(obj, null, 2), 'utf8');
}

function writeJS(targetPath, obj) {
  const content = `// 由 CSV 转 JSON 后自动生成的 JS 数据模块\n// 请勿手动编辑，修改源数据后运行 scripts/generateSchools.js 重新生成\n\nmodule.exports = ${JSON.stringify(obj, null, 2)};\n`;
  fs.writeFileSync(targetPath, content, 'utf8');
}

function main() {
  const projectRoot = process.cwd();
  const dataDir = path.join(projectRoot, 'pages', 'school-selector', 'data');
  ensureDir(dataDir);

  // 1) 内地：province,school -> 按省份分组
  const mainlandCSVPath = path.join(projectRoot, 'china_universities_by_province.csv');
  const mainlandCSV = fs.readFileSync(mainlandCSVPath, 'utf8');
  const { rows: mainlandRows } = parseCSV(mainlandCSV);
  const mainlandGrouped = groupBy(mainlandRows, 'province', 'school');
  writeJSON(path.join(dataDir, 'mainland_by_province.json'), mainlandGrouped);
  writeJS(path.join(dataDir, 'mainland_by_province.js'), mainlandGrouped);
  console.log(`主陆高校生成完成，共 ${Object.keys(mainlandGrouped).length} 个省/直辖市/自治区`);

  // 2) 港澳台：region,school -> 按区域分组（香港特别行政区/澳门特别行政区/台湾省）
  const hkmtCSVPath = path.join(projectRoot, 'hk_macao_taiwan_universities.csv');
  const hkmtCSV = fs.readFileSync(hkmtCSVPath, 'utf8');
  const { rows: hkmtRows } = parseCSV(hkmtCSV);
  const hkmtGrouped = groupBy(hkmtRows, 'region', 'school');
  writeJSON(path.join(dataDir, 'hk_macao_taiwan.json'), hkmtGrouped);
  writeJS(path.join(dataDir, 'hk_macao_taiwan.js'), hkmtGrouped);
  console.log(`港澳台高校生成完成，共 ${Object.keys(hkmtGrouped).length} 个区域`);

  // 3) 海外：country,chinese_name -> 按国家分组
  const foreignCSVPath = path.join(projectRoot, 'foreign_universities.csv');
  const foreignCSV = fs.readFileSync(foreignCSVPath, 'utf8');
  const { rows: foreignRows } = parseCSV(foreignCSV);
  const foreignGrouped = groupBy(foreignRows, 'country', 'chinese_name');
  writeJSON(path.join(dataDir, 'foreign_by_country.json'), foreignGrouped);
  writeJS(path.join(dataDir, 'foreign_by_country.js'), foreignGrouped);
  console.log(`海外高校生成完成，共 ${Object.keys(foreignGrouped).length} 个国家/地区`);
}

main();
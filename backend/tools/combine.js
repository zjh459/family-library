/**
 * 合并数据文件工具
 * 将每行一个JSON对象的格式转换为标准JSON格式
 */

const fs = require('fs');
const path = require('path');

// 参数检查
const args = process.argv.slice(2);
if (args.length < 2) {
  console.log('使用方式: node combine.js <books.json路径> <categories.json路径> [输出路径]');
  process.exit(1);
}

// 文件路径
const BOOKS_FILE = args[0];
const CATEGORIES_FILE = args[1];
const OUTPUT_FILE = args[2] || path.join(__dirname, '../exports/combined_data.json');

/**
 * 解析每行一个JSON对象的文件
 * @param {string} filePath 文件路径
 * @returns {Array} JSON对象数组
 */
function parseJsonLines(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`错误: 找不到文件 ${filePath}`);
    return [];
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n').filter(line => line.trim());
  
  return lines.map(line => {
    try {
      return JSON.parse(line);
    } catch (e) {
      console.error(`解析行失败: ${line}`);
      return null;
    }
  }).filter(item => item !== null);
}

/**
 * 合并并保存数据
 */
function combineData() {
  console.log('开始合并数据...');
  
  // 解析JSON文件
  const books = parseJsonLines(BOOKS_FILE);
  const categories = parseJsonLines(CATEGORIES_FILE);
  
  console.log(`读取到 ${books.length} 本图书和 ${categories.length} 个分类`);
  
  // 创建合并后的数据对象
  const combinedData = { books, categories };
  
  // 将合并后的数据保存为标准JSON文件
  const outputDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(combinedData, null, 2), 'utf8');
  
  console.log(`数据已合并并保存至: ${OUTPUT_FILE}`);
}

// 执行合并
try {
  combineData();
} catch (error) {
  console.error('合并数据失败:', error);
  process.exit(1);
} 
/**
 * 从JSON文件导入数据到MySQL数据库
 * 这个脚本用于处理从小程序导出的JSON数据文件
 */

const fs = require('fs');
const path = require('path');
const mysql = require('../utils/mysql');

// 参数检查
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('使用方式: node import.js <books.json路径> [categories.json路径]');
  console.log('如果只提供一个参数，则假定为包含books和categories数据的合并JSON文件');
  process.exit(1);
}

// 确定导入文件的路径
const BOOKS_FILE = args[0];
const CATEGORIES_FILE = args.length > 1 ? args[1] : null;

/**
 * 解析JSON文件，处理每行一个JSON对象的格式
 * @param {string} filePath 文件路径
 * @returns {Array} 解析后的数据数组
 */
function parseJsonLines(filePath) {
  try {
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
  } catch (error) {
    console.error(`读取/解析文件失败: ${filePath}`, error);
    return [];
  }
}

/**
 * 解析日期对象
 * @param {Object} dateObj 日期对象，格式为 { $date: "ISO字符串" }
 * @returns {string} MySQL格式的日期字符串
 */
function parseDateObject(dateObj) {
  if (!dateObj || !dateObj.$date) return null;
  try {
    return new Date(dateObj.$date).toISOString().slice(0, 19).replace('T', ' ');
  } catch (e) {
    return null;
  }
}

/**
 * 处理分类数据，转换为MySQL格式
 * @param {Array} categories 分类数据数组
 * @returns {Array} 处理后的分类数组
 */
function processCategories(categories) {
  return categories.map(cat => {
    return {
      cloud_id: cat._id || '',
      name: cat.name || '',
      create_time: parseDateObject(cat.createTime) || new Date().toISOString().slice(0, 19).replace('T', ' '),
      update_time: new Date().toISOString().slice(0, 19).replace('T', ' '),
      // 可选的额外字段
      icon: cat.icon || 'default',
      color: cat.color || '#000000'
    };
  });
}

/**
 * 处理图书数据，转换为MySQL格式
 * @param {Array} books 图书数据数组
 * @returns {Array} 处理后的图书数组
 */
function processBooks(books) {
  return books.map(book => {
    return {
      cloud_id: book._id || '',
      title: book.title || '',
      author: book.author || '',
      category_name: book.category || (book.categories && book.categories.length > 0 ? book.categories[0] : ''),
      categories_json: JSON.stringify(book.categories || []),
      publisher: book.publisher || '',
      publication_date: book.publishDate || null,
      price: book.price || 0,
      isbn: book.isbn || '',
      cover: book.coverUrl || '',
      summary: book.description || '',
      create_time: parseDateObject(book.addTime) || new Date().toISOString().slice(0, 19).replace('T', ' '),
      update_time: new Date().toISOString().slice(0, 19).replace('T', ' ')
    };
  });
}

/**
 * 从JSON文件导入数据到MySQL
 */
async function importFromJSON() {
  try {
    console.log('开始从JSON文件导入数据到MySQL...');
    
    // 测试MySQL连接
    const connected = await mysql.testConnection();
    if (!connected) {
      console.error('无法连接到MySQL数据库，请检查配置');
      return false;
    }
    
    // 创建数据表
    await mysql.createTables();
    
    let books = [];
    let categories = [];
    
    // 如果提供了两个文件，分别读取
    if (CATEGORIES_FILE) {
      console.log(`读取分类数据从: ${CATEGORIES_FILE}`);
      categories = parseJsonLines(CATEGORIES_FILE);
      console.log(`读取图书数据从: ${BOOKS_FILE}`);
      books = parseJsonLines(BOOKS_FILE);
    } 
    // 如果只提供了一个文件，假定为合并文件
    else {
      console.log(`读取合并数据从: ${BOOKS_FILE}`);
      try {
        const jsonContent = fs.readFileSync(BOOKS_FILE, 'utf8');
        const data = JSON.parse(jsonContent);
        
        if (data.books && data.categories) {
          books = data.books;
          categories = data.categories;
        } else if (Array.isArray(data)) {
          // 如果是数组，尝试找出books和categories
          const possibleBooks = data.filter(item => item.title);
          const possibleCategories = data.filter(item => !item.title && item.name);
          
          if (possibleBooks.length > 0) books = possibleBooks;
          if (possibleCategories.length > 0) categories = possibleCategories;
        }
      } catch (e) {
        // 尝试逐行解析
        const allItems = parseJsonLines(BOOKS_FILE);
        books = allItems.filter(item => item.title || item.isbn);
        categories = allItems.filter(item => !item.title && !item.isbn && item.name);
      }
    }
    
    if (categories.length === 0 && books.length === 0) {
      console.error('没有找到有效的分类或图书数据');
      return false;
    }
    
    console.log(`读取数据成功: ${categories.length}个分类, ${books.length}本图书`);
    
    // 处理数据
    const processedCategories = processCategories(categories);
    const processedBooks = processBooks(books);
    
    // 导入数据
    const result = await mysql.importData(processedBooks, processedCategories);
    
    console.log(`数据已成功导入到MySQL数据库: ${result.categoriesCount}个分类, ${result.booksCount}本图书`);
    return true;
    
  } catch (error) {
    console.error('从JSON文件导入数据到MySQL失败:', error);
    return false;
  }
}

// 执行导入
importFromJSON()
  .then(success => {
    if (success) {
      console.log('导入成功，程序退出');
      process.exit(0);
    } else {
      console.error('导入失败，程序退出');
      process.exit(1);
    }
  })
  .catch(err => {
    console.error('导入过程发生错误:', err);
    process.exit(1);
  }); 
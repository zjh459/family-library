/**
 * MySQL数据库工具类
 * 用于连接和操作MySQL数据库
 */

const mysql = require('mysql2/promise');
const config = require('../config');

// 创建数据库连接池
const pool = mysql.createPool(config.mysql);

// 测试数据库连接
async function testConnection() {
  let connection;
  try {
    connection = await pool.getConnection();
    console.log('MySQL数据库连接成功');
    return true;
  } catch (error) {
    console.error('MySQL数据库连接失败:', error);
    return false;
  } finally {
    if (connection) connection.release();
  }
}

/**
 * 执行SQL查询
 * @param {string} sql SQL语句
 * @param {Array} params 参数数组
 * @returns {Promise} 查询结果
 */
async function query(sql, params = []) {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('SQL查询执行失败:', error);
    throw error;
  }
}

/**
 * 创建数据库表结构
 * 根据云数据库的结构创建MySQL表
 */
async function createTables() {
  try {
    // 创建categories表
    await query(`
      CREATE TABLE IF NOT EXISTS categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cloud_id VARCHAR(50),
        name VARCHAR(100) NOT NULL,
        icon VARCHAR(50) DEFAULT 'default',
        color VARCHAR(20) DEFAULT '#000000',
        create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY (name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    // 创建books表
    await query(`
      CREATE TABLE IF NOT EXISTS books (
        id INT AUTO_INCREMENT PRIMARY KEY,
        cloud_id VARCHAR(50),
        title VARCHAR(255) NOT NULL,
        author VARCHAR(255),
        category_id INT,
        category_name VARCHAR(100),
        categories_json TEXT,
        publisher VARCHAR(255),
        publication_date VARCHAR(100),
        price DECIMAL(10,2),
        isbn VARCHAR(50),
        cover TEXT,
        summary TEXT,
        borrow_status VARCHAR(50) DEFAULT 'in',
        create_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        update_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    
    console.log('数据库表结构创建成功');
    return true;
  } catch (error) {
    console.error('创建数据库表结构失败:', error);
    throw error;
  }
}

/**
 * 从微信云数据库导入数据到MySQL
 * @param {Array} books 处理后的书籍数据数组
 * @param {Array} categories 处理后的分类数据数组
 * @returns {Object} 导入结果统计
 */
async function importData(books, categories) {
  let connection;
  let categoriesCount = 0;
  let booksCount = 0;
  
  try {
    // 开始事务
    connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // 1. 导入分类数据
      console.log(`开始导入${categories.length}个分类...`);
      const categoryIdMap = {}; // 用于映射cloud_id到MySQL自增ID
      
      for (const category of categories) {
        const { cloud_id, name, icon, color, create_time, update_time } = category;
        
        // 检查分类是否已存在
        const [existingRows] = await connection.execute(
          'SELECT id FROM categories WHERE name = ?',
          [name]
        );
        
        let categoryId;
        if (existingRows.length > 0) {
          // 分类已存在，更新它
          categoryId = existingRows[0].id;
          await connection.execute(
            'UPDATE categories SET cloud_id = ?, icon = ?, color = ?, update_time = ? WHERE id = ?',
            [cloud_id, icon, color, update_time, categoryId]
          );
        } else {
          // 插入新分类
          const [result] = await connection.execute(
            'INSERT INTO categories (cloud_id, name, icon, color, create_time, update_time) VALUES (?, ?, ?, ?, ?, ?)',
            [cloud_id, name, icon, color, create_time, update_time]
          );
          categoryId = result.insertId;
          categoriesCount++;
        }
        
        // 保存映射关系
        categoryIdMap[name] = categoryId;
      }
      
      // 2. 导入书籍数据
      console.log(`开始导入${books.length}本书籍...`);
      for (const book of books) {
        const { 
          cloud_id, title, author, category_name, categories_json,
          publisher, publication_date, price, isbn, cover, summary,
          create_time, update_time
        } = book;
        
        // 查找对应的分类ID
        let categoryId = null;
        if (category_name && categoryIdMap[category_name]) {
          categoryId = categoryIdMap[category_name];
        }
        
        // 插入书籍
        const [result] = await connection.execute(
          `INSERT INTO books 
           (cloud_id, title, author, category_id, category_name, categories_json, 
            publisher, publication_date, price, isbn, cover, summary, create_time, update_time) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [cloud_id, title, author, categoryId, category_name, categories_json,
           publisher, publication_date, price, isbn, cover, summary, create_time, update_time]
        );
        
        booksCount++;
      }
      
      // 提交事务
      await connection.commit();
      console.log('数据导入成功');
      return { categoriesCount, booksCount };
    } catch (error) {
      // 发生错误，回滚事务
      await connection.rollback();
      console.error('数据导入失败，事务已回滚:', error);
      throw error;
    }
  } catch (error) {
    console.error('数据导入过程出错:', error);
    throw error;
  } finally {
    if (connection) connection.release();
  }
}

module.exports = {
  testConnection,
  query,
  createTables,
  importData
}; 
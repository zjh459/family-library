/**
 * 图书管理系统服务器 - 提供MySQL数据库访问API
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mysql = require('./utils/mysql');

// 创建Express应用
const app = express();
const port = process.env.PORT || 3000;

// 中间件配置
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 测试路由
app.get('/api/ping', (req, res) => {
  res.json({ message: 'pong', timestamp: new Date() });
});

// 获取所有分类
app.get('/api/categories', async (req, res) => {
  try {
    const categories = await mysql.query(`
      SELECT id, cloud_id, name, icon, color, create_time, update_time
      FROM categories
      ORDER BY name ASC
    `);
    
    res.json(categories);
  } catch (error) {
    console.error('获取分类列表失败:', error);
    res.status(500).json({ error: '获取分类列表失败' });
  }
});

// 获取单个分类
app.get('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [category] = await mysql.query(
      `SELECT id, cloud_id, name, icon, color, create_time, update_time
       FROM categories WHERE id = ?`,
      [id]
    );
    
    if (!category) {
      return res.status(404).json({ error: '分类不存在' });
    }
    
    res.json(category);
  } catch (error) {
    console.error('获取分类详情失败:', error);
    res.status(500).json({ error: '获取分类详情失败' });
  }
});

// 添加分类
app.post('/api/categories', async (req, res) => {
  try {
    const { name, icon = 'default', color = '#000000' } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: '分类名称不能为空' });
    }
    
    const result = await mysql.query(
      `INSERT INTO categories (name, icon, color, create_time, update_time) 
       VALUES (?, ?, ?, NOW(), NOW())`,
      [name, icon, color]
    );
    
    const id = result.insertId;
    res.status(201).json({ 
      id, 
      name, 
      icon, 
      color,
      create_time: new Date().toISOString().slice(0, 19).replace('T', ' '),
      update_time: new Date().toISOString().slice(0, 19).replace('T', ' ')
    });
  } catch (error) {
    console.error('添加分类失败:', error);
    
    // 处理重复名称错误
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '该分类名称已存在' });
    }
    
    res.status(500).json({ error: '添加分类失败' });
  }
});

// 更新分类
app.put('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, icon, color } = req.body;
    
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: '分类名称不能为空' });
    }
    
    let updateFields = [];
    let params = [];
    
    if (name) {
      updateFields.push('name = ?');
      params.push(name);
    }
    
    if (icon) {
      updateFields.push('icon = ?');
      params.push(icon);
    }
    
    if (color) {
      updateFields.push('color = ?');
      params.push(color);
    }
    
    updateFields.push('update_time = NOW()');
    params.push(id);
    
    const result = await mysql.query(
      `UPDATE categories SET ${updateFields.join(', ')} WHERE id = ?`,
      params
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '分类不存在' });
    }
    
    const [updatedCategory] = await mysql.query(
      `SELECT id, cloud_id, name, icon, color, create_time, update_time
       FROM categories WHERE id = ?`,
      [id]
    );
    
    res.json(updatedCategory);
  } catch (error) {
    console.error('更新分类失败:', error);
    
    // 处理重复名称错误
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: '该分类名称已存在' });
    }
    
    res.status(500).json({ error: '更新分类失败' });
  }
});

// 删除分类
app.delete('/api/categories/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // 先更新引用此分类的图书
    await mysql.query(
      'UPDATE books SET category_id = NULL WHERE category_id = ?',
      [id]
    );
    
    // 删除分类
    const result = await mysql.query(
      'DELETE FROM categories WHERE id = ?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '分类不存在' });
    }
    
    res.json({ message: '分类删除成功' });
  } catch (error) {
    console.error('删除分类失败:', error);
    res.status(500).json({ error: '删除分类失败' });
  }
});

// 获取图书列表 (支持分页、搜索和分类筛选)
app.get('/api/books', async (req, res) => {
  try {
    const { 
      query = '', // 搜索关键词
      category_id = '', // 分类ID
      page = 1,
      limit = 50,
      orderBy = 'create_time',
      order = 'desc'
    } = req.query;
    
    const offset = (page - 1) * limit;
    
    // 构建基础SQL
    let sql = `
      SELECT 
        b.id, b.cloud_id, b.title, b.author, b.publisher, b.isbn, 
        b.cover, b.publication_date, b.price, b.summary,
        b.borrow_status, b.create_time, b.update_time,
        c.id as category_id, c.name as category_name
      FROM books b
      LEFT JOIN categories c ON b.category_id = c.id
    `;
    
    // 构建查询参数
    const params = [];
    
    // WHERE条件
    let whereClauses = [];
    
    // 处理搜索
    if (query) {
      whereClauses.push(`(
        b.title LIKE ? OR 
        b.author LIKE ? OR 
        b.isbn LIKE ?
      )`);
      const searchPattern = `%${query}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }
    
    // 处理分类过滤
    if (category_id) {
      whereClauses.push(`b.category_id = ?`);
      params.push(category_id);
    }
    
    // 添加WHERE子句
    if (whereClauses.length > 0) {
      sql += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    
    // 添加排序
    const validOrderColumns = ['create_time', 'update_time', 'title', 'author'];
    const validOrderDirections = ['asc', 'desc'];
    
    const orderColumn = validOrderColumns.includes(orderBy) ? orderBy : 'create_time';
    const orderDirection = validOrderDirections.includes(order.toLowerCase()) ? order : 'desc';
    
    sql += ` ORDER BY b.${orderColumn} ${orderDirection}`;
    
    // 添加分页
    sql += ` LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);
    
    // 执行查询
    const books = await mysql.query(sql, params);
    
    // 获取总数
    let countSql = `SELECT COUNT(*) as total FROM books b`;
    if (whereClauses.length > 0) {
      countSql += ` WHERE ${whereClauses.join(' AND ')}`;
    }
    
    const [countResult] = await mysql.query(countSql, params.slice(0, params.length - 2));
    const total = countResult.total;
    
    // 为每本书添加totalCount字段，用于前端判断总数
    const booksWithTotal = books.map(book => ({
      ...book,
      totalCount: total
    }));
    
    res.json(booksWithTotal);
  } catch (error) {
    console.error('获取图书列表失败:', error);
    res.status(500).json({ error: '获取图书列表失败' });
  }
});

// 图书搜索接口
app.get('/api/books/search', async (req, res) => {
  try {
    const { keyword } = req.query;
    
    if (!keyword) {
      return res.status(400).json({ error: '搜索关键词不能为空' });
    }
    
    const sql = `
      SELECT 
        b.id, b.cloud_id, b.title, b.author, b.publisher, b.isbn, 
        b.cover, b.publication_date, b.price, b.summary,
        b.borrow_status, b.create_time, b.update_time,
        c.id as category_id, c.name as category_name
      FROM books b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.title LIKE ? OR b.author LIKE ? OR b.isbn LIKE ?
      ORDER BY b.create_time DESC
      LIMIT 50
    `;
    
    const searchPattern = `%${keyword}%`;
    const books = await mysql.query(sql, [searchPattern, searchPattern, searchPattern]);
    
    res.json(books);
  } catch (error) {
    console.error('搜索图书失败:', error);
    res.status(500).json({ error: '搜索图书失败' });
  }
});

// 获取单本图书
app.get('/api/books/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [book] = await mysql.query(`
      SELECT 
        b.id, b.cloud_id, b.title, b.author, b.publisher, b.isbn, 
        b.cover, b.publication_date, b.price, b.summary,
        b.borrow_status, b.create_time, b.update_time,
        c.id as category_id, c.name as category_name,
        b.categories_json
      FROM books b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.id = ?
    `, [id]);
    
    if (!book) {
      return res.status(404).json({ error: '图书不存在' });
    }
    
    // 解析分类JSON
    if (book.categories_json) {
      try {
        book.categories = JSON.parse(book.categories_json);
      } catch (e) {
        book.categories = [];
      }
    } else {
      book.categories = [];
    }
    
    // 删除原始JSON字段
    delete book.categories_json;
    
    res.json(book);
  } catch (error) {
    console.error('获取图书详情失败:', error);
    res.status(500).json({ error: '获取图书详情失败' });
  }
});

// 添加图书
app.post('/api/books', async (req, res) => {
  try {
    const { 
      title, author, publisher, publication_date, isbn, 
      price, cover, summary, category_id 
    } = req.body;
    
    if (!title) {
      return res.status(400).json({ error: '图书标题不能为空' });
    }
    
    // 获取分类名称
    let categoryName = null;
    if (category_id) {
      const [category] = await mysql.query(
        'SELECT name FROM categories WHERE id = ?',
        [category_id]
      );
      if (category) {
        categoryName = category.name;
      }
    }
    
    // 插入图书
    const result = await mysql.query(
      `INSERT INTO books 
       (title, author, publisher, publication_date, isbn, price, cover, summary, 
        category_id, category_name, create_time, update_time) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [title, author, publisher, publication_date, isbn, price, cover, 
       summary, category_id, categoryName]
    );
    
    const bookId = result.insertId;
    
    // 获取新增的图书
    const [newBook] = await mysql.query(
      `SELECT 
        b.id, b.cloud_id, b.title, b.author, b.publisher, b.isbn, 
        b.cover, b.publication_date, b.price, b.summary,
        b.borrow_status, b.create_time, b.update_time,
        c.id as category_id, c.name as category_name
      FROM books b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.id = ?`,
      [bookId]
    );
    
    res.status(201).json(newBook);
  } catch (error) {
    console.error('添加图书失败:', error);
    res.status(500).json({ error: '添加图书失败' });
  }
});

// 更新图书
app.put('/api/books/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      title, author, publisher, publication_date, isbn, 
      price, cover, summary, category_id, borrow_status 
    } = req.body;
    
    // 验证必填字段
    if (title && typeof title !== 'string') {
      return res.status(400).json({ error: '图书标题必须是字符串' });
    }
    
    // 构建更新字段
    let updateFields = [];
    let params = [];
    
    if (title !== undefined) {
      updateFields.push('title = ?');
      params.push(title);
    }
    
    if (author !== undefined) {
      updateFields.push('author = ?');
      params.push(author);
    }
    
    if (publisher !== undefined) {
      updateFields.push('publisher = ?');
      params.push(publisher);
    }
    
    if (publication_date !== undefined) {
      updateFields.push('publication_date = ?');
      params.push(publication_date);
    }
    
    if (isbn !== undefined) {
      updateFields.push('isbn = ?');
      params.push(isbn);
    }
    
    if (price !== undefined) {
      updateFields.push('price = ?');
      params.push(price);
    }
    
    if (cover !== undefined) {
      updateFields.push('cover = ?');
      params.push(cover);
    }
    
    if (summary !== undefined) {
      updateFields.push('summary = ?');
      params.push(summary);
    }
    
    if (borrow_status !== undefined) {
      updateFields.push('borrow_status = ?');
      params.push(borrow_status);
    }
    
    // 处理分类
    if (category_id !== undefined) {
      updateFields.push('category_id = ?');
      params.push(category_id);
      
      // 更新分类名称
      if (category_id) {
        const [category] = await mysql.query(
          'SELECT name FROM categories WHERE id = ?',
          [category_id]
        );
        
        if (category) {
          updateFields.push('category_name = ?');
          params.push(category.name);
        } else {
          updateFields.push('category_name = NULL');
        }
      } else {
        updateFields.push('category_name = NULL');
      }
    }
    
    // 添加更新时间
    updateFields.push('update_time = NOW()');
    
    // 添加ID参数
    params.push(id);
    
    // 执行更新
    if (updateFields.length > 0) {
      const result = await mysql.query(
        `UPDATE books SET ${updateFields.join(', ')} WHERE id = ?`,
        params
      );
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: '图书不存在' });
      }
    }
    
    // 获取更新后的图书
    const [updatedBook] = await mysql.query(
      `SELECT 
        b.id, b.cloud_id, b.title, b.author, b.publisher, b.isbn, 
        b.cover, b.publication_date, b.price, b.summary,
        b.borrow_status, b.create_time, b.update_time,
        c.id as category_id, c.name as category_name
      FROM books b
      LEFT JOIN categories c ON b.category_id = c.id
      WHERE b.id = ?`,
      [id]
    );
    
    if (!updatedBook) {
      return res.status(404).json({ error: '图书不存在' });
    }
    
    res.json(updatedBook);
  } catch (error) {
    console.error('更新图书失败:', error);
    res.status(500).json({ error: '更新图书失败' });
  }
});

// 删除图书
app.delete('/api/books/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = await mysql.query(
      'DELETE FROM books WHERE id = ?',
      [id]
    );
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '图书不存在' });
    }
    
    res.json({ message: '图书删除成功' });
  } catch (error) {
    console.error('删除图书失败:', error);
    res.status(500).json({ error: '删除图书失败' });
  }
});

// 获取未分类的图书
app.get('/api/books/uncategorized', async (req, res) => {
  try {
    const { 
      page = 1,
      limit = 50,
      orderBy = 'create_time',
      order = 'desc'
    } = req.query;
    
    const offset = (page - 1) * limit;
    
    // 查询没有分类或分类ID为null的图书
    const sql = `
      SELECT 
        b.id, b.cloud_id, b.title, b.author, b.publisher, b.isbn, 
        b.cover, b.publication_date, b.price, b.summary,
        b.borrow_status, b.create_time, b.update_time
      FROM books b
      WHERE b.category_id IS NULL
      ORDER BY b.${orderBy} ${order}
      LIMIT ? OFFSET ?
    `;
    
    const books = await mysql.query(sql, [parseInt(limit), offset]);
    
    // 获取总数
    const [countResult] = await mysql.query(
      'SELECT COUNT(*) as total FROM books WHERE category_id IS NULL'
    );
    const total = countResult.total;
    
    // 为每本书添加totalCount字段
    const booksWithTotal = books.map(book => ({
      ...book,
      totalCount: total
    }));
    
    res.json(booksWithTotal);
  } catch (error) {
    console.error('获取未分类图书失败:', error);
    res.status(500).json({ error: '获取未分类图书失败' });
  }
});

// 启动服务器
app.listen(port, () => {
  console.log(`服务器运行在 http://localhost:${port}`);
}); 
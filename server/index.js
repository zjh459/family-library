// 服务器端API代码
const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2/promise');
const cors = require('cors');
const morgan = require('morgan');
const app = express();
const port = 3000;

// 自定义日志格式
morgan.token('body', (req) => JSON.stringify(req.body));
morgan.token('error', (req, res) => res.locals.error || '');
morgan.token('response-body', (req, res) => {
  if (res._responseBody) {
    return JSON.stringify(res._responseBody);
  }
  return '';
});

// 中间件设置
app.use(bodyParser.json({ limit: '10mb' }));
app.use(cors());

// 响应体捕获中间件
app.use((req, res, next) => {
  const originalJson = res.json;
  res.json = function (body) {
    res._responseBody = body;
    return originalJson.call(this, body);
  };
  next();
});

// 请求日志中间件
app.use(morgan(':method :url :status :response-time ms - :res[content-length] - Request: :body - Response: :response-body - Error: :error'));


// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('错误:', err);
  res.locals.error = err.message;
  next(err);
});

// 导入数据库配置
const config = require('./config');

// 创建MySQL连接池
const pool = mysql.createPool(config.database);

// 测试数据库连接
app.get('/api/test', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT 1 as test');
    res.json({ success: true, message: '数据库连接成功', data: rows });
  } catch (error) {
    console.error('数据库连接失败:', error);
    res.status(500).json({ success: false, message: '数据库连接失败', error: error.message });
  }
});

// 分类相关API
// 获取所有分类
app.get('/api/categories', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM categories ORDER BY name');
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('获取分类失败:', error);
    res.status(500).json({ success: false, message: '获取分类失败', error: error.message });
  }
});

// 添加分类
app.post('/api/categories', async (req, res) => {
  try {
    const category = req.body;
    const [result] = await pool.query('INSERT INTO categories (name, icon, color) VALUES (?, ?, ?)', 
      [category.name, category.icon || 'default', category.color || '#000000']);
    
    res.json({ 
      success: true, 
      message: '添加分类成功',
      data: { 
        id: result.insertId,
        ...category
      }
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: '分类名称已存在' });
    }
    console.error('添加分类失败:', error);
    res.status(500).json({ success: false, message: '添加分类失败', error: error.message });
  }
});

// 更新分类
app.put('/api/categories/:id', async (req, res) => {
  try {
    const category = req.body;
    const [result] = await pool.query('UPDATE categories SET name = ?, icon = ?, color = ? WHERE id = ?',
      [category.name, category.icon, category.color, req.params.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '分类不存在' });
    }
    
    res.json({ success: true, message: '更新分类成功', data: { id: parseInt(req.params.id), ...category } });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: '分类名称已存在' });
    }
    console.error('更新分类失败:', error);
    res.status(500).json({ success: false, message: '更新分类失败', error: error.message });
  }
});

// 删除分类
app.delete('/api/categories/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '分类不存在' });
    }
    
    res.json({ success: true, message: '删除分类成功' });
  } catch (error) {
    console.error('删除分类失败:', error);
    res.status(500).json({ success: false, message: '删除分类失败', error: error.message });
  }
});

// 图书相关API
// 获取所有图书
app.get('/api/books', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT b.*, c.name as category_name 
      FROM books b 
      LEFT JOIN categories c ON b.category_id = c.id 
      ORDER BY b.create_time DESC
    `);
    
    // 处理categories_json字段
    rows.forEach(book => {
      if (book.categories_json) {
        try {
          book.categories = JSON.parse(book.categories_json);
        } catch (e) {
          book.categories = [];
        }
      }
    });
    
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('获取图书失败:', error);
    res.status(500).json({ success: false, message: '获取图书失败', error: error.message });
  }
});

// 获取单本图书
app.get('/api/books/:id', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT b.*, c.name as category_name 
      FROM books b 
      LEFT JOIN categories c ON b.category_id = c.id 
      WHERE b.id = ?
    `, [req.params.id]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: '图书不存在' });
    }
    
    // 处理categories_json字段
    if (rows[0].categories_json) {
      try {
        rows[0].categories = JSON.parse(rows[0].categories_json);
      } catch (e) {
        rows[0].categories = [];
      }
    }
    
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('获取图书失败:', error);
    res.status(500).json({ success: false, message: '获取图书失败', error: error.message });
  }
});

// 添加图书
app.post('/api/books', async (req, res) => {
  try {
    const book = req.body;
    
    // 处理categories字段
    if (book.categories) {
      book.categories_json = JSON.stringify(book.categories);
    }
    
    // 设置默认值
    book.borrow_status = book.borrow_status || 'in';
    
    const [result] = await pool.query('INSERT INTO books SET ?', [book]);
    
    res.json({ 
      success: true, 
      message: '添加图书成功',
      data: { 
        id: result.insertId,
        ...book
      }
    });
  } catch (error) {
    console.error('添加图书失败:', error);
    res.status(500).json({ success: false, message: '添加图书失败', error: error.message });
  }
});

// 更新图书
app.put('/api/books/:id', async (req, res) => {
  try {
    const book = req.body;
    
    // 处理categories字段
    if (book.categories) {
      book.categories_json = JSON.stringify(book.categories);
    }
    
    const [result] = await pool.query('UPDATE books SET ? WHERE id = ?', [book, req.params.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '图书不存在' });
    }
    
    res.json({ success: true, message: '更新图书成功', data: { id: parseInt(req.params.id), ...book } });
  } catch (error) {
    console.error('更新图书失败:', error);
    res.status(500).json({ success: false, message: '更新图书失败', error: error.message });
  }
});

// 删除图书
app.delete('/api/books/:id', async (req, res) => {
  try {
    const [result] = await pool.query('DELETE FROM books WHERE id = ?', [req.params.id]);
    
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: '图书不存在' });
    }
    
    res.json({ success: true, message: '删除图书成功' });
  } catch (error) {
    console.error('删除图书失败:', error);
    res.status(500).json({ success: false, message: '删除图书失败', error: error.message });
  }
});

// 统计API
// 获取各分类的图书数量
app.get('/api/statistics/categories', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        c.name as category_name,
        c.id as category_id,
        COUNT(b.id) as book_count
      FROM 
        categories c
        LEFT JOIN books b ON c.id = b.category_id
      GROUP BY 
        c.id, c.name
      ORDER BY 
        c.name
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('获取分类统计失败:', error);
    res.status(500).json({ success: false, message: '获取分类统计失败', error: error.message });
  }
});

// 借阅统计
app.get('/api/statistics/borrow', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        borrow_status,
        COUNT(*) as count
      FROM 
        books
      GROUP BY 
        borrow_status
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('获取借阅统计失败:', error);
    res.status(500).json({ success: false, message: '获取借阅统计失败', error: error.message });
  }
});

// 启动服务器
app.listen(port, () => {
  console.log(`服务器已启动，端口：${port}`);
});
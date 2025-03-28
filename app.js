// app.js
const config = require('./config');
// 引入MySQL适配器
const mysqlAdapter = require('./miniprogram/utils/mysql-adapter');

App({
  onLaunch() {
    // 初始化云开发
    if (wx.cloud) {
      wx.cloud.init({
        env: config.cloud.env, // 从配置文件读取云环境ID
        traceUser: true,
      });
    } else {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    }
    
    // 初始化本地存储
    this.initStorage();
    
    // 从云数据库同步图书数据
    this.syncBooksFromCloud().then(() => {
      // 同步完成后，更新所有分类的计数
      this.syncCategoriesCount();
      // 检查并修复所有图书的分类数据结构
      this.fixBookCategoriesData();
      // 修复分类数据中的ID和名称混用问题
      this.fixBookCategoriesIDNameMismatch();
    });
  },

  globalData: {
    userInfo: null,
    books: [],
    theme: {
      primaryColor: '#FFF5E6',    // 主色（主背景/大面积留白）
      secondaryColor: '#C8D8C7',  // 辅助色（次级背景/模块容器）
      accentColor: '#FFA07A',     // 点缀色（按钮/高亮图标）
      textColor: '#4A3F35',       // 文字色（正文文字/深色控件）
      highlightColor: '#C8D8C7',  // 高亮色(使用辅助色)
      borderRadius: '8px'         // 圆角大小
    }
  },

  // 初始化本地存储
  initStorage() {
    const books = wx.getStorageSync('books');
    if (!books) {
      wx.setStorageSync('books', []);
    } else {
      this.globalData.books = books;
    }
  },

  // 从云端同步图书数据
  syncBooksFromCloud() {
    console.log('开始从云端同步图书数据');
    
    // 使用API获取所有图书
    return mysqlAdapter.getAllBooks()
      .then(res => {
        const books = res.data || [];
        console.log(`从API获取了${books.length}本图书`);
        
        // 处理书籍数据
        this.globalData.books = books.map(book => {
          // 确保ID字段的一致性
          if (!book._id && book.id) {
            book._id = book.id;
          }
          if (!book.id && book._id) {
            book.id = book._id;
          }
          
          // 确保旧的云数据库ID也能映射到新的ID
          // 云数据库ID通常为长字符串格式，如果本地存储中有旧的云ID引用，这里做映射
          if (book.cloud_id) {
            book._cloud_id = book.cloud_id; // 保存云ID到另一个字段
            
            // 创建一个映射关系存储在本地，便于后续查询
            try {
              let idMapping = wx.getStorageSync('id_mapping') || {};
              idMapping[book.cloud_id] = book.id;
              wx.setStorageSync('id_mapping', idMapping);
            } catch (e) {
              console.error('保存ID映射失败:', e);
            }
          }
          
          // 处理borrowStatus字段
          if (book.borrow_status && !book.borrowStatus) {
            book.borrowStatus = book.borrow_status;
          }
          // 确保categories字段是数组
          if (!book.categories) {
            book.categories = book.category ? [book.category] : [];
          }
          return book;
        });
        
        this.saveBooks();
        console.log('图书数据已同步到本地');
        return true;
      })
      .catch(err => {
        console.error('从API同步图书数据失败:', err);
        return false;
      });
  },

  // 保存所有书籍到本地
  saveBooks() {
    wx.setStorageSync('books', this.globalData.books);
  },

  // 添加书籍
  addBook(book) {
    const now = new Date();
    
    // 如果没有id，生成一个临时id
    if (!book.id) {
      book.id = `book_${now.getTime()}`;
    }
    
    book.addTime = book.addTime || now.getTime();
    book.borrowStatus = book.borrowStatus || 'in'; // 默认在库
    
    this.globalData.books.unshift(book); // 新书放在最前面
    this.saveBooks();
    return book.id;
  },

  // 更新书籍
  updateBook(bookId, updatedInfo) {
    console.log('开始更新书籍，ID:', bookId, '更新信息:', updatedInfo);
    
    // 支持根据id查找书籍
    const index = this.globalData.books.findIndex(book => book.id == bookId);
    
    console.log('在全局数据中查找书籍索引:', index);
    
    if (index !== -1) {
      console.log('找到书籍，开始更新');
      
      this.globalData.books[index] = {
        ...this.globalData.books[index],
        ...updatedInfo
      };
      this.saveBooks();
      
      console.log('已更新本地数据');
      
      // 同步更新到MySQL服务器（使用适配器）
      const { _openid, _id, ...serverSafeData } = updatedInfo;
      
      console.log('开始更新服务器数据库，ID:', bookId);
      
      mysqlAdapter.database().collection('books').doc(bookId).update({
        data: serverSafeData,
        success: res => {
          console.log('更新服务器数据库成功:', res);
        },
        fail: err => {
          console.error('更新服务器数据库失败', err);
        }
      });
      
      return true;
    }
    
    console.error('未找到要更新的书籍，ID:', bookId);
    return false;
  },

  // 删除书籍
  deleteBook(bookId) {
    console.log('尝试删除书籍，ID:', bookId);
    
    // 规范化ID
    const normalizedId = bookId.toString().trim();
    
    const index = this.globalData.books.findIndex(book => 
      (book.id && book.id.toString() === normalizedId) || 
      (book._id && book._id.toString() === normalizedId)
    );
    
    console.log('在全局数据中查找书籍索引:', index);
    
    // 定义使用API删除书籍的函数
    const deleteWithAPI = (id) => {
      console.log('开始使用API删除书籍:', id);
      
      return mysqlAdapter.deleteBook(id)
        .then(res => {
          console.log('通过API删除书籍成功:', res);
          return true;
        })
        .catch(err => {
          console.error('通过API删除书籍失败:', err);
          
          // 如果是404错误，说明记录不存在，也视为成功
          if (err.statusCode === 404) {
            console.warn('API可能已不存在此记录，继续视为已删除');
            return true;
          }
          
          return false;
        });
    };
    
    // 如果在本地找到了书籍
    if (index !== -1) {
      // 获取书籍的分类信息，用于后续更新分类计数
      const bookCategories = this.globalData.books[index].categories || [];
      const bookCategory = this.globalData.books[index].category;
      
      // 合并所有分类
      const allCategories = [...new Set([...(bookCategories || []), bookCategory].filter(Boolean))];
      
      // 先从本地删除
      const deletedBook = this.globalData.books.splice(index, 1)[0];
      this.saveBooks();
      
      console.log('已从本地删除书籍:', deletedBook);
      
      // 通过API删除书籍
      return deleteWithAPI(normalizedId)
        .then(success => {
          console.log('通过API删除书籍结果:', success);
          return true;
        })
        .catch(() => {
          // 即使API删除失败，也返回true，因为本地已删除
          return true;
        });
    } else {
      console.warn('在本地未找到要删除的书籍，尝试直接通过API删除, ID:', normalizedId);
      
      // 尝试通过API直接删除
      return deleteWithAPI(normalizedId)
        .then(success => {
          if (success) {
            console.log('成功通过API删除书籍:', normalizedId);
            // 删除成功后重新同步本地数据
            this.syncBooksFromCloud();
          }
          return success;
        });
    }
  },
  
  // 更新删除书籍后的分类计数
  updateCategoryCountsAfterDeletion(categories) {
    if (!categories || !categories.length) return;
    
    console.log('更新被删除书籍相关的分类计数:', categories);
    
    // 通过API获取分类统计
    mysqlAdapter.getCategoriesStatistics()
      .then(result => {
        console.log('获取分类统计结果:', result);
      })
      .catch(err => {
        console.error('获取分类统计失败:', err);
      });
  },

  // 查找书籍
  getBook(bookId) {
    return this.globalData.books.find(book => book.id === bookId);
  },

  // 搜索书籍
  searchBooks(query, filters = {}) {
    if (!query && Object.keys(filters).length === 0) {
      return this.globalData.books;
    }

    return this.globalData.books.filter(book => {
      // 关键词搜索
      if (query) {
        const lowerQuery = query.toLowerCase();
        if (
          (book.title && book.title.toLowerCase().includes(lowerQuery)) ||
          (book.author && book.author.toLowerCase().includes(lowerQuery)) ||
          (book.isbn && book.isbn.includes(query))
        ) {
          // 如果关键词匹配，再检查筛选条件
          return this.matchesFilters(book, filters);
        }
        return false;
      }
      
      // 没有关键词，只检查筛选条件
      return this.matchesFilters(book, filters);
    });
  },

  // 检查书籍是否符合筛选条件
  matchesFilters(book, filters) {
    for (const key in filters) {
      if (filters[key] && book[key] !== filters[key]) {
        return false;
      }
    }
    return true;
  },

  // 同步所有分类的计数
  syncCategoriesCount() {
    console.log('开始同步所有分类的计数');
    
    // 通过API获取分类统计
    return mysqlAdapter.getCategoriesStatistics()
      .then(result => {
        const categories = result.data || [];
        if (categories.length === 0) {
          console.log('没有分类数据需要同步');
          return Promise.resolve();
        }
        
        console.log(`找到${categories.length}个分类，统计结果:`, categories);
        return Promise.resolve();
      })
      .catch(err => {
        console.error('同步分类计数失败:', err);
        return Promise.reject(err);
      });
  },
  
  // 更新单个分类的计数(使用API自动完成，此方法保留但无实际操作)
  updateSingleCategoryCount(category) {
    if (!category || !category.category_name || !category.category_id) {
      return Promise.resolve();
    }
    
    console.log(`分类[${category.category_name}]的计数已在API中自动处理，不需手动更新`);
    return Promise.resolve();
  },

  // 检查并修复所有图书的分类数据结构(使用API自动完成，此方法保留但无实际操作)
  fixBookCategoriesData() {
    console.log('使用API管理数据，分类数据结构由后端自动维护');
    return Promise.resolve();
  },

  // 修复图书分类ID和名称混用问题(使用API自动完成，此方法保留但无实际操作)
  fixBookCategoriesIDNameMismatch() {
    console.log('使用API管理数据，ID和名称映射由后端自动维护');
    return Promise.resolve();
  },
}) 
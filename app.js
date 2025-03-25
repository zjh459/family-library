// app.js
const config = require('./config');

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
    this.syncBooksFromCloud();
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

  // 从云数据库同步图书数据
  syncBooksFromCloud() {
    if (!wx.cloud) return;
    
    wx.cloud.database().collection('books').get({
      success: res => {
        if (res.data && res.data.length > 0) {
          // 将云数据与本地数据合并（以云数据为准）
          const cloudBooks = res.data.map(book => ({
            ...book,
            id: book._id // 确保云端的_id映射到本地的id
          }));
          
          this.globalData.books = cloudBooks;
          this.saveBooks();
        }
      },
      fail: err => {
        console.error('从云端同步图书失败', err);
      }
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
    const index = this.globalData.books.findIndex(book => book.id === bookId);
    if (index !== -1) {
      this.globalData.books[index] = {
        ...this.globalData.books[index],
        ...updatedInfo
      };
      this.saveBooks();
      
      // 同步更新到云数据库
      if (wx.cloud) {
        const cloudId = bookId.startsWith('book_') ? null : bookId;
        if (cloudId) {
          // 排除系统字段，避免Invalid Key Name错误
          const { _openid, _id, ...cloudSafeData } = updatedInfo;
          
          wx.cloud.database().collection('books').doc(cloudId).update({
            data: cloudSafeData,
            fail: err => {
              console.error('更新云数据库失败', err);
            }
          });
        }
      }
      
      return true;
    }
    return false;
  },

  // 删除书籍
  deleteBook(bookId) {
    const index = this.globalData.books.findIndex(book => book.id === bookId);
    if (index !== -1) {
      // 先从本地删除
      const deletedBook = this.globalData.books.splice(index, 1)[0];
      this.saveBooks();
      
      // 同步从云数据库删除
      if (wx.cloud && bookId.indexOf('book_') !== 0) {
        wx.cloud.database().collection('books').doc(bookId).remove({
          fail: err => {
            console.error('从云数据库删除失败', err);
          }
        });
        
        // 如果有封面图片存储在云存储中，也一并删除
        if (deletedBook.coverUrl && deletedBook.coverUrl.indexOf('cloud://') === 0) {
          wx.cloud.deleteFile({
            fileList: [deletedBook.coverUrl],
            fail: err => {
              console.error('删除云存储图片失败', err);
            }
          });
        }
      }
      
      return true;
    }
    return false;
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
  }
}) 
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
    console.log('开始更新书籍，ID:', bookId, '更新信息:', updatedInfo);
    
    // 支持根据id或_id查找书籍
    const index = this.globalData.books.findIndex(book => book.id === bookId || book._id === bookId);
    
    console.log('在全局数据中查找书籍索引:', index);
    
    if (index !== -1) {
      console.log('找到书籍，开始更新');
      
      this.globalData.books[index] = {
        ...this.globalData.books[index],
        ...updatedInfo
      };
      this.saveBooks();
      
      console.log('已更新本地数据');
      
      // 同步更新到云数据库
      if (wx.cloud) {
        const cloudId = bookId.startsWith('book_') ? null : bookId;
        if (cloudId) {
          // 排除系统字段，避免Invalid Key Name错误
          const { _openid, _id, ...cloudSafeData } = updatedInfo;
          
          console.log('开始更新云数据库，ID:', cloudId);
          
          wx.cloud.database().collection('books').doc(cloudId).update({
            data: cloudSafeData,
            success: res => {
              console.log('更新云数据库成功:', res);
            },
            fail: err => {
              console.error('更新云数据库失败', err);
            }
          });
        }
      }
      
      return true;
    }
    
    console.error('未找到要更新的书籍，ID:', bookId);
    return false;
  },

  // 删除书籍
  deleteBook(bookId) {
    console.log('尝试删除书籍，ID:', bookId);
    
    const index = this.globalData.books.findIndex(book => book.id === bookId || book._id === bookId);
    
    console.log('在全局数据中查找书籍索引:', index);
    
    if (index !== -1) {
      // 先从本地删除
      const deletedBook = this.globalData.books.splice(index, 1)[0];
      this.saveBooks();
      
      console.log('已从本地删除书籍:', deletedBook);
      
      // 同步从云数据库删除
      if (wx.cloud && bookId.indexOf('book_') !== 0) {
        console.log('开始从云数据库删除书籍:', bookId);
        
        // 返回Promise以便等待删除完成
        return new Promise((resolve, reject) => {
          wx.cloud.database().collection('books').doc(bookId).remove({
            success: res => {
              console.log('从云数据库删除成功:', res);
              
              // 如果有封面图片存储在云存储中，也一并删除
              if (deletedBook.coverUrl && deletedBook.coverUrl.indexOf('cloud://') === 0) {
                wx.cloud.deleteFile({
                  fileList: [deletedBook.coverUrl],
                  success: fileRes => {
                    console.log('删除云存储图片成功:', fileRes);
                  },
                  fail: err => {
                    console.error('删除云存储图片失败', err);
                  },
                  complete: () => {
                    resolve(true);
                  }
                });
              } else {
                resolve(true);
              }
            },
            fail: err => {
              console.error('从云数据库删除失败', err);
              
              // 即使云数据库删除失败，如果本地已删除，也视为部分成功
              // 这通常发生在记录已不存在或权限问题的情况下
              if (err.errCode === -1 || err.errMsg.includes('not exist') || err.errMsg.includes('not found')) {
                console.warn('云数据库可能已不存在此记录，继续视为已删除');
                resolve(true);
                return;
              }
              
              reject(err);
            }
          });
        }).then(() => true).catch(err => {
          console.error('删除过程中发生错误:', err);
          return false;
        });
      }
      
      return true;
    }
    
    console.error('未找到要删除的书籍，ID:', bookId);
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
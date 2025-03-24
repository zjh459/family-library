// app.js
App({
  onLaunch() {
    // 初始化本地存储
    this.initStorage();
  },

  globalData: {
    userInfo: null,
    books: [],
    theme: {
      primaryColor: '#F5F5DC',  // 米白色
      secondaryColor: '#D2B48C', // 原木色
      accentColor: '#8FBC8F',   // 豆沙绿
      alternateAccentColor: '#87CEEB', // 雾霾蓝
      borderRadius: '8px'       // 圆角大小
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

  // 保存所有书籍到本地
  saveBooks() {
    wx.setStorageSync('books', this.globalData.books);
  },

  // 添加书籍
  addBook(book) {
    const now = new Date();
    book.id = `book_${now.getTime()}`;
    book.addTime = now.getTime();
    book.borrowStatus = 'in'; // 默认在库
    
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
      return true;
    }
    return false;
  },

  // 删除书籍
  deleteBook(bookId) {
    const index = this.globalData.books.findIndex(book => book.id === bookId);
    if (index !== -1) {
      this.globalData.books.splice(index, 1);
      this.saveBooks();
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
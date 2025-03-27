const app = getApp();
const Database = require('../../utils/database'); 
const bookUtils = require('../../utils/book'); // 引入book工具函数

Page({
  data: {
    books: [],
    searchValue: '',
    filteredBooks: [],
    theme: {},
    categories: [],           // 所有分类
    selectedCategory: 'all',  // 当前选中的分类，默认为全部
    loading: true,
    pageSize: 10,             // 每页显示数量
    currentPage: 1,           // 当前页码
    hasMoreData: true,        // 是否还有更多数据
    loadingMore: false,       // 是否正在加载更多
    preloadedImages: [],      // 预加载的图片
    totalBooks: 0             // 总图书数量
  },

  onLoad() {
    this.setData({
      theme: app.globalData.theme
    });
    this.loadBooks();
    this.initCategories();
  },

  onShow() {
    // 创建变量跟踪是否是首次显示页面
    if (!this.hasShownBefore) {
      // 第一次显示时正常加载
      this.hasShownBefore = true;
      this.loadBooks();
      this.loadCategories();
      return;
    }
    
    // 从其他页面返回时，只检查是否有新图书，而不重置整个列表
    this.checkForNewBooks();
  },
  
  // 检查是否有新图书
  async checkForNewBooks() {
    try {
      // 获取最新图书列表，检查是否有变化
      const books = await Database.getBooks({ limit: 1 });
      
      // 检查books是否为数组
      if (!Array.isArray(books)) {
        console.error('检查新图书返回的数据不是数组:', books);
        this.setData({ loading: false });
        return;
      }
      
      const currentTotal = books.length > 0 ? books[0].totalCount || 0 : 0;
      
      if (currentTotal !== this.data.totalBooks) {
        console.log('书籍数量已变化，只加载新增书籍');
        
        // 书籍总数发生变化，但我们只加载新增的书籍
        if (currentTotal > this.data.totalBooks) {
          // 如果是新增了书籍，只获取最新的书籍
          const newBooksCount = currentTotal - this.data.totalBooks;
          this.loadNewBooks(newBooksCount);
        } else {
          // 如果是删除了书籍，需要完全重新加载
          this.setData({
            currentPage: 1,
            hasMoreData: true
          });
          this.loadBooks();
        }
        
        // 更新分类信息
        this.loadCategories();
      } else {
        console.log('书籍数量未变化，保留当前状态');
        // 数量未变，保留当前状态
        this.setData({
          loading: false
        });
      }
    } catch (err) {
      console.error('检查图书数量变化失败:', err);
      this.setData({
        loading: false
      });
    }
  },
  
  // 只加载新增的书籍
  async loadNewBooks(count) {
    this.setData({ loading: true });
    
    try {
      // 获取最新的count本书
      const newBooks = await Database.getBooks({
        page: 1,
        pageSize: count,
        orderBy: 'addTime',
        order: 'desc'
      });
      
      // 检查newBooks是否为数组
      if (!Array.isArray(newBooks)) {
        console.error('加载新书返回的数据不是数组:', newBooks);
        this.setData({ loading: false });
        return;
      }
      
      // 处理封面URL
      const processedBooks = newBooks.map(book => {
        const processedBook = bookUtils.processCoverUrl(book);
        // 初始化封面加载状态
        processedBook.coverLoaded = false;
        return processedBook;
      });
      
      // 更新总书籍数量
      this.setData({
        totalBooks: this.data.totalBooks + processedBooks.length
      });
      
      // 检查是否有重复的书籍(基于_id)
      const existingIds = this.data.books.map(book => book._id);
      const uniqueNewBooks = processedBooks.filter(book => !existingIds.includes(book._id));
      
      if (uniqueNewBooks.length === 0) {
        this.setData({ loading: false });
        return;
      }
      
      // 将新书籍添加到列表前面，保持已有书籍的状态不变
      const updatedBooks = [...uniqueNewBooks, ...this.data.books];
      
      // 根据当前筛选条件更新filteredBooks
      let updatedFilteredBooks;
      if (this.data.selectedCategory === 'all') {
        // 如果当前显示全部，直接添加到前面
        updatedFilteredBooks = [...uniqueNewBooks, ...this.data.filteredBooks];
      } else {
        // 如果有分类筛选，则先筛选出符合条件的新书
        const filteredNewBooks = uniqueNewBooks.filter(book => 
          book.categories && book.categories.includes(this.data.selectedCategory)
        );
        
        // 然后添加到前面
        updatedFilteredBooks = [...filteredNewBooks, ...this.data.filteredBooks];
      }
      
      // 更新数据
      this.setData({
        books: updatedBooks,
        filteredBooks: updatedFilteredBooks,
        loading: false
      });
      
      // 预加载新书的图片
      this.preloadImages(uniqueNewBooks);
      
    } catch (err) {
      console.error('加载新增书籍失败:', err);
      this.setData({ loading: false });
    }
  },
  
  // 监听用户下拉刷新
  onPullDownRefresh() {
    this.setData({
      currentPage: 1,
      hasMoreData: true
    });
    this.loadBooks().then(() => {
      wx.stopPullDownRefresh();
    });
  },
  
  // 监听触底事件，加载更多数据
  onReachBottom() {
    if (this.data.hasMoreData && !this.data.loadingMore) {
      this.loadMoreBooks();
    }
  },

  // 加载更多图书
  loadMoreBooks() {
    if (!this.data.hasMoreData || this.data.loadingMore) {
      return;
    }
    
    const nextPage = this.data.currentPage + 1;
    this.setData({
      loadingMore: true
    });
    
    // 构建查询条件
    let query = {
      page: nextPage,
      pageSize: this.data.pageSize,
      orderBy: 'addTime',
      order: 'desc'
    };
    
    if (this.data.selectedCategory && this.data.selectedCategory !== 'all') {
      query.category = this.data.selectedCategory;
    }

    if (this.data.searchValue) {
      query.query = this.data.searchValue;
    }
    
    // 保存已加载书籍的ID，避免重复加载
    const existingIds = this.data.books.map(book => book._id);
    
    Database.getBooks(query)
      .then(books => {
        // 检查books是否为数组
        if (!Array.isArray(books)) {
          console.error('加载更多返回的图书数据不是数组:', books);
          this.setData({
            hasMoreData: false,
            loadingMore: false
          });
          return;
        }
        
        // 处理封面URL
        const newBooks = books.map(book => {
          const processedBook = bookUtils.processCoverUrl(book);
          // 如果已经在页面上显示过这本书，检查之前的加载状态
          const existingBookIndex = this.data.books.findIndex(b => b._id === book._id);
          if (existingBookIndex !== -1 && this.data.books[existingBookIndex].coverLoaded) {
            // 保留已加载的状态
            processedBook.coverLoaded = true;
          } else {
            // 新书初始化为已加载状态
            processedBook.coverLoaded = true;
          }
          return processedBook;
        });
        
        // 如果没有新数据，表示已加载全部
        if (newBooks.length === 0) {
          this.setData({
            hasMoreData: false,
            loadingMore: false
          });
          return;
        }
        
        // 过滤掉重复的书籍
        const uniqueNewBooks = newBooks.filter(book => !existingIds.includes(book._id));
        
        // 合并新旧数据
        const updatedBooks = [...this.data.books, ...uniqueNewBooks];
        const updatedFilteredBooks = [...this.data.filteredBooks, ...uniqueNewBooks];
        
        this.setData({
          currentPage: nextPage,
          books: updatedBooks,
          filteredBooks: updatedFilteredBooks,
          loadingMore: false
        });
      })
      .catch(err => {
        console.error('加载更多图书失败：', err);
        this.setData({
          loadingMore: false,
          hasMoreData: false
        });
      });
  },

  // 预加载图片，提前缓存以提高体验
  preloadImages(books) {
    // 只预加载有封面的书籍
    const booksToPreload = books.filter(book => book.cover && !book.coverLoaded);
    
    if (booksToPreload.length === 0) return;
    
    // 更新预加载图片数组
    this.setData({
      preloadedImages: booksToPreload.map(book => book.cover)
    });
  },
  
  // 图片加载开始
  onLoadImage(e) {
    console.log('开始加载图片:', e.currentTarget.dataset.id);
  },
  
  // 图片加载成功
  onImageLoad(e) {
    const bookId = e.currentTarget.dataset.id;
    console.log('图片加载成功:', bookId);
    
    // 更新书籍的封面加载状态
    const books = this.data.books.map(book => {
      if (book._id === bookId) {
        return { ...book, coverLoaded: true };
      }
      return book;
    });
    
    // 同样更新筛选后的书籍列表
    const filteredBooks = this.data.filteredBooks.map(book => {
      if (book._id === bookId) {
        return { ...book, coverLoaded: true };
      }
      return book;
    });
    
    this.setData({ books, filteredBooks });
  },
  
  // 图片加载失败
  onImageError(e) {
    const bookId = e.currentTarget.dataset.id;
    console.log('图片加载失败:', bookId);
    
    // 更新书籍的封面，使用默认封面
    const books = this.data.books.map(book => {
      if (book._id === bookId) {
        return { 
          ...book, 
          cover: '../../images/default-book.png',
          coverLoaded: true 
        };
      }
      return book;
    });
    
    // 同样更新筛选后的书籍列表
    const filteredBooks = this.data.filteredBooks.map(book => {
      if (book._id === bookId) {
        return { 
          ...book, 
          cover: '../../images/default-book.png', 
          coverLoaded: true 
        };
      }
      return book;
    });
    
    this.setData({ books, filteredBooks });
  },

  // 加载图书数据
  async loadBooks() {
    this.setData({ loading: true });
    
    try {
      // 构建查询条件
      let query = {
        page: 1,
        pageSize: this.data.pageSize,
        orderBy: 'addTime',
        order: 'desc'
      };
      
      if (this.data.selectedCategory && this.data.selectedCategory !== 'all') {
        query.category = this.data.selectedCategory;
      }

      if (this.data.searchValue) {
        query.query = this.data.searchValue;
      }
      
      const books = await Database.getBooks(query);
      
      // 检查books是否为数组
      if (!Array.isArray(books)) {
        console.error('API返回的图书数据不是数组:', books);
        this.setData({ 
          books: [],
          filteredBooks: [],
          loading: false,
          totalBooks: 0,
          hasMoreData: false
        });
        return [];
      }
      
      // 获取总数
      const totalBooks = books.length > 0 && books[0].totalCount ? books[0].totalCount : books.length;
      
      // 处理封面URL
      const processedBooks = books.map(book => {
        const processedBook = bookUtils.processCoverUrl(book);
        return {
          ...processedBook,
          coverLoaded: false  // 初始化封面加载状态
        };
      });
      
      this.setData({
        books: processedBooks,
        filteredBooks: processedBooks,
        loading: false,
        totalBooks: totalBooks,
        hasMoreData: processedBooks.length >= this.data.pageSize
      });
      
      // 预加载图片
      this.preloadImages(processedBooks);
      
      return processedBooks;
    } catch (err) {
      console.error('加载图书失败:', err);
      this.setData({ 
        loading: false,
        books: [],
        filteredBooks: [],
        totalBooks: 0
      });
      return [];
    }
  },
  
  // 搜索框输入变化
  onSearchChange(e) {
    this.setData({
      searchValue: e.detail
    });
  },
  
  // 搜索提交
  onSearch(e) {
    this.filterBooks(this.data.searchValue);
  },
  
  // 根据关键词筛选图书
  filterBooks(keyword) {
    // 重置筛选
    this.setData({
      loading: true,
      currentPage: 1,
      hasMoreData: true
    });
    
    if (!keyword) {
      // 如果关键词为空，则恢复原列表
      this.loadBooks();
      return;
    }
    
    // 调用API进行搜索
    Database.searchBooks(keyword)
      .then(books => {
        // 检查books是否为数组
        if (!Array.isArray(books)) {
          console.error('搜索返回的图书数据不是数组:', books);
          this.setData({ 
            filteredBooks: [],
            loading: false,
            hasMoreData: false
          });
          return;
        }

        // 处理封面URL
        const processedBooks = books.map(book => {
          const processedBook = bookUtils.processCoverUrl(book);
          return {
            ...processedBook,
            coverLoaded: false  // 初始化封面加载状态
          };
        });
        
        this.setData({
          filteredBooks: processedBooks,
          loading: false,
          hasMoreData: false  // 搜索结果一次性获取，不需要加载更多
        });
        
        // 预加载图片
        this.preloadImages(processedBooks);
      })
      .catch(err => {
        console.error('搜索图书失败:', err);
        this.setData({ 
          loading: false,
          filteredBooks: []
        });
      });
  },
  
  // 根据分类筛选图书
  filterBooksByCategory(category) {
    this.setData({
      selectedCategory: category,
      loading: true,
      currentPage: 1,
      hasMoreData: true
    });
    
    // 如果选择全部，则重新加载所有图书
    if (category === 'all') {
      this.loadBooks();
      return;
    }
    
    // 加载该分类下的图书
    Database.getBooksByCategory(category)
      .then(books => {
        // 检查books是否为数组
        if (!Array.isArray(books)) {
          console.error('分类筛选返回的图书数据不是数组:', books);
          this.setData({ 
            filteredBooks: [],
            loading: false,
            hasMoreData: false
          });
          return;
        }

        // 处理封面URL
        const processedBooks = books.map(book => {
          const processedBook = bookUtils.processCoverUrl(book);
          return {
            ...processedBook,
            coverLoaded: false  // 初始化封面加载状态
          };
        });
        
        this.setData({
          filteredBooks: processedBooks,
          loading: false,
          hasMoreData: false  // 类别筛选一次性获取，不需要加载更多
        });
        
        // 预加载图片
        this.preloadImages(processedBooks);
      })
      .catch(err => {
        console.error('按分类筛选图书失败:', err);
        this.setData({ 
          loading: false,
          filteredBooks: []
        });
      });
  },
  
  // 跳转到图书详情页
  goToDetail(e) {
    const { id } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `../bookDetail/bookDetail?id=${id}`
    });
  },
  
  // 跳转到添加图书页
  goToAdd() {
    wx.navigateTo({
      url: '../bookAdd/bookAdd'
    });
  },
  
  // 扫码添加图书
  scanCode() {
    // 调用扫码API
    wx.scanCode({
      scanType: ['barCode'], // 指定只扫条形码
      success: (res) => {
        // 获取ISBN号
        const isbn = res.result;
        
        // 跳转到添加页面，并传递ISBN参数
        wx.navigateTo({
          url: `../bookAdd/bookAdd?isbn=${isbn}`
        });
      },
      fail: (err) => {
        // 扫码失败，显示错误提示
        wx.showToast({
          title: '扫码失败，请重试',
          icon: 'none'
        });
        console.error('扫码失败：', err);
      }
    });
  },
  
  // 分享功能
  onShareAppMessage() {
    return {
      title: '我的图书收藏',
      path: '/pages/index/index',
      imageUrl: '../../images/share-image.png'
    };
  },
  
  // 加载分类数据
  loadCategories() {
    Database.getCategories()
      .then(categories => {
        // 添加"全部"选项
        const allCategories = [
          { _id: 'all', name: '全部' },
          ...categories
        ];
        
        this.setData({
          categories: allCategories
        });
      })
      .catch(err => {
        console.error('加载分类失败:', err);
        // 出错时至少保证"全部"选项可用
        this.setData({
          categories: [{ _id: 'all', name: '全部' }]
        });
      });
  },
  
  // 选择分类
  selectCategory(e) {
    const categoryId = e.currentTarget.dataset.id;
    if (categoryId !== this.data.selectedCategory) {
      this.filterBooksByCategory(categoryId);
    }
  },
  
  // 初始化分类
  async initCategories() {
    try {
      const categories = await Database.getCategories();
      
      // 添加"全部"选项
      const allCategories = [
        { _id: 'all', name: '全部' },
        ...categories
      ];
      
      this.setData({
        categories: allCategories
      });
    } catch (err) {
      console.error('初始化分类失败:', err);
      // 出错时至少保证"全部"选项可用
      this.setData({
        categories: [{ _id: 'all', name: '全部' }]
      });
    }
  }
}); 
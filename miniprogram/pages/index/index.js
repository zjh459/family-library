const app = getApp();
const db = wx.cloud.database();
const _ = db.command;
const bookUtils = require('../../utils/book'); // 引入book工具函数
const api = require('../../utils/api');

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
      const db = wx.cloud.database();
      
      // 获取当前最新的书籍总数
      const countRes = await db.collection('books').count();
      const currentTotal = countRes.total;
      
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
    }
  },
  
  // 只加载新增的书籍
  async loadNewBooks(count) {
    this.setData({ loading: true });
    
    try {
      // 获取最新的count本书
      const res = await db.collection('books')
        .orderBy('addTime', 'desc')
        .limit(count)
        .get();
      
      // 处理封面URL
      const newBooks = res.data.map(book => {
        const processedBook = bookUtils.processCoverUrl(book);
        // 初始化封面加载状态
        processedBook.coverLoaded = false;
        return processedBook;
      });
      
      // 更新总书籍数量
      this.setData({
        totalBooks: this.data.totalBooks + newBooks.length
      });
      
      // 检查是否有重复的书籍(基于_id)
      const existingIds = this.data.books.map(book => book._id);
      const uniqueNewBooks = newBooks.filter(book => !existingIds.includes(book._id));
      
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
    let query = {};
    if (this.data.selectedCategory && this.data.selectedCategory !== 'all') {
      query.categories = this.data.selectedCategory;
    }

    if (this.data.searchValue) {
      query.title = db.RegExp({
        regexp: this.data.searchValue,
        options: 'i'
      });
    }
    
    // 保存已加载书籍的ID，避免重复加载
    const existingIds = this.data.books.map(book => book._id);
    
    db.collection('books')
      .where(query)
      .orderBy('addTime', 'desc')
      .skip((nextPage - 1) * this.data.pageSize)
      .limit(this.data.pageSize)
      .get()
      .then(res => {
        // 处理封面URL
        const newBooks = res.data.map(book => {
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
          loadingMore: false
        });
      });
  },

  // 预加载图片，提前缓存以提高体验
  preloadImages(books) {
    const imagesToPreload = books
      .filter(book => book.coverUrl && book.coverUrl.startsWith('http'))
      .map(book => book.coverUrl);
    
    if (imagesToPreload.length === 0) return;
    
    // 记录预加载的图片
    this.setData({
      preloadedImages: [...this.data.preloadedImages, ...imagesToPreload]
    });
    
    // 执行预加载
    imagesToPreload.forEach(imageUrl => {
      wx.getImageInfo({
        src: imageUrl,
        success: () => {
          console.log('预加载图片成功:', imageUrl);
        },
        fail: (err) => {
          console.error('预加载图片失败:', imageUrl, err);
        }
      });
    });
  },

  // 图片加载完成处理（新方法，与WXML中的bindloadimage对应）
  onLoadImage(e) {
    return this.onImageLoad(e);
  },

  // 图片加载完成处理
  onImageLoad(e) {
    try {
      const index = e.currentTarget.dataset.index;
      if (index === undefined || index === null) {
        console.error('图片加载事件缺少索引值');
        return;
      }
      
      const filteredBooks = this.data.filteredBooks;
      if (!filteredBooks || !Array.isArray(filteredBooks)) {
        console.error('filteredBooks不是有效数组');
        return;
      }
      
      // 标记图片已加载完成
      if (filteredBooks[index]) {
        // 使用setData的key特定更新方式，避免更新整个数组造成性能问题
        this.setData({
          [`filteredBooks[${index}].coverLoaded`]: true
        });
      }
    } catch (err) {
      console.error('处理图片加载完成事件出错:', err);
    }
  },

  // 图片加载错误处理
  onImageError(e) {
    try {
      const index = e.currentTarget.dataset.index;
      if (index === undefined || index === null) {
        console.error('图片错误事件缺少索引值');
        return;
      }
      
      const filteredBooks = this.data.filteredBooks;
      if (!filteredBooks || !Array.isArray(filteredBooks)) {
        console.error('filteredBooks不是有效数组');
        return;
      }
      
      // 如果图片加载失败，设置为默认图片
      if (filteredBooks[index]) {
        this.setData({
          [`filteredBooks[${index}].coverUrl`]: '../../images/default-cover.png',
          [`filteredBooks[${index}].coverLoaded`]: true
        });
      }
    } catch (err) {
      console.error('处理图片加载错误事件出错:', err);
    }
  },

  // 加载图书数据
  loadBooks() {
    const that = this;
    
    // 根据当前选择的分类进行过滤
    let query = {};
    if (this.data.selectedCategory && this.data.selectedCategory !== 'all') {
      query.categories = this.data.selectedCategory;
    }

    // 如果有搜索值，添加搜索条件
    if (this.data.searchValue) {
      query.title = db.RegExp({
        regexp: this.data.searchValue,
        options: 'i'
      });
    }

    this.setData({ loading: true });

    // 先获取符合条件的总数
    const countPromise = db.collection('books')
      .where(query)
      .count()
      .then(res => {
        this.setData({
          totalBooks: res.total,
          hasMoreData: res.total > this.data.pageSize
        });
        return res.total;
      });
    
    // 保存当前已加载完成图片的id和状态映射
    const loadedImagesMap = {};
    if (this.data.books && this.data.books.length > 0) {
      this.data.books.forEach(book => {
        if (book._id && book.coverLoaded) {
          loadedImagesMap[book._id] = true;
        }
      });
    }
    
    // 分页查询数据
    const dataPromise = db.collection('books')
      .where(query)
      .orderBy('addTime', 'desc')
      .limit(this.data.pageSize)
      .get()
      .then(res => {
        // 处理封面URL
        const books = res.data.map(book => {
          const processedBook = bookUtils.processCoverUrl(book);
          // 如果这本书之前已加载过图片，保留加载状态
          if (book._id && loadedImagesMap[book._id]) {
            processedBook.coverLoaded = true;
          } else {
            // 否则初始化为已加载状态，避免显示加载中
            processedBook.coverLoaded = true;
          }
          return processedBook;
        });
        
        that.setData({
          books: books,
          filteredBooks: books,
          loading: false,
          currentPage: 1
        });
        
        return books;
      });
    
    return Promise.all([countPromise, dataPromise])
      .catch(err => {
        console.error('加载图书失败：', err);
        that.setData({ loading: false });
        wx.showToast({
          title: '加载图书失败',
          icon: 'none'
        });
      });
  },

  // 搜索框内容变化
  onSearchChange(e) {
    this.setData({
      searchValue: e.detail
    });
    this.filterBooks(e.detail);
  },

  // 搜索确认
  onSearch(e) {
    this.filterBooks(this.data.searchValue);
  },

  // 过滤图书(搜索)
  filterBooks(keyword) {
    let filtered = this.data.books;
    
    // 如果有选中的分类，先按分类筛选
    if (this.data.selectedCategory && this.data.selectedCategory !== 'all') {
      filtered = filtered.filter(book => 
        book.categories && book.categories.includes(this.data.selectedCategory)
      );
    }
    
    // 再按关键词筛选
    if (keyword) {
      const searchStr = keyword.toLowerCase();
      filtered = filtered.filter(book => {
        return (
          (book.title && book.title.toLowerCase().includes(searchStr)) ||
          (book.author && book.author.toLowerCase().includes(searchStr))
        );
      });
    }

    this.setData({
      filteredBooks: filtered
    });
  },

  // 按分类筛选图书
  filterBooksByCategory(category) {
    if (category === 'all') {
      // 如果选择"全部"，则只应用搜索过滤
      this.filterBooks(this.data.searchValue);
      return;
    }
    
    // 按分类筛选
    const filtered = this.data.books.filter(book => 
      book.categories && book.categories.includes(category)
    );
    
    // 再应用搜索关键词
    this.setData({
      filteredBooks: filtered
    });
    
    if (this.data.searchValue) {
      this.filterBooks(this.data.searchValue);
    }
  },

  // 跳转到图书详情
  goToDetail(e) {
    const id = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `../bookDetail/bookDetail?id=${id}`
    });
  },

  // 跳转到添加图书
  goToAdd() {
    wx.navigateTo({
      url: '../bookAdd/bookAdd'
    });
  },

  // 扫码添加图书
  scanCode() {
    wx.scanCode({
      success: (res) => {
        console.log('扫码结果:', res);
        // 如果是ISBN码，跳转到添加页面
        if (res.scanType === 'EAN_13' || res.scanType === 'EAN_10') {
          wx.navigateTo({
            url: `../bookAdd/bookAdd?isbn=${res.result}`
          });
        } else {
          wx.showToast({
            title: '不是有效的ISBN码',
            icon: 'none'
          });
        }
      },
      fail: (err) => {
        console.error('扫码失败:', err);
      }
    });
  },

  // 分享页面
  onShareAppMessage() {
    return {
      title: '稻米小屋',
      path: '/miniprogram/pages/welcome/welcome'
    }
  },

  // 加载分类数据
  loadCategories() {
    return api.getCategoriesStatistics()
      .then(result => {
        // 处理返回的数据，确保字段名称一致
        const categories = result.data.map(category => ({
          ...category,
          name: category.category_name,
          _id: category.category_id,
          count: category.book_count || 0
        }));
        
        console.log('首页-加载分类成功，分类总数:', categories.length);
        
        // 记录一下各分类的数量，便于调试
        categories.forEach(category => {
          console.log(`首页-分类[${category.name}]数量: ${category.count || 0}`);
        });
        
        this.setData({ categories });
        return categories;
      })
      .catch(err => {
        console.error('加载分类失败：', err);
        wx.showToast({
          title: '加载分类失败',
          icon: 'none'
        });
      });
  },

  // 选择分类
  selectCategory(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({
      selectedCategory: category
    });
    this.filterBooksByCategory(category);
  },

  // 初始化分类
  async initCategories() {
    try {
      const result = await api.getCategoriesStatistics();
      
      if (result.data && result.data.length > 0) {
        const categories = result.data.map(category => ({
          ...category,
          name: category.category_name,
          _id: category.category_id,
          count: category.book_count || 0
        }));
        this.setData({ categories });
        return;
      }

      // 如果没有分类数据，创建默认分类
      const defaultCategories = [
        { name: '文学', icon: 'book', color: '#FF6B6B' },
        { name: '科技', icon: 'science', color: '#4ECDC4' },
        { name: '历史', icon: 'history', color: '#45B7D1' },
        { name: '艺术', icon: 'art', color: '#96CEB4' },
        { name: '教育', icon: 'education', color: '#FFEEAD' },
        { name: '儿童', icon: 'child', color: '#FF9999' },
        { name: '其他', icon: 'more', color: '#CCCCCC' }
      ];

      // 批量添加默认分类
      const tasks = defaultCategories.map(category => 
        api.addCategory(category)
      );

      await Promise.all(tasks);
      
      // 重新获取分类列表
      const newResult = await api.getCategoriesStatistics();
      const newCategories = newResult.data.map(category => ({
        ...category,
        name: category.category_name,
        _id: category.category_id,
        count: category.book_count || 0
      }));
      this.setData({ categories: newCategories });
    } catch (error) {
      console.error('初始化分类失败：', error);
      wx.showToast({
        title: '加载分类失败',
        icon: 'none'
      });
    }
  }
}) 
const app = getApp();

Page({
  data: {
    keyword: '',
    searchResults: [],
    isSearching: false,
    showFilterPopup: false,
    filters: {
      category: '',
      publishYear: '',
      author: '',
      publisher: '',
      borrowStatus: ''
    },
    categories: ['全部'],  // 将在onLoad中动态加载实际分类
    publishYears: ['全部', '2023', '2022', '2021', '2020', '2019', '2018', '更早'],
    authors: ['全部'],     // 将在搜索时动态加载
    publishers: ['全部'],  // 将在搜索时动态加载
    borrowStatus: ['全部', '在库', '已借出'],
    currentCategory: '全部',
    currentPublishYear: '全部',
    currentAuthor: '全部',
    currentPublisher: '全部',
    currentBorrowStatus: '全部',
    searchHistory: [],
    theme: {},
    hasSearched: false
  },

  onLoad() {
    this.setData({
      theme: app.globalData.theme,
      searchHistory: wx.getStorageSync('searchHistory') || []
    });
    
    // 加载实际分类
    this.loadCategories();
    
    // 加载作者和出版社列表
    this.loadFiltersData();
  },
  
  // 加载分类数据
  async loadCategories() {
    try {
      const db = wx.cloud.database();
      const res = await db.collection('categories').get();
      
      if (res.data && res.data.length > 0) {
        // 提取分类名称并保留"全部"选项在首位
        const categoryNames = ['全部', ...res.data.map(item => item.name)];
        
        this.setData({
          categories: categoryNames
        });
      }
    } catch (err) {
      console.error('加载分类失败：', err);
    }
  },
  
  // 加载筛选数据（作者、出版社）
  async loadFiltersData() {
    try {
      const db = wx.cloud.database();
      const booksRes = await db.collection('books').get();
      
      if (booksRes.data && booksRes.data.length > 0) {
        // 提取唯一的作者和出版社
        const authors = new Set(['全部']);
        const publishers = new Set(['全部']);
        
        booksRes.data.forEach(book => {
          if (book.author) authors.add(book.author);
          if (book.publisher) publishers.add(book.publisher);
        });
        
        this.setData({
          authors: Array.from(authors),
          publishers: Array.from(publishers)
        });
      }
    } catch (err) {
      console.error('加载筛选数据失败：', err);
    }
  },

  // 输入关键词
  onKeywordInput(e) {
    this.setData({
      keyword: e.detail
    });
  },

  // 提交搜索
  onSearch() {
    const keyword = this.data.keyword.trim();
    if (!keyword) {
      return;
    }
    
    this.performSearch(keyword);
    this.addToSearchHistory(keyword);
  },

  // 执行搜索
  performSearch(keyword) {
    this.setData({ 
      isSearching: true,
      hasSearched: true 
    });

    // 构建筛选条件
    const filters = {};
    
    // 分类筛选
    if (this.data.currentCategory !== '全部') {
      // 修改为检查categories数组中是否包含所选分类
      filters.categoryName = this.data.currentCategory;
    }
    
    // 作者筛选
    if (this.data.currentAuthor !== '全部') {
      filters.author = this.data.currentAuthor;
    }
    
    // 出版社筛选
    if (this.data.currentPublisher !== '全部') {
      filters.publisher = this.data.currentPublisher;
    }
    
    // 在库状态筛选
    if (this.data.currentBorrowStatus !== '全部') {
      filters.borrowStatus = this.data.currentBorrowStatus === '在库' ? 'in' : 'out';
    }
    
    // 处理年份筛选
    if (this.data.currentPublishYear !== '全部') {
      if (this.data.currentPublishYear === '更早') {
        // 找2018年之前的
        filters.publishYearBefore = 2018;
      } else {
        filters.publishYear = this.data.currentPublishYear;
      }
    }

    // 调用搜索
    this.searchBooksFromCloud(keyword, filters);
  },
  
  // 从云数据库中搜索图书
  async searchBooksFromCloud(keyword, filters) {
    try {
      const db = wx.cloud.database();
      const _ = db.command;
      
      // 构建查询条件
      let query = db.collection('books');
      
      // 关键词搜索（标题、作者或ISBN）
      if (keyword) {
        // 由于微信小程序云数据库不支持复杂的OR查询，需要多次查询合并结果
        const titleQuery = await db.collection('books')
          .where({
            title: db.RegExp({
              regexp: keyword,
              options: 'i',
            })
          })
          .get();
          
        const authorQuery = await db.collection('books')
          .where({
            author: db.RegExp({
              regexp: keyword,
              options: 'i',
            })
          })
          .get();
          
        const isbnQuery = await db.collection('books')
          .where({
            isbn: db.RegExp({
              regexp: keyword,
              options: 'i',
            })
          })
          .get();
          
        // 合并查询结果并去重
        const allResults = [...titleQuery.data, ...authorQuery.data, ...isbnQuery.data];
        const uniqueResults = this.removeDuplicates(allResults, '_id');
        
        // 应用筛选条件
        let filteredResults = this.applyFilters(uniqueResults, filters);
        
        this.setData({
          searchResults: filteredResults,
          isSearching: false
        });
        return;
      }
      
      // 如果没有关键词，直接按筛选条件查询
      let dbQuery = query;
      
      // 添加分类筛选条件
      if (filters.categoryName) {
        dbQuery = dbQuery.where({
          categories: _.all([filters.categoryName])
        });
      }
      
      // 添加其他筛选条件
      if (filters.author) {
        dbQuery = dbQuery.where({
          author: filters.author
        });
      }
      
      if (filters.publisher) {
        dbQuery = dbQuery.where({
          publisher: filters.publisher
        });
      }
      
      if (filters.borrowStatus) {
        dbQuery = dbQuery.where({
          borrowStatus: filters.borrowStatus
        });
      }
      
      // 执行查询
      const res = await dbQuery.get();
      
      // 处理出版年份筛选（云数据库不好做这种部分匹配的查询，所以在结果中筛选）
      let results = res.data;
      if (filters.publishYear || filters.publishYearBefore) {
        results = this.filterByPublishYear(results, filters);
      }
      
      this.setData({
        searchResults: results,
        isSearching: false
      });
    } catch (err) {
      console.error('搜索失败：', err);
      this.setData({
        searchResults: [],
        isSearching: false
      });
      
      wx.showToast({
        title: '搜索失败',
        icon: 'none'
      });
    }
  },
  
  // 从数组中删除重复项
  removeDuplicates(array, key) {
    const seen = new Set();
    return array.filter(item => {
      const value = item[key];
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
  },
  
  // 应用内存中的筛选条件
  applyFilters(books, filters) {
    return books.filter(book => {
      // 分类筛选
      if (filters.categoryName && (!book.categories || !book.categories.includes(filters.categoryName))) {
        return false;
      }
      
      // 作者筛选
      if (filters.author && book.author !== filters.author) {
        return false;
      }
      
      // 出版社筛选
      if (filters.publisher && book.publisher !== filters.publisher) {
        return false;
      }
      
      // 借阅状态筛选
      if (filters.borrowStatus && book.borrowStatus !== filters.borrowStatus) {
        return false;
      }
      
      // 年份筛选
      if (filters.publishYear || filters.publishYearBefore) {
        return this.matchesPublishYearFilter(book, filters);
      }
      
      return true;
    });
  },
  
  // 筛选出版年份
  filterByPublishYear(books, filters) {
    return books.filter(book => this.matchesPublishYearFilter(book, filters));
  },
  
  // 检查是否匹配出版年份筛选
  matchesPublishYearFilter(book, filters) {
    if (!book.publishDate) return false;
    
    const year = parseInt(book.publishDate.split('-')[0]);
    if (isNaN(year)) return false;
    
    if (filters.publishYearBefore) {
      return year < filters.publishYearBefore;
    }
    
    if (filters.publishYear) {
      return year.toString() === filters.publishYear;
    }
    
    return true;
  },

  // 添加到搜索历史
  addToSearchHistory(keyword) {
    // 获取当前历史
    let history = this.data.searchHistory;
    
    // 如果已存在相同关键词，先移除
    history = history.filter(item => item !== keyword);
    
    // 添加到历史首位
    history.unshift(keyword);
    
    // 最多保存10条历史
    if (history.length > 10) {
      history = history.slice(0, 10);
    }
    
    // 更新状态和本地存储
    this.setData({
      searchHistory: history
    });
    wx.setStorageSync('searchHistory', history);
  },

  // 点击历史记录
  onHistoryItemTap(e) {
    const keyword = e.currentTarget.dataset.keyword;
    this.setData({ keyword });
    this.performSearch(keyword);
  },

  // 清空历史记录
  clearHistory() {
    this.setData({
      searchHistory: []
    });
    wx.setStorageSync('searchHistory', []);
  },

  // 打开筛选弹窗
  openFilterPopup() {
    this.setData({ showFilterPopup: true });
  },

  // 关闭筛选弹窗
  closeFilterPopup() {
    this.setData({ showFilterPopup: false });
  },

  // 选择分类
  onCategorySelect(e) {
    const category = e.currentTarget.dataset.value;
    this.setData({
      currentCategory: category
    });
  },

  // 选择作者
  onAuthorSelect(e) {
    const author = e.currentTarget.dataset.value;
    this.setData({
      currentAuthor: author
    });
  },
  
  // 选择出版社
  onPublisherSelect(e) {
    const publisher = e.currentTarget.dataset.value;
    this.setData({
      currentPublisher: publisher
    });
  },

  // 选择出版年份
  onPublishYearSelect(e) {
    const year = e.currentTarget.dataset.value;
    this.setData({
      currentPublishYear: year
    });
  },
  
  // 选择借阅状态
  onBorrowStatusSelect(e) {
    const status = e.currentTarget.dataset.value;
    this.setData({
      currentBorrowStatus: status
    });
  },

  // 应用筛选
  applyFilter() {
    this.setData({ showFilterPopup: false });
    if (this.data.keyword) {
      this.performSearch(this.data.keyword);
    } else {
      // 即使没有关键词，也可以按筛选条件搜索
      this.performSearch('');
    }
  },

  // 重置筛选
  resetFilter() {
    this.setData({
      currentCategory: '全部',
      currentPublishYear: '全部',
      currentAuthor: '全部',
      currentPublisher: '全部',
      currentBorrowStatus: '全部'
    });
  },

  // 跳转到书籍详情
  navigateToDetail(e) {
    const bookId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `../bookDetail/bookDetail?id=${bookId}`
    });
  }
}) 
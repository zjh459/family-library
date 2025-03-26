const app = getApp();
const bookUtils = require('../../utils/book');

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
      // 增加获取数据上限，确保获取所有图书
      const countResult = await db.collection('books').count();
      const total = countResult.total;
      
      // 分批获取数据
      const batchSize = 100;
      const batchTimes = Math.ceil(total / batchSize);
      const tasks = [];
      
      for (let i = 0; i < batchTimes; i++) {
        const promise = db.collection('books')
          .skip(i * batchSize)
          .limit(batchSize)
          .get();
        tasks.push(promise);
      }
      
      const results = await Promise.all(tasks);
      let books = [];
      results.forEach(res => {
        books = books.concat(res.data);
      });
      
      if (books.length > 0) {
        // 提取唯一的作者和出版社
        const authors = new Set(['全部']);
        const publishers = new Set(['全部']);
        
        // 处理每本书的作者和出版社
        books.forEach(book => {
          // 处理作者，支持多作者的情况
          if (book.author) {
            // 如果作者字段包含逗号、分号或其他分隔符，可能是多作者
            if (typeof book.author === 'string' && (book.author.includes(',') || book.author.includes('、') || book.author.includes(';'))) {
              // 分割多作者并单独添加
              const authorNames = book.author.split(/[,、;]/);
              authorNames.forEach(name => {
                const trimmedName = name.trim();
                if (trimmedName) authors.add(trimmedName);
              });
            } else {
              // 单作者情况，去除可能的空格
              authors.add(book.author.trim());
            }
          }
          
          if (book.publisher) publishers.add(book.publisher);
        });
        
        // 转换为数组并排序
        const authorsArray = Array.from(authors);
        const publishersArray = Array.from(publishers);
        
        // 将"全部"选项放到第一位
        authorsArray.sort((a, b) => {
          if (a === '全部') return -1;
          if (b === '全部') return 1;
          return a.localeCompare(b, 'zh');
        });
        
        publishersArray.sort((a, b) => {
          if (a === '全部') return -1;
          if (b === '全部') return 1;
          return a.localeCompare(b, 'zh');
        });
        
        this.setData({
          authors: authorsArray,
          publishers: publishersArray
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
  onSearch: function() {
    this.setData({
      isSearching: true,
      hasSearched: true
    });
    
    const db = wx.cloud.database();
    const _ = db.command;
    
    // 保存搜索历史（仅当关键词不为空时）
    if (this.data.keyword) {
      this.addToHistory(this.data.keyword);
    }
    
    let query = {};
    
    // 添加关键字搜索条件（书名、作者或ISBN）
    if (this.data.keyword) {
      query = db.command.or([
        {
          title: db.RegExp({
            regexp: this.data.keyword,
            options: 'i'
          })
        },
        {
          author: db.RegExp({
            regexp: this.data.keyword,
            options: 'i'
          })
        },
        {
          isbn: db.RegExp({
            regexp: this.data.keyword,
            options: 'i'
          })
        }
      ]);
    }
    
    // 添加筛选条件
    let filterConditions = {};
    
    if (this.data.currentCategory && this.data.currentCategory !== '全部') {
      filterConditions.categories = this.data.currentCategory;
    }
    
    if (this.data.currentAuthor && this.data.currentAuthor !== '全部') {
      // 使用正则表达式匹配作者，以支持多作者的情况
      filterConditions.author = db.RegExp({
        regexp: this.data.currentAuthor,
        options: 'i'
      });
    }
    
    if (this.data.currentPublisher && this.data.currentPublisher !== '全部') {
      filterConditions.publisher = this.data.currentPublisher;
    }
    
    if (this.data.currentPublishYear && this.data.currentPublishYear !== '全部') {
      filterConditions.publishDate = db.RegExp({
        regexp: this.data.currentPublishYear,
        options: 'i'
      });
    }
    
    if (this.data.currentBorrowStatus && this.data.currentBorrowStatus !== '全部') {
      const status = this.data.currentBorrowStatus === '在库' ? 'in' : 'out';
      filterConditions.borrowStatus = status;
    }
    
    // 构建最终查询条件
    let finalQuery = query;
    
    // 如果有筛选条件
    if (Object.keys(filterConditions).length > 0) {
      // 如果同时有关键字查询和筛选条件，使用AND组合
      if (this.data.keyword) {
        finalQuery = db.command.and([query, filterConditions]);
      } else {
        // 仅有筛选条件时直接使用
        finalQuery = filterConditions;
      }
    } else if (!this.data.keyword) {
      // 既没有关键词也没有筛选条件，则获取所有书籍
      finalQuery = {};
    }
    
    db.collection('books')
      .where(finalQuery)
      .get()
      .then(res => {
        // 处理封面URL
        const books = res.data.map(book => bookUtils.processCoverUrl(book));
        
        this.setData({
          searchResults: books,
          isSearching: false
        });
      })
      .catch(err => {
        console.error('搜索失败:', err);
        this.setData({
          isSearching: false,
          searchResults: []
        });
        wx.showToast({
          title: '搜索失败',
          icon: 'none'
        });
      });
  },

  // 添加到搜索历史
  addToHistory(keyword) {
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
    this.onSearch();
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
    this.closeFilterPopup();
    
    // 如果已经有搜索关键词，则执行搜索
    if (this.data.keyword) {
      this.onSearch();
    } else {
      // 如果没有关键词但选择了筛选条件，使用空搜索
      this.setData({ keyword: '' });
      this.onSearch();
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
const app = getApp();
const bookUtils = require('../../utils/book');
const api = require('../../utils/api');

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
      const result = await api.getCategoriesStatistics();
      
      if (result.data && result.data.length > 0) {
        // 提取分类名称并保留"全部"选项在首位
        const categoryNames = ['全部', ...result.data.map(item => item.category_name)];
        
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
      console.log('开始加载筛选数据');
      
      // 使用API获取所有图书
      const result = await api.getAllBooks();
      const books = result.data;
      
      if (books && books.length > 0) {
        console.log(`获取到 ${books.length} 本图书数据用于筛选`);
        
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
        
        console.log('筛选数据加载完成:', {
          authors: authorsArray.length,
          publishers: publishersArray.length
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
    if (!this.data.keyword && 
        this.data.currentCategory === '全部' && 
        this.data.currentAuthor === '全部' && 
        this.data.currentPublisher === '全部' && 
        this.data.currentPublishYear === '全部' && 
        this.data.currentBorrowStatus === '全部') {
      wx.showToast({
        title: '请输入搜索关键词或选择筛选条件',
        icon: 'none'
      });
      return;
    }
    
    this.setData({
      isSearching: true,
      hasSearched: true
    });
    
    // 保存搜索历史（仅当关键词不为空时）
    if (this.data.keyword) {
      this.addToHistory(this.data.keyword);
    }
    
    // 构建搜索参数
    const searchParams = {
      searchText: this.data.keyword || '',
      page: 1,
      pageSize: 100 // 使用较大的pageSize避免分页
    };
    
    // 添加筛选条件
    if (this.data.currentCategory && this.data.currentCategory !== '全部') {
      searchParams.category = this.data.currentCategory;
    }
    
    // 调用API搜索图书
    api.getBooks(searchParams)
      .then(result => {
        console.log('搜索结果:', result);
        let books = result.data;
        
        // 手动过滤结果（如API不支持的筛选条件）
        if (books && books.length > 0) {
          // 作者筛选
          if (this.data.currentAuthor && this.data.currentAuthor !== '全部') {
            books = books.filter(book => 
              book.author && book.author.indexOf(this.data.currentAuthor) !== -1
            );
          }
          
          // 出版社筛选
          if (this.data.currentPublisher && this.data.currentPublisher !== '全部') {
            books = books.filter(book => 
              book.publisher === this.data.currentPublisher
            );
          }
          
          // 出版年份筛选
          if (this.data.currentPublishYear && this.data.currentPublishYear !== '全部') {
            const year = this.data.currentPublishYear;
            books = books.filter(book => {
              if (!book.publishDate) return false;
              if (year === '更早') {
                // 处理"更早"的情况 - 2018年以前
                const bookYear = parseInt(book.publishDate.substring(0, 4), 10);
                return bookYear < 2018;
              } else {
                // 匹配具体年份
                return book.publishDate.indexOf(year) === 0;
              }
            });
          }
          
          // 借阅状态筛选
          if (this.data.currentBorrowStatus && this.data.currentBorrowStatus !== '全部') {
            const status = this.data.currentBorrowStatus === '在库' ? 'in' : 'out';
            books = books.filter(book => book.borrowStatus === status);
          }
          
          // 处理封面URL
          books = books.map(book => bookUtils.processCoverUrl(book));
        }
        
        this.setData({
          searchResults: books,
          isSearching: false
        });
      })
      .catch(err => {
        console.error('搜索失败：', err);
        this.setData({
          isSearching: false,
          searchResults: []
        });
        wx.showToast({
          title: '搜索失败，请重试',
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
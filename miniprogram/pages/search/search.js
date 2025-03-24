const app = getApp();

Page({
  data: {
    keyword: '',
    searchResults: [],
    isSearching: false,
    showFilterPopup: false,
    filters: {
      category: '',
      publishYear: ''
    },
    categories: ['全部', '小说', '经管', '科技', '文学', '其他'],
    publishYears: ['全部', '2023', '2022', '2021', '2020', '2019', '2018', '更早'],
    currentCategory: '全部',
    currentPublishYear: '全部',
    searchHistory: [],
    theme: {},
    hasSearched: false
  },

  onLoad() {
    this.setData({
      theme: app.globalData.theme,
      searchHistory: wx.getStorageSync('searchHistory') || []
    });
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
    if (this.data.currentCategory !== '全部') {
      filters.category = this.data.currentCategory;
    }
    
    // 处理年份筛选
    if (this.data.currentPublishYear !== '全部') {
      // 这里假设书籍的 publishDate 格式为 YYYY-MM-DD 或 YYYY-MM
      // 实际应用中可能需要更复杂的逻辑
      if (this.data.currentPublishYear === '更早') {
        // 找2018年之前的
        filters.publishYearBefore = 2018;
      } else {
        filters.publishYear = this.data.currentPublishYear;
      }
    }

    // 使用app全局搜索方法
    setTimeout(() => {
      let results = app.searchBooks(keyword, filters);
      
      // 如果有年份筛选，需要手动处理，因为app.searchBooks可能无法处理复杂的年份筛选
      if (filters.publishYearBefore) {
        results = results.filter(book => {
          const year = book.publishDate ? parseInt(book.publishDate.split('-')[0]) : 0;
          return year > 0 && year < 2018;
        });
      } else if (filters.publishYear) {
        results = results.filter(book => {
          const year = book.publishDate ? book.publishDate.split('-')[0] : '';
          return year === filters.publishYear;
        });
      }

      this.setData({
        searchResults: results,
        isSearching: false
      });
    }, 500);
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

  // 选择出版年份
  onPublishYearSelect(e) {
    const year = e.currentTarget.dataset.value;
    this.setData({
      currentPublishYear: year
    });
  },

  // 应用筛选
  applyFilter() {
    this.setData({ showFilterPopup: false });
    if (this.data.keyword) {
      this.performSearch(this.data.keyword);
    }
  },

  // 重置筛选
  resetFilter() {
    this.setData({
      currentCategory: '全部',
      currentPublishYear: '全部'
    });
  },

  // 跳转到书籍详情
  navigateToDetail(e) {
    const bookId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/bookDetail/bookDetail?id=${bookId}`
    });
  }
}) 
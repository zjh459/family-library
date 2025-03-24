const app = getApp();

Page({
  data: {
    books: [],
    activeTab: 0,
    sortType: 'time', // 排序方式：time-添加时间, name-书名, date-出版时间
    sortOptions: [
      { text: '按添加时间', value: 'time' },
      { text: '按书名', value: 'name' },
      { text: '按出版时间', value: 'date' }
    ],
    showSortPopup: false,
    categories: ['全部', '小说', '经管', '科技', '文学', '其他'],
    currentCategory: '全部',
    loading: true,
    theme: {}
  },

  onLoad() {
    this.setData({
      theme: app.globalData.theme
    });
    this.loadBooks();
  },

  onShow() {
    // 每次显示页面时重新加载数据
    this.loadBooks();
  },

  // 加载书籍数据
  loadBooks() {
    // 模拟加载过程
    this.setData({ loading: true });
    
    setTimeout(() => {
      const books = app.globalData.books || [];
      this.setData({ 
        books,
        loading: false
      });
      this.applySortAndFilter();
    }, 500);
  },

  // 应用排序和筛选
  applySortAndFilter() {
    let filteredBooks = [...this.data.books];
    
    // 按分类筛选
    if (this.data.currentCategory !== '全部') {
      filteredBooks = filteredBooks.filter(book => 
        book.category === this.data.currentCategory
      );
    }
    
    // 按借阅状态筛选
    if (this.data.activeTab === 1) { // 已借出
      filteredBooks = filteredBooks.filter(book => book.borrowStatus === 'out');
    } else if (this.data.activeTab === 0) { // 在库
      filteredBooks = filteredBooks.filter(book => book.borrowStatus === 'in');
    }
    
    // 排序
    filteredBooks.sort((a, b) => {
      switch (this.data.sortType) {
        case 'name':
          return (a.title || '').localeCompare(b.title || '');
        case 'date':
          return new Date(b.publishDate || 0) - new Date(a.publishDate || 0);
        case 'time':
        default:
          return (b.addTime || 0) - (a.addTime || 0);
      }
    });
    
    this.setData({ 
      displayBooks: filteredBooks 
    });
  },

  // 切换标签页
  onTabChange(e) {
    this.setData({
      activeTab: e.detail.index
    });
    this.applySortAndFilter();
  },

  // 打开排序弹窗
  openSortPopup() {
    this.setData({ showSortPopup: true });
  },

  // 关闭排序弹窗
  closeSortPopup() {
    this.setData({ showSortPopup: false });
  },

  // 选择排序方式
  onSortChange(e) {
    const sortType = e.currentTarget.dataset.value;
    this.setData({ 
      sortType,
      showSortPopup: false
    });
    this.applySortAndFilter();
  },

  // 切换分类
  onCategoryChange(e) {
    const category = e.currentTarget.dataset.category;
    this.setData({ currentCategory: category });
    this.applySortAndFilter();
  },

  // 跳转到书籍详情页
  navigateToDetail(e) {
    const bookId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/bookDetail/bookDetail?id=${bookId}`
    });
  },

  // 跳转到添加书籍页
  navigateToAdd() {
    wx.switchTab({
      url: '/pages/bookAdd/bookAdd'
    });
  },

  // 分享
  onShareAppMessage() {
    return {
      title: '我的家庭图书馆',
      path: '/pages/index/index'
    };
  }
}) 
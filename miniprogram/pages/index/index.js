const app = getApp();
const db = wx.cloud.database();
const _ = db.command;

Page({
  data: {
    books: [],
    searchValue: '',
    filteredBooks: [],
    theme: {},
    categories: [],           // 所有分类
    selectedCategory: 'all',  // 当前选中的分类，默认为全部
    loading: true
  },

  onLoad() {
    this.setData({
      theme: app.globalData.theme
    });
    this.loadBooks();
    this.initCategories();
  },

  onShow() {
    // 每次显示页面时重新加载数据，确保数据最新
    this.loadBooks();
    this.loadCategories();
  },

  // 加载图书数据
  loadBooks() {
    db.collection('books')
      .get()
      .then(res => {
        this.setData({
          books: res.data,
          filteredBooks: res.data,
          loading: false
        });
        
        // 如果有选中的分类，则应用分类筛选
        if (this.data.selectedCategory && this.data.selectedCategory !== 'all') {
          this.filterBooksByCategory(this.data.selectedCategory);
        }
        
        // 如果有搜索条件，则应用搜索筛选
        if (this.data.searchValue) {
          this.filterBooks(this.data.searchValue);
        }
      })
      .catch(err => {
        console.error('加载图书失败：', err);
        this.setData({ loading: false });
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

  // 分享
  onShareAppMessage() {
    return {
      title: '我的家庭图书馆',
      path: '/miniprogram/pages/index/index'
    };
  },

  // 加载分类
  async loadCategories() {
    try {
      const res = await db.collection('categories')
        .get();
      this.setData({
        categories: res.data
      });
    } catch (err) {
      console.error('加载分类失败：', err);
    }
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
      const { data } = await db.collection('categories').get();
      
      if (data && data.length > 0) {
        this.setData({ categories: data });
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
        db.collection('categories').add({
          data: {
            ...category,
            createTime: db.serverDate()
          }
        })
      );

      await Promise.all(tasks);
      
      // 重新获取分类列表
      const { data: newData } = await db.collection('categories').get();
      this.setData({ categories: newData });
    } catch (error) {
      console.error('初始化分类失败：', error);
      wx.showToast({
        title: '加载分类失败',
        icon: 'none'
      });
    }
  }
}) 
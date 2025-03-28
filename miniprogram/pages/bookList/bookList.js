const api = require('../../utils/api');
const app = getApp(); // 获取全局应用实例
const bookUtils = require('../../utils/book');

// 未分类的特殊标识
const UNCATEGORIZED_MARK = '__uncategorized__'

Page({
  data: {
    books: [],
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 50,
    searchText: '',
    total: 0,
    categories: [],
    selectedCategory: '',
    categoryTitle: '',
    theme: {},
    isUncategorized: false, // 是否是查询未分类图书
  },

  onLoad(options) {
    this.setData({
      theme: app.globalData.theme || { accentColor: '#8FBC8F' }
    })
    
    console.log('bookList 接收到的原始参数:', options)
    
    if (options.category) {
      const category = decodeURIComponent(options.category)
      console.log('解析后的分类参数:', category)
      
      // 检查是否是未分类的特殊标记
      if (category === UNCATEGORIZED_MARK) {
        this.setData({
          isUncategorized: true,
          selectedCategory: '' // 实际查询时不使用分类条件
        })
      } else {
        this.setData({
          selectedCategory: category
        })
        console.log('设置选中分类为:', category)
      }
    }
    
    if (options.title) {
      const title = decodeURIComponent(options.title)
      console.log('解析后的标题参数:', title)
      this.setData({
        categoryTitle: title
      })
      wx.setNavigationBarTitle({
        title: title || '图书列表'
      })
    } else {
      wx.setNavigationBarTitle({
        title: '图书列表'
      })
    }
    
    this.loadCategories()
    this.loadBooks()
  },

  onPullDownRefresh() {
    this.setData({
      books: [],
      page: 1,
      hasMore: true
    })
    this.loadBooks().then(() => {
      wx.stopPullDownRefresh()
    })
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMoreBooks()
    }
  },

  async loadBooks() {
    if (this.data.loading) return

    this.setData({ loading: true })
    try {
      // 使用分页API获取图书
      const params = {
        page: this.data.page,
        pageSize: this.data.pageSize,
        searchText: this.data.searchText || '',
        category: this.data.selectedCategory || ''
      };
      
      // 对未分类情况特殊处理
      if (this.data.isUncategorized) {
        params.uncategorized = true;
      }
      
      console.log('查询参数:', params);
      const result = await api.getBooks(params);
      console.log('API分页返回:', result);
      
      // 处理返回的数据
      const books = result.data.map(book => bookUtils.processCoverUrl(book));
      
      this.setData({
        books: books,
        total: result.total || books.length,
        hasMore: books.length >= this.data.pageSize,
        loading: false
      });
      
      // 将结果添加到全局books缓存中
      this.updateGlobalBooks(books);
    } catch (err) {
      console.error('加载图书失败：', err)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
      this.setData({ loading: false })
    }
  },

  async loadMoreBooks() {
    if (this.data.loading) return

    this.setData({ 
      loading: true,
      page: this.data.page + 1
    })

    try {
      // 使用分页API获取下一页图书
      const params = {
        page: this.data.page,
        pageSize: this.data.pageSize,
        searchText: this.data.searchText || '',
        category: this.data.selectedCategory || ''
      };
      
      // 对未分类情况特殊处理
      if (this.data.isUncategorized) {
        params.uncategorized = true;
      }
      
      console.log('加载更多 - 查询参数:', params);
      const result = await api.getBooks(params);
      
      // 处理返回的数据
      const newBooks = result.data.map(book => bookUtils.processCoverUrl(book));
      
      this.setData({
        books: [...this.data.books, ...newBooks],
        hasMore: newBooks.length >= this.data.pageSize,
        loading: false
      });
      
      // 将结果添加到全局books缓存中
      this.updateGlobalBooks(newBooks);
    } catch (err) {
      console.error('加载更多图书失败：', err)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
      this.setData({ loading: false })
    }
  },
  
  // 更新全局图书缓存
  updateGlobalBooks(books) {
    if (!books || books.length === 0) return;
    
    const app = getApp();
    if (!app.globalData.books) {
      app.globalData.books = [];
    }
    
    // 更新全局books，避免重复
    books.forEach(book => {
      const index = app.globalData.books.findIndex(b => b.id === book.id);
      if (index >= 0) {
        app.globalData.books[index] = book;
      } else {
        app.globalData.books.push(book);
      }
    });
    
    console.log('全局图书缓存更新，当前数量:', app.globalData.books.length);
  },

  getSearchQuery() {
    // 使用原生JSON结构构建查询
    let query = {}
    
    if (this.data.isUncategorized) {
      // 特殊处理未分类查询
      console.log('查询未分类图书')
      
      // 未分类图书的查询条件: 
      // 1. 没有categories数组 且 没有category字段
      // 2. 有categories数组但为空
      // 3. 有category字段但为空字符串
      query = {
        $or: [
          {
            // 没有任何分类信息
            categories: { $exists: false },
            category: { $exists: false }
          },
          {
            // categories数组为空
            categories: { $size: 0 }
          },
          {
            // category为空字符串
            category: ""
          }
        ]
      }
    } else if (this.data.selectedCategory) {
      // 记录分类查询的值
      const categoryValue = this.data.selectedCategory
      console.log('查询分类:', categoryValue)
      
      // 使用基本的数组包含查询
      query = {
        $or: [
          // 新数据结构: 使用categories数组
          { categories: categoryValue },
          // 旧数据结构: 使用category字段
          { category: categoryValue }
        ]
      }
    }
    
    // 添加搜索文本条件
    if (this.data.searchText) {
      const searchOptions = [
        {
          title: db.RegExp({
            regexp: this.data.searchText,
            options: 'i'
          })
        },
        {
          author: db.RegExp({
            regexp: this.data.searchText,
            options: 'i'
          })
        },
        {
          isbn: db.RegExp({
            regexp: this.data.searchText,
            options: 'i'
          })
        }
      ]
      
      // 如果已有分类查询，则添加AND条件
      if (Object.keys(query).length > 0) {
        query = {
          $and: [
            query,
            { $or: searchOptions }
          ]
        }
      } else {
        // 如果只有搜索条件
        query = { $or: searchOptions }
      }
    }
    
    console.log('最终查询条件:', JSON.stringify(query))
    return query
  },

  onSearchInput(e) {
    this.setData({
      searchText: e.detail.value
    })
  },

  onSearch() {
    this.setData({
      books: [],
      page: 1,
      hasMore: true
    })
    this.loadBooks()
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/miniprogram/pages/bookDetail/bookDetail?id=${id}`
    })
  },

  goToAdd() {
    wx.navigateTo({
      url: '/miniprogram/pages/bookAdd/bookAdd'
    })
  },

  async loadCategories() {
    try {
      const result = await api.getCategoriesStatistics()
      const categories = result.data.map(category => ({
        ...category,
        name: category.category_name,
        _id: category.category_id
      }));
      
      this.setData({
        categories: categories
      })
    } catch (err) {
      console.error('加载分类失败：', err)
    }
  },

  onCategoryChange(e) {
    this.setData({
      selectedCategory: e.detail.value,
      books: [],
      page: 1,
      hasMore: true
    })
    this.loadBooks()
  }
})
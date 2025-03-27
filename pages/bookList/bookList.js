const db = wx.cloud.database()
const _ = db.command
const app = getApp() // 获取全局应用实例

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
    
    if (options.category) {
      const category = decodeURIComponent(options.category)
      console.log('接收到的分类参数:', category)
      
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
      }
    }
    
    if (options.title) {
      const title = decodeURIComponent(options.title)
      console.log('接收到的标题参数:', title)
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

  // 获取不受限制的集合
  getCollection() {
    return db.collection('books');
  },

  async loadBooks() {
    if (this.data.loading) return

    this.setData({ loading: true })
    try {
      const query = this.getSearchQuery()
      console.log('查询条件:', JSON.stringify(query))
      console.log('当前选中分类:', this.data.selectedCategory)
      
      // 获取一次性查询最大数量的数据
      const res = await this.getCollection()
        .where(query)
        .limit(100)  // 一次性尝试获取更多数据
        .orderBy('createTime', 'desc')
        .get()

      console.log('查询结果数量:', res.data.length)
      
      // 打印每本书的分类信息
      res.data.forEach(book => {
        console.log(`书籍 [${book.title}] 的分类:`, book.categories || book.category || '无分类')
      })

      const total = await this.getCollection().where(query).count()
      console.log('总记录数:', total.total)
      
      this.setData({
        books: res.data,
        total: total.total,
        hasMore: res.data.length < total.total,
        loading: false
      })
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
      const query = this.getSearchQuery()
      const res = await db.collection('books')
        .where(query)
        .skip((this.data.page - 1) * this.data.pageSize)
        .limit(this.data.pageSize)
        .orderBy('createTime', 'desc')
        .get()

      this.setData({
        books: [...this.data.books, ...res.data],
        hasMore: res.data.length === this.data.pageSize,
        loading: false
      })
    } catch (err) {
      console.error('加载更多图书失败：', err)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
      this.setData({ loading: false })
    }
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
      const res = await db.collection('categories').get()
      this.setData({
        categories: res.data
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
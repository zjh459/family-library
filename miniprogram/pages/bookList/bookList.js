const db = wx.cloud.database()
const _ = db.command

Page({
  data: {
    books: [],
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 10,
    searchText: '',
    total: 0,
    categories: [],
    selectedCategory: ''
  },

  onLoad(options) {
    if (options.category) {
      this.setData({
        selectedCategory: options.category
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
      const query = this.getSearchQuery()
      const res = await db.collection('books')
        .where(query)
        .skip((this.data.page - 1) * this.data.pageSize)
        .limit(this.data.pageSize)
        .orderBy('createTime', 'desc')
        .get()

      const total = await db.collection('books').where(query).count()
      
      this.setData({
        books: res.data,
        total: total.total,
        hasMore: res.data.length === this.data.pageSize,
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
    const query = {}
    
    if (this.data.searchText) {
      query.$or = [
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
    }
    
    if (this.data.selectedCategory) {
      query.categories = this.data.selectedCategory
    }
    
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
      url: `/pages/bookDetail/bookDetail?id=${id}`
    })
  },

  goToAdd() {
    wx.navigateTo({
      url: '/pages/bookAdd/bookAdd'
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
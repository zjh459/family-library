const db = wx.cloud.database()
const _ = db.command

Page({
  data: {
    categories: [],
    newCategory: '',
    loading: false,
    editing: false,
    currentCategory: null
  },

  onLoad() {
    this.loadCategories()
  },

  onShow() {
    this.loadCategories()
  },

  async loadCategories() {
    this.setData({ loading: true })
    try {
      // 获取所有分类
      const categoriesRes = await db.collection('categories')
        .orderBy('createTime', 'desc')
        .get()
      
      // 获取所有图书
      const booksRes = await db.collection('books').get()
      const books = booksRes.data || []
      
      // 计算每个分类的图书数量
      const categories = categoriesRes.data.map(category => {
        const count = books.filter(book => {
          // 检查是否包含此分类
          if (book.categories && Array.isArray(book.categories)) {
            return book.categories.includes(category.name)
          } else if (book.category) {
            // 兼容旧数据结构
            return book.category === category.name
          }
          return false
        }).length
        
        return {
          ...category,
          count
        }
      })
      
      this.setData({
        categories,
        loading: false
      })
    } catch (err) {
      console.error('加载分类失败：', err)
      wx.showToast({
        title: '加载分类失败',
        icon: 'none'
      })
      this.setData({ loading: false })
    }
  },

  onInputChange(e) {
    this.setData({
      newCategory: e.detail.value
    })
  },

  async addCategory() {
    if (!this.data.newCategory.trim()) {
      wx.showToast({
        title: '分类名称不能为空',
        icon: 'none'
      })
      return
    }

    // 检查是否已存在同名分类
    const existCategory = this.data.categories.find(
      item => item.name === this.data.newCategory.trim()
    )
    if (existCategory) {
      wx.showToast({
        title: '该分类已存在',
        icon: 'none'
      })
      return
    }

    this.setData({ loading: true })
    try {
      await db.collection('categories').add({
        data: {
          name: this.data.newCategory.trim(),
          count: 0,
          createTime: db.serverDate()
        }
      })
      
      this.setData({
        newCategory: '',
        loading: false
      })
      
      wx.showToast({
        title: '添加成功'
      })
      
      this.loadCategories()
    } catch (err) {
      console.error('添加分类失败：', err)
      wx.showToast({
        title: '添加失败',
        icon: 'none'
      })
      this.setData({ loading: false })
    }
  },

  startEdit(e) {
    const { category } = e.currentTarget.dataset
    this.setData({
      editing: true,
      currentCategory: category,
      newCategory: category.name
    })
  },

  cancelEdit() {
    this.setData({
      editing: false,
      currentCategory: null,
      newCategory: ''
    })
  },

  async updateCategory() {
    if (!this.data.newCategory.trim()) {
      wx.showToast({
        title: '分类名称不能为空',
        icon: 'none'
      })
      return
    }

    // 检查是否已存在同名分类(排除当前编辑的分类)
    const existCategory = this.data.categories.find(
      item => item.name === this.data.newCategory.trim() && 
      item._id !== this.data.currentCategory._id
    )
    if (existCategory) {
      wx.showToast({
        title: '该分类已存在',
        icon: 'none'
      })
      return
    }

    this.setData({ loading: true })
    try {
      // 先更新分类表中的数据
      await db.collection('categories').doc(this.data.currentCategory._id).update({
        data: {
          name: this.data.newCategory.trim()
        }
      })
      
      // 更新使用该分类的图书
      const oldName = this.data.currentCategory.name
      const newName = this.data.newCategory.trim()
      
      // 获取所有包含该分类的图书
      const booksRes = await db.collection('books').where({
        categories: oldName
      }).get()
      
      // 逐个更新图书分类
      const tasks = booksRes.data.map(async book => {
        const categories = book.categories || []
        const updatedCategories = categories.map(cat => cat === oldName ? newName : cat)
        
        return db.collection('books').doc(book._id).update({
          data: {
            categories: updatedCategories
          }
        })
      })
      
      await Promise.all(tasks)
      
      this.setData({
        editing: false,
        currentCategory: null,
        newCategory: '',
        loading: false
      })
      
      wx.showToast({ title: '更新成功' })
      this.loadCategories()
    } catch (err) {
      console.error('更新分类失败：', err)
      wx.showToast({
        title: '更新失败',
        icon: 'none'
      })
      this.setData({ loading: false })
    }
  },

  async deleteCategory(e) {
    const { id, name } = e.currentTarget.dataset
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除"${name}"分类吗？该分类下的图书将会移除此分类标签。`,
      success: async (res) => {
        if (res.confirm) {
          this.setData({ loading: true })
          try {
            // 删除分类
            await db.collection('categories').doc(id).remove()
            
            // 更新使用该分类的图书
            const booksRes = await db.collection('books').where({
              categories: name
            }).get()
            
            // 逐个更新图书分类
            const tasks = booksRes.data.map(async book => {
              const categories = book.categories || []
              const updatedCategories = categories.filter(cat => cat !== name)
              
              return db.collection('books').doc(book._id).update({
                data: {
                  categories: updatedCategories
                }
              })
            })
            
            await Promise.all(tasks)
            
            wx.showToast({ title: '删除成功' })
            this.loadCategories()
          } catch (err) {
            console.error('删除分类失败：', err)
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            })
            this.setData({ loading: false })
          }
        }
      }
    })
  }
}) 
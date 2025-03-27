// 未分类的特殊ID和名称
const UNCATEGORIZED_ID = 'uncategorized'
const UNCATEGORIZED_NAME = '未分类'

const Database = require('../../utils/database')
const app = getApp()

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

  // 同步所有分类计数
  syncAllCategories() {
    wx.showLoading({
      title: '同步中...'
    })
    
    // 调用app.js中的同步分类计数方法
    app.syncCategoriesCount()
      .then(() => {
        wx.hideLoading()
        wx.showToast({
          title: '同步成功'
        })
        // 重新加载分类列表以显示更新后的计数
        this.loadCategories()
      })
      .catch(err => {
        console.error('同步分类计数失败:', err)
        wx.hideLoading()
        wx.showToast({
          title: '同步失败',
          icon: 'none'
        })
      })
  },

  async loadCategories() {
    this.setData({ loading: true })
    try {
      // 获取所有分类
      const categories = await Database.getCategories();
      
      // 添加未分类到分类列表最前面
      // 获取未分类图书数量 - 可以考虑使用数据库中的值，或计算真实值
      const uncategorizedCount = await this.getUncategorizedCount();
      
      categories.unshift({
        _id: UNCATEGORIZED_ID,
        name: UNCATEGORIZED_NAME,
        count: uncategorizedCount,
        isSystem: true // 标记为系统分类，不可编辑删除
      });
      
      this.setData({
        categories,
        loading: false
      });
    } catch (err) {
      console.error('加载分类失败：', err);
      wx.showToast({
        title: '加载分类失败',
        icon: 'none'
      });
      this.setData({ loading: false });
    }
  },
  
  // 获取未分类的图书数量
  async getUncategorizedCount() {
    try {
      if (app.globalData.useApi) {
        // 使用API模式，从服务器获取未分类图书数量
        // 简单获取10本未分类图书来确认是否有未分类图书
        const books = await Database.getBooks({ category: 'uncategorized', limit: 10 });
        return books.length > 0 ? books[0].totalCount || books.length : 0;
      } else {
        // 使用云数据库模式
        const db = wx.cloud.database();
        const _ = db.command;
        
        // 查询没有categories字段或categories为空数组的图书
        const res = await db.collection('books').where({
          categories: _.eq([])
        }).count();
        
        const res2 = await db.collection('books').where({
          categories: _.eq(null)
        }).count();
        
        const res3 = await db.collection('books').where({
          categories: _.eq(undefined)
        }).count();
        
        // 查询既没有categories也没有category的图书
        const res4 = await db.collection('books').where({
          categories: _.exists(false),
          category: _.exists(false)
        }).count();
        
        const total = res.total + res2.total + res3.total + res4.total;
        console.log(`未分类图书数量: ${total} (空数组:${res.total}, null:${res2.total}, undefined:${res3.total}, 不存在:${res4.total})`);
        
        return total;
      }
    } catch (err) {
      console.error('获取未分类图书数量失败:', err);
      return 0;
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

    // 检查是否是保留的系统分类名
    if (this.data.newCategory.trim() === UNCATEGORIZED_NAME) {
      wx.showToast({
        title: '不能使用系统保留名称',
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
    
    // 检查是否是系统分类，不允许编辑
    if (category.isSystem) {
      wx.showToast({
        title: '系统分类不可编辑',
        icon: 'none'
      })
      return
    }
    
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

    // 检查是否是保留的系统分类名
    if (this.data.newCategory.trim() === UNCATEGORIZED_NAME) {
      wx.showToast({
        title: '不能使用系统保留名称',
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
    
    // 检查是否是系统分类，不允许删除
    const category = this.data.categories.find(cat => cat._id === id)
    if (category && category.isSystem) {
      wx.showToast({
        title: '系统分类不可删除',
        icon: 'none'
      })
      return
    }
    
    // 检查分类下是否有书籍
    if (category && category.count > 0) {
      wx.showModal({
        title: '确认删除',
        content: `该分类下有${category.count}本图书，删除分类将会清空这些图书的分类信息。确定要删除吗？`,
        success: async (res) => {
          if (res.confirm) {
            this.performCategoryDeletion(id, name);
          }
        }
      })
    } else {
      wx.showModal({
        title: '确认删除',
        content: `确定要删除"${name}"分类吗？`,
        success: async (res) => {
          if (res.confirm) {
            this.performCategoryDeletion(id, name);
          }
        }
      })
    }
  },
  
  // 执行分类删除的实际逻辑
  async performCategoryDeletion(id, name) {
    this.setData({ loading: true })
    try {
      // 1. 首先清空使用该分类的图书分类信息
      const booksRes = await db.collection('books').where({
        categories: name
      }).get()
      
      if (booksRes.data && booksRes.data.length > 0) {
        console.log(`发现${booksRes.data.length}本使用该分类的图书，正在清空分类...`)
        
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
        console.log('所有图书分类信息已清空')
      }
      
      // 2. 然后删除分类本身
      await db.collection('categories').doc(id).remove()
      
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
  },

  // 查看分类下的图书
  viewCategoryBooks(e) {
    const { category } = e.currentTarget.dataset
    console.log('点击查看分类:', category)
    
    if (category.count > 0) {
      // 使用encodeURIComponent确保参数正确传递
      let categoryName, title
      
      if (category._id === UNCATEGORIZED_ID) {
        // 特殊处理未分类
        categoryName = encodeURIComponent('__uncategorized__')
        title = encodeURIComponent('未分类图书')
      } else {
        categoryName = encodeURIComponent(category.name)
        title = encodeURIComponent(category.name + '分类')
      }
      
      console.log('跳转参数-分类名:', categoryName)
      console.log('跳转参数-标题:', title)
      
      wx.navigateTo({
        url: `/pages/bookList/bookList?category=${categoryName}&title=${title}`
      })
    } else {
      wx.showToast({
        title: '暂无图书',
        icon: 'none'
      })
    }
  }
}) 
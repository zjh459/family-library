// 未分类的特殊ID和名称
const UNCATEGORIZED_ID = 'uncategorized'
const UNCATEGORIZED_NAME = '未分类'

const api = require('../../utils/api');

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
  async syncAllCategories() {
    wx.showLoading({
      title: '同步中...'
    })
    
    try {
      await api.getCategoriesStatistics()
      wx.hideLoading()
      wx.showToast({
        title: '同步成功'
      })
      // 重新加载分类列表以显示更新后的计数
      this.loadCategories()
    } catch (err) {
      console.error('同步分类计数失败:', err)
      wx.hideLoading()
      wx.showToast({
        title: '同步失败',
        icon: 'none'
      })
    }
  },

  async loadCategories() {
    this.setData({ loading: true })
    try {
      // 获取所有分类统计
      const result = await api.getCategoriesStatistics()
      const categories = result.data;
      
      // 添加未分类到分类列表最前面
      categories.unshift({
        id: UNCATEGORIZED_ID,
        category_name: UNCATEGORIZED_NAME,
        book_count: 0,
        isSystem: true // 标记为系统分类，不可编辑删除
      });
      
      // 处理返回的数据，确保字段名称一致
      const processedCategories = categories.map(category => ({
        ...category,
        name: category.category_name, // 添加name字段
        count: category.book_count || 0, // 保持与模板中使用的字段名一致
        _id: category.category_id || category.id || UNCATEGORIZED_ID
      }));
      
      this.setData({
        categories: processedCategories,
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
      // 使用API添加分类
      await api.addCategory({
        name: this.data.newCategory.trim(),
        icon: 'default',
        color: '#000000'
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
      await api.updateCategory(this.data.currentCategory.id, {
        name: this.data.newCategory.trim(),
        icon: this.data.currentCategory.icon || 'default',
        color: this.data.currentCategory.color || '#000000'
      })
      
      this.setData({
        editing: false,
        currentCategory: null,
        newCategory: '',
        loading: false
      })
      
      wx.showToast({
        title: '更新成功'
      })
      
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
    const { category } = e.currentTarget.dataset
    
    // 检查是否是系统分类，不允许删除
    if (category.isSystem) {
      wx.showToast({
        title: '系统分类不可删除',
        icon: 'none'
      })
      return
    }
    
    // 检查分类下是否有图书
    if (category.book_count > 0) {
      wx.showToast({
        title: '该分类下还有图书，不能删除',
        icon: 'none'
      })
      return
    }

    const res = await wx.showModal({
      title: '确认删除',
      content: `确定要删除分类"${category.name}"吗？`
    })
    
    if (res.confirm) {
      await this.performCategoryDeletion(category.id, category.name)
    }
  },
  
  // 执行分类删除的实际逻辑
  async performCategoryDeletion(id, name) {
    this.setData({ loading: true })
    try {
      // 使用API删除分类
      await api.deleteCategory(id)
      
      wx.showToast({ title: '删除成功' })
      this.loadCategories()
      this.setData({ loading: false })
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
      try {
        // 使用encodeURIComponent确保参数正确传递
        let categoryName, title
        
        if (category._id === UNCATEGORIZED_ID) {
          // 特殊处理未分类
          categoryName = encodeURIComponent('__uncategorized__')
          title = encodeURIComponent('未分类图书')
        } else {
          // 使用category_name作为分类名称
          categoryName = encodeURIComponent(category.category_name || category.name)
          title = encodeURIComponent((category.category_name || category.name) + '分类')
        }
        
        console.log('跳转参数-分类名:', categoryName)
        console.log('跳转参数-标题:', title)
        
        // 使用完整路径并确保参数格式正确
        const url = `/miniprogram/pages/bookList/bookList?category=${categoryName}&title=${title}`
        console.log('跳转URL:', url)
        
        wx.navigateTo({
          url: url,
          fail: function(err) {
            console.error('页面跳转失败:', err)
            wx.showToast({
              title: '页面跳转失败',
              icon: 'none'
            })
          }
        })
      } catch (err) {
        console.error('构建跳转参数失败:', err)
        wx.showToast({
          title: '参数处理错误',
          icon: 'none'
        })
      }
    } else {
      wx.showToast({
        title: '暂无图书',
        icon: 'none'
      })
    }
  }
})
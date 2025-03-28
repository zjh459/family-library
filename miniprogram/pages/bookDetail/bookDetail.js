const app = getApp();
const bookUtils = require('../../utils/book');
const api = require('../../utils/api');

Page({
  data: {
    bookId: '',
    book: null,
    showBorrowPopup: false,
    borrower: '',
    showReturnPopup: false,
    showDeleteConfirm: false,
    theme: {},
    isEditMode: false,
    editForm: {},
    categories: [],
    showCategoryPicker: false,
    currentCategory: '',
    showCategoryModal: false,
    allCategories: [],
    selectedCategories: [],
    categoriesWithSelection: [],
    originalSelectedCategories: [],
    newCategoryName: '',
    showAddCategoryInput: false,
    loading: true
  },

  onLoad(options) {
    console.log('bookDetail页面onLoad被调用，参数:', options);
    
    if (options.id) {
      console.log('接收到书籍ID:', options.id);
      this.setData({
        bookId: options.id,
        theme: app.globalData.theme
      });
      this.loadBookDetail();
    } else {
      console.error('未接收到有效的图书ID');
      wx.showToast({
        title: '无效的图书ID',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  // 加载书籍详情
  async loadBookDetail() {
    console.log('开始加载书籍详情，ID:', this.data.bookId);
    
    this.setData({ loading: true });
    
    try {
      // 检查是否为旧的云数据库ID格式（通常为长字符串）
      let bookId = this.data.bookId;
      
      // 检查是否有对应的ID映射
      try {
        const idMapping = wx.getStorageSync('id_mapping') || {};
        if (idMapping[bookId]) {
          console.log('找到映射的ID:', idMapping[bookId], '原ID:', bookId);
          bookId = idMapping[bookId];
        } else if (bookId.length > 20) {
          // 可能是云ID但没找到映射，尝试通过遍历全局books查找
          const app = getApp();
          const book = app.globalData.books.find(b => b.cloud_id === bookId);
          if (book) {
            console.log('通过全局查找到映射ID:', book.id, '原ID:', bookId);
            bookId = book.id;
          } else {
            console.warn('无法找到旧ID的映射，尝试直接使用该ID');
          }
        }
      } catch (e) {
        console.error('获取ID映射失败:', e);
      }
      
      // 使用API获取图书详情（使用可能已映射的ID）
      const result = await api.getBook(bookId);
      console.log('API返回的书籍详情:', result);
      
      if (!result.success || !result.data) {
        this.showBookNotFound();
        return;
      }
      
      // 处理书籍信息，确保所有字段都有正确的值
      const book = bookUtils.processCoverUrl(result.data);
      console.log('处理后的书籍信息:', book);
      
      // 手动检查确保关键字段的一致性
      this.ensureBookFields(book);
      
      // 确保ID字段的兼容性
      if (book) {
        // 保存原始云ID
        if (this.data.bookId.length > 20 && this.data.bookId !== book.id) {
          book._cloud_id = this.data.bookId;
        }
        
        // 确保_id字段存在
        if (!book._id && book.id) {
          book._id = book.id;
        }
        
        // 确保id字段存在
        if (!book.id && book._id) {
          book.id = book._id;
        }
      }
      
      this.setData({
        book: book,
        editForm: { ...book },
        currentCategory: book.category_name || book.category || '',
        loading: false
      });
      
      // 加载分类列表
      this.loadCategories();
    } catch (err) {
      console.error('获取图书详情失败', err);
      this.setData({ loading: false });
      
      // 如果是404错误，说明书籍不存在
      if (err.statusCode === 404) {
        console.warn('书籍不存在，可能已被删除');
        this.showBookNotFound();
        return;
      }
      
      wx.showToast({
        title: '获取图书详情失败',
        icon: 'none'
      });
    }
  },
  
  // 确保书籍所有重要字段都有默认值
  ensureBookFields(book) {
    if (!book) return;
    
    // 确保字段不是undefined或空字符串
    const ensureField = (field, defaultValue = null) => {
      if (book[field] === undefined || book[field] === '') {
        book[field] = defaultValue;
      }
    };
    
    // 确保所有可能显示为"未知"的字段至少有默认值
    ensureField('publishDate');
    ensureField('pages');
    ensureField('price');
    ensureField('binding');
    ensureField('edition');
    ensureField('format');
    ensureField('description', '暂无简介');
    
    // MySQL中返回的数字0有时需要显示为未知
    if (book.price === 0) book.price = null;
    if (book.pages === 0) book.pages = null;
    
    // 确保categories是数组
    if (!Array.isArray(book.categories)) {
      book.categories = book.category ? [book.category] : [];
    }
    
    return book;
  },
  
  // 显示书籍不存在提示
  showBookNotFound() {
    wx.showToast({
      title: '书籍不存在',
      icon: 'none'
    });
    setTimeout(() => {
      wx.navigateBack();
    }, 1500);
  },

  // 打开借出弹窗
  openBorrowPopup() {
    this.setData({ showBorrowPopup: true });
  },

  // 关闭借出弹窗
  closeBorrowPopup() {
    this.setData({ 
      showBorrowPopup: false,
      borrower: '' 
    });
  },

  // 借出人输入变化
  onBorrowerInput(e) {
    this.setData({
      borrower: e.detail
    });
  },

  // 确认借出
  async confirmBorrow() {
    if (!this.data.borrower.trim()) {
      wx.showToast({
        title: '请输入借阅人姓名',
        icon: 'none'
      });
      return;
    }

    const now = new Date();
    const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const updateInfo = {
      borrowStatus: 'out',
      borrow_status: 'out',
      borrower: this.data.borrower,
      borrowDate: dateStr
    };

    // 更新借阅历史
    const borrowHistory = this.data.book.borrowHistory || [];
    borrowHistory.push({
      borrower: this.data.borrower,
      borrowDate: dateStr,
      returnDate: null
    });
    updateInfo.borrowHistory = borrowHistory;

    wx.showLoading({
      title: '处理中...'
    });

    try {
      // 使用API更新图书借阅状态
      const result = await api.updateBook(this.data.bookId, updateInfo);
      
      if (result.success) {
        console.log('借阅状态更新成功');
        
        this.setData({
          showBorrowPopup: false,
          borrower: ''
        });
        
        // 重新加载图书详情
        this.loadBookDetail();
        
        wx.hideLoading();
        wx.showToast({
          title: '借出成功',
          icon: 'success'
        });
      } else {
        throw new Error(result.message || '借出失败');
      }
    } catch (err) {
      console.error('借出图书失败:', err);
      
      wx.hideLoading();
      wx.showToast({
        title: '借出失败: ' + (err.message || '未知错误'),
        icon: 'none'
      });
    }
  },

  // 打开归还弹窗
  openReturnPopup() {
    this.setData({ showReturnPopup: true });
  },

  // 关闭归还弹窗
  closeReturnPopup() {
    this.setData({ showReturnPopup: false });
  },

  // 确认归还
  async confirmReturn() {
    const returnDate = new Date().toISOString().split('T')[0];
    
    // 更新借阅历史
    const borrowHistory = this.data.book.borrowHistory || [];
    if (borrowHistory.length > 0) {
      const lastRecord = borrowHistory[borrowHistory.length - 1];
      if (!lastRecord.returnDate) {
        lastRecord.returnDate = returnDate;
      }
    }
    
    const updateInfo = {
      borrowStatus: 'in',
      borrow_status: 'in',
      borrower: '',
      borrowDate: '',
      borrowHistory: borrowHistory
    };

    wx.showLoading({
      title: '处理中...'
    });

    try {
      // 使用API更新图书归还状态
      const result = await api.updateBook(this.data.bookId, updateInfo);
      
      if (result.success) {
        console.log('归还状态更新成功');
        
        this.setData({
          showReturnPopup: false
        });
        
        // 重新加载图书详情
        this.loadBookDetail();
        
        wx.hideLoading();
        wx.showToast({
          title: '归还成功',
          icon: 'success'
        });
      } else {
        throw new Error(result.message || '归还失败');
      }
    } catch (err) {
      console.error('归还图书失败:', err);
      
      wx.hideLoading();
      wx.showToast({
        title: '归还失败: ' + (err.message || '未知错误'),
        icon: 'none'
      });
    }
  },

  // 打开删除确认弹窗
  openDeleteConfirm() {
    this.setData({ showDeleteConfirm: true });
  },

  // 关闭删除确认弹窗
  closeDeleteConfirm() {
    this.setData({ showDeleteConfirm: false });
  },

  // 确认删除图书
  async confirmDelete() {
    wx.showLoading({
      title: '删除中...'
    });
    
    try {
      // 使用API删除图书
      const result = await api.deleteBook(this.data.bookId);
      
      if (result.success) {
        console.log('图书删除成功');
        
        wx.hideLoading();
        wx.showToast({
          title: '删除成功',
          icon: 'success'
        });
        
        // 返回上一页
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      } else {
        throw new Error(result.message || '删除失败');
      }
    } catch (err) {
      console.error('删除图书失败:', err);
      
      wx.hideLoading();
      wx.showToast({
        title: '删除失败: ' + (err.message || '未知错误'),
        icon: 'none'
      });
      
      this.setData({
        showDeleteConfirm: false
      });
    }
  },

  // 切换编辑模式
  toggleEditMode() {
    const isEditMode = !this.data.isEditMode;
    this.setData({ 
      isEditMode,
      editForm: isEditMode ? { ...this.data.book } : {},
      currentCategory: isEditMode ? this.data.book.category || '' : ''
    });
  },

  // 表单输入处理
  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail || '';  // 确保value不会是undefined
    
    console.log('表单输入变化:', field, value);  // 添加日志以便调试
    
    this.setData({
      [`editForm.${field}`]: value
    });
  },

  // 打开分类选择器
  openCategoryPicker() {
    this.setData({ showCategoryPicker: true });
  },

  // 关闭分类选择器
  closeCategoryPicker() {
    this.setData({ showCategoryPicker: false });
  },

  // 选择分类
  onCategorySelected(e) {
    const category = e.currentTarget.dataset.value;
    this.setData({
      currentCategory: category,
      'editForm.category': category,
      showCategoryPicker: false
    });
  },

  // 上传封面
  uploadCover() {
    // 提供用户选择：本地图片或输入网络图片URL
    wx.showActionSheet({
      itemList: ['从相册选择', '拍照', '输入图片网址'],
      success: (res) => {
        if (res.tapIndex === 0 || res.tapIndex === 1) {
          // 选择本地图片或拍照
          wx.chooseImage({
            count: 1,
            sizeType: ['compressed'],
            sourceType: res.tapIndex === 0 ? ['album'] : ['camera'],
            success: (res) => {
              const tempFilePath = res.tempFilePaths[0];
              
              // 直接使用临时路径作为封面
              this.setData({
                'editForm.coverUrl': tempFilePath,
                'editForm.coverSource': 'local' // 标记为本地图片
              });
              
              wx.showToast({
                title: '图片已选择',
                icon: 'success'
              });
            }
          });
        } else if (res.tapIndex === 2) {
          // 输入网络图片URL
          this.showInputImageUrlDialog();
        }
      }
    });
  },
  
  // 显示输入图片URL的对话框
  showInputImageUrlDialog() {
    wx.showModal({
      title: '输入图片URL',
      editable: true,
      placeholderText: 'https://example.com/image.jpg',
      success: (res) => {
        if (res.confirm && res.content) {
          const imageUrl = res.content.trim();
          
          // 验证URL格式
          if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
            this.setData({
              'editForm.coverUrl': imageUrl,
              'editForm.coverSource': 'network' // 标记为网络图片
            });
            
            wx.showToast({
              title: 'URL已设置',
              icon: 'success'
            });
          } else {
            wx.showToast({
              title: '请输入有效的URL',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 保存编辑内容
  async saveEdit() {
    if (!this.data.editForm.title) {
      wx.showToast({
        title: '书名不能为空',
        icon: 'none'
      });
      return;
    }

    const updateData = { ...this.data.editForm };
    
    // 确保数据格式正确
    if (updateData.publishDate) {
      updateData.publishDate = updateData.publishDate.trim();
    }
    
    // 设置封面URL来源标识
    if (updateData.coverUrl && updateData.coverUrl.startsWith('http')) {
      updateData.coverSource = 'network';
    }
    
    // 确保分类处理正确
    if (this.data.currentCategory) {
      updateData.category = this.data.currentCategory;
      // 确保categories数组存在并包含当前分类
      if (!updateData.categories) {
        updateData.categories = [this.data.currentCategory];
      } else if (!updateData.categories.includes(this.data.currentCategory)) {
        updateData.categories.push(this.data.currentCategory);
      }
    }
    
    wx.showLoading({
      title: '保存中...'
    });
    
    try {
      // 使用API更新图书信息
      const result = await api.updateBook(this.data.bookId, updateData);
      
      if (result.success) {
        console.log('图书更新成功');
        
        this.setData({
          isEditMode: false,
          book: {
            ...this.data.book,
            ...updateData
          }
        });
        
        // 重新加载图书详情以确保数据一致
        this.loadBookDetail();
        
        wx.hideLoading();
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
      } else {
        throw new Error(result.message || '更新失败');
      }
    } catch (err) {
      console.error('更新图书失败:', err);
      
      wx.hideLoading();
      wx.showToast({
        title: '保存失败: ' + (err.message || '未知错误'),
        icon: 'none'
      });
    }
  },

  // 取消编辑
  cancelEdit() {
    this.setData({ isEditMode: false });
  },

  // 分享
  onShareAppMessage() {
    return {
      title: `我的藏书：${this.data.book?.title || '稻米小屋'}`,
      path: `/miniprogram/pages/bookDetail/bookDetail?id=${this.data.bookId}`
    };
  },

  // 编辑图书
  editBook() {
    // 创建编辑表单，确保所有字段都有值
    const editForm = { ...this.data.book };
    
    // 确保关键字段不会是undefined
    const requiredFields = ['title', 'author', 'publisher', 'isbn', 'description'];
    requiredFields.forEach(field => {
      if (editForm[field] === undefined) {
        editForm[field] = '';
      }
    });
    
    console.log('初始化编辑表单:', editForm);
    
    this.setData({
      isEditMode: true,
      editForm: editForm
    });
  },

  // 管理分类
  manageCategories: function() {
    // 确保已加载分类
    if (!this.data.categoriesWithSelection || this.data.categoriesWithSelection.length === 0) {
      this.loadCategories();
    }
    
    // 保存原始选中状态，以便取消时恢复
    const originalCategoriesWithSelection = this.data.categoriesWithSelection.map(item => ({ ...item }));
    
    this.setData({
      showCategoryModal: true,
      originalCategoriesWithSelection: originalCategoriesWithSelection
    });
  },
  
  // 关闭分类管理弹窗
  closeCategoryModal() {
    this.setData({ showCategoryModal: false });
  },
  
  // 切换分类选中状态
  toggleCategory(e) {
    const index = e.currentTarget.dataset.index;
    const categoriesWithSelection = [...this.data.categoriesWithSelection];
    
    // 切换选中状态
    categoriesWithSelection[index].selected = !categoriesWithSelection[index].selected;
    
    console.log('切换分类:', categoriesWithSelection[index].name, '选中状态:', categoriesWithSelection[index].selected);
    
    this.setData({ categoriesWithSelection });
  },

  // 显示添加分类的输入框
  showAddCategoryInput() {
    this.setData({
      showAddCategoryInput: true
    });
  },

  // 处理新分类名称输入
  onNewCategoryInput(e) {
    this.setData({
      newCategoryName: e.detail.value
    });
  },

  // 添加新分类
  addNewCategory() {
    const newName = this.data.newCategoryName.trim();
    
    // 验证输入
    if (!newName) {
      wx.showToast({
        title: '分类名称不能为空',
        icon: 'none'
      });
      return;
    }

    // 检查是否已存在同名分类
    const exists = this.data.categoriesWithSelection.some(category => 
      category.name === newName
    );
    
    if (exists) {
      wx.showToast({
        title: '该分类已存在',
        icon: 'none'
      });
      return;
    }

    // 添加分类
    wx.showLoading({
      title: '添加中...',
    });
    
    api.addCategory({
      name: newName,
      icon: 'default',
      color: '#' + Math.floor(Math.random()*16777215).toString(16) // 随机颜色
    })
    .then(result => {
      wx.hideLoading();
      
      // 添加新分类到本地列表并自动选中
      const newCategory = {
        _id: result.data.id,
        name: newName,
        selected: true
      };
      
      const categoriesWithSelection = [...this.data.categoriesWithSelection, newCategory];
      
      this.setData({
        categoriesWithSelection,
        newCategoryName: '',
        showAddCategoryInput: false
      });
      
      wx.showToast({
        title: '添加成功',
        icon: 'success'
      });
    })
    .catch(err => {
      console.error('添加分类失败', err);
      wx.hideLoading();
      wx.showToast({
        title: '添加失败',
        icon: 'none'
      });
    });
  },

  // 取消添加新分类
  cancelAddCategory() {
    this.setData({
      newCategoryName: '',
      showAddCategoryInput: false
    });
  },
  
  // 保存分类
  async saveCategories() {
    // 收集选中的分类名称
    const selectedCategories = this.data.categoriesWithSelection
      .filter(category => category.selected)
      .map(category => category.name);
    
    console.log('保存的分类:', selectedCategories);
    
    wx.showLoading({
      title: '保存中...'
    });
    
    const updateInfo = {
      categories: selectedCategories,
      // 使用第一个选中的分类作为主分类，如果没有选中分类则使用"其他"
      category: selectedCategories.length > 0 ? selectedCategories[0] : '其他'
    };
    
    try {
      // 使用API更新图书分类
      const result = await api.updateBook(this.data.bookId, updateInfo);
      
      if (result.success) {
        console.log('分类更新成功');
        
        this.closeCategoryModal();
        
        // 重新加载图书详情，确保数据一致
        this.loadBookDetail();
        
        wx.hideLoading();
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
      } else {
        throw new Error(result.message || '保存分类失败');
      }
    } catch (err) {
      console.error('保存分类失败:', err);
      
      wx.hideLoading();
      wx.showToast({
        title: '保存失败: ' + (err.message || '未知错误'),
        icon: 'none'
      });
    }
  },

  // 加载分类列表
  async loadCategories() {
    try {
      const result = await api.getCategoriesStatistics();
      console.log('获取到分类列表:', result.data);
      
      // 将书籍的分类与所有分类进行匹配，设置选中状态
      const allCategories = result.data.map(category => ({
        _id: category.category_id,
        name: category.category_name
      }));
      
      const bookCategories = this.data.book.categories || [];
      console.log('当前书籍分类:', bookCategories);
      
      const categoriesWithSelection = allCategories.map(category => {
        const isSelected = bookCategories.includes(category.name);
        console.log('分类:', category.name, '是否选中:', isSelected);
        
        return {
          _id: category._id,
          name: category.name,
          selected: isSelected
        };
      });
      
      console.log('处理后的分类列表:', categoriesWithSelection);
      
      this.setData({
        allCategories: allCategories,
        categoriesWithSelection: categoriesWithSelection
      });
    } catch (err) {
      console.error('加载分类失败:', err);
      wx.showToast({
        title: '加载分类失败',
        icon: 'none'
      });
    }
  },
}) 
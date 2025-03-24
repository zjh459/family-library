const app = getApp();

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
    categories: ['小说', '经管', '科技', '文学', '其他'],
    showCategoryPicker: false,
    currentCategory: ''
  },

  onLoad(options) {
    if (options.id) {
      this.setData({
        bookId: options.id,
        theme: app.globalData.theme
      });
      this.loadBookDetail();
    } else {
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
  loadBookDetail() {
    const book = app.getBook(this.data.bookId);
    if (book) {
      this.setData({ 
        book,
        editForm: { ...book },
        currentCategory: book.category || ''
      });
    } else {
      wx.showToast({
        title: '书籍不存在',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
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
  confirmBorrow() {
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
      borrower: this.data.borrower,
      borrowDate: dateStr
    };

    if (app.updateBook(this.data.bookId, updateInfo)) {
      this.setData({
        showBorrowPopup: false,
        borrower: ''
      });
      this.loadBookDetail();
      wx.showToast({
        title: '借出成功',
        icon: 'success'
      });
    } else {
      wx.showToast({
        title: '操作失败',
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
  confirmReturn() {
    const updateInfo = {
      borrowStatus: 'in',
      borrower: '',
      borrowDate: '',
      returnDate: new Date().toISOString().split('T')[0]
    };

    if (app.updateBook(this.data.bookId, updateInfo)) {
      this.setData({ showReturnPopup: false });
      this.loadBookDetail();
      wx.showToast({
        title: '归还成功',
        icon: 'success'
      });
    } else {
      wx.showToast({
        title: '操作失败',
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

  // 确认删除
  confirmDelete() {
    if (app.deleteBook(this.data.bookId)) {
      this.setData({ showDeleteConfirm: false });
      wx.showToast({
        title: '删除成功',
        icon: 'success'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } else {
      wx.showToast({
        title: '删除失败',
        icon: 'none'
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
    const { value } = e.detail;
    
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
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        this.setData({
          'editForm.coverUrl': tempFilePath
        });
      }
    });
  },

  // 保存编辑
  saveEdit() {
    // 验证必填项
    if (!this.data.editForm.title) {
      wx.showToast({
        title: '请输入书名',
        icon: 'none'
      });
      return;
    }

    if (app.updateBook(this.data.bookId, this.data.editForm)) {
      this.setData({ isEditMode: false });
      this.loadBookDetail();
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });
    } else {
      wx.showToast({
        title: '保存失败',
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
    const book = this.data.book;
    return {
      title: `推荐好书：${book?.title || '家庭图书馆'}`,
      path: `/pages/bookDetail/bookDetail?id=${this.data.bookId}`
    };
  }
}) 
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
    currentCategory: '',
    showCategoryModal: false,
    allCategories: [],
    selectedCategories: [],
    categoriesWithSelection: [],
    originalSelectedCategories: [],
    newCategoryName: '',
    showAddCategoryInput: false
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
      // 如果本地没有，尝试从云数据库获取
      if (wx.cloud) {
        wx.showLoading({
          title: '加载中...',
        });
        
        wx.cloud.database().collection('books').doc(this.data.bookId).get({
          success: res => {
            wx.hideLoading();
            if (res.data) {
              const bookData = {
                ...res.data,
                id: res.data._id
              };
              
              // 添加到本地缓存
              app.addBook(bookData);
              
              this.setData({ 
                book: bookData,
                editForm: { ...bookData },
                currentCategory: bookData.category || ''
              });
            } else {
              this.showBookNotFound();
            }
          },
          fail: err => {
            console.error('获取图书详情失败', err);
            wx.hideLoading();
            this.showBookNotFound();
          }
        });
      } else {
        this.showBookNotFound();
      }
    }
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

    // 更新借阅历史
    const borrowHistory = this.data.book.borrowHistory || [];
    borrowHistory.push({
      borrower: this.data.borrower,
      borrowDate: dateStr,
      returnDate: null
    });
    updateInfo.borrowHistory = borrowHistory;

    wx.showLoading({
      title: '处理中...',
    });

    // 更新云数据库
    if (wx.cloud && !this.data.bookId.startsWith('book_')) {
      // 排除系统字段，避免Invalid Key Name错误
      const { _openid, _id, ...cloudSafeData } = updateInfo;
      
      wx.cloud.database().collection('books').doc(this.data.bookId).update({
        data: cloudSafeData,
        success: () => {
          this.updateLocalAndRefresh(updateInfo);
        },
        fail: err => {
          console.error('更新借阅信息失败', err);
          wx.hideLoading();
          wx.showToast({
            title: '操作失败: ' + (err.errMsg || '未知错误'),
            icon: 'none'
          });
        }
      });
    } else {
      // 仅本地更新
      this.updateLocalAndRefresh(updateInfo);
    }
  },

  // 更新本地数据并刷新
  updateLocalAndRefresh(updateInfo) {
    if (app.updateBook(this.data.bookId, updateInfo)) {
      this.setData({
        showBorrowPopup: false,
        borrower: ''
      });
      this.loadBookDetail();
      wx.hideLoading();
      wx.showToast({
        title: '借出成功',
        icon: 'success'
      });
    } else {
      wx.hideLoading();
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
      borrower: '',
      borrowDate: '',
      returnDate: returnDate,
      borrowHistory: borrowHistory
    };

    wx.showLoading({
      title: '处理中...',
    });

    // 更新云数据库
    if (wx.cloud && !this.data.bookId.startsWith('book_')) {
      // 排除系统字段，避免Invalid Key Name错误
      const { _openid, _id, ...cloudSafeData } = updateInfo;
      
      wx.cloud.database().collection('books').doc(this.data.bookId).update({
        data: cloudSafeData,
        success: () => {
          this.updateReturnAndRefresh(updateInfo);
        },
        fail: err => {
          console.error('更新归还信息失败', err);
          wx.hideLoading();
          wx.showToast({
            title: '操作失败: ' + (err.errMsg || '未知错误'),
            icon: 'none'
          });
        }
      });
    } else {
      // 仅本地更新
      this.updateReturnAndRefresh(updateInfo);
    }
  },

  // 更新本地归还数据并刷新
  updateReturnAndRefresh(updateInfo) {
    if (app.updateBook(this.data.bookId, updateInfo)) {
      this.setData({ showReturnPopup: false });
      this.loadBookDetail();
      wx.hideLoading();
      wx.showToast({
        title: '归还成功',
        icon: 'success'
      });
    } else {
      wx.hideLoading();
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
    wx.showLoading({
      title: '删除中...',
    });
    
    if (app.deleteBook(this.data.bookId)) {
      this.setData({ showDeleteConfirm: false });
      wx.hideLoading();
      wx.showToast({
        title: '删除成功',
        icon: 'success'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } else {
      wx.hideLoading();
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
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const tempFilePath = res.tempFilePaths[0];
        
        wx.showLoading({
          title: '上传中...',
        });
        
        // 上传到云存储
        if (wx.cloud) {
          const cloudPath = `book-covers/${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;
          wx.cloud.uploadFile({
            cloudPath: cloudPath,
            filePath: tempFilePath,
            success: res => {
              // 获取图片的云存储链接
              const fileID = res.fileID;
              this.setData({
                'editForm.coverUrl': fileID
              });
              wx.hideLoading();
              wx.showToast({
                title: '上传成功',
                icon: 'success'
              });
            },
            fail: err => {
              console.error('上传失败', err);
              wx.hideLoading();
              wx.showToast({
                title: '上传失败',
                icon: 'none'
              });
              // 上传失败也要设置本地临时文件
              this.setData({
                'editForm.coverUrl': tempFilePath
              });
            }
          });
        } else {
          // 如果云开发不可用，使用本地临时路径
          this.setData({
            'editForm.coverUrl': tempFilePath
          });
          wx.hideLoading();
        }
      }
    });
  },

  // 保存编辑
  saveEdit() {
    console.log('保存编辑表单:', this.data.editForm); // 添加调试日志
    
    // 验证必填项
    if (!this.data.editForm.title || this.data.editForm.title === '') {
      wx.showToast({
        title: '请输入书名',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '保存中...',
    });

    // 如果是云数据库的记录，则同步更新到云端
    if (wx.cloud && !this.data.bookId.startsWith('book_')) {
      // 准备更新数据，排除_id、id和_openid字段
      const { id, _id, _openid, ...updateData } = this.data.editForm;
      
      // 确保所有字段有有效值
      Object.keys(updateData).forEach(key => {
        if (updateData[key] === undefined) {
          updateData[key] = '';
        }
      });
      
      console.log('准备更新到云数据库:', updateData); // 添加调试日志
      
      wx.cloud.database().collection('books').doc(this.data.bookId).update({
        data: updateData,
        success: () => {
          this.updateEditAndRefresh();
        },
        fail: err => {
          console.error('更新图书信息失败', err);
          wx.hideLoading();
          wx.showToast({
            title: '保存失败: ' + (err.errMsg || '未知错误'),
            icon: 'none'
          });
        }
      });
    } else {
      // 仅本地更新
      this.updateEditAndRefresh();
    }
  },

  // 更新编辑信息并刷新
  updateEditAndRefresh() {
    // 排除系统字段后再更新
    const { _openid, ...updateData } = this.data.editForm;
    
    // 确保所有字段都有有效值
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) {
        updateData[key] = '';
      }
    });
    
    console.log('本地更新数据:', updateData);
    
    if (app.updateBook(this.data.bookId, updateData)) {
      this.setData({ isEditMode: false });
      this.loadBookDetail();
      wx.hideLoading();
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });
    } else {
      wx.hideLoading();
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

  // 删除图书
  deleteBook() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这本书吗？此操作不可恢复。',
      success: (res) => {
        if (res.confirm) {
          const success = app.deleteBook(this.data.book.id);
          if (success) {
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
        }
      }
    });
  },

  // 打开分类管理弹窗
  manageCategories() {
    // 初始化已选分类
    let selectedCategoryNames = [];
    
    // 如果book.categories是数组，直接使用
    if (this.data.book.categories && Array.isArray(this.data.book.categories)) {
      selectedCategoryNames = [...this.data.book.categories];
    } 
    // 如果book.category是字符串，转为数组
    else if (this.data.book.category) {
      selectedCategoryNames = [this.data.book.category];
    }
    
    console.log('初始选中分类名称:', selectedCategoryNames);
    
    // 从云数据库获取分类
    wx.showLoading({
      title: '加载分类...',
    });
    
    if (wx.cloud) {
      wx.cloud.database().collection('categories').get({
        success: res => {
          wx.hideLoading();
          
          // 加载分类后，为每个分类添加选中状态标记
          const rawCategories = res.data || [];
          const categoriesWithSelection = rawCategories.map(category => ({
            ...category,
            selected: selectedCategoryNames.indexOf(category.name) !== -1
          }));
          
          console.log('带选中状态的分类:', categoriesWithSelection);
          
          this.setData({ 
            showCategoryModal: true,
            categoriesWithSelection: categoriesWithSelection,
            originalSelectedCategories: [...selectedCategoryNames], // 保存原始选中，便于取消操作
            newCategoryName: '', // 清空新分类名称
            showAddCategoryInput: false // 初始不显示添加分类输入框
          });
        },
        fail: err => {
          console.error('获取分类失败', err);
          wx.hideLoading();
          wx.showToast({
            title: '获取分类失败',
            icon: 'none'
          });
        }
      });
    } else {
      wx.hideLoading();
      wx.showToast({
        title: '云开发未启用',
        icon: 'none'
      });
    }
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

    // 添加分类到云数据库
    wx.showLoading({
      title: '添加中...',
    });
    
    if (wx.cloud) {
      wx.cloud.database().collection('categories').add({
        data: {
          name: newName,
          count: 0,
          createTime: wx.cloud.database().serverDate()
        },
        success: res => {
          wx.hideLoading();
          
          // 添加新分类到本地列表并自动选中
          const newCategory = {
            _id: res._id,
            name: newName,
            count: 0,
            createTime: new Date(),
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
        },
        fail: err => {
          console.error('添加分类失败', err);
          wx.hideLoading();
          wx.showToast({
            title: '添加失败',
            icon: 'none'
          });
        }
      });
    } else {
      wx.hideLoading();
      wx.showToast({
        title: '云开发未启用',
        icon: 'none'
      });
    }
  },

  // 取消添加新分类
  cancelAddCategory() {
    this.setData({
      newCategoryName: '',
      showAddCategoryInput: false
    });
  },
  
  // 保存分类变更
  saveCategories() {
    // 获取当前选中的分类名称数组
    const selectedCategories = this.data.categoriesWithSelection
      .filter(category => category.selected)
      .map(category => category.name);
    
    console.log('保存的分类:', selectedCategories);
    
    wx.showLoading({
      title: '保存中...',
    });
    
    const updateInfo = {
      categories: selectedCategories
    };
    
    // 更新云数据库
    if (wx.cloud && !this.data.bookId.startsWith('book_')) {
      wx.cloud.database().collection('books').doc(this.data.bookId).update({
        data: updateInfo,
        success: () => {
          // 更新本地数据
          const success = app.updateBook(this.data.bookId, updateInfo);
          if (success) {
            this.closeCategoryModal();
            this.loadBookDetail(); // 重新加载图书详情，确保数据一致
            wx.hideLoading();
            wx.showToast({
              title: '保存成功',
              icon: 'success'
            });
          } else {
            wx.hideLoading();
            wx.showToast({
              title: '本地保存失败',
              icon: 'none'
            });
          }
        },
        fail: err => {
          console.error('保存分类失败', err);
          wx.hideLoading();
          wx.showToast({
            title: '保存失败：' + (err.errMsg || '未知错误'),
            icon: 'none'
          });
        }
      });
    } else {
      // 仅本地更新
      const success = app.updateBook(this.data.bookId, updateInfo);
      if (success) {
        this.closeCategoryModal();
        this.loadBookDetail(); // 重新加载以确保数据一致
        wx.hideLoading();
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
      } else {
        wx.hideLoading();
        wx.showToast({
          title: '保存失败',
          icon: 'none'
        });
      }
    }
  },
}) 
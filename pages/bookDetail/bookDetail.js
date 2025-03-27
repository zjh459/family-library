const app = getApp();
const bookUtils = require('../../utils/book');

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
  loadBookDetail() {
    const that = this;
    const db = wx.cloud.database();
    
    console.log('开始加载书籍详情，ID:', this.data.bookId);
    
    this.setData({ loading: true });
    
    db.collection('books')
      .doc(this.data.bookId)
      .get()
      .then(res => {
        console.log('获取到书籍详情:', res.data);
        
        // 处理封面URL
        const book = bookUtils.processCoverUrl(res.data);
        
        console.log('处理后的书籍信息:', book);
        
        // 确保书籍ID在本地和云端是一致的
        if (book && book._id) {
          // 检查书籍是否存在于全局数据中
          const globalBookIndex = app.globalData.books.findIndex(b => 
            (b._id && b._id.toString() === book._id.toString()) || 
            (b.id && b.id.toString() === book._id.toString())
          );
          
          // 如果不在全局数据中，添加到全局
          if (globalBookIndex === -1) {
            console.log('书籍存在于云端但不在本地缓存中，添加到全局数据');
            book.id = book._id; // 确保id和_id一致
            app.globalData.books.unshift(book);
            app.saveBooks();
          }
        }
        
        that.setData({
          book: book,
          editForm: { ...book },
          currentCategory: book.category || '',
          loading: false
        });
        
        // 加载分类列表
        that.loadCategories();
      })
      .catch(err => {
        console.error('获取图书详情失败', err);
        that.setData({ loading: false });
        
        // 检查是否是因为书籍不存在
        if (err.errCode === -1 || err.errMsg.includes('not exist') || err.errMsg.includes('not found')) {
          console.warn('书籍在云数据库中不存在，可能已被删除');
          this.showBookNotFound();
          return;
        }
        
        wx.showToast({
          title: '获取图书详情失败',
          icon: 'none'
        });
      });
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
          wx.showLoading({
            title: '删除中...',
          });
          
          try {
            console.log('开始删除图书, ID:', this.data.bookId);
            const result = app.deleteBook(this.data.bookId);
            
            // 处理可能的Promise返回值
            if (result instanceof Promise) {
              result.then(success => {
                wx.hideLoading();
                console.log('删除结果:', success);
                
                // 确保分类计数更新
                const app = getApp();
                if (app.syncCategoriesCount) {
                  console.log('开始同步分类计数');
                  app.syncCategoriesCount().then(() => {
                    console.log('分类计数同步完成');
                  }).catch(err => {
                    console.error('分类计数同步失败:', err);
                  });
                }
                
                wx.showToast({
                  title: '删除成功',
                  icon: 'success'
                });
                
                setTimeout(() => {
                  wx.navigateBack();
                }, 1500);
              }).catch(err => {
                wx.hideLoading();
                console.error('删除图书时出错:', err);
                
                wx.showToast({
                  title: '删除失败',
                  icon: 'none'
                });
              });
            } else {
              // 同步返回结果的处理
              wx.hideLoading();
              if (result) {
                // 确保分类计数更新
                const app = getApp();
                if (app.syncCategoriesCount) {
                  console.log('开始同步分类计数');
                  app.syncCategoriesCount().then(() => {
                    console.log('分类计数同步完成');
                  }).catch(err => {
                    console.error('分类计数同步失败:', err);
                  });
                }
                
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
          } catch (err) {
            wx.hideLoading();
            console.error('删除图书时发生异常:', err);
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            });
          }
        }
      }
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
      categories: selectedCategories,
      // 使用第一个选中的分类作为主分类，如果没有选中分类则使用"其他"
      category: selectedCategories.length > 0 ? selectedCategories[0] : '其他'
    };
    
    // 更新云数据库
    if (wx.cloud && !this.data.bookId.startsWith('book_')) {
      wx.cloud.database().collection('books').doc(this.data.bookId).update({
        data: updateInfo,
        success: () => {
          console.log('云数据库分类更新成功');
          // 更新本地数据
          app.updateBook(this.data.bookId, updateInfo);
          
          // 分类变更后，更新所有分类的计数
          this.updateCategoriesCount(this.data.book.categories || [], selectedCategories);
          
          this.closeCategoryModal();
          this.loadBookDetail(); // 重新加载图书详情，确保数据一致
          wx.hideLoading();
          wx.showToast({
            title: '保存成功',
            icon: 'success'
          });
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
      app.updateBook(this.data.bookId, updateInfo);
      
      // 分类变更后，更新所有分类的计数
      this.updateCategoriesCount(this.data.book.categories || [], selectedCategories);
      
      this.closeCategoryModal();
      this.loadBookDetail(); // 重新加载以确保数据一致
      wx.hideLoading();
      wx.showToast({
        title: '保存成功',
        icon: 'success'
      });
    }
  },
  
  // 更新分类计数
  updateCategoriesCount(oldCategories, newCategories) {
    console.log('更新分类计数，原分类:', oldCategories, '新分类:', newCategories);
    
    const db = wx.cloud.database();
    const allCategories = [...new Set([...oldCategories, ...newCategories])];
    
    // 对每个受影响的分类进行处理
    allCategories.forEach(categoryName => {
      // 检查分类是否在旧的列表中但不在新的列表中，则减1
      const wasInOld = oldCategories.includes(categoryName);
      const isInNew = newCategories.includes(categoryName);
      
      console.log(`处理分类[${categoryName}], 原列表中:${wasInOld}, 新列表中:${isInNew}`);
      
      // 查询该分类相关的所有图书
      db.collection('books')
        .where({
          categories: categoryName
        })
        .count()
        .then(res => {
          // 获取该分类的实际图书数量
          const actualCount = res.total;
          console.log(`分类[${categoryName}]的实际图书数量:`, actualCount);
          
          // 查询该分类下具体包含哪些图书(用于调试)
          db.collection('books')
            .where({
              categories: categoryName
            })
            .field({
              _id: true,
              title: true,
              categories: true
            })
            .get()
            .then(booksRes => {
              console.log(`分类[${categoryName}]包含以下图书:`, 
                booksRes.data.map(b => b.title));
            });
          
          // 更新数据库中的计数
          db.collection('categories')
            .where({
              name: categoryName
            })
            .get()
            .then(catRes => {
              if (catRes.data && catRes.data.length > 0) {
                const categoryId = catRes.data[0]._id;
                const currentCount = catRes.data[0].count || 0;
                
                console.log(`分类[${categoryName}]当前计数为:${currentCount}, 更新为:${actualCount}`);
                
                // 强制更新为实际计算的数量
                db.collection('categories').doc(categoryId).update({
                  data: {
                    count: actualCount
                  }
                }).then(() => {
                  console.log(`分类[${categoryName}]计数已更新为:`, actualCount);
                }).catch(err => {
                  console.error(`更新分类[${categoryName}]计数失败:`, err);
                  
                  // 如果更新失败，尝试使用set完全覆盖文档
                  const fullCategory = {...catRes.data[0], count: actualCount};
                  db.collection('categories').doc(categoryId).set({
                    data: fullCategory
                  }).then(() => {
                    console.log(`使用set方法更新分类[${categoryName}]计数成功`);
                  }).catch(setErr => {
                    console.error(`使用set方法更新分类[${categoryName}]计数失败:`, setErr);
                  });
                });
              }
            })
            .catch(err => {
              console.error(`查询分类[${categoryName}]失败:`, err);
            });
        })
        .catch(err => {
          console.error(`获取分类[${categoryName}]的图书数量失败:`, err);
        });
    });
  },

  // 加载分类列表
  loadCategories: function() {
    console.log('开始加载分类列表');
    
    const db = wx.cloud.database();
    db.collection('categories')
      .get()
      .then(res => {
        console.log('获取到分类列表:', res.data);
        
        // 将书籍的分类与所有分类进行匹配，设置选中状态
        const allCategories = res.data;
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
      })
      .catch(err => {
        console.error('加载分类失败:', err);
        wx.showToast({
          title: '加载分类失败',
          icon: 'none'
        });
      });
  },
}) 
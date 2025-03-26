const app = getApp();
const config = require('../.././../config');
const bookUtils = require('../../utils/book');

Page({
  data: {
    activeTab: 0,
    isbnValue: '',
    isbnLoading: false,
    bookForm: {
      title: '',
      author: '',
      publisher: '',
      publishDate: '',
      isbn: '',
      category: '',
      coverUrl: '',
      description: '',
      pages: '',
      price: '',
      binding: '',
      edition: '',
      format: ''
    },
    categories: [],           // 所有分类
    selectedCategories: [],   // 已选分类
    categoriesWithSelection: [], // 带选中状态的分类
    showCategoryPickerModal: false,
    theme: {},
    showAddCategoryModal: false,
    newCategoryName: '',
    coverSource: 'network', // 标记封面来源
    bookInfo: null,
    loading: false,
    showError: false,
    errorMsg: '',
    currentCategory: null,
    isSaving: false,          // 是否正在保存中，防止重复提交
    lastSubmitTime: 0         // 上次提交时间，用于防抖
  },

  onLoad: function(options) {
    // 设置主题
    this.setData({
      theme: app.globalData.theme
    });
    
    // 加载分类
    this.loadCategories();
    
    // 如果有传入ISBN参数，自动获取图书信息
    if (options.isbn) {
      this.setData({ 'bookForm.isbn': options.isbn });
      this.fetchBookInfoByISBN(options.isbn);
    }
  },

  // 页面卸载时重置状态
  onUnload: function() {
    this.setData({
      isSaving: false,
      lastSubmitTime: 0
    });
  },
  
  // 页面隐藏时重置状态
  onHide: function() {
    this.setData({
      isSaving: false
    });
  },

  // 加载图书数据（编辑模式）
  async loadBookData(bookId) {
    try {
      wx.showLoading({ title: '加载中...' });
      const db = wx.cloud.database();
      const res = await db.collection('books').doc(bookId).get();
      
      if (res.data) {
        this.setData({
          bookForm: { ...res.data }
        });
        
        // 加载图书分类
        if (res.data.categories && res.data.categories.length > 0) {
          this.loadBookCategories(bookId);
        }
      }
      wx.hideLoading();
    } catch (err) {
      console.error('加载图书数据失败：', err);
      wx.hideLoading();
      wx.showToast({
        title: '加载图书失败',
        icon: 'none'
      });
    }
  },

  // 切换标签页
  onTabChange(e) {
    this.setData({
      activeTab: e.detail.index
    });
  },

  // ISBN输入变化
  onIsbnInput(e) {
    this.setData({
      isbnValue: e.detail
    });
    
    // 如果输入的ISBN码长度符合标准，可以自动查询
    if (e.detail && (e.detail.length === 10 || e.detail.length === 13)) {
      // 如果想要自动查询，取消下面这行的注释
      // this.searchByIsbn();
    }
  },

  // 扫码
  scanCode() {
    wx.scanCode({
      scanType: ['barCode'],
      success: (res) => {
        if (res.result) {
          this.setData({
            isbnValue: res.result
          });
          // 扫码后自动查询
          this.searchByIsbn();
        }
      },
      fail: () => {
        wx.showToast({
          title: '扫码失败',
          icon: 'none'
        });
      }
    });
  },

  // 通过ISBN查询
  searchByIsbn() {
    if (!this.data.isbnValue) {
      wx.showToast({
        title: '请输入ISBN',
        icon: 'none'
      });
      return;
    }

    this.setData({ isbnLoading: true });

    // 调用探书API获取图书信息
    wx.request({
      url: config.api.tanshu.url,
      data: {
        key: config.api.tanshu.key, // 从配置文件读取API密钥
        isbn: this.data.isbnValue
      },
      success: (res) => {
        console.log('探书API返回数据:', res.data);
        
        if (res.data && res.data.status === 0) {
          // API正常返回但未找到图书，尝试使用备用方法
          this.searchByIsbnFallback();
          return;
        }
        
        // 处理API返回的JSON包含多层嵌套的情况
        let data = res.data;
        
        // 如果有data字段，使用其中的数据
        if (res.data && res.data.data) {
          data = res.data.data;
        }
        
        if (data && data.title) {
          // 构建图书对象，补充缺失的字段
          const bookData = {
            title: data.title || '',
            author: data.author || '',
            publisher: data.publisher || '',
            publishDate: data.pubdate || '',
            isbn: data.isbn || this.data.isbnValue,
            category: this.matchCategory(data.title),
            coverUrl: data.img || '',
            description: data.summary || '',
            pages: data.pages || '',
            price: data.price || '',
            binding: data.binding || '',
            edition: data.edition || '',
            format: data.format || ''
          };
          
          console.log('处理后的图书数据:', bookData);
          
          this.setData({
            bookForm: bookData,
            isbnLoading: false,
            activeTab: 1, // 自动切换到表单页
            currentCategory: this.matchCategory(data.title)
          });

          wx.showToast({
            title: '查询成功',
            icon: 'success'
          });
        } else {
          console.error('API返回数据格式异常:', data);
          this.searchByIsbnFallback();
        }
      },
      fail: (err) => {
        console.error('探书API请求失败:', err);
        this.searchByIsbnFallback();
      }
    });
  },
  
  // 备用ISBN查询方法
  searchByIsbnFallback() {
    console.log('尝试备用查询方法');
    
    // 由于第三方API可能有使用限制，直接提示用户手动输入
    this.setData({ isbnLoading: false });
    wx.showModal({
      title: '提示',
      content: '未能通过ISBN找到图书信息，您可以手动填写图书信息或尝试其他ISBN码',
      showCancel: false,
      success: () => {
        this.setData({
          activeTab: 1,
          'bookForm.isbn': this.data.isbnValue
        });
      }
    });
    
    /* 备用API方案，如有需要可以取消注释
    wx.request({
      url: `https://douban-api.uieee.com/v2/book/isbn/${this.data.isbnValue}`,
      header: {
        'content-type': 'json'
      },
      success: (res) => {
        console.log('备用API返回:', res.data);
        if (res.data && res.data.title) {
          const data = res.data;
          // 格式化作者信息
          let author = '';
          if (data.author && data.author.length > 0) {
            author = data.author.join(', ');
          }
          
          this.setData({
            bookForm: {
              title: data.title || '',
              author: author,
              publisher: data.publisher || '',
              publishDate: data.pubdate || '',
              isbn: this.data.isbnValue,
              category: this.matchCategory(data.title),
              coverUrl: (data.images && data.images.large) || '',
              description: data.summary || '',
              pages: (data.pages && data.pages.toString()) || '',
              price: data.price || '',
              binding: data.binding || '',
              edition: '',
              format: ''
            },
            isbnLoading: false,
            activeTab: 1,
            currentCategory: this.matchCategory(data.title)
          });
          
          wx.showToast({
            title: '查询成功',
            icon: 'success'
          });
        } else {
          // 所有API都失败了，允许用户手动输入
          this.setData({ isbnLoading: false });
          wx.showToast({
            title: '未找到图书信息，请手动填写',
            icon: 'none',
            duration: 2000
          });
          
          // 自动切换到手动输入标签页
          setTimeout(() => {
            this.setData({
              activeTab: 1,
              'bookForm.isbn': this.data.isbnValue
            });
          }, 2000);
        }
      },
      fail: (err) => {
        console.error('备用API请求失败:', err);
        this.setData({ isbnLoading: false });
        wx.showToast({
          title: '未找到图书信息，请手动填写',
          icon: 'none',
          duration: 2000
        });
        
        // 自动切换到手动输入标签页
        setTimeout(() => {
          this.setData({
            activeTab: 1,
            'bookForm.isbn': this.data.isbnValue
          });
        }, 2000);
      }
    });
    */
  },

  // 根据书名匹配分类（简单实现）
  matchCategory(title) {
    const categories = this.data.categories;
    for (let category of categories) {
      if (title && title.includes(category)) {
        return category;
      }
    }
    return '其他'; // 默认分类
  },

  // 表单输入处理
  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    const value = e.detail || '';
    
    this.setData({
      [`bookForm.${field}`]: value
    });
    
    console.log('表单字段更新:', field, '值:', value);
  },

  // 加载所有分类
  async loadCategories() {
    try {
      const db = wx.cloud.database()
      const res = await db.collection('categories').get()
      
      // 为每个分类添加选中状态
      const categoriesWithSelection = res.data.map(category => ({
        ...category,
        selected: false
      }));
      
      this.setData({
        categories: res.data,
        categoriesWithSelection: categoriesWithSelection
      })
      console.log('加载分类成功，分类数量:', res.data.length);
      console.log('当前已选分类:', this.data.selectedCategories);
    } catch (err) {
      console.error('加载分类失败：', err)
    }
  },
  
  // 加载图书分类（编辑模式）
  async loadBookCategories(bookId) {
    try {
      const db = wx.cloud.database()
      const book = await db.collection('books').doc(bookId).get()
      
      if (book.data && book.data.categories) {
        // 根据分类名称找到对应的ID
        const categoryIds = []
        book.data.categories.forEach(categoryName => {
          const category = this.data.categories.find(c => c.name === categoryName)
          if (category) {
            categoryIds.push(category._id)
          }
        })
        
        // 更新选中状态
        const categoriesWithSelection = this.data.categoriesWithSelection.map(category => {
          return {
            ...category,
            selected: book.data.categories.includes(category.name)
          };
        });
        
        this.setData({
          selectedCategories: categoryIds,
          categoriesWithSelection
        })
      }
    } catch (err) {
      console.error('加载图书分类失败：', err)
    }
  },
  
  // 显示分类选择器
  showCategoryPicker() {
    this.setData({
      showCategoryPickerModal: true
    })
  },
  
  // 隐藏分类选择器
  hideCategoryPicker() {
    this.setData({
      showCategoryPickerModal: false
    })
  },
  
  // 选择/取消选择分类
  toggleCategory(e) {
    const categoryId = e.currentTarget.dataset.id;
    if (!categoryId) {
      console.error('获取分类ID失败:', e.currentTarget.dataset);
      return; // 确保id存在
    }
    
    console.log('toggleCategory被调用，分类ID:', categoryId);
    console.log('选择前selectedCategories:', JSON.stringify(this.data.selectedCategories));
    
    const index = this.data.selectedCategories.indexOf(categoryId);
    const newSelectedCategories = [...this.data.selectedCategories];
    
    if (index === -1) {
      // 添加分类
      newSelectedCategories.push(categoryId);
      console.log('添加分类:', categoryId);
    } else {
      // 移除分类
      newSelectedCategories.splice(index, 1);
      console.log('移除分类:', categoryId);
    }
    
    console.log('选择后selectedCategories:', JSON.stringify(newSelectedCategories));
    
    // 更新categoriesWithSelection中的选中状态
    const categoriesWithSelection = this.data.categoriesWithSelection.map(category => {
      return {
        ...category,
        selected: newSelectedCategories.includes(category._id)
      };
    });
    
    // 更新currentCategory
    let currentCategory = null;
    if (newSelectedCategories.length > 0) {
      currentCategory = newSelectedCategories[0];
    }
    
    this.setData({
      selectedCategories: newSelectedCategories,
      categoriesWithSelection: categoriesWithSelection,
      currentCategory: currentCategory
    });
  },
  
  // 移除已选分类
  removeCategory(e) {
    const index = e.currentTarget.dataset.index
    const selectedCategories = [...this.data.selectedCategories]
    selectedCategories.splice(index, 1)
    
    this.setData({
      selectedCategories
    })
  },

  // 选择封面
  chooseCover() {
    // 提供用户选择：本地图片或输入网络图片URL
    wx.showActionSheet({
      itemList: ['从相册选择', '拍照', '输入图片网址', '使用扫描封面'],
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
                'bookForm.coverUrl': tempFilePath,
                coverSource: 'local' // 标记为本地图片
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
        } else if (res.tapIndex === 3) {
          // 使用扫描获取的封面
          if (this.data.bookInfo && this.data.bookInfo.coverUrl) {
            this.setData({
              'bookForm.coverUrl': this.data.bookInfo.coverUrl,
              coverSource: 'network' // 标记为网络图片
            });
            wx.showToast({
              title: '已使用扫描封面',
              icon: 'success'
            });
          } else {
            wx.showToast({
              title: '没有扫描封面',
              icon: 'none'
            });
          }
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
              'bookForm.coverUrl': imageUrl,
              coverSource: 'network' // 标记为网络图片
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
  
  // 保存图书
  saveBook() {
    console.log('开始保存图书...');
    
    // 验证必填项
    if (!this.data.bookForm.title) {
      this.showError('请输入书名');
      return;
    }
    
    // 防抖：检查是否在保存中和时间间隔
    if (this.data.isSaving) {
      console.log('保存操作正在进行中，请勿重复提交');
      wx.showToast({
        title: '请勿重复提交',
        icon: 'none'
      });
      return;
    }
    
    // 检查是否短时间内重复提交（3秒内）
    const now = Date.now();
    if (now - this.data.lastSubmitTime < 3000) {
      console.log('提交过于频繁，请稍后再试');
      wx.showToast({
        title: '操作过于频繁',
        icon: 'none'
      });
      return;
    }
    
    // 设置保存状态和时间戳
    this.setData({
      isSaving: true,
      lastSubmitTime: now
    });
    
    // 检查ISBN是否为空
    const isbn = this.data.bookForm.isbn ? this.data.bookForm.isbn.trim() : '';
    console.log('检查ISBN:', isbn);
    
    wx.showLoading({
      title: '保存中...',
    });
    
    // 如果有ISBN，先检查是否存在相同ISBN的书籍
    if (isbn) {
      console.log('ISBN不为空，开始检查是否存在重复...');
      const db = wx.cloud.database();
      
      db.collection('books')
        .where({
          isbn: isbn
        })
        .get()
        .then(res => {
          console.log('ISBN查询结果:', res.data);
          if (res.data && res.data.length > 0) {
            // 已存在相同ISBN的书籍
            wx.hideLoading();
            this.setData({ isSaving: false }); // 重置保存状态
            
            // 获取已存在书籍的ID
            const existingBookId = res.data[0]._id;
            console.log('找到已存在的书籍ID:', existingBookId);
            
            wx.showModal({
              title: '提示',
              content: '该书籍已存在，是否查看详情？',
              confirmText: '查看详情',
              cancelText: '继续编辑',
              success: (result) => {
                if (result.confirm) {
                  // 用户选择查看详情，跳转到书籍详情页
                  console.log('用户选择查看详情，准备跳转到:', `/pages/bookDetail/bookDetail?id=${existingBookId}`);
                  
                  // 使用switchTab+navigateTo的组合解决可能的跳转问题
                  try {
                    wx.navigateTo({
                      url: `../bookDetail/bookDetail?id=${existingBookId}`,
                      success: function() {
                        console.log('跳转成功');
                      },
                      fail: function(error) {
                        console.error('navigateTo失败:', error);
                        
                        // 如果直接跳转失败，可能是在tabBar页面，尝试用redirectTo
                        wx.redirectTo({
                          url: `../bookDetail/bookDetail?id=${existingBookId}`,
                          success: function() {
                            console.log('redirectTo跳转成功');
                          },
                          fail: function(err) {
                            console.error('redirectTo也失败:', err);
                            
                            // 最后尝试使用reLaunch
                            wx.reLaunch({
                              url: `../bookDetail/bookDetail?id=${existingBookId}`,
                              success: function() {
                                console.log('reLaunch跳转成功');
                              },
                              fail: function(e) {
                                console.error('所有跳转方式都失败:', e);
                              }
                            });
                          }
                        });
                      }
                    });
                  } catch (err) {
                    console.error('跳转过程中发生异常:', err);
                  }
                } else {
                  console.log('用户选择继续编辑');
                }
              }
            });
            return;
          } else {
            // 如果ISBN没有重复，再检查标题+作者组合是否重复
            this.checkTitleAuthorDuplicate();
          }
        })
        .catch(err => {
          console.error('检查ISBN失败', err);
          this.setData({ isSaving: false }); // 重置保存状态
          wx.hideLoading();
          wx.showToast({
            title: '检查ISBN失败',
            icon: 'none'
          });
        });
    } else {
      // 没有ISBN，检查标题+作者组合是否重复
      this.checkTitleAuthorDuplicate();
    }
  },
  
  // 检查标题+作者组合是否重复
  checkTitleAuthorDuplicate() {
    const title = this.data.bookForm.title.trim();
    const author = this.data.bookForm.author.trim();
    
    // 如果没有标题或作者，直接保存
    if (!title || !author) {
      this.saveBookToCloud();
      return;
    }
    
    console.log('检查标题+作者组合是否重复:', title, author);
    
    const db = wx.cloud.database();
    const _ = db.command;
    
    db.collection('books')
      .where({
        title: title,
        author: author
      })
      .get()
      .then(res => {
        console.log('标题+作者查询结果:', res.data);
        if (res.data && res.data.length > 0) {
          // 已存在相同标题+作者的书籍
          wx.hideLoading();
          this.setData({ isSaving: false }); // 重置保存状态
          
          // 获取已存在书籍的ID
          const existingBookId = res.data[0]._id;
          console.log('找到已存在的书籍ID:', existingBookId);
          
          wx.showModal({
            title: '提示',
            content: '已存在相同标题和作者的书籍，可能是重复添加，是否查看详情？',
            confirmText: '查看详情',
            cancelText: '仍然添加',
            success: (result) => {
              if (result.confirm) {
                // 用户选择查看详情，跳转到书籍详情页
                console.log('用户选择查看详情，准备跳转到:', `../bookDetail/bookDetail?id=${existingBookId}`);
                
                try {
                  wx.navigateTo({
                    url: `../bookDetail/bookDetail?id=${existingBookId}`,
                    success: function() {
                      console.log('跳转成功');
                    },
                    fail: function(error) {
                      console.error('navigateTo失败:', error);
                      
                      // 尝试其他跳转方式
                      wx.redirectTo({
                        url: `../bookDetail/bookDetail?id=${existingBookId}`,
                        fail: function(err) {
                          console.error('redirectTo也失败:', err);
                          wx.reLaunch({
                            url: `../bookDetail/bookDetail?id=${existingBookId}`
                          });
                        }
                      });
                    }
                  });
                } catch (err) {
                  console.error('跳转过程中发生异常:', err);
                }
              } else {
                console.log('用户选择仍然添加，继续保存');
                this.saveBookToCloud();
              }
            }
          });
        } else {
          // 不存在重复，继续保存
          this.saveBookToCloud();
        }
      })
      .catch(err => {
        console.error('检查标题+作者失败', err);
        // 出错时继续保存
        this.saveBookToCloud();
      });
  },
  
  // 保存书籍到云数据库
  saveBookToCloud() {
    // 将分类ID转换为分类名称
    const categoryNames = [];
    let categoryName = null;
    
    if (this.data.selectedCategories && this.data.selectedCategories.length > 0) {
      // 遍历选中的分类ID，找出对应的分类名称
      this.data.selectedCategories.forEach(categoryId => {
        const categoryObj = this.data.categoriesWithSelection.find(item => item._id === categoryId);
        if (categoryObj) {
          categoryNames.push(categoryObj.name);
          // 设置第一个选中的分类为主分类
          if (!categoryName) {
            categoryName = categoryObj.name;
          }
        }
      });
    }
    
    const bookData = {
      title: this.data.bookForm.title,
      author: this.data.bookForm.author,
      publisher: this.data.bookForm.publisher,
      publishDate: this.data.bookForm.publishDate,
      isbn: this.data.bookForm.isbn,
      pages: this.data.bookForm.pages,
      price: this.data.bookForm.price,
      binding: this.data.bookForm.binding,
      edition: this.data.bookForm.edition,
      format: this.data.bookForm.format,
      description: this.data.bookForm.description,
      coverUrl: this.data.bookForm.coverUrl,
      coverSource: this.data.coverSource || 'network',
      category: categoryName || '其他',
      categories: categoryNames.length > 0 ? categoryNames : ['其他'],
      borrowStatus: 'in',
      addTime: wx.cloud.database().serverDate()
    };
    
    // 保存到云数据库
    wx.cloud.database().collection('books').add({
      data: bookData,
      success: (res) => {
        wx.hideLoading();
        this.setData({ isSaving: false }); // 重置保存状态
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
        
        // 返回上一页
        setTimeout(() => {
          wx.navigateBack();
        }, 1500);
      },
      fail: (err) => {
        console.error('保存图书失败', err);
        wx.hideLoading();
        this.setData({ isSaving: false }); // 重置保存状态
        this.showError('保存失败：' + err.errMsg);
      }
    });
  },

  // 显示添加分类弹窗
  showAddCategoryModal() {
    this.setData({
      showAddCategoryModal: true,
      newCategoryName: ''
    });
  },

  // 关闭添加分类弹窗
  closeAddCategoryModal() {
    this.setData({
      showAddCategoryModal: false
    });
  },

  // 新分类输入变化
  onNewCategoryInput(e) {
    this.setData({
      newCategoryName: e.detail
    });
  },

  // 添加新分类
  async addNewCategory() {
    if (!this.data.newCategoryName.trim()) {
      wx.showToast({
        title: '分类名称不能为空',
        icon: 'none'
      });
      return;
    }

    try {
      const db = wx.cloud.database();
      const result = await db.collection('categories').add({
        data: {
          name: this.data.newCategoryName,
          icon: 'default',
          color: '#' + Math.floor(Math.random()*16777215).toString(16), // 随机颜色
          createTime: db.serverDate()
        }
      });

      // 添加成功后，刷新分类列表并选中新添加的分类
      if (result._id) {
        // 获取新添加的分类完整信息
        const newCategory = await db.collection('categories').doc(result._id).get();
        
        // 添加到分类列表并设置为选中
        const newSelectedCategories = [...this.data.selectedCategories, result._id];
        
        // 更新categoriesWithSelection
        const newCategoriesWithSelection = [
          ...this.data.categoriesWithSelection,
          {
            ...newCategory.data,
            selected: true
          }
        ];
        
        this.setData({
          categories: [...this.data.categories, newCategory.data],
          selectedCategories: newSelectedCategories,
          categoriesWithSelection: newCategoriesWithSelection
        });

        wx.showToast({
          title: '分类添加成功',
          icon: 'success'
        });
      }
    } catch (err) {
      console.error('添加分类失败：', err);
      wx.showToast({
        title: '添加分类失败',
        icon: 'none'
      });
    }
  },

  // 通过索引切换分类选中状态
  toggleCategoryByIndex(e) {
    const index = e.currentTarget.dataset.index;
    if (index === undefined || index === null) {
      console.error('无效的分类索引');
      return;
    }
    
    console.log('切换分类索引:', index);
    
    // 获取当前的分类列表和选中状态
    const categoriesWithSelection = [...this.data.categoriesWithSelection];
    
    // 切换选中状态
    categoriesWithSelection[index].selected = !categoriesWithSelection[index].selected;
    
    console.log('分类', categoriesWithSelection[index].name, '的新状态:', categoriesWithSelection[index].selected);
    
    // 同时更新selectedCategories数组，保持两种方式的兼容性
    const selectedCategories = categoriesWithSelection
      .filter(category => category.selected)
      .map(category => category._id);
    
    // 更新currentCategory，使用选中的第一个分类作为当前分类
    let currentCategory = null;
    if (selectedCategories.length > 0) {
      const selectedCategory = categoriesWithSelection.find(c => c.selected);
      currentCategory = selectedCategory ? selectedCategory._id : null;
    }
    
    this.setData({
      categoriesWithSelection,
      selectedCategories,
      currentCategory // 添加更新currentCategory
    });
  },

  // 通过ISBN获取图书信息
  fetchBookInfoByISBN: function(isbn) {
    this.setData({ loading: true });
    
    bookUtils.fetchBookInfoByISBN(isbn)
      .then(bookInfo => {
        this.setData({
          bookForm: {
            title: bookInfo.title,
            author: bookInfo.author,
            publisher: bookInfo.publisher,
            publishDate: bookInfo.publishDate,
            isbn: isbn,
            description: bookInfo.description,
            coverUrl: bookInfo.coverUrl,
            pages: bookInfo.pages,
            price: bookInfo.price,
            binding: bookInfo.binding
          },
          coverSource: 'network',
          bookInfo: bookInfo,
          loading: false
        });
      })
      .catch(err => {
        console.error('获取图书信息失败：', err);
        this.setData({ 
          loading: false,
          'bookForm.isbn': isbn  // 保留ISBN
        });
        this.showError('未找到图书信息，请手动输入');
      });
  },

  // 显示错误提示
  showError: function(msg) {
    this.setData({
      showError: true,
      errorMsg: msg
    });
    
    setTimeout(() => {
      this.setData({
        showError: false,
        errorMsg: ''
      });
    }, 3000);
  },
}) 
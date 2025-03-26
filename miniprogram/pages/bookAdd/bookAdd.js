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
  
  // 完成保存
  saveToCloud() {
    console.log('保存到云端的图书数据：', this.data.bookForm);
    
    // 验证isbn唯一性
    if (this.data.bookForm.isbn) {
      wx.cloud.database().collection('books')
        .where({
          isbn: this.data.bookForm.isbn,
          _id: wx.cloud.database().command.neq(this.data.bookId || '') // 排除当前编辑的图书
        })
        .count()
        .then(res => {
          if (res.total > 0) {
            wx.showModal({
              title: '重复ISBN',
              content: '系统中已存在相同ISBN的图书，确定继续添加吗？',
              success: (res) => {
                if (res.confirm) {
                  this.performSave();
                }
              }
            });
          } else {
            this.performSave();
          }
        })
        .catch(err => {
          console.error('验证ISBN唯一性失败:', err);
          // 继续保存
          this.performSave();
        });
    } else {
      this.performSave();
    }
  },
  
  // 保存按钮点击处理函数
  saveBook() {
    console.log('点击了保存按钮');
    // 表单验证
    const bookForm = this.data.bookForm;
    
    if (!bookForm.title || bookForm.title.trim() === '') {
      wx.showToast({
        title: '请输入书名',
        icon: 'none'
      });
      return;
    }
    
    // 执行保存操作
    this.performSave();
  },
  
  // 执行实际保存操作
  performSave() {
    wx.showLoading({
      title: '保存中...',
    });
    
    // 记录旧的分类，用于更新分类计数
    let oldCategories = [];
    
    // 如果已有ID，表示是编辑模式
    if (this.data.bookId) {
      // 获取原图书信息以获取旧的分类
      wx.cloud.database().collection('books').doc(this.data.bookId).get()
        .then(res => {
          if (res.data) {
            oldCategories = res.data.categories || [];
          }
          this.continuePerformSave(oldCategories);
        })
        .catch(err => {
          console.error('获取原图书信息失败:', err);
          this.continuePerformSave([]);
        });
    } else {
      this.continuePerformSave([]);
    }
  },
  
  // 处理封面图片：如果是本地文件则上传到云存储
  handleCoverImage(bookForm) {
    return new Promise((resolve, reject) => {
      const coverUrl = bookForm.coverUrl;
      const coverSource = this.data.coverSource;
      
      console.log('处理封面图片:', coverUrl, '来源:', coverSource);
      
      // 如果没有封面或者封面是网络图片，直接返回
      if (!coverUrl || coverSource === 'network' || coverUrl.startsWith('cloud://') || coverUrl.startsWith('http')) {
        resolve(bookForm);
        return;
      }
      
      // 如果是本地图片，需要上传到云存储
      if (coverSource === 'local' && wx.cloud) {
        const cloudPath = `covers/${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;
        
        wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: coverUrl,
          success: res => {
            console.log('封面上传成功:', res.fileID);
            // 更新bookForm中的封面URL为云存储路径
            const updatedBookForm = { ...bookForm, coverUrl: res.fileID, coverSource: 'cloud' };
            resolve(updatedBookForm);
          },
          fail: err => {
            console.error('封面上传失败:', err);
            // 失败时仍使用原始表单
            resolve(bookForm);
          }
        });
      } else {
        // 其他情况，直接使用原始表单
        resolve(bookForm);
      }
    });
  },
  
  // 继续执行保存操作
  continuePerformSave(oldCategories) {
    const bookForm = { ...this.data.bookForm };
    
    // 添加时间
    bookForm.addTime = wx.cloud.database().serverDate();
    
    // 添加分类信息 - 将分类ID转换为分类名称
    const categoryNames = [];
    if (this.data.selectedCategories && this.data.selectedCategories.length > 0) {
      // 遍历选中的分类ID，找出对应的分类名称
      this.data.selectedCategories.forEach(categoryId => {
        const categoryObj = this.data.categories.find(item => item._id === categoryId);
        if (categoryObj) {
          categoryNames.push(categoryObj.name);
        }
      });
    }
    
    // 保存分类名称数组到categories字段
    bookForm.categories = categoryNames.length > 0 ? categoryNames : ['其他'];
    // 使用第一个分类名称作为主分类
    bookForm.category = categoryNames.length > 0 ? categoryNames[0] : '其他';
    
    // 设置默认借阅状态为"在库"
    if (!bookForm.borrowStatus) {
      bookForm.borrowStatus = 'in';
    }
    
    // 处理封面图片
    this.handleCoverImage(bookForm)
      .then(processedBookForm => {
        // 保存到云数据库
        if (this.data.bookId) {
          // 编辑模式
          wx.cloud.database().collection('books').doc(this.data.bookId).update({
            data: processedBookForm
          })
          .then(() => {
            console.log('更新图书成功');
            wx.hideLoading();
            
            // 更新分类计数
            this.updateCategoriesCount(oldCategories, bookForm.categories);
            
            wx.showToast({
              title: '保存成功',
              icon: 'success'
            });
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          })
          .catch(err => {
            console.error('更新图书失败:', err);
            wx.hideLoading();
            wx.showToast({
              title: '保存失败',
              icon: 'none'
            });
          });
        } else {
          // 新增模式
          wx.cloud.database().collection('books').add({
            data: processedBookForm
          })
          .then(res => {
            console.log('添加图书成功, ID:', res._id);
            wx.hideLoading();
            
            // 更新分类计数
            this.updateCategoriesCount([], bookForm.categories);
            
            wx.showToast({
              title: '添加成功',
              icon: 'success'
            });
            setTimeout(() => {
              wx.navigateBack();
            }, 1500);
          })
          .catch(err => {
            console.error('添加图书失败:', err);
            wx.hideLoading();
            wx.showToast({
              title: '添加失败',
              icon: 'none'
            });
          });
        }
      })
      .catch(err => {
        console.error('处理图书封面失败:', err);
        wx.hideLoading();
        wx.showToast({
          title: '上传封面失败',
          icon: 'none'
        });
      });
  },
  
  // 更新分类计数
  updateCategoriesCount(oldCategories, newCategories) {
    console.log('更新分类计数，原分类:', oldCategories, '新分类:', newCategories);
    
    const db = wx.cloud.database();
    const allCategories = [...new Set([...oldCategories, ...newCategories])];
    
    // 对每个受影响的分类进行处理
    allCategories.forEach(categoryName => {
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
          
          // 调试：查看该分类下的所有图书
          db.collection('books')
            .where({
              categories: categoryName
            })
            .field({
              _id: true,
              title: true
            })
            .get()
            .then(booksRes => {
              console.log(`分类[${categoryName}]下的图书:`, 
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
                const currentCount = catRes.data[0].count;
                
                console.log(`准备更新分类[${categoryName}]计数，当前值:${currentCount}，新值:${actualCount}`);
                
                db.collection('categories').doc(categoryId).update({
                  data: {
                    count: actualCount
                  }
                }).then(() => {
                  console.log(`分类[${categoryName}]计数已更新为:`, actualCount);
                }).catch(err => {
                  console.error(`更新分类[${categoryName}]计数失败:`, err);
                  
                  // 如果更新失败，尝试使用set方法覆盖
                  const updatedCategory = {...catRes.data[0], count: actualCount};
                  db.collection('categories').doc(categoryId).set({
                    data: updatedCategory
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
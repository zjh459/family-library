const app = getApp();
const config = require('../.././../config');

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
    showCategoryPickerModal: false,
    theme: {},
    showAddCategoryModal: false,
    newCategoryName: ''
  },

  onLoad(options) {
    this.setData({
      theme: app.globalData.theme,
      selectedCategories: []  // 确保初始化时是空数组
    });

    // 初始化云环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    } else {
      wx.cloud.init({
        env: config.cloud.env, // 从配置文件读取云环境ID
        traceUser: true,
      });
    }

    // 加载分类数据
    this.loadCategories();
    
    // 如果是编辑模式，需要加载图书的分类信息
    if (options.id) {
      this.loadBookData(options.id);
    }
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
    const { value } = e.detail;
    
    this.setData({
      [`bookForm.${field}`]: value
    });
  },

  // 加载所有分类
  async loadCategories() {
    try {
      const db = wx.cloud.database()
      const res = await db.collection('categories').get()
      this.setData({
        categories: res.data
      })
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
        
        this.setData({
          selectedCategories: categoryIds
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
    if (!categoryId) return; // 确保id存在
    
    const index = this.data.selectedCategories.indexOf(categoryId);
    const newSelectedCategories = [...this.data.selectedCategories];
    
    if (index === -1) {
      // 添加分类
      newSelectedCategories.push(categoryId);
    } else {
      // 移除分类
      newSelectedCategories.splice(index, 1);
    }
    
    this.setData({
      selectedCategories: newSelectedCategories
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
        
        // 上传图片到云存储
        const cloudPath = `book-covers/${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;
        wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: tempFilePath,
          success: res => {
            // 获取图片的云存储链接
            const fileID = res.fileID;
            this.setData({
              'bookForm.coverUrl': fileID
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
              'bookForm.coverUrl': tempFilePath
            });
          }
        });
      }
    });
  },

  // 保存书籍
  async saveBook() {
    // 验证必填项
    if (!this.data.bookForm.title) {
      wx.showToast({
        title: '请输入书名',
        icon: 'none'
      });
      return;
    }

    // 检查ISBN是否重复
    const existingBook = app.globalData.books.find(book => book.isbn === this.data.bookForm.isbn);
    if (existingBook) {
      wx.showModal({
        title: '提示',
        content: '该ISBN的图书已存在，是否查看已存在的图书？',
        confirmText: '查看',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: `/miniprogram/pages/bookDetail/bookDetail?id=${existingBook.id}`
            });
          }
        }
      });
      return;
    }

    wx.showLoading({
      title: '保存中...',
    });

    // 处理从API获取的远程图片URL
    this.handleCoverImage().then(coverUrl => {
      // 获取所有选中的分类名称
      const categoryNames = this.getCategoryNames();
      
      // 构建图书数据，确保不包含_openid等系统字段
      const { _openid, _id, ...cleanBookForm } = this.data.bookForm;
      const bookData = {
        ...cleanBookForm,
        coverUrl: coverUrl,
        categories: categoryNames
      };

      // 将图书数据保存到云数据库
      wx.cloud.database().collection('books').add({
        data: {
          ...bookData,
          addTime: new Date().getTime(),
          borrowStatus: 'in', // 默认为在库状态
          borrowHistory: []
        },
        success: res => {
          const bookId = res._id;
          
          // 同时添加到本地全局数据
          app.addBook({
            ...bookData,
            id: bookId,
            addTime: new Date().getTime(),
            borrowStatus: 'in'
          });

          wx.hideLoading();
          
          // 显示成功提示并询问是否继续添加
          wx.showModal({
            title: '添加成功',
            content: '是否继续添加新书？',
            confirmText: '继续添加',
            cancelText: '返回书库',
            success: (result) => {
              if (result.confirm) {
                // 重置表单
                this.setData({
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
                  isbnValue: '',
                  currentCategory: '',
                  activeTab: 0,
                  selectedCategories: []  // 清空已选分类
                });
              } else {
                // 返回书库
                wx.navigateBack();
              }
            }
          });
        },
        fail: err => {
          console.error('保存失败', err);
          wx.hideLoading();
          wx.showToast({
            title: '保存失败',
            icon: 'none'
          });
        }
      });
    }).catch(err => {
      console.error('处理封面图片失败', err);
      wx.hideLoading();
      wx.showToast({
        title: '图片处理失败',
        icon: 'none'
      });
    });
  },

  // 处理封面图片
  handleCoverImage() {
    return new Promise((resolve, reject) => {
      const coverUrl = this.data.bookForm.coverUrl;
      
      // 如果没有封面或者已经是云存储路径，直接返回
      if (!coverUrl || coverUrl.startsWith('cloud://')) {
        resolve(coverUrl);
        return;
      }
      
      // 如果是远程图片URL（API返回的图片），下载后再上传到云存储
      if (coverUrl.startsWith('http')) {
        wx.showLoading({
          title: '处理封面...',
        });
        
        // 下载远程图片
        wx.downloadFile({
          url: coverUrl,
          success: res => {
            if (res.statusCode === 200) {
              const tempFilePath = res.tempFilePath;
              
              // 上传到云存储
              const cloudPath = `book-covers/${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;
              wx.cloud.uploadFile({
                cloudPath: cloudPath,
                filePath: tempFilePath,
                success: res => {
                  const fileID = res.fileID;
                  resolve(fileID);
                },
                fail: err => {
                  console.error('上传到云存储失败', err);
                  // 失败时使用原始URL
                  resolve(coverUrl);
                }
              });
            } else {
              console.error('下载远程图片失败', res);
              // 失败时使用原始URL
              resolve(coverUrl);
            }
          },
          fail: err => {
            console.error('下载远程图片失败', err);
            // 失败时使用原始URL
            resolve(coverUrl);
          }
        });
      } else {
        // 本地临时路径，直接上传到云存储
        const cloudPath = `book-covers/${Date.now()}-${Math.floor(Math.random() * 1000)}.jpg`;
        wx.cloud.uploadFile({
          cloudPath: cloudPath,
          filePath: coverUrl,
          success: res => {
            const fileID = res.fileID;
            resolve(fileID);
          },
          fail: err => {
            console.error('上传到云存储失败', err);
            // 失败时使用原始路径
            resolve(coverUrl);
          }
        });
      }
    });
  },

  // 获取所有选中的分类名称
  getCategoryNames() {
    return this.data.categories
      .filter(category => this.data.selectedCategories.includes(category._id))
      .map(category => category.name);
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
        // 刷新分类列表
        this.loadCategories().then(() => {
          // 选中新添加的分类
          const newSelectedCategories = [...this.data.selectedCategories];
          newSelectedCategories.push(result._id);
          this.setData({
            selectedCategories: newSelectedCategories
          });
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
}) 
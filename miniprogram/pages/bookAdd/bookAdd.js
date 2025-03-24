const app = getApp();

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
      description: ''
    },
    categories: ['小说', '经管', '科技', '文学', '其他'],
    currentCategory: '',
    showCategoryPicker: false,
    theme: {}
  },

  onLoad() {
    this.setData({
      theme: app.globalData.theme
    });
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

    // 这里模拟API请求，实际项目中应该调用真实API
    setTimeout(() => {
      // 假数据，实际应从API获取
      const bookData = {
        title: '示例书籍',
        author: '示例作者',
        publisher: '示例出版社',
        publishDate: '2020-01-01',
        isbn: this.data.isbnValue,
        category: '小说',
        coverUrl: '',
        description: '这是一本示例书籍的描述...'
      };

      this.setData({
        bookForm: bookData,
        isbnLoading: false,
        activeTab: 1, // 自动切换到表单页
        currentCategory: bookData.category
      });

      wx.showToast({
        title: '查询成功',
        icon: 'success'
      });
    }, 1500);

    /* 实际的API调用应该类似如下
    wx.request({
      url: `https://api.douban.com/v2/book/isbn/${this.data.isbnValue}`,
      success: (res) => {
        // 处理返回数据
        const data = res.data;
        this.setData({
          bookForm: {
            title: data.title,
            author: data.author.join(', '),
            publisher: data.publisher,
            publishDate: data.pubdate,
            isbn: data.isbn13,
            category: data.tags[0]?.name || '其他',
            coverUrl: data.images.large,
            description: data.summary
          },
          isbnLoading: false,
          activeTab: 1,
          currentCategory: data.tags[0]?.name || '其他'
        });
      },
      fail: () => {
        this.setData({ isbnLoading: false });
        wx.showToast({
          title: '查询失败，请重试',
          icon: 'none'
        });
      }
    });
    */
  },

  // 表单输入处理
  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;
    
    this.setData({
      [`bookForm.${field}`]: value
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
      'bookForm.category': category,
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
        
        // 在实际应用中，应该将图片上传到服务器或小程序云存储
        // 这里仅演示用本地临时路径
        this.setData({
          'bookForm.coverUrl': tempFilePath
        });
      }
    });
  },

  // 保存书籍
  saveBook() {
    // 验证必填项
    if (!this.data.bookForm.title) {
      wx.showToast({
        title: '请输入书名',
        icon: 'none'
      });
      return;
    }

    // 添加书籍到全局
    const bookId = app.addBook(this.data.bookForm);

    // 提示保存成功并重置表单
    wx.showToast({
      title: '添加成功',
      icon: 'success',
      duration: 1500,
      success: () => {
        setTimeout(() => {
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
              description: ''
            },
            isbnValue: '',
            currentCategory: '',
            activeTab: 0
          });
          
          // 跳转到书籍详情页
          wx.navigateTo({
            url: `/pages/bookDetail/bookDetail?id=${bookId}`
          });
        }, 1500);
      }
    });
  }
}) 
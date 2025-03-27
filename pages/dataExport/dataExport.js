const app = getApp();

Page({
  data: {
    exporting: false,
    exportStatus: '',
    progress: 0,
    books: [],
    categories: []
  },

  onLoad() {
    // 页面加载时，不执行任何操作
  },

  // 开始导出数据
  startExport() {
    this.setData({
      exporting: true,
      exportStatus: '开始导出数据...',
      progress: 0
    });

    // 导出流程：先导出分类，再导出图书
    this.exportCategories()
      .then(() => {
        this.setData({
          progress: 50,
          exportStatus: '分类导出完成，开始导出图书...'
        });
        return this.exportBooks();
      })
      .then(() => {
        this.setData({
          progress: 100,
          exportStatus: '全部数据导出完成！',
          exporting: false
        });
      })
      .catch(err => {
        console.error('导出数据失败:', err);
        this.setData({
          exportStatus: '导出失败: ' + err.message,
          exporting: false
        });
      });
  },

  // 导出分类数据
  exportCategories() {
    return new Promise((resolve, reject) => {
      const db = wx.cloud.database();
      
      // 获取所有分类
      db.collection('categories').get()
        .then(res => {
          const categories = res.data || [];
          this.setData({ 
            categories,
            exportStatus: `已获取${categories.length}个分类` 
          });
          resolve(categories);
        })
        .catch(err => {
          console.error('获取分类失败:', err);
          reject(err);
        });
    });
  },

  // 导出图书数据
  exportBooks() {
    return new Promise((resolve, reject) => {
      const db = wx.cloud.database();
      const MAX_LIMIT = 20; // 微信小程序单次查询最大条数
      
      // 先获取总数
      db.collection('books').count()
        .then(res => {
          const total = res.total;
          const batchTimes = Math.ceil(total / MAX_LIMIT);
          let books = [];
          let tasks = [];
          
          this.setData({ 
            exportStatus: `共有${total}本图书，分${batchTimes}批获取中...` 
          });
          
          // 并发获取所有批次的图书
          for (let i = 0; i < batchTimes; i++) {
            const promise = db.collection('books')
              .skip(i * MAX_LIMIT)
              .limit(MAX_LIMIT)
              .get();
            tasks.push(promise);
          }
          
          // 等待所有请求完成
          return Promise.all(tasks);
        })
        .then(results => {
          let books = [];
          results.forEach(res => {
            books = books.concat(res.data);
          });
          
          this.setData({ 
            books,
            exportStatus: `已获取${books.length}本图书` 
          });
          
          resolve(books);
        })
        .catch(err => {
          console.error('获取图书失败:', err);
          reject(err);
        });
    });
  },

  // 复制数据到剪贴板
  copyData() {
    const data = {
      books: this.data.books,
      categories: this.data.categories
    };
    
    wx.setClipboardData({
      data: JSON.stringify(data),
      success: () => {
        wx.showToast({
          title: '数据已复制到剪贴板',
          icon: 'success'
        });
      }
    });
  },

  // 导出数据为JSON文件
  exportToJSON() {
    const fs = wx.getFileSystemManager();
    const data = {
      books: this.data.books,
      categories: this.data.categories
    };
    
    // 创建临时文件
    const jsonStr = JSON.stringify(data);
    const filePath = `${wx.env.USER_DATA_PATH}/export_data.json`;
    
    fs.writeFile({
      filePath: filePath,
      data: jsonStr,
      encoding: 'utf8',
      success: () => {
        // 保存到手机相册或下载
        wx.saveFile({
          tempFilePath: filePath,
          success: (res) => {
            const savedFilePath = res.savedFilePath;
            wx.showModal({
              title: '导出成功',
              content: `数据已保存，路径: ${savedFilePath}`,
              confirmText: '分享文件',
              success(res) {
                if (res.confirm) {
                  wx.shareFileMessage({
                    filePath: savedFilePath,
                    success() {
                      console.log('分享成功');
                    },
                    fail(res) {
                      console.error('分享失败', res);
                      wx.showToast({
                        title: '分享失败',
                        icon: 'none'
                      });
                    }
                  });
                }
              }
            });
          },
          fail: (err) => {
            console.error('保存文件失败', err);
            wx.showModal({
              title: '导出失败',
              content: '无法保存文件: ' + err.errMsg,
              showCancel: false
            });
          }
        });
      },
      fail: (err) => {
        console.error('写入文件失败', err);
        wx.showToast({
          title: '导出失败',
          icon: 'none'
        });
      }
    });
  }
}); 
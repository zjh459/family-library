/**
 * 图书相关工具函数
 */

// 处理图书封面URL和字段兼容性，确保能正确显示
function processCoverUrl(book) {
  if (!book) return book;
  
  // 字段兼容性处理
  
  // 1. ID 字段兼容
  if (!book._id && book.id) {
    book._id = book.id;
  }
  if (!book.id && book._id) {
    book.id = book._id;
  }
  
  // 2. 分类字段兼容
  if (book.category_name && !book.category) {
    book.category = book.category_name;
  }
  if (book.category_id && !book.categoryId) {
    book.categoryId = book.category_id;
  }
  
  // 3. 借阅状态字段兼容
  if (book.borrow_status && !book.borrowStatus) {
    book.borrowStatus = book.borrow_status;
  }
  
  // 4. 封面URL字段兼容
  if (!book.coverUrl && book.cover) {
    book.coverUrl = book.cover;
  }
  
  // 5. 分类数组兼容
  if (!book.categories) {
    book.categories = book.category ? [book.category] : [];
  } else if (typeof book.categories === 'string') {
    try {
      book.categories = JSON.parse(book.categories);
    } catch (e) {
      console.error('解析categories字段失败:', e);
      book.categories = [];
    }
  }
  
  // 6. 出版日期字段兼容
  if (book.publication_date && !book.publishDate) {
    book.publishDate = book.publication_date;
  }
  
  // 7. 装帧字段兼容
  if (!book.binding && book.binding_type) {
    book.binding = book.binding_type;
  }
  
  // 8. 开本字段兼容
  if (!book.format && book.book_format) {
    book.format = book.book_format;
  }

  // 9. 版次字段兼容
  if (!book.edition && book.version) {
    book.edition = book.version;
  }
  
  // 10. 如果缺少某些重要字段但有其他相关字段，使用相关字段数据
  if (!book.pages && book.page_count) {
    book.pages = book.page_count;
  }
  
  // 11. 设置数字类型字段的默认值，避免显示为 0
  if (book.price === 0 || book.price === '0') {
    book.price = null;
  }
  if (book.pages === 0 || book.pages === '0') {
    book.pages = null;
  }
  
  // 处理封面URL
  if (!book.coverUrl) {
    // 如果没有封面，使用默认封面
    book.coverUrl = '/images/default-cover.png';
    return book;
  }
  
  // 处理不同来源的图片
  if (book.coverSource === 'local') {
    // 本地图片处理
    if (!book.coverUrl.startsWith('/')) {
      book.coverUrl = '/' + book.coverUrl;
    }
  } else if (book.coverUrl.indexOf('cloud://') === 0) {
    // 旧数据可能还使用云存储，转换为https直接访问链接
    try {
      const cloudEnv = book.coverUrl.match(/cloud:\/\/([^.]+)/)[1];
      const path = book.coverUrl.replace(/cloud:\/\/[^/]+\//, '');
      book.coverUrl = `https://${cloudEnv}.tcb.qcloud.la/${path}`;
    } catch (err) {
      console.error('转换云存储URL失败:', err);
      book.coverUrl = '/images/default-cover.png';
    }
  } else if (book.coverUrl.startsWith('http')) {
    // 网络图片，保持不变
  } else {
    // 其他情况，确保路径正确
    if (!book.coverUrl.startsWith('/')) {
      book.coverUrl = '/' + book.coverUrl;
    }
  }
  
  // 移除可能存在的miniprogram前缀
  if (book.coverUrl.startsWith('/miniprogram/')) {
    book.coverUrl = book.coverUrl.replace('/miniprogram', '');
  }
  
  return book;
}

// 根据ISBN获取图书信息
function fetchBookInfoByISBN(isbn) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: `https://api.douban.com/v2/book/isbn/${isbn}?apikey=0df993c66c0c636e29ecbb5344252a4a`,
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          const bookInfo = {
            title: res.data.title || '',
            author: (res.data.author && res.data.author.length > 0) ? res.data.author.join(', ') : '',
            publisher: res.data.publisher || '',
            publishDate: res.data.pubdate || '',
            isbn: isbn,
            description: res.data.summary || '',
            coverUrl: res.data.images ? (res.data.images.large || res.data.images.medium || res.data.images.small) : '',
            pages: res.data.pages || '',
            price: res.data.price || '',
            binding: res.data.binding || '',
            coverSource: 'network',
          };
          resolve(bookInfo);
        } else {
          reject(new Error('未找到图书信息'));
        }
      },
      fail: (err) => {
        reject(err);
      }
    });
  });
}

module.exports = {
  processCoverUrl,
  fetchBookInfoByISBN
}; 
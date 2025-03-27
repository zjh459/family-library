/**
 * 图书相关工具函数
 */

// 处理图书封面URL，确保能正确显示
function processCoverUrl(book) {
  if (!book) {
    return book;
  }
  
  // 兼容处理：有些对象使用coverUrl，有些使用cover
  const coverUrl = book.cover || book.coverUrl;
  if (!coverUrl) {
    return {
      ...book,
      cover: '../../images/default-book.png'
    };
  }
  
  // 创建新对象，统一使用cover属性
  const processedBook = {
    ...book,
    cover: coverUrl
  };
  
  // 处理不同来源的图片
  if (book.coverSource === 'local') {
    // 本地图片，小程序重启后可能无法访问，设置为默认图片
    if (!wx.getFileSystemManager().accessSync) {
      try {
        wx.getFileSystemManager().accessSync(processedBook.cover);
      } catch (e) {
        processedBook.cover = '../../images/default-book.png';
      }
    }
  } else if (processedBook.cover.indexOf('cloud://') === 0) {
    // 旧数据可能还使用云存储，转换为https直接访问链接
    try {
      const cloudEnv = processedBook.cover.match(/cloud:\/\/([^.]+)/)[1];
      const path = processedBook.cover.replace(/cloud:\/\/[^/]+\//, '');
      processedBook.cover = `https://${cloudEnv}.tcb.qcloud.la/${path}`;
    } catch (err) {
      console.error('转换云存储URL失败:', err);
      processedBook.cover = '../../images/default-book.png';
    }
  }
  
  return processedBook;
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
            cover: res.data.images ? (res.data.images.large || res.data.images.medium || res.data.images.small) : '',
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
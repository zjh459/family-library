/**
 * API请求工具函数
 */
const config = require('../../config');

// 基础请求函数
function request(url, method, data = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data,
      header: {
        'content-type': 'application/json'
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // 处理响应数据，确保字段一致性
          const processedData = processResponse(res.data);
          resolve(processedData);
        } else {
          reject({
            statusCode: res.statusCode,
            message: res.data.message || '请求失败'
          });
        }
      },
      fail: (err) => {
        reject({
          statusCode: -1,
          message: err.errMsg || '网络错误'
        });
      }
    });
  });
}

// 处理响应数据，统一字段名称
function processResponse(response) {
  // 如果没有数据，直接返回
  if (!response) return response;
  
  // 处理单个对象的字段
  const processFields = (obj) => {
    // 如果不是对象，直接返回
    if (!obj || typeof obj !== 'object') return obj;
    
    // 处理常见的字段名不一致问题
    // 1. ID和分类字段
    if (obj.category_id !== undefined && obj._id === undefined) {
      obj._id = obj.category_id;
    }
    if (obj.category_name !== undefined && obj.name === undefined) {
      obj.name = obj.category_name;
    }
    if (obj.book_count !== undefined && obj.count === undefined) {
      obj.count = obj.book_count;
    }
    
    // 2. 借阅状态
    if (obj.borrow_status !== undefined && obj.borrowStatus === undefined) {
      obj.borrowStatus = obj.borrow_status;
    }
    
    // 3. 分类数组
    if (obj.categories_json !== undefined && obj.categories === undefined) {
      try {
        obj.categories = JSON.parse(obj.categories_json);
      } catch (e) {
        console.error('解析categories_json失败:', e);
        obj.categories = [];
      }
    }
    
    // 4. 封面图片
    if (obj.cover && !obj.coverUrl) {
      obj.coverUrl = obj.cover;
    }
    
    // 5. 出版日期
    if (obj.publication_date && !obj.publishDate) {
      obj.publishDate = obj.publication_date;
    }
    
    // 6. 页数
    if (obj.page_count && !obj.pages) {
      obj.pages = obj.page_count;
    }
    
    // 7. 装帧
    if (obj.binding_type && !obj.binding) {
      obj.binding = obj.binding_type;
    }
    
    // 8. 开本
    if (obj.book_format && !obj.format) {
      obj.format = obj.book_format;
    }
    
    // 9. 版次
    if (obj.version && !obj.edition) {
      obj.edition = obj.version;
    }
    
    // 10. 处理特殊数字值，避免显示0
    if (obj.price === 0 || obj.price === '0') {
      obj.price = null;
    }
    if (obj.pages === 0 || obj.pages === '0') {
      obj.pages = null;
    }
    
    return obj;
  };
  
  // 处理响应对象
  let result = { ...response };
  
  // 处理数据数组
  if (result.data && Array.isArray(result.data)) {
    result.data = result.data.map(item => processFields(item));
  } 
  // 处理单个数据对象
  else if (result.data && typeof result.data === 'object') {
    result.data = processFields(result.data);
  }
  
  return result;
}

// 获取API基础URL
function getBaseUrl() {
  return config.api.server.url;
}

// 获取所有图书
function getAllBooks() {
  return request(`${getBaseUrl()}/books`, 'GET');
}

// 获取单本图书
function getBook(id) {
  return request(`${getBaseUrl()}/books/${id}`, 'GET');
}

// 添加图书
function addBook(book) {
  return request(`${getBaseUrl()}/books`, 'POST', book);
}

// 更新图书
function updateBook(id, book) {
  return request(`${getBaseUrl()}/books/${id}`, 'PUT', book);
}

// 删除图书
function deleteBook(id) {
  return request(`${getBaseUrl()}/books/${id}`, 'DELETE');
}

// 添加分类
function addCategory(category) {
  return request(`${getBaseUrl()}/categories`, 'POST', category);
}

// 更新分类
function updateCategory(id, category) {
  return request(`${getBaseUrl()}/categories/${id}`, 'PUT', category);
}

// 删除分类
function deleteCategory(id) {
  return request(`${getBaseUrl()}/categories/${id}`, 'DELETE');
}

// 获取分类统计
function getCategoriesStatistics() {
  return request(`${getBaseUrl()}/statistics/categories`, 'GET');
}

// 获取借阅统计
function getBorrowStatistics() {
  return request(`${getBaseUrl()}/statistics/borrow`, 'GET');
}

/**
 * 获取图书列表（带分页）
 * @param {Object} params - 查询参数
 * @param {number} params.page - 页码，从1开始
 * @param {number} params.pageSize - 每页数量
 * @param {string} params.searchText - 搜索关键词（可选）
 * @param {string} params.category - 分类ID或名称（可选）
 * @param {boolean} params.uncategorized - 是否只查询未分类图书（可选）
 * @returns {Promise<Object>} - 包含分页图书数据的结果
 */
function getBooks(params = {}) {
  const { page = 1, pageSize = 10, searchText = '', category = '', uncategorized = false } = params;
  
  let url = `${getBaseUrl()}/books?page=${page}&pageSize=${pageSize}`;
  
  if (searchText) {
    url += `&search=${encodeURIComponent(searchText)}`;
  }
  
  if (category) {
    url += `&category=${encodeURIComponent(category)}`;
  }
  
  if (uncategorized) {
    url += '&uncategorized=true';
  }
  
  return request(url).then(processResponse);
}

// 导出API方法
module.exports = {
  getAllBooks,
  getBook,
  addBook,
  updateBook,
  deleteBook,
  addCategory,
  updateCategory,
  deleteCategory,
  getCategoriesStatistics,
  getBorrowStatistics,
  getBooks
}; 
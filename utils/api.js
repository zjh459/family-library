/**
 * API工具类
 * 用于处理与服务器端的通信
 */

const config = require('../utils/config');

// API基础URL
const BASE_URL = config.server.url;

/**
 * 发送请求的基础方法
 * @param {string} url 请求地址
 * @param {string} method 请求方法
 * @param {object} data 请求数据
 * @returns {Promise} 请求结果
 */
function request(url, method = 'GET', data = {}) {
  return new Promise((resolve, reject) => {
    wx.request({
      url: BASE_URL + url,
      method,
      data,
      header: {
        'content-type': 'application/json'
      },
      success: res => {
        // 检查状态码
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          console.error(`请求失败: ${url}`, res);
          // 尝试从响应中提取错误消息
          const errMsg = (res.data && res.data.error) || '请求失败';
          reject(new Error(errMsg));
        }
      },
      fail: err => {
        console.error(`请求出错: ${url}`, err);
        reject(new Error('网络请求失败'));
      }
    });
  });
}

// 分类相关API
const categories = {
  /**
   * 获取所有分类
   */
  getAll() {
    return request('/api/categories');
  },

  /**
   * 获取单个分类详情
   * @param {string} id 分类ID
   */
  getOne(id) {
    return request(`/api/categories/${id}`);
  },

  /**
   * 添加分类
   * @param {object} categoryData 分类数据
   * @param {string} categoryData.name 分类名称
   * @param {string} categoryData.icon 分类图标
   * @param {string} categoryData.color 分类颜色
   */
  add(categoryData) {
    return request('/api/categories', 'POST', categoryData);
  },

  /**
   * 更新分类
   * @param {string} id 分类ID
   * @param {object} categoryData 分类数据
   * @param {string} categoryData.name 分类名称
   * @param {string} categoryData.icon 分类图标
   * @param {string} categoryData.color 分类颜色
   */
  update(id, categoryData) {
    return request(`/api/categories/${id}`, 'PUT', categoryData);
  },

  /**
   * 删除分类
   * @param {string} id 分类ID
   */
  delete(id) {
    return request(`/api/categories/${id}`, 'DELETE');
  }
};

// 图书相关API
const books = {
  /**
   * 获取图书列表
   * @param {object} params 查询参数
   * @param {number} params.page 页码
   * @param {number} params.pageSize 每页数量
   * @param {string} params.category 分类ID
   */
  getList(params = {}) {
    // 特殊处理uncategorized分类
    if (params.category === 'uncategorized') {
      // 使用专门的未分类接口
      return request('/api/books/uncategorized', 'GET', {
        page: params.page,
        limit: params.pageSize,
        orderBy: params.orderBy,
        order: params.order
      }).then(response => {
        // 确保返回数组
        if (Array.isArray(response)) {
          console.log('服务器直接返回未分类书籍数组:', response.length, '条记录');
          return response;
        }
        
        // 兜底返回空数组
        console.warn('未分类图书API响应格式异常:', response);
        return [];
      });
    }
    
    return request('/api/books', 'GET', params)
      .then(response => {
        // 处理服务器返回的分页格式
        if (response && response.books && Array.isArray(response.books)) {
          console.log('服务器返回书籍数据:', response.books.length, '条记录');
          return response.books;
        }
        
        // 如果直接返回的是数组，直接使用
        if (Array.isArray(response)) {
          console.log('服务器直接返回书籍数组:', response.length, '条记录');
          return response;
        }
        
        // 兜底返回空数组
        console.warn('API响应格式异常，既不是数组也不包含books数组:', response);
        return [];
      });
  },

  /**
   * 搜索图书
   * @param {string} query 搜索关键词
   */
  search(query) {
    return request('/api/books/search', 'GET', { keyword: query })
      .then(response => {
        // 确保返回数组
        if (Array.isArray(response)) {
          return response;
        }
        console.warn('搜索API返回格式异常:', response);
        return [];
      });
  },

  /**
   * 获取单本图书详情
   * @param {string} id 图书ID
   */
  getDetail(id) {
    return request(`/api/books/${id}`);
  },

  /**
   * 添加图书
   * @param {object} bookData 图书数据
   */
  add(bookData) {
    return request('/api/books', 'POST', bookData);
  },

  /**
   * 更新图书
   * @param {string} id 图书ID
   * @param {object} bookData 图书数据
   */
  update(id, bookData) {
    return request(`/api/books/${id}`, 'PUT', bookData);
  },

  /**
   * 删除图书
   * @param {string} id 图书ID
   */
  delete(id) {
    return request(`/api/books/${id}`, 'DELETE');
  }
};

module.exports = {
  categories,
  books
}; 
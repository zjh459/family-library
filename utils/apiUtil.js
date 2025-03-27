// apiUtil.js
// 用于与MySQL服务器通信的API工具类

const config = require('../../config');

/**
 * API请求工具类
 * 当useApi设置为true时，使用此类来替代云数据库操作
 */
class ApiUtil {
  /**
   * 发送请求到服务器API
   * @param {string} url - API端点
   * @param {string} method - 请求方法（GET, POST, PUT, DELETE）
   * @param {Object} data - 要发送的数据
   * @returns {Promise} - 请求的响应
   */
  static async request(url, method = 'GET', data = {}) {
    try {
      // 获取服务器API基础URL
      const baseUrl = config.server.url;
      // 构建完整URL
      const fullUrl = `${baseUrl}${url}`;
      
      // 准备请求参数
      const options = {
        url: fullUrl,
        method,
        header: {
          'content-type': 'application/json'
        }
      };
      
      // 如果有数据，添加到请求中
      if (method !== 'GET' && Object.keys(data).length > 0) {
        options.data = data;
      } else if (method === 'GET' && Object.keys(data).length > 0) {
        // GET请求将参数添加到URL中
        const queryString = Object.keys(data)
          .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(data[key])}`)
          .join('&');
        options.url = `${fullUrl}?${queryString}`;
      }
      
      // 发送请求
      return new Promise((resolve, reject) => {
        wx.request({
          ...options,
          success(res) {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(res.data);
            } else {
              reject({
                statusCode: res.statusCode,
                message: res.data.message || '请求失败'
              });
            }
          },
          fail(err) {
            reject({
              statusCode: 500,
              message: err.errMsg || '网络错误，请检查网络连接'
            });
          }
        });
      });
    } catch (error) {
      console.error('API请求错误:', error);
      throw error;
    }
  }
  
  // ------------ 分类API ------------
  
  /**
   * 获取所有分类
   * @returns {Promise<Array>} 分类列表
   */
  static async getCategories() {
    return this.request('/api/categories');
  }
  
  /**
   * 获取特定分类
   * @param {number} id - 分类ID
   * @returns {Promise<Object>} 分类信息
   */
  static async getCategory(id) {
    return this.request(`/api/categories/${id}`);
  }
  
  /**
   * 添加新分类
   * @param {Object} category - 分类数据
   * @returns {Promise<Object>} 添加的分类
   */
  static async addCategory(category) {
    return this.request('/api/categories', 'POST', category);
  }
  
  /**
   * 更新分类
   * @param {number} id - 分类ID
   * @param {Object} category - 更新的分类数据
   * @returns {Promise<Object>} 更新后的分类
   */
  static async updateCategory(id, category) {
    return this.request(`/api/categories/${id}`, 'PUT', category);
  }
  
  /**
   * 删除分类
   * @param {number} id - 要删除的分类ID
   * @returns {Promise<Object>} 操作结果
   */
  static async deleteCategory(id) {
    return this.request(`/api/categories/${id}`, 'DELETE');
  }
  
  // ------------ 图书API ------------
  
  /**
   * 获取所有图书
   * @param {Object} query - 查询参数
   * @returns {Promise<Array>} 图书列表
   */
  static async getBooks(query = {}) {
    return this.request('/api/books', 'GET', query);
  }
  
  /**
   * 根据分类获取图书
   * @param {number} categoryId - 分类ID
   * @returns {Promise<Array>} 该分类下的图书列表
   */
  static async getBooksByCategory(categoryId) {
    return this.request('/api/books', 'GET', { category_id: categoryId });
  }
  
  /**
   * 获取特定图书
   * @param {number} id - 图书ID
   * @returns {Promise<Object>} 图书信息
   */
  static async getBook(id) {
    return this.request(`/api/books/${id}`);
  }
  
  /**
   * 搜索图书
   * @param {string} keyword - 搜索关键词
   * @returns {Promise<Array>} 搜索结果
   */
  static async searchBooks(keyword) {
    return this.request('/api/books/search', 'GET', { keyword });
  }
  
  /**
   * 添加新图书
   * @param {Object} book - 图书数据
   * @returns {Promise<Object>} 添加的图书
   */
  static async addBook(book) {
    return this.request('/api/books', 'POST', book);
  }
  
  /**
   * 更新图书
   * @param {number} id - 图书ID
   * @param {Object} book - 更新的图书数据
   * @returns {Promise<Object>} 更新后的图书
   */
  static async updateBook(id, book) {
    return this.request(`/api/books/${id}`, 'PUT', book);
  }
  
  /**
   * 删除图书
   * @param {number} id - 要删除的图书ID
   * @returns {Promise<Object>} 操作结果
   */
  static async deleteBook(id) {
    return this.request(`/api/books/${id}`, 'DELETE');
  }
}

module.exports = ApiUtil; 
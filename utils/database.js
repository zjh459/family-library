// database.js
// 统一的数据库操作接口，支持云开发和MySQL API两种模式

const config = require('../utils/config');
const api = require('./api');
const app = getApp();

/**
 * 数据库服务类
 * 提供统一的数据库操作接口，根据配置自动切换云数据库或MySQL API
 */
class Database {
  /**
   * 获取所有分类
   * @returns {Promise<Array>} 分类列表
   */
  static async getCategories() {
    try {
      if (app.globalData.useApi) {
        // 使用API获取分类
        const result = await api.categories.getAll();
        // 确保返回数组
        if (!Array.isArray(result)) {
          console.warn('API返回的分类数据不是数组:', result);
          return [];
        }
        return result;
      } else {
        // 使用云数据库获取分类
        const db = wx.cloud.database();
        const result = await db.collection('categories').get();
        return result.data;
      }
    } catch (error) {
      console.error('获取分类失败:', error);
      return []; // 出错时返回空数组而不是抛出异常
    }
  }
  
  /**
   * 获取特定分类
   * @param {string|number} id - 分类ID
   * @returns {Promise<Object>} 分类信息
   */
  static async getCategory(id) {
    try {
      if (app.globalData.useApi) {
        // 使用API获取分类
        const result = await api.categories.getOne(id);
        return result;
      } else {
        // 使用云数据库获取分类
        const db = wx.cloud.database();
        const result = await db.collection('categories').doc(id).get();
        return result.data;
      }
    } catch (error) {
      console.error(`获取分类(ID:${id})失败:`, error);
      throw error;
    }
  }
  
  /**
   * 添加新分类
   * @param {Object} category - 分类数据
   * @returns {Promise<Object>} 添加的分类
   */
  static async addCategory(category) {
    try {
      if (app.globalData.useApi) {
        // 使用API添加分类
        const result = await api.categories.add(category);
        return result;
      } else {
        // 使用云数据库添加分类
        const db = wx.cloud.database();
        const result = await db.collection('categories').add({
          data: category
        });
        return { ...category, _id: result._id };
      }
    } catch (error) {
      console.error('添加分类失败:', error);
      throw error;
    }
  }
  
  /**
   * 更新分类
   * @param {string|number} id - 分类ID
   * @param {Object} category - 更新的分类数据
   * @returns {Promise<Object>} 更新后的分类
   */
  static async updateCategory(id, category) {
    try {
      if (app.globalData.useApi) {
        // 使用API更新分类
        const result = await api.categories.update(id, category);
        return result;
      } else {
        // 使用云数据库更新分类
        const db = wx.cloud.database();
        await db.collection('categories').doc(id).update({
          data: category
        });
        return { ...category, _id: id };
      }
    } catch (error) {
      console.error(`更新分类(ID:${id})失败:`, error);
      throw error;
    }
  }
  
  /**
   * 删除分类
   * @param {string|number} id - 要删除的分类ID
   * @returns {Promise<Object>} 操作结果
   */
  static async deleteCategory(id) {
    try {
      if (app.globalData.useApi) {
        // 使用API删除分类
        const result = await api.categories.delete(id);
        return result;
      } else {
        // 使用云数据库删除分类
        const db = wx.cloud.database();
        await db.collection('categories').doc(id).remove();
        return { success: true };
      }
    } catch (error) {
      console.error(`删除分类(ID:${id})失败:`, error);
      throw error;
    }
  }
  
  /**
   * 获取所有图书
   * @param {Object} query - 查询参数
   * @returns {Promise<Array>} 图书列表
   */
  static async getBooks(query = {}) {
    try {
      if (app.globalData.useApi) {
        // 使用API获取图书
        const result = await api.books.getList(query);
        // 确保返回数组
        if (!Array.isArray(result)) {
          console.warn('API返回的图书数据不是数组:', result);
          return [];
        }
        return result;
      } else {
        // 使用云数据库获取图书
        const db = wx.cloud.database();
        const _ = db.command;
        let dbQuery = db.collection('books');
        
        // 处理查询条件
        if (query.category) {
          dbQuery = dbQuery.where({
            category_id: query.category
          });
        }
        
        const result = await dbQuery.get();
        return result.data;
      }
    } catch (error) {
      console.error('获取图书列表失败:', error);
      return []; // 出错时返回空数组而不是抛出异常
    }
  }
  
  /**
   * 根据分类获取图书
   * @param {string|number} categoryId - 分类ID
   * @returns {Promise<Array>} 该分类下的图书列表
   */
  static async getBooksByCategory(categoryId) {
    try {
      if (app.globalData.useApi) {
        // 使用API获取分类下的图书
        const result = await api.books.getList({ category: categoryId });
        // 确保返回数组
        if (!Array.isArray(result)) {
          console.warn('API返回的分类图书数据不是数组:', result);
          return [];
        }
        return result;
      } else {
        // 使用云数据库获取分类下的图书
        const db = wx.cloud.database();
        const result = await db.collection('books')
          .where({ category_id: categoryId })
          .get();
        return result.data;
      }
    } catch (error) {
      console.error(`获取分类(ID:${categoryId})下的图书失败:`, error);
      return []; // 出错时返回空数组而不是抛出异常
    }
  }
  
  /**
   * 获取特定图书
   * @param {string|number} id - 图书ID
   * @returns {Promise<Object>} 图书信息
   */
  static async getBook(id) {
    try {
      if (app.globalData.useApi) {
        // 使用API获取图书
        const result = await api.books.getDetail(id);
        return result;
      } else {
        // 使用云数据库获取图书
        const db = wx.cloud.database();
        const result = await db.collection('books').doc(id).get();
        return result.data;
      }
    } catch (error) {
      console.error(`获取图书(ID:${id})失败:`, error);
      throw error;
    }
  }
  
  /**
   * 搜索图书
   * @param {string} keyword - 搜索关键词
   * @returns {Promise<Array>} 搜索结果
   */
  static async searchBooks(keyword) {
    try {
      if (app.globalData.useApi) {
        // 使用API搜索图书
        const result = await api.books.search(keyword);
        // 确保返回数组
        if (!Array.isArray(result)) {
          console.warn('API搜索返回的图书数据不是数组:', result);
          return [];
        }
        return result;
      } else {
        // 使用云数据库搜索图书
        const db = wx.cloud.database();
        const _ = db.command;
        const result = await db.collection('books')
          .where(_.or([
            { title: db.RegExp({ regexp: keyword, options: 'i' }) },
            { author: db.RegExp({ regexp: keyword, options: 'i' }) }
          ]))
          .get();
        return result.data;
      }
    } catch (error) {
      console.error(`搜索图书(关键词:${keyword})失败:`, error);
      return []; // 出错时返回空数组而不是抛出异常
    }
  }
  
  /**
   * 添加新图书
   * @param {Object} book - 图书数据
   * @returns {Promise<Object>} 添加的图书
   */
  static async addBook(book) {
    try {
      if (app.globalData.useApi) {
        // 使用API添加图书
        const result = await api.books.add(book);
        return result;
      } else {
        // 使用云数据库添加图书
        const db = wx.cloud.database();
        const result = await db.collection('books').add({
          data: book
        });
        return { ...book, _id: result._id };
      }
    } catch (error) {
      console.error('添加图书失败:', error);
      throw error;
    }
  }
  
  /**
   * 更新图书
   * @param {string|number} id - 图书ID
   * @param {Object} book - 更新的图书数据
   * @returns {Promise<Object>} 更新后的图书
   */
  static async updateBook(id, book) {
    try {
      if (app.globalData.useApi) {
        // 使用API更新图书
        const result = await api.books.update(id, book);
        return result;
      } else {
        // 使用云数据库更新图书
        const db = wx.cloud.database();
        await db.collection('books').doc(id).update({
          data: book
        });
        return { ...book, _id: id };
      }
    } catch (error) {
      console.error(`更新图书(ID:${id})失败:`, error);
      throw error;
    }
  }
  
  /**
   * 删除图书
   * @param {string|number} id - 要删除的图书ID
   * @returns {Promise<Object>} 操作结果
   */
  static async deleteBook(id) {
    try {
      if (app.globalData.useApi) {
        // 使用API删除图书
        const result = await api.books.delete(id);
        return result;
      } else {
        // 使用云数据库删除图书
        const db = wx.cloud.database();
        await db.collection('books').doc(id).remove();
        return { success: true };
      }
    } catch (error) {
      console.error(`删除图书(ID:${id})失败:`, error);
      throw error;
    }
  }

  /**
   * 同步所有分类的计数
   * @returns {Promise<boolean>} 操作结果
   */
  static async syncCategoriesCount() {
    try {
      if (app.globalData.useApi) {
        // 使用API同步分类计数
        // 目前在MySQL API模式下，这个操作是自动的，不需要额外操作
        return true;
      } else {
        // 使用云数据库同步计数
        const db = wx.cloud.database();
        const _ = db.command;
        
        // 1. 获取所有分类
        const categories = await db.collection('categories').get();
        
        // 2. 获取所有书籍的分类信息
        const books = await db.collection('books').field({
          categories: true,
          category: true
        }).get();
        
        // 3. 统计每个分类的书籍数量
        const categoryCount = {};
        
        // 初始化所有分类的计数为0
        categories.data.forEach(category => {
          categoryCount[category._id] = 0;
        });
        
        // 统计每本书的分类
        books.data.forEach(book => {
          if (book.categories && Array.isArray(book.categories)) {
            // 使用新的categories数组
            book.categories.forEach(categoryId => {
              if (categoryCount[categoryId] !== undefined) {
                categoryCount[categoryId]++;
              }
            });
          } else if (book.category) {
            // 使用旧的category字段
            if (categoryCount[book.category] !== undefined) {
              categoryCount[book.category]++;
            }
          }
        });
        
        // 4. 更新每个分类的计数
        const updatePromises = categories.data.map(category => {
          return db.collection('categories').doc(category._id).update({
            data: {
              count: categoryCount[category._id] || 0
            }
          });
        });
        
        await Promise.all(updatePromises);
        return true;
      }
    } catch (error) {
      console.error('同步分类计数失败:', error);
      throw error;
    }
  }
}

module.exports = Database; 
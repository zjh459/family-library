/**
 * MySQL数据库适配器
 * 提供类似云开发的API接口，但实际使用自定义API
 */
const api = require('./api');

// 处理ID映射
function mapId(id) {
  if (!id) return id;
  
  // 检查是否为旧的云数据库ID
  try {
    const idMapping = wx.getStorageSync('id_mapping') || {};
    if (idMapping[id]) {
      console.log('使用ID映射:', id, '->', idMapping[id]);
      return idMapping[id];
    }
  } catch (e) {
    console.error('获取ID映射失败:', e);
  }
  
  return id;
}

// 数据库操作适配器
const mysqlAdapter = {
  // 获取所有图书
  getAllBooks() {
    return api.getAllBooks();
  },
  
  // 获取图书详情
  getBook(id) {
    const mappedId = mapId(id);
    return api.getBook(mappedId);
  },
  
  // 添加图书
  addBook(book) {
    return api.addBook(book);
  },
  
  // 更新图书
  updateBook(id, data) {
    const mappedId = mapId(id);
    return api.updateBook(mappedId, data);
  },
  
  // 删除图书
  deleteBook(id) {
    const mappedId = mapId(id);
    return api.deleteBook(mappedId);
  },
  
  // 获取分类统计
  getCategoriesStatistics() {
    return api.getCategoriesStatistics();
  },
  
  // 兼容云开发的数据库操作
  database() {
    return {
      collection(collectionName) {
        return {
          // 获取单条记录
          doc(id) {
            const mappedId = mapId(id);
            
            return {
              get(options = {}) {
                const promise = new Promise((resolve, reject) => {
                  if (collectionName === 'books') {
                    api.getBook(mappedId)
                      .then(result => {
                        if (result.success && result.data) {
                          resolve({ data: result.data });
                        } else {
                          reject(new Error('未找到记录'));
                        }
                      })
                      .catch(err => {
                        if (options.fail) options.fail(err);
                        reject(err);
                      });
                  } else if (collectionName === 'categories') {
                    // 暂不实现分类的单个获取
                    reject(new Error('不支持的操作'));
                  } else {
                    reject(new Error('不支持的集合'));
                  }
                });
                
                // 兼容回调和Promise两种方式
                if (options.success || options.fail) {
                  promise
                    .then(res => { if (options.success) options.success(res); })
                    .catch(err => { if (options.fail) options.fail(err); });
                  return;
                }
                
                return promise;
              },
              
              // 更新记录
              update(options = {}) {
                const promise = new Promise((resolve, reject) => {
                  if (collectionName === 'books') {
                    api.updateBook(mappedId, options.data)
                      .then(result => {
                        if (result.success) {
                          resolve(result);
                        } else {
                          reject(new Error(result.message || '更新失败'));
                        }
                      })
                      .catch(err => {
                        if (options.fail) options.fail(err);
                        reject(err);
                      });
                  } else if (collectionName === 'categories') {
                    // 暂不实现分类的更新
                    reject(new Error('不支持的操作'));
                  } else {
                    reject(new Error('不支持的集合'));
                  }
                });
                
                // 兼容回调和Promise两种方式
                if (options.success || options.fail) {
                  promise
                    .then(res => { if (options.success) options.success(res); })
                    .catch(err => { if (options.fail) options.fail(err); });
                  return;
                }
                
                return promise;
              },
              
              // 删除记录
              remove(options = {}) {
                const promise = new Promise((resolve, reject) => {
                  if (collectionName === 'books') {
                    api.deleteBook(mappedId)
                      .then(result => {
                        if (result.success) {
                          resolve(result);
                        } else {
                          reject(new Error(result.message || '删除失败'));
                        }
                      })
                      .catch(err => {
                        if (options.fail) options.fail(err);
                        reject(err);
                      });
                  } else if (collectionName === 'categories') {
                    // 暂不实现分类的删除
                    reject(new Error('不支持的操作'));
                  } else {
                    reject(new Error('不支持的集合'));
                  }
                });
                
                // 兼容回调和Promise两种方式
                if (options.success || options.fail) {
                  promise
                    .then(res => { if (options.success) options.success(res); })
                    .catch(err => { if (options.fail) options.fail(err); });
                  return;
                }
                
                return promise;
              }
            };
          },
          
          // 获取记录列表
          get(options = {}) {
            const promise = new Promise((resolve, reject) => {
              if (collectionName === 'books') {
                api.getAllBooks()
                  .then(result => {
                    if (result.success) {
                      resolve({ data: result.data });
                    } else {
                      reject(new Error(result.message || '获取记录失败'));
                    }
                  })
                  .catch(err => {
                    if (options.fail) options.fail(err);
                    reject(err);
                  });
              } else if (collectionName === 'categories') {
                api.getCategoriesStatistics()
                  .then(result => {
                    if (result.success) {
                      resolve({ data: result.data });
                    } else {
                      reject(new Error(result.message || '获取记录失败'));
                    }
                  })
                  .catch(err => {
                    if (options.fail) options.fail(err);
                    reject(err);
                  });
              } else {
                reject(new Error('不支持的集合'));
              }
            });
            
            // 兼容回调和Promise两种方式
            if (options.success || options.fail) {
              promise
                .then(res => { if (options.success) options.success(res); })
                .catch(err => { if (options.fail) options.fail(err); });
              return;
            }
            
            return promise;
          },
          
          // 添加记录
          add(options = {}) {
            const promise = new Promise((resolve, reject) => {
              if (collectionName === 'books') {
                api.addBook(options.data)
                  .then(result => {
                    if (result.success) {
                      resolve({ _id: result.data.id });
                    } else {
                      reject(new Error(result.message || '添加记录失败'));
                    }
                  })
                  .catch(err => {
                    if (options.fail) options.fail(err);
                    reject(err);
                  });
              } else if (collectionName === 'categories') {
                api.addCategory(options.data)
                  .then(result => {
                    if (result.success) {
                      resolve({ _id: result.data.id });
                    } else {
                      reject(new Error(result.message || '添加记录失败'));
                    }
                  })
                  .catch(err => {
                    if (options.fail) options.fail(err);
                    reject(err);
                  });
              } else {
                reject(new Error('不支持的集合'));
              }
            });
            
            // 兼容回调和Promise两种方式
            if (options.success || options.fail) {
              promise
                .then(res => { if (options.success) options.success(res); })
                .catch(err => { if (options.fail) options.fail(err); });
              return;
            }
            
            return promise;
          },
          
          // where查询条件
          where(condition) {
            let whereCondition = condition;
            return {
              get(options = {}) {
                const promise = new Promise((resolve, reject) => {
                  // 目前的API不支持复杂条件查询，所以先获取所有数据然后在前端过滤
                  if (collectionName === 'books') {
                    api.getAllBooks()
                      .then(result => {
                        if (result.success) {
                          // 前端过滤
                          let filteredData = result.data;
                          
                          // 简单条件过滤
                          Object.keys(whereCondition).forEach(key => {
                            filteredData = filteredData.filter(item => {
                              if (key === 'categories' && Array.isArray(item.categories)) {
                                return item.categories.includes(whereCondition[key]);
                              }
                              return item[key] === whereCondition[key];
                            });
                          });
                          
                          resolve({ data: filteredData });
                        } else {
                          reject(new Error(result.message || '查询失败'));
                        }
                      })
                      .catch(err => {
                        if (options.fail) options.fail(err);
                        reject(err);
                      });
                  } else if (collectionName === 'categories') {
                    api.getCategoriesStatistics()
                      .then(result => {
                        if (result.success) {
                          // 前端过滤
                          let filteredData = result.data;
                          
                          // 简单条件过滤
                          Object.keys(whereCondition).forEach(key => {
                            filteredData = filteredData.filter(item => {
                              if (key === 'name') {
                                return item.category_name === whereCondition[key];
                              }
                              return item[key] === whereCondition[key];
                            });
                          });
                          
                          resolve({ data: filteredData });
                        } else {
                          reject(new Error(result.message || '查询失败'));
                        }
                      })
                      .catch(err => {
                        if (options.fail) options.fail(err);
                        reject(err);
                      });
                  } else {
                    reject(new Error('不支持的集合'));
                  }
                });
                
                // 兼容回调和Promise两种方式
                if (options.success || options.fail) {
                  promise
                    .then(res => { if (options.success) options.success(res); })
                    .catch(err => { if (options.fail) options.fail(err); });
                  return;
                }
                
                return promise;
              },
              
              // count查询
              count(options = {}) {
                const promise = new Promise((resolve, reject) => {
                  // 目前的API不支持复杂条件查询，所以先获取所有数据然后在前端过滤
                  if (collectionName === 'books') {
                    api.getAllBooks()
                      .then(result => {
                        if (result.success) {
                          // 前端过滤
                          let filteredData = result.data;
                          
                          // 简单条件过滤
                          Object.keys(whereCondition).forEach(key => {
                            filteredData = filteredData.filter(item => {
                              if (key === 'categories' && Array.isArray(item.categories)) {
                                return item.categories.includes(whereCondition[key]);
                              }
                              return item[key] === whereCondition[key];
                            });
                          });
                          
                          resolve({ total: filteredData.length });
                        } else {
                          reject(new Error(result.message || '查询失败'));
                        }
                      })
                      .catch(err => {
                        if (options.fail) options.fail(err);
                        reject(err);
                      });
                  } else if (collectionName === 'categories') {
                    api.getCategoriesStatistics()
                      .then(result => {
                        if (result.success) {
                          // 前端过滤
                          let filteredData = result.data;
                          
                          // 简单条件过滤
                          Object.keys(whereCondition).forEach(key => {
                            filteredData = filteredData.filter(item => {
                              if (key === 'name') {
                                return item.category_name === whereCondition[key];
                              }
                              return item[key] === whereCondition[key];
                            });
                          });
                          
                          resolve({ total: filteredData.length });
                        } else {
                          reject(new Error(result.message || '查询失败'));
                        }
                      })
                      .catch(err => {
                        if (options.fail) options.fail(err);
                        reject(err);
                      });
                  } else {
                    reject(new Error('不支持的集合'));
                  }
                });
                
                // 兼容回调和Promise两种方式
                if (options.success || options.fail) {
                  promise
                    .then(res => { if (options.success) options.success(res); })
                    .catch(err => { if (options.fail) options.fail(err); });
                  return;
                }
                
                return promise;
              },
              
              // 只返回指定字段
              field(fields) {
                return {
                  get(options = {}) {
                    const promise = new Promise((resolve, reject) => {
                      // 目前的API不支持字段筛选，所以先获取所有数据然后在前端处理
                      if (collectionName === 'books') {
                        api.getAllBooks()
                          .then(result => {
                            if (result.success) {
                              // 前端过滤条件
                              let filteredData = result.data;
                              
                              // 简单条件过滤
                              Object.keys(whereCondition).forEach(key => {
                                filteredData = filteredData.filter(item => {
                                  if (key === 'categories' && Array.isArray(item.categories)) {
                                    return item.categories.includes(whereCondition[key]);
                                  }
                                  return item[key] === whereCondition[key];
                                });
                              });
                              
                              // 字段筛选
                              if (typeof fields === 'object') {
                                filteredData = filteredData.map(item => {
                                  const newItem = {};
                                  Object.keys(fields).forEach(key => {
                                    if (fields[key]) {
                                      newItem[key] = item[key];
                                    }
                                  });
                                  return newItem;
                                });
                              }
                              
                              resolve({ data: filteredData });
                            } else {
                              reject(new Error(result.message || '查询失败'));
                            }
                          })
                          .catch(err => {
                            if (options.fail) options.fail(err);
                            reject(err);
                          });
                      } else if (collectionName === 'categories') {
                        api.getCategoriesStatistics()
                          .then(result => {
                            if (result.success) {
                              // 前端过滤条件
                              let filteredData = result.data;
                              
                              // 简单条件过滤
                              Object.keys(whereCondition).forEach(key => {
                                filteredData = filteredData.filter(item => {
                                  if (key === 'name') {
                                    return item.category_name === whereCondition[key];
                                  }
                                  return item[key] === whereCondition[key];
                                });
                              });
                              
                              // 字段筛选
                              if (typeof fields === 'object') {
                                filteredData = filteredData.map(item => {
                                  const newItem = {};
                                  Object.keys(fields).forEach(key => {
                                    if (fields[key]) {
                                      newItem[key] = item[key];
                                    }
                                  });
                                  return newItem;
                                });
                              }
                              
                              resolve({ data: filteredData });
                            } else {
                              reject(new Error(result.message || '查询失败'));
                            }
                          })
                          .catch(err => {
                            if (options.fail) options.fail(err);
                            reject(err);
                          });
                      } else {
                        reject(new Error('不支持的集合'));
                      }
                    });
                    
                    // 兼容回调和Promise两种方式
                    if (options.success || options.fail) {
                      promise
                        .then(res => { if (options.success) options.success(res); })
                        .catch(err => { if (options.fail) options.fail(err); });
                      return;
                    }
                    
                    return promise;
                  }
                };
              }
            };
          }
        };
      }
    };
  }
};

// 服务器日期
mysqlAdapter.serverDate = function() {
  return new Date();
};

module.exports = mysqlAdapter; 
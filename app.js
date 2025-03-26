// app.js
const config = require('./config');

App({
  onLaunch() {
    // 初始化云开发
    if (wx.cloud) {
      wx.cloud.init({
        env: config.cloud.env, // 从配置文件读取云环境ID
        traceUser: true,
      });
    } else {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
    }
    
    // 初始化本地存储
    this.initStorage();
    
    // 从云数据库同步图书数据
    this.syncBooksFromCloud().then(() => {
      // 同步完成后，更新所有分类的计数
      this.syncCategoriesCount();
      // 检查并修复所有图书的分类数据结构
      this.fixBookCategoriesData();
      // 修复分类数据中的ID和名称混用问题
      this.fixBookCategoriesIDNameMismatch();
    });
  },

  globalData: {
    userInfo: null,
    books: [],
    theme: {
      primaryColor: '#FFF5E6',    // 主色（主背景/大面积留白）
      secondaryColor: '#C8D8C7',  // 辅助色（次级背景/模块容器）
      accentColor: '#FFA07A',     // 点缀色（按钮/高亮图标）
      textColor: '#4A3F35',       // 文字色（正文文字/深色控件）
      highlightColor: '#C8D8C7',  // 高亮色(使用辅助色)
      borderRadius: '8px'         // 圆角大小
    }
  },

  // 初始化本地存储
  initStorage() {
    const books = wx.getStorageSync('books');
    if (!books) {
      wx.setStorageSync('books', []);
    } else {
      this.globalData.books = books;
    }
  },

  // 从云数据库同步图书数据
  syncBooksFromCloud() {
    if (!wx.cloud) return Promise.resolve();
    
    return new Promise((resolve, reject) => {
      wx.cloud.database().collection('books').get({
        success: res => {
          if (res.data && res.data.length > 0) {
            // 将云数据与本地数据合并（以云数据为准）
            const cloudBooks = res.data.map(book => ({
              ...book,
              id: book._id // 确保云端的_id映射到本地的id
            }));
            
            this.globalData.books = cloudBooks;
            this.saveBooks();
          }
          resolve();
        },
        fail: err => {
          console.error('从云端同步图书失败', err);
          reject(err);
        }
      });
    });
  },

  // 保存所有书籍到本地
  saveBooks() {
    wx.setStorageSync('books', this.globalData.books);
  },

  // 添加书籍
  addBook(book) {
    const now = new Date();
    
    // 如果没有id，生成一个临时id
    if (!book.id) {
      book.id = `book_${now.getTime()}`;
    }
    
    book.addTime = book.addTime || now.getTime();
    book.borrowStatus = book.borrowStatus || 'in'; // 默认在库
    
    this.globalData.books.unshift(book); // 新书放在最前面
    this.saveBooks();
    return book.id;
  },

  // 更新书籍
  updateBook(bookId, updatedInfo) {
    console.log('开始更新书籍，ID:', bookId, '更新信息:', updatedInfo);
    
    // 支持根据id或_id查找书籍
    const index = this.globalData.books.findIndex(book => book.id === bookId || book._id === bookId);
    
    console.log('在全局数据中查找书籍索引:', index);
    
    if (index !== -1) {
      console.log('找到书籍，开始更新');
      
      this.globalData.books[index] = {
        ...this.globalData.books[index],
        ...updatedInfo
      };
      this.saveBooks();
      
      console.log('已更新本地数据');
      
      // 同步更新到云数据库
      if (wx.cloud) {
        const cloudId = bookId.startsWith('book_') ? null : bookId;
        if (cloudId) {
          // 排除系统字段，避免Invalid Key Name错误
          const { _openid, _id, ...cloudSafeData } = updatedInfo;
          
          console.log('开始更新云数据库，ID:', cloudId);
          
          wx.cloud.database().collection('books').doc(cloudId).update({
            data: cloudSafeData,
            success: res => {
              console.log('更新云数据库成功:', res);
            },
            fail: err => {
              console.error('更新云数据库失败', err);
            }
          });
        }
      }
      
      return true;
    }
    
    console.error('未找到要更新的书籍，ID:', bookId);
    return false;
  },

  // 删除书籍
  deleteBook(bookId) {
    console.log('尝试删除书籍，ID:', bookId);
    
    // 规范化ID
    const normalizedId = bookId.toString().trim();
    
    const index = this.globalData.books.findIndex(book => 
      (book.id && book.id.toString() === normalizedId) || 
      (book._id && book._id.toString() === normalizedId)
    );
    
    console.log('在全局数据中查找书籍索引:', index);
    
    // 定义删除云数据库中书籍的函数
    const deleteFromCloud = (id) => {
      if (!wx.cloud || !id || id.indexOf('book_') === 0) {
        return Promise.resolve(false);
      }
      
      console.log('开始从云数据库删除书籍:', id);
      
      return new Promise((resolve, reject) => {
        wx.cloud.database().collection('books').doc(id).remove({
          success: res => {
            console.log('从云数据库删除成功:', res);
            resolve(true);
          },
          fail: err => {
            console.error('从云数据库删除失败', err);
            
            // 如果是因为记录不存在导致的错误，也视为成功
            if (err.errCode === -1 || err.errMsg.includes('not exist') || err.errMsg.includes('not found')) {
              console.warn('云数据库可能已不存在此记录，继续视为已删除');
              resolve(true);
              return;
            }
            
            reject(err);
          }
        });
      });
    };
    
    // 如果在本地找到了书籍
    if (index !== -1) {
      // 获取书籍的分类信息，用于后续更新分类计数
      const bookCategories = this.globalData.books[index].categories || [];
      const bookCategory = this.globalData.books[index].category;
      
      // 合并所有分类
      const allCategories = [...new Set([...(bookCategories || []), bookCategory].filter(Boolean))];
      
      // 先从本地删除
      const deletedBook = this.globalData.books.splice(index, 1)[0];
      this.saveBooks();
      
      console.log('已从本地删除书籍:', deletedBook);
      
      // 更新分类计数
      this.updateCategoryCountsAfterDeletion(allCategories);
      
      // 同步从云数据库删除
      if (wx.cloud && normalizedId.indexOf('book_') !== 0) {
        console.log('开始从云数据库删除书籍:', normalizedId);
        
        // 返回Promise以便等待删除完成
        return deleteFromCloud(normalizedId)
          .then(success => {
            // 如果有封面图片存储在云存储中，也一并删除
            if (deletedBook.coverUrl && deletedBook.coverUrl.indexOf('cloud://') === 0) {
              return new Promise((resolve) => {
                wx.cloud.deleteFile({
                  fileList: [deletedBook.coverUrl],
                  success: fileRes => {
                    console.log('删除云存储图片成功:', fileRes);
                  },
                  fail: err => {
                    console.error('删除云存储图片失败', err);
                  },
                  complete: () => {
                    resolve(true);
                  }
                });
              });
            }
            return Promise.resolve(true);
          })
          .then(() => true)
          .catch(err => {
            console.error('删除过程中发生错误:', err);
            return true; // 即使出错，也返回true，因为本地已删除
          });
      }
      
      return true;
    } else {
      console.warn('在本地未找到要删除的书籍，尝试直接从云数据库删除, ID:', normalizedId);
      
      // 先获取书籍信息以获取分类
      if (wx.cloud && normalizedId.indexOf('book_') !== 0) {
        return wx.cloud.database().collection('books')
          .doc(normalizedId)
          .get()
          .then(res => {
            if (res.data) {
              const bookCategories = res.data.categories || [];
              const bookCategory = res.data.category;
              const allCategories = [...new Set([...(bookCategories || []), bookCategory].filter(Boolean))];
              
              // 先删除书籍
              return deleteFromCloud(normalizedId)
                .then(() => {
                  console.log('成功从云数据库删除书籍:', normalizedId);
                  // 删除成功后更新分类计数
                  this.updateCategoryCountsAfterDeletion(allCategories);
                  this.syncBooksFromCloud(); // 重新同步本地数据
                  return true;
                });
            } else {
              return Promise.reject(new Error('未找到书籍信息'));
            }
          })
          .catch(err => {
            console.error('无法从云数据库删除书籍:', err);
            return deleteFromCloud(normalizedId)
              .then(() => {
                console.log('仍然尝试删除并成功');
                this.syncBooksFromCloud();
                return true;
              })
              .catch(() => false);
          });
      }
      
      console.error('未找到要删除的书籍，无法删除, ID:', normalizedId);
      return false;
    }
  },
  
  // 更新删除书籍后的分类计数
  updateCategoryCountsAfterDeletion(categories) {
    if (!categories || !categories.length) return;
    
    console.log('更新被删除书籍相关的分类计数:', categories);
    
    const db = wx.cloud.database();
    
    // 对每个分类进行处理
    categories.forEach(categoryName => {
      if (!categoryName) return;
      
      // 查询该分类下现在还有多少书籍，使用直接匹配，而不是db.command.all
      db.collection('books')
        .where({
          categories: categoryName
        })
        .count()
        .then(res => {
          // 获取该分类的实际图书数量
          const actualCount = res.total;
          console.log(`分类[${categoryName}]的实际图书数量:`, actualCount);
          
          // 输出更详细的日志
          db.collection('books')
            .where({
              categories: categoryName
            })
            .get()
            .then(booksRes => {
              console.log(`分类[${categoryName}]包含的图书:`, 
                booksRes.data.map(b => b.title));
            });
          
          // 更新数据库中的计数
          db.collection('categories')
            .where({
              name: categoryName
            })
            .get()
            .then(catRes => {
              if (catRes.data && catRes.data.length > 0) {
                const categoryId = catRes.data[0]._id;
                const originalCount = catRes.data[0].count || 0;
                
                console.log(`分类[${categoryName}]的原计数为: ${originalCount}, 更新为: ${actualCount}`);
                
                db.collection('categories').doc(categoryId).update({
                  data: {
                    count: actualCount
                  }
                }).then(() => {
                  console.log(`分类[${categoryName}]计数已更新为:`, actualCount);
                }).catch(err => {
                  console.error(`更新分类[${categoryName}]计数失败:`, err);
                  
                  // 尝试使用set方法完全覆盖更新
                  const updatedCategory = {...catRes.data[0], count: actualCount};
                  db.collection('categories').doc(categoryId).set({
                    data: updatedCategory
                  }).then(() => {
                    console.log(`使用set方法更新分类[${categoryName}]计数成功`);
                  }).catch(setErr => {
                    console.error(`使用set方法更新分类[${categoryName}]计数失败:`, setErr);
                  });
                });
              }
            })
            .catch(err => {
              console.error(`查询分类[${categoryName}]失败:`, err);
            });
        })
        .catch(err => {
          console.error(`获取分类[${categoryName}]的图书数量失败:`, err);
        });
    });
  },

  // 查找书籍
  getBook(bookId) {
    return this.globalData.books.find(book => book.id === bookId);
  },

  // 搜索书籍
  searchBooks(query, filters = {}) {
    if (!query && Object.keys(filters).length === 0) {
      return this.globalData.books;
    }

    return this.globalData.books.filter(book => {
      // 关键词搜索
      if (query) {
        const lowerQuery = query.toLowerCase();
        if (
          (book.title && book.title.toLowerCase().includes(lowerQuery)) ||
          (book.author && book.author.toLowerCase().includes(lowerQuery)) ||
          (book.isbn && book.isbn.includes(query))
        ) {
          // 如果关键词匹配，再检查筛选条件
          return this.matchesFilters(book, filters);
        }
        return false;
      }
      
      // 没有关键词，只检查筛选条件
      return this.matchesFilters(book, filters);
    });
  },

  // 检查书籍是否符合筛选条件
  matchesFilters(book, filters) {
    for (const key in filters) {
      if (filters[key] && book[key] !== filters[key]) {
        return false;
      }
    }
    return true;
  },

  // 同步所有分类的计数
  syncCategoriesCount() {
    if (!wx.cloud) return Promise.resolve();
    
    console.log('开始同步所有分类的计数');
    
    return wx.cloud.database().collection('categories').get()
      .then(res => {
        if (!res.data || res.data.length === 0) {
          console.log('没有分类数据需要同步');
          return Promise.resolve();
        }
        
        const categories = res.data;
        console.log(`找到${categories.length}个分类，开始更新计数`);
        
        // 对每个分类进行计数更新
        const updatePromises = categories.map(category => {
          return this.updateSingleCategoryCount(category);
        });
        
        return Promise.all(updatePromises).then(() => {
          console.log('所有分类计数同步完成');
        });
      })
      .catch(err => {
        console.error('同步分类计数失败:', err);
        return Promise.reject(err);
      });
  },
  
  // 更新单个分类的计数
  updateSingleCategoryCount(category) {
    if (!category || !category.name || !category._id) {
      return Promise.resolve();
    }
    
    const db = wx.cloud.database();
    
    console.log(`开始更新分类[${category.name}]的计数，当前值: ${category.count}`);
    
    // 尝试直接查询，不使用复杂条件
    return db.collection('books')
      .where({
        categories: category.name
      })
      .count()
      .then(res => {
        const actualCount = res.total;
        console.log(`分类[${category.name}]的实际图书数量: ${actualCount}, 原计数: ${category.count}`);
        
        // 输出更详细日志，辅助调试
        db.collection('books')
          .where({
            categories: category.name
          })
          .get()
          .then(booksRes => {
            console.log(`分类[${category.name}]包含的具体图书:`, 
              booksRes.data.map(b => ({
                id: b._id,
                title: b.title,
                categories: b.categories
              }))
            );
          });
        
        // 无论如何都更新，确保数据库与计算结果一致
        console.log(`强制更新分类[${category.name}]的计数为: ${actualCount}`);
        
        return db.collection('categories').doc(category._id).update({
          data: {
            count: actualCount
          }
        })
        .then(updateRes => {
          console.log(`成功更新分类[${category.name}]的计数，结果:`, updateRes);
          return updateRes;
        })
        .catch(err => {
          console.error(`更新分类[${category.name}]计数失败:`, err);
          // 尝试覆盖更新整个文档
          return db.collection('categories').doc(category._id).get()
            .then(getRes => {
              if (getRes.data) {
                const updatedCategory = {...getRes.data, count: actualCount};
                return db.collection('categories').doc(category._id).set({
                  data: updatedCategory
                })
                .then(setRes => {
                  console.log(`使用set方法更新分类[${category.name}]成功:`, setRes);
                  return setRes;
                })
                .catch(setErr => {
                  console.error(`使用set方法更新分类[${category.name}]失败:`, setErr);
                  return Promise.reject(setErr);
                });
              }
              return Promise.reject(new Error('无法获取分类信息'));
            });
        });
      })
      .catch(err => {
        console.error(`获取分类[${category.name}]的图书数量失败:`, err);
        return Promise.reject(err);
      });
  },

  // 检查并修复所有图书的分类数据结构
  fixBookCategoriesData() {
    if (!wx.cloud) return Promise.resolve();
    
    console.log('开始检查并修复图书分类数据结构');
    
    const db = wx.cloud.database();
    
    // 获取所有图书
    return db.collection('books')
      .get()
      .then(res => {
        const books = res.data || [];
        console.log(`找到${books.length}本图书，开始检查分类数据`);
        
        // 对每本书检查其分类数据
        const updatePromises = books.map(book => {
          // 检查categories字段是否为数组
          if (!book.categories || !Array.isArray(book.categories)) {
            console.log(`图书[${book.title}]的categories字段不是数组，进行修复`);
            
            // 如果有category字段但没有正确的categories数组，创建一个新的
            const categories = [];
            if (book.category && typeof book.category === 'string') {
              categories.push(book.category);
            }
            
            // 更新图书的categories字段
            return db.collection('books').doc(book._id).update({
              data: {
                categories: categories
              }
            }).then(() => {
              console.log(`图书[${book.title}]的分类数据已修复`);
              return true;
            }).catch(err => {
              console.error(`修复图书[${book.title}]的分类数据失败:`, err);
              return false;
            });
          }
          
          return Promise.resolve(true); // 数据正常，不需要修复
        });
        
        return Promise.all(updatePromises).then(results => {
          const fixedCount = results.filter(r => r === true).length;
          console.log(`图书分类数据检查完成，修复了${fixedCount}本图书的数据`);
          
          // 修复完成后，更新所有分类的计数
          return this.syncCategoriesCount();
        });
      })
      .catch(err => {
        console.error('检查图书分类数据失败:', err);
        return Promise.reject(err);
      });
  },

  // 修复图书分类ID和名称混用问题
  fixBookCategoriesIDNameMismatch() {
    if (!wx.cloud) return Promise.resolve();
    
    console.log('开始检查并修复图书分类ID和名称混用问题');
    
    const db = wx.cloud.database();
    
    // 首先获取所有分类数据建立ID到名称的映射
    return db.collection('categories').get()
      .then(categoriesRes => {
        const categories = categoriesRes.data || [];
        console.log(`找到${categories.length}个分类，建立ID-名称映射`);
        
        const idToNameMap = {};
        categories.forEach(category => {
          idToNameMap[category._id] = category.name;
        });
        
        console.log('分类ID到名称的映射:', idToNameMap);
        
        // 接着获取所有图书
        return db.collection('books').get()
          .then(booksRes => {
            const books = booksRes.data || [];
            console.log(`找到${books.length}本图书，开始检查分类数据`);
            
            // 检查每本书的分类数据
            const updatePromises = books.map(book => {
              // 如果没有categories字段或不是数组，跳过
              if (!book.categories || !Array.isArray(book.categories)) {
                return Promise.resolve(null);
              }
              
              // 检查categories数组的每个元素是否是ID而非名称
              let needsUpdate = false;
              const correctedCategories = [];
              
              book.categories.forEach(categoryItem => {
                // 如果是ID(通常ID长度较长，包含字母和数字)
                if (categoryItem && typeof categoryItem === 'string' && 
                    idToNameMap[categoryItem] && 
                    categoryItem.length > 10) {
                  needsUpdate = true;
                  correctedCategories.push(idToNameMap[categoryItem]); // 转为名称
                } else {
                  correctedCategories.push(categoryItem); // 保持不变
                }
              });
              
              // 需要更新
              if (needsUpdate) {
                console.log(`图书[${book.title}]的分类需要修复:`);
                console.log('  原始分类:', book.categories);
                console.log('  修复后:', correctedCategories);
                
                return db.collection('books').doc(book._id).update({
                  data: {
                    categories: correctedCategories,
                    // 更新category字段，使用第一个分类作为主分类
                    category: correctedCategories.length > 0 ? correctedCategories[0] : '其他'
                  }
                }).then(() => {
                  console.log(`图书[${book.title}]的分类已修复`);
                  return { 
                    fixed: true, 
                    title: book.title, 
                    oldCategories: book.categories,
                    newCategories: correctedCategories 
                  };
                }).catch(err => {
                  console.error(`修复图书[${book.title}]的分类失败:`, err);
                  return { fixed: false, title: book.title, error: err };
                });
              }
              
              return Promise.resolve(null); // 不需要修复
            });
            
            // 等待所有更新完成
            return Promise.all(updatePromises)
              .then(results => {
                const fixedBooks = results.filter(r => r && r.fixed);
                console.log(`分类数据检查完成，修复了${fixedBooks.length}本图书的分类数据:`);
                fixedBooks.forEach(book => {
                  console.log(`- ${book.title}: ${book.oldCategories} -> ${book.newCategories}`);
                });
                
                // 修复完成后，更新所有分类的计数
                return this.syncCategoriesCount();
              });
          });
      })
      .catch(err => {
        console.error('修复分类数据失败:', err);
        return Promise.reject(err);
      });
  },
}) 
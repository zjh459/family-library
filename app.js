const config = require('./config.js');

App({
  onLaunch: function () {
    // 判断是否使用API服务器或云开发
    if (config.server && config.server.useApi) {
      console.log('使用MySQL API服务器模式');
      // 使用服务器API，不初始化云开发
      this.globalData.useApi = true;
    } else {
      console.log('使用云开发模式');
      // 使用云开发模式
      this.globalData.useApi = false;
      
      if (!wx.cloud) {
        console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      } else {
        wx.cloud.init({
          env: config.cloud.env,
          traceUser: true,
        });
      }
    }
    
    // 设置全局主题
    this.globalData.theme = {
      primaryColor: '#4ECDC4',   // 主色调
      accentColor: '#FF6B6B',    // 强调色
      highlightColor: '#F7FFF7', // 高亮背景色
      textColor: '#292F36',      // 文字颜色
      secondaryTextColor: '#616161' // 次要文字颜色
    };
  },
  
  globalData: {
    useApi: false, // 默认使用云开发，在onLaunch中会根据配置修改
    categories: [],
    userInfo: null,
    theme: {} // 主题配置
  },
  
  // 同步所有分类的计数
  syncCategoriesCount() {
    return new Promise(async (resolve, reject) => {
      try {
        const Database = require('./utils/database');
        // 更新所有分类计数，直接返回结果
        await Database.syncCategoriesCount();
        resolve();
      } catch (error) {
        console.error('同步分类计数失败:', error);
        reject(error);
      }
    });
  }
}) 
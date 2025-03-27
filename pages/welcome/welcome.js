const app = getApp();

Page({
  data: {
    theme: {}
  },

  onLoad() {
    // 设置主题
    this.setData({
      theme: app.globalData.theme
    });
    
    // 设置3秒后自动跳转
    this.autoNavigateTimer = setTimeout(() => {
      this.enterApp();
    }, 3000);
  },

  onUnload() {
    // 页面卸载时清除定时器
    if (this.autoNavigateTimer) {
      clearTimeout(this.autoNavigateTimer);
    }
  },

  enterApp() {
    // 清除定时器，防止手动点击后还会触发自动跳转
    if (this.autoNavigateTimer) {
      clearTimeout(this.autoNavigateTimer);
    }
    wx.switchTab({
      url: '../index/index'
    });
  }
}) 
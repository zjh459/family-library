Page({
  data: {
    theme: {
      accentColor: '#8FBC8F'  // 与您的主题色保持一致
    }
  },

  onLoad() {
    // 设置2秒后自动跳转
    this.autoNavigateTimer = setTimeout(() => {
      this.enterApp();
    }, 2000);
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
      url: '/miniprogram/pages/index/index'
    });
  }
}) 
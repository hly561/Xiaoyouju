Page({
  onLoad(options) {
    const index = typeof options?.index !== 'undefined' ? Number(options.index) : -1;
    try {
      if (!Number.isNaN(index) && index >= 0) {
        wx.setStorageSync('educationEditIndex', index);
      }
    } catch (e) {}
    // 统一跳转到“我的-认证”编辑页
    wx.navigateTo({ url: '/pages/my/verify/index' });
  },
});
Page({
  data: {},

  onLoad(options) {},

  onContactService() {
    wx.showModal({
      title: '联系客服',
      content: '如有问题，请发送邮件至 1632043695@qq.com',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  onBusinessCooperation() {
    wx.showModal({
      title: '商务合作',
      content: '商务合作请联系：1632043695@qq.com',
      showCancel: false,
      confirmText: '知道了'
    });
  },

  onWriteSuggestion() {
    wx.showModal({
      title: '提供宝贵意见',
      editable: true,
      placeholderText: '请输入您的建议',
      confirmText: '提交',
      cancelText: '取消',
      success: async (res) => {
        if (!res.confirm) return;
        const content = (res.content || '').trim();
        if (!content) {
          wx.showToast({ title: '请输入建议内容', icon: 'none' });
          return;
        }
        if (content.length < 5) {
          wx.showToast({ title: '建议不少于5个字', icon: 'none' });
          return;
        }

        const phoneNumber = wx.getStorageSync('phoneNumber');
        if (!phoneNumber) {
          wx.showModal({
            title: '登录提示',
            content: '请先登录后再提交建议',
            confirmText: '去登录',
            cancelText: '取消',
            success: (nav) => {
              if (nav.confirm) {
                wx.navigateTo({ url: '/pages/login/login' });
              }
            }
          });
          return;
        }

        try {
          wx.showLoading({ title: '正在提交...', mask: true });
          const db = wx.cloud.database();
          const userRes = await db.collection('users').where({ phoneNumber }).get();
          if (!userRes.data || userRes.data.length === 0) {
            wx.hideLoading();
            wx.showToast({ title: '未找到用户信息', icon: 'none' });
            return;
          }
          const userId = userRes.data[0]._id;

          await db.collection('comments').add({
            data: {
              userId,
              content,
              createTime: db.serverDate ? db.serverDate() : new Date()
            }
          });

          wx.hideLoading();
          wx.showModal({
            title: '提示',
            content: '已收到建议，感谢您的反馈～',
            showCancel: false,
            confirmText: '知道了'
          });
        } catch (err) {
          console.error('提交建议失败:', err);
          wx.hideLoading();
          wx.showModal({
            title: '提交失败',
            content: '请稍后重试，或在云开发控制台创建 comments 集合',
            showCancel: false
          });
        }
      }
    });
  }
});

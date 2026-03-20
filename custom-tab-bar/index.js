const app = getApp();

Component({
  data: {
    value: '', // 初始值设置为空，避免第一次加载时闪烁
    unreadNum: 0, // 未读消息数量
    showRedDot: false, // 是否显示红点，基于messageAllread字段
    list: [
      {
        icon: 'home',
        value: 'index',
        label: '首页',
      },
      {
        icon: 'chat',
        value: 'notice',
        label: '消息',
      },
      {
        icon: 'user',
        value: 'my',
        label: '我的',
      },
    ],
  },
  lifetimes: {
    ready() {
      const pages = getCurrentPages();
      const curPage = pages[pages.length - 1];
      if (curPage) {
        const nameRe = /pages\/(\w+)\/index/.exec(curPage.route);
        if (nameRe === null) return;
        if (nameRe[1] && nameRe) {
          this.setData({
            value: nameRe[1],
          });
        }
      }

      // 同步全局未读消息数量
      this.setUnreadNum(app.globalData.unreadNum);
      app.eventBus.on('unread-num-change', (unreadNum) => {
        this.setUnreadNum(unreadNum);
      });
      
      // 立即获取用户messageAllread状态，避免首次进入时红点延时
      this.getUserMessageAllreadStatus();
      
      // 监听messageAllread状态变化
      app.eventBus.on('message-allread-change', (messageAllread) => {
        this.setData({ showRedDot: !messageAllread });
      });
    },
  },
  methods: {
    handleChange(e) {
      const { value } = e.detail;
      
      // 如果点击的是消息页面，检查是否已登录
      if (value === 'notice') {
        const phoneNumber = wx.getStorageSync('phoneNumber');
        if (!phoneNumber) {
          const from = encodeURIComponent('/pages/message/index');
          wx.showModal({
            title: '登录提示',
            content: '登录后才能查看消息，是否前往登录？',
            confirmText: '去登录',
            cancelText: '取消',
            success: (res) => {
              if (res.confirm) {
                wx.navigateTo({ url: `/pages/login/login?from=${from}` });
              }
            }
          });
          return;
        }
      }
      
      wx.switchTab({ url: `/pages/${value}/index` });
    },

    /** 设置未读消息数量 */
    setUnreadNum(unreadNum) {
      this.setData({ unreadNum });
    },
    
    /** 获取用户messageAllread状态 */
    async getUserMessageAllreadStatus() {
      try {
        const phoneNumber = wx.getStorageSync('phoneNumber');
        if (!phoneNumber) {
          this.setData({ showRedDot: false });
          return;
        }
        
        const db = wx.cloud.database();
        const result = await db.collection('users')
          .where({ phoneNumber: phoneNumber })
          .field({ messageAllread: true })
          .get();
        
        if (result.data && result.data.length > 0) {
          const messageAllread = result.data[0].messageAllread;
          this.setData({ showRedDot: !messageAllread });
          console.log('用户messageAllread状态:', messageAllread, '显示红点:', !messageAllread);
        } else {
          // 用户不存在，不显示红点
          this.setData({ showRedDot: false });
        }
      } catch (error) {
        console.error('获取用户messageAllread状态失败:', error);
        // 出错时不显示红点
        this.setData({ showRedDot: false });
      }
    },
  },
});

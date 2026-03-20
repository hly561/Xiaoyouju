import request from '../../api/request.js';
import useToastBehavior from '../../behaviors/useToast.js';

Page({
  behaviors: [useToastBehavior],

  data: {
    isLoad: false,
    personalInfo: {},
    gridList: [
      {
        name: '我组织的活动',
        icon: 'root-list',
        type: 'organized',
        url: '/pages/my/organized-activities/index',
      },
      {
        name: '我参加的活动',
        icon: 'user-list',
        type: 'participated',
        url: '/pages/my/participated-activities/index',
      },
      {
        name: '校友圈子',
        icon: 'usergroup',
        type: 'circles',
        url: '/pages/my/circles/index',
      },
    ],

    settingList: [
      { name: '校友认证', icon: 'verified', type: 'verify' },
      { name: '我的兴趣', icon: 'heart', type: 'interests', url: '/pages/interests/index' },
      { name: '联系我们', icon: 'service', type: 'contact' },
      { name: '退出登录', icon: 'poweroff', type: 'logout' },
    ],
  },

  onLoad() {
  },

  observers: {},

  async onShow() {
    const Token = wx.getStorageSync('access_token');
    const personalInfo = await this.getPersonalInfo();

    let pendingCount = 0;
    if (personalInfo.role === 'manager') {
      // 查询待审核学历条目（含有至少一个pending条目）的用户数量
      try {
        const db = wx.cloud.database();
        const _ = db.command;
        const res = await db.collection('users').where({
          educations: _.elemMatch({ status: 'pending' })
        }).count();
        pendingCount = res.total || 0;
      } catch (e) {
        pendingCount = 0;
      }
    }

    if (Token) {
      let settingList = [
        { name: '校友认证', icon: 'verified', type: 'verify' },
        { name: '我的兴趣', icon: 'heart', type: 'interests', url: '/pages/interests/index' },
        { name: '联系我们', icon: 'service', type: 'contact' },
        { name: '退出登录', icon: 'poweroff', type: 'logout' },
      ];
      this.setData({
        isLoad: true,
        personalInfo,
        settingList,
        pendingCount
      });
    } else {
      // 未登录时，显示默认头像和昵称
      let settingList = [
        { name: '校友认证', icon: 'verified', type: 'verify' },
        { name: '我的兴趣', icon: 'heart', type: 'interests', url: '/pages/interests/index' },
        { name: '联系我们', icon: 'service', type: 'contact' },
        { name: '退出登录', icon: 'poweroff', type: 'logout' },
      ];
      this.setData({
        isLoad: false,
        personalInfo: {
          name: '校友',
          image: '', // 可替换为默认头像图片路径
          authStatus: '未认证'
        },
        settingList
      });
    }

    // 进入“我的”页时，触发消息未读数与红点状态的刷新
    try {
      const app = getApp();
      if (app && typeof app.getUnreadNum === 'function') {
        app.getUnreadNum();
      }
      if (app && typeof app.updateUserMessageAllreadStatus === 'function') {
        app.updateUserMessageAllreadStatus();
      }
    } catch (e) {
      console.warn('进入我的页刷新消息红点失败:', e);
    }
  },


  async getPersonalInfo() {
    try {
      const db = wx.cloud.database();
      const phoneNumber = wx.getStorageSync('phoneNumber');
      
      if (!phoneNumber) {
        console.error('未找到手机号码');
        return {};
      }

      const userResult = await db.collection('users').where({
        phoneNumber: phoneNumber
      }).get();
      
      if (!userResult.data || userResult.data.length === 0) {
        console.error('未找到用户信息');
        return {};
      }
      // 若存在多个用户文档（历史数据或重复），优先选择最近审核的或已通过的文档
      const users = userResult.data.slice();
      let userInfo = users[0];
      try {
        users.sort((a, b) => {
          const ta = a.reviewTime ? new Date(a.reviewTime).getTime() : 0;
          const tb = b.reviewTime ? new Date(b.reviewTime).getTime() : 0;
          return tb - ta;
        });
        userInfo = users[0];
        const approvedDoc = users.find(u => {
          const list = Array.isArray(u.educations) ? u.educations : (Array.isArray(u.eductions) ? u.eductions : (Array.isArray(u.certifications) ? u.certifications : []));
          return list.some(e => e && e.status === 'approved');
        });
        if (approvedDoc) userInfo = approvedDoc;
      } catch (e) {}

      // 兼容旧字段，统一从存在的数组字段中读取状态
      const educations = Array.isArray(userInfo.educations)
        ? userInfo.educations
        : (Array.isArray(userInfo.eductions)
          ? userInfo.eductions
          : (Array.isArray(userInfo.certifications)
            ? userInfo.certifications
            : []));
      const hasApproved = educations.some(e => e && e.status === 'approved');
      const hasPending = educations.some(e => e && e.status === 'pending');
      const verifyStatus = hasApproved ? 'approved' : (hasPending ? 'pending' : 'unverified');
      const authStatus = verifyStatus === 'approved'
        ? '已认证'
        : (verifyStatus === 'pending'
          ? '审核中'
          : '认证失败');
      return {
        name: userInfo.name || '校友',
        image: userInfo.image,
        verifyStatus,
        authStatus: authStatus,
        role: userInfo.role || ''
      };
    } catch (error) {
      console.error('获取用户信息失败:', error);
      return {};
    }
  },

  onLogin(e) {
    wx.navigateTo({
      url: '/pages/login/login',
    });
  },

  onNavigateTo() {
    wx.navigateTo({ url: `/pages/my/info-edit/index` });
  },

  onEleClick(e) {
    const { name, url, type } = e.currentTarget.dataset.data;
    if (type === 'verify') {
      wx.navigateTo({ url: '/pages/certification/index' });
      return;
    }

    if (type === 'contact') {
      wx.navigateTo({ url: '/pages/contact-us/index' });
      return;
    }

    // "联系客服"不需要登录
    if (type === 'service') {
      wx.showModal({
        title: '联系我们',
        content: '如有问题，请发送邮件至 1632043695@qq.com',
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }

    // "商务合作"不需要登录
    if (type === 'business') {
      wx.showModal({
        title: '商务合作',
        content: '商务合作请联系：1632043695@qq.com\n或添加微信：BusinessWX123',
        showCancel: false,
        confirmText: '知道了'
      });
      return;
    }

    // “退出登录”不需要登录
    if (type === 'logout') {
      if (!this.data.isLoad) {
        wx.showToast({
          title: '尚未登录',
          icon: 'none'
        });
        return;
      }
      try {
        wx.removeStorageSync('phoneNumber');
        wx.removeStorageSync('access_token');
        wx.removeStorageSync('userInfo');
        wx.removeStorageSync('loginType');
        const app = getApp();
        if (app && app.globalData) {
          app.globalData.userInfo = null;
        }
      } catch (e) {
        console.error('清除登录信息失败:', e);
      }
      this.setData({
        isLoad: false,
        personalInfo: {}
      });
      wx.navigateTo({ url: '/pages/login/login' });
      return;
    }

    // 其余功能未登录拦截
    if (!this.data.isLoad) {
      const from = encodeURIComponent('/pages/my/index');
      wx.showModal({
        title: '登录提示',
        content: '登录后才能使用该功能，是否前往登录？',
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
    
    if (url) {
      wx.navigateTo({ url });
      return;
    }
    if (type === 'verify') {
      const { verifyStatus } = this.data.personalInfo;
      if (verifyStatus === 'pending') {
        wx.showToast({
          title: '审核中',
          icon: 'none'
        });
        return;
      }
      if (verifyStatus === 'approved') {
        wx.showToast({
          title: '已认证',
          icon: 'none'
        });
        return;
      }
      wx.navigateTo({ url: '/pages/my/verify/index' });
      return;
    }

    this.onShowToast('#t-toast', name);
  },
});

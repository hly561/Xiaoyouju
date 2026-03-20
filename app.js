// app.js
import config from './config';
import createBus from './utils/eventBus';
import { connectSocket, fetchUnreadNum } from './mock/chat';

try {
  wx.cloud.init({
    env: 'cloud1-8g1w7r28e2de3747',
    traceUser: true
  });
} catch (err) {
  console.error('云初始化失败:', err);
  try { wx.showToast({ title: '云环境连接失败', icon: 'none' }); } catch (_) {}
}

App({
  onLaunch() {
    // 初始化Mock（如果需要）
    this.initMock();
    
    const updateManager = wx.getUpdateManager();

    updateManager.onCheckForUpdate((res) => {
      // console.log(res.hasUpdate)
    });

    updateManager.onUpdateReady(() => {
      wx.showModal({
        title: '更新提示',
        content: '新版本已经准备好，是否重启应用？',
        success(res) {
          if (res.confirm) {
            updateManager.applyUpdate();
          }
        },
      });
    });

    // 从本地存储恢复用户信息
    this.restoreUserInfo();
    
    // 检查登录状态，未登录则跳转到登录页面
    this.checkLoginStatus();
    
    // 立即获取未读消息数量和messageAllread状态，避免不必要的延时
    this.getUnreadNum();
    this.updateUserMessageAllreadStatus();
    
    // 监听页面显示事件，实时更新未读消息数量
    this.setupPageShowListener();
    
    this.connect();
  },
  
  /** 设置页面显示监听器 */
  setupPageShowListener() {
    // 监听小程序显示事件（用户每次进入小程序）
    wx.onAppShow(() => {
      console.log('小程序进入前台，立即更新未读消息数量和messageAllread状态');
      // 直接调用，避免进入前台后的感知延迟
      this.getUnreadNum();
      this.updateUserMessageAllreadStatus();
    });
    
    // 定时更新未读消息数量（每30秒检查一次）
    setInterval(() => {
      this.getUnreadNum();
    }, 30000);
  },

  /** 从本地存储恢复用户信息 */
  restoreUserInfo() {
    try {
      const token = wx.getStorageSync('access_token');
      const loginType = wx.getStorageSync('loginType');
      const phoneNumber = wx.getStorageSync('phoneNumber');
      
      if (token) {
        this.globalData.userInfo = {
          access_token: token,
          loginType: loginType || 'phone'
        };
        
        // 如果是手机号登录，需要手机号信息
        if (loginType === 'phone' && phoneNumber) {
          this.globalData.userInfo.phoneNumber = phoneNumber;
        }
        
        console.log('用户信息已恢复:', this.globalData.userInfo);
      }
    } catch (error) {
      console.error('恢复用户信息失败:', error);
    }
  },

  /** 检查登录状态 */
  checkLoginStatus() {
    // 延迟执行，确保页面栈已初始化
    setTimeout(() => {
      const userInfo = this.globalData.userInfo;
      
      // 不再自动跳转到登录页面，允许未登录用户浏览
      if (!userInfo || !userInfo.access_token) {
        console.log('用户未登录，允许浏览');
      }
    }, 100);
  },

  // 初始化Mock
  initMock() {
    try {
      // 确保wx对象已经完全初始化
      if (typeof wx === 'undefined') {
        console.warn('wx对象尚未初始化，延迟Mock初始化');
        setTimeout(() => this.initMock(), 100);
        return;
      }

      // 预览环境为降低包体积，不引入全量 Mock 库
      if (config.isMock) {
        console.warn('Mock 模式开启，但预览环境不加载 Mock 库以减少包体积');
      }
    } catch (error) {
      console.error('Mock初始化失败:', error);
      // 即使Mock初始化失败，也不应该阻止应用启动
    }
  },

  globalData: {
    userInfo: null,
    unreadNum: 0, // 未读消息数量
    socket: null, // SocketTask 对象
  },

  /** 全局事件总线 */
  eventBus: createBus(),

  /** 初始化WebSocket */
  connect() {
    const socket = connectSocket();
    socket.onMessage((data) => {
      data = JSON.parse(data);
      if (data.type === 'message' && !data.data.message.read) this.setUnreadNum(this.globalData.unreadNum + 1);
    });
    this.globalData.socket = socket;
  },

  /** 获取未读消息数量 */
  async getUnreadNum() {
    try {
      const { data } = await fetchUnreadNum();
      this.globalData.unreadNum = data;
      this.eventBus.emit('unread-num-change', data);
    } catch (error) {
      console.error('获取未读消息数量失败:', error);
      // 出错时设置为0
      this.globalData.unreadNum = 0;
      this.eventBus.emit('unread-num-change', 0);
    }
  },

  /** 设置未读消息数量 */
  setUnreadNum(unreadNum) {
    this.globalData.unreadNum = unreadNum;
    this.eventBus.emit('unread-num-change', unreadNum);
  },
  
  /** 更新用户messageAllread状态 */
  async updateUserMessageAllreadStatus() {
    try {
      const phoneNumber = wx.getStorageSync('phoneNumber');
      if (!phoneNumber) {
        this.eventBus.emit('message-allread-change', true); // 未登录时不显示红点
        return;
      }
      // 统一在客户端重新计算并写入，保持与消息页一致（排除“校友认证审核结果”）
      try {
        const db = wx.cloud.database();
        const _ = db.command;
        // 查询除审核结果外的未读消息数量
        const unreadResult = await db.collection('messages')
          .where({
            phoneNumber,
            isRead: false,
            title: _.neq('校友认证审核结果')
          })
          .count();
        const hasUnread = (unreadResult.total || 0) > 0;
        const messageAllread = !hasUnread;
        // 写回用户表
        await db.collection('users')
          .where({ phoneNumber })
          .update({ data: { messageAllread } });
        // 广播给自定义TabBar
        this.eventBus.emit('message-allread-change', messageAllread);
        console.log('客户端重算 messageAllread:', messageAllread, '未读数量:', unreadResult.total);
      } catch (calcErr) {
        console.error('客户端重算 messageAllread 失败，尝试读取用户当前状态:', calcErr);
        try {
          const db = wx.cloud.database();
          const userResult = await db.collection('users')
            .where({ phoneNumber })
            .field({ messageAllread: true })
            .get();
          const messageAllread = (userResult.data && userResult.data[0]) ? userResult.data[0].messageAllread : true;
          this.eventBus.emit('message-allread-change', messageAllread);
          console.log('读取用户当前 messageAllread:', messageAllread);
        } catch (dbErr) {
          console.error('读取用户 messageAllread 失败:', dbErr);
          this.eventBus.emit('message-allread-change', true);
        }
      }
    } catch (error) {
      console.error('全局更新用户messageAllread状态失败:', error);
      // 出错时不显示红点
      this.eventBus.emit('message-allread-change', true);
    }
  },
});

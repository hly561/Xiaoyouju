// pages/chat/index.js
const app = getApp();
const { socket } = app.globalData; // 获取已连接的socketTask

Page({
  /** 页面的初始数据 */
  data: {
    myAvatar: '/static/chat/avatar.png', // 自己的头像
    userId: null, // 对方userId
    avatar: '', // 对方头像
    name: '', // 对方昵称
    messages: [], // 消息列表 { messageId, from, content, time, read }
    input: '', // 输入框内容
    anchor: '', // 消息列表滚动到 id 与之相同的元素的位置
    keyboardHeight: 0, // 键盘当前高度(px)
  },

  /** 生命周期函数--监听页面加载 */
  onLoad(options) {
    this.getOpenerEventChannel().on('update', this.update);
  },

  /** 生命周期函数--监听页面初次渲染完成 */
  onReady() {},

  /** 生命周期函数--监听页面显示 */
  onShow() {},

  /** 生命周期函数--监听页面隐藏 */
  onHide() {},

  /** 生命周期函数--监听页面卸载 */
  onUnload() {
    app.eventBus.off('update', this.update);
  },

  /** 页面相关事件处理函数--监听用户下拉动作 */
  onPullDownRefresh() {},

  /** 页面上拉触底事件的处理函数 */
  onReachBottom() {},

  /** 用户点击右上角分享 */
  onShareAppMessage() {},

  /** 更新数据 */
  update({ userId, avatar, name, messages }) {
    this.setData({ userId, avatar, name, messages: [...messages] });
    wx.nextTick(this.scrollToBottom);
  },

  /** 处理唤起键盘事件 */
  handleKeyboardHeightChange(event) {
    const { height } = event.detail;
    if (!height) return;
    this.setData({ keyboardHeight: height });
    wx.nextTick(this.scrollToBottom);
  },

  /** 处理收起键盘事件 */
  handleBlur() {
    this.setData({ keyboardHeight: 0 });
  },

  /** 处理输入事件 */
  handleInput(event) {
    this.setData({ input: event.detail.value });
  },

  /** 发送消息 */
  async sendMessage() {
    const { userId, messages, input: content } = this.data;
    if (!content) return;
    
    // 获取当前用户手机号
    const phoneNumber = wx.getStorageSync('phoneNumber');
    const userInfo = wx.getStorageSync('userInfo');
    const openid = userInfo ? userInfo.openid : '';
    
    if (!phoneNumber && !openid) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }
    
    const message = { messageId: null, from: 0, content, time: Date.now(), read: true };
    messages.push(message);
    this.setData({ input: '', messages });
    
    // 发送到WebSocket
    socket.send(JSON.stringify({ type: 'message', data: { userId, content } }));
    
    // 保存消息到云数据库，与手机号绑定
    try {
      const db = wx.cloud.database();
      const messageData = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: phoneNumber || openid, // 使用手机号作为主要标识，openid作为备用
        phoneNumber: phoneNumber, // 明确保存手机号
        openid: openid, // 保存openid
        targetUserId: userId, // 消息接收方
        type: 'user',
        name: '我',
        avatar: this.data.myAvatar,
        content: content,
        lastMessage: content,
        isRead: false,
        createdAt: new Date()
      };
      
      await db.collection('messages').add({
        data: messageData
      });
      

    } catch (error) {

      // 即使保存失败，也不影响界面显示
    }
    
    wx.nextTick(this.scrollToBottom);
  },

  /** 消息列表滚动到底部 */
  scrollToBottom() {
    this.setData({ anchor: 'bottom' });
  },
});

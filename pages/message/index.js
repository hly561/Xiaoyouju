Page({
  data: {
    messages: [],
    loading: true,
    isEmpty: false,
    refreshing: false,
    showLoginGuide: false
  },

  onLoad() {
    this.loadMessages();
  },

  onShow() {
    this.loadMessages();
  },

  // 加载消息列表
  async loadMessages(isRefresh = false) {
    try {
      // 如果是下拉刷新，不显示loading状态
      if (!isRefresh) {
        this.setData({ loading: true });
      }
      
      const phoneNumber = wx.getStorageSync('phoneNumber');
      if (!phoneNumber) {
        console.log('用户未登录');
        this.setData({ 
          loading: false,
          isEmpty: true,
          messages: [],
          showLoginGuide: true
        });
        // 用户未登录时，设置未读数量为0
        this.updateUnreadCount([]);
        return;
      }

      const db = wx.cloud.database();
      
      // 查询该用户的所有消息
      const result = await db.collection('messages')
        .where({
          phoneNumber: phoneNumber
        })
        .orderBy('createdAt', 'desc')
        .get();

      console.log('查询到的消息:', result.data);
      
      // 处理消息数据，确保每条消息都有isRead字段
      const processedMessages = result.data.map(msg => {
        // 如果消息没有isRead字段，设置默认值为false
        if (msg.isRead === undefined) {
          msg.isRead = false;
        }
        return msg;
      });
      // 过滤掉「校友认证审核结果」消息，只保留其他消息（如系统消息等）
      const filteredMessages = processedMessages.filter(msg => msg.title !== '校友认证审核结果');
      
      // 后台清理：自动删除数据库中的「校友认证审核结果」消息，避免后续继续占用未读数量
      const duplicatesToDelete = processedMessages.filter(msg => msg.title === '校友认证审核结果');
      if (duplicatesToDelete.length > 0) {
        const phoneNumberForDelete = wx.getStorageSync('phoneNumber');
        Promise.all(
          duplicatesToDelete.map(m => wx.cloud.callFunction({
            name: 'deleteMessage',
            data: { messageId: m._id, phoneNumber: phoneNumberForDelete }
          }).catch(err => console.error('删除重复审核结果消息失败:', err)))
        ).then(() => {
          console.log('重复的审核结果消息已清理');
        });
      }
      
      this.setData({
        messages: filteredMessages,
        loading: false,
        isEmpty: filteredMessages.length === 0
      });
      
      // 计算并更新未读消息数量
      this.updateUnreadCount(filteredMessages);
      
    } catch (error) {
      console.error('加载消息失败:', error);
      wx.showToast({
        title: '加载消息失败',
        icon: 'none'
      });
    this.setData({
        loading: false,
        isEmpty: true,
        messages: []
      });
      // 加载失败时，设置未读数量为0
      this.updateUnreadCount([]);
    }
  },

  goLoginWithFrom() {
    const from = encodeURIComponent('/pages/message/index');
    wx.navigateTo({ url: `/pages/login/login?from=${from}` });
  },

  // 计算并更新未读消息数量
  async updateUnreadCount(messages) {
    try {
      // 直接查询数据库获取实时未读消息数量
      const app = getApp();
      await app.getUnreadNum();
      
      // 更新用户的messageAllread字段
      await this.updateUserMessageAllreadStatus();
      
      // 备用方案：如果数据库查询失败，使用传入的messages计算
      if (messages && Array.isArray(messages)) {
        const unreadCount = messages.filter(msg => !msg.isRead).length;
        console.log('备用方案计算的未读数量:', unreadCount);
      }
    } catch (error) {
      console.error('更新未读消息数量失败:', error);
      // 出错时使用传入的messages作为备用方案
      if (messages && Array.isArray(messages)) {
        const unreadCount = messages.filter(msg => !msg.isRead).length;
        const app = getApp();
        app.setUnreadNum(unreadCount);
      }
    }
  },

  // 更新用户的messageAllread状态
  async updateUserMessageAllreadStatus() {
    try {
      const phoneNumber = wx.getStorageSync('phoneNumber');
      if (!phoneNumber) {
        return;
      }

      const db = wx.cloud.database();
      const _ = db.command;
      
      // 查询该用户除「校友认证审核结果」以外的未读消息
      const unreadResult = await db.collection('messages')
        .where({
          phoneNumber: phoneNumber,
          isRead: false,
          title: _.neq('校友认证审核结果')
        })
        .count();
      
      const hasUnreadMessages = unreadResult.total > 0;
      const messageAllread = !hasUnreadMessages;
      
      console.log('用户未读消息数量(已排除审核结果):', unreadResult.total, '设置messageAllread为:', messageAllread);
      
      // 更新用户的messageAllread字段
      await db.collection('users')
        .where({
          phoneNumber: phoneNumber
        })
        .update({
          data: { messageAllread: messageAllread }
        });
      
      console.log('用户messageAllread状态已更新为:', messageAllread);
      const app = getApp();
      app.eventBus.emit('message-allread-change', messageAllread);
    } catch (error) {
      console.error('更新用户messageAllread状态失败:', error);
    }
  },

  // 标记消息为已读
  async markAsRead(messageId) {
    try {
      console.log('开始标记消息为已读:', messageId);
      
      // 调用云函数更新消息状态
      const result = await wx.cloud.callFunction({
        name: 'updateMessageStatus',
        data: {
          messageId: messageId
        }
      });
      
      console.log('云函数调用结果:', result);
      
      if (result.result && result.result.success) {
        console.log('标记消息已读成功:', result.result.data);
        console.log('更新后的消息:', result.result.updatedMessage);
        return result.result;
      } else {
        throw new Error(result.result?.error || '云函数调用失败');
      }
    } catch (error) {
      console.error('标记消息已读失败:', error);
      wx.showToast({
        title: '更新失败: ' + error.message,
        icon: 'error'
      });
      throw error;
    }
  },

  // 点击消息项
  onMessageTap(e) {
    const { message } = e.currentTarget.dataset;
    
    // 标记为已读
    if (!message.isRead) {
      console.log('消息点击，准备标记为已读:', message);
      
      // 先更新本地数据，提供即时反馈
      const messages = this.data.messages.map(msg => {
        if (msg._id === message._id) {
          return { ...msg, isRead: true };
        }
        return msg;
      });
      
      this.setData({ messages });
      
      // 异步更新数据库并重新计算未读消息数量
      this.markAsRead(message._id).then(() => {
        // 标记成功后，实时更新未读消息数量
        this.updateUnreadCount();
      }).catch(error => {
        console.error('数据库更新失败，回滚本地状态:', error);
        // 如果数据库更新失败，回滚本地状态
        const rollbackMessages = this.data.messages.map(msg => {
          if (msg._id === message._id) {
            return { ...msg, isRead: message.isRead };
          }
          return msg;
        });
        this.setData({ messages: rollbackMessages });
        this.updateUnreadCount(rollbackMessages);
      });
    }
    
    // 活动更新通知和活动推荐通知都可以跳转到活动详情页
    if ((message.title === '活动更新通知' && message.type === 'activity_notification' && message.activityId) || 
        (message.title === '活动推荐通知' && message.type === 'activity_recommendation' && message.activityId)) {
      // 先检查活动是否存在
      const db = wx.cloud.database();
       db.collection('activities').doc(message.activityId).get()
         .then(res => {
           if (res.data) {
             // 活动存在，跳转到详情页
             wx.navigateTo({
               url: `/pages/activity-detail/index?id=${message.activityId}`
             });
           } else {
             // 活动不存在，提示用户
             wx.showToast({
               title: '活动已删除',
               icon: 'error',
               duration: 2000
             });
           }
         })
         .catch(err => {
           // 文档不存在是正常情况，不记录为错误
           if (err.errMsg && err.errMsg.includes('cannot find document')) {
             wx.showToast({
               title: '活动已删除',
               icon: 'error',
               duration: 2000
             });
           } else {
             // 其他网络或权限错误才记录
             console.error('检查活动存在性失败：', err);
             wx.showToast({
               title: '网络异常，请重试',
               icon: 'error',
               duration: 2000
             });
           }
         });
    } else {
      // 其他类型消息的处理逻辑
      console.log('点击消息:', message);
    }
  },

  // 下拉刷新
  onRefresh() {
    this.refresh();
  },
  
  async refresh() {
    console.log('用户下拉刷新消息列表');
    
    this.setData({
      refreshing: true
    });
    
    try {
      await this.loadMessages(true);
      
      // 延迟一下让用户看到刷新完成状态
    setTimeout(() => {
        this.setData({
          refreshing: false
        });
      }, 1000);
    } catch (error) {
      console.error('下拉刷新失败:', error);
      this.setData({
        refreshing: false
      });
      wx.showToast({
        title: '刷新失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 触摸开始

  // 长按消息
  onLongPress(e) {
    const messageId = e.currentTarget.dataset.id;
    const message = e.currentTarget.dataset.message;
    
    wx.showActionSheet({
      itemList: ['删除消息'],
      itemColor: '#ff4757',
      success: (res) => {
        if (res.tapIndex === 0) {
          this.deleteMessage(messageId);
        }
      }
    });
  },

  // 删除消息
  async deleteMessage(messageId) {
    try {
      const result = await wx.showModal({
        title: '确认删除',
        content: '确定要删除这条消息吗？',
        confirmText: '删除',
        confirmColor: '#ff4757'
      });
      
      if (result.confirm) {
        wx.showLoading({ title: '删除中...' });
        
        try {
          // 获取当前用户手机号
          const phoneNumber = wx.getStorageSync('phoneNumber');
          
          if (!phoneNumber) {
            wx.hideLoading();
            wx.showToast({
              title: '请先登录',
              icon: 'error'
            });
            return;
          }
          
          // 调用云函数删除消息
          const deleteResult = await wx.cloud.callFunction({
            name: 'deleteMessage',
            data: {
              messageId: messageId,
              phoneNumber: phoneNumber
            }
          });
          
          console.log('云函数删除结果:', deleteResult);
          
          if (!deleteResult.result.success) {
            wx.hideLoading();
            wx.showToast({
              title: deleteResult.result.error || '删除失败',
              icon: 'error'
            });
            return;
          }
          
          // 从本地数据中删除
          const messages = this.data.messages.filter(msg => msg._id !== messageId);
          
          this.setData({
            messages,
            isEmpty: messages.length === 0
          });
          
          // 更新未读消息数量
          this.updateUnreadCount();
          
          wx.hideLoading();
          wx.showToast({
            title: '删除成功',
            icon: 'success'
          });
        } catch (dbError) {
          wx.hideLoading();
          console.error('数据库删除失败:', dbError);
          console.error('错误详情:', {
            errCode: dbError.errCode,
            errMsg: dbError.errMsg,
            messageId: messageId
          });
          
          let errorMsg = '删除失败，请重试';
          if (dbError.errCode === -502006) {
            errorMsg = '无权限删除此消息';
          } else if (dbError.errCode === -502005) {
            errorMsg = '消息不存在';
          }
          
          wx.showToast({
            title: errorMsg,
            icon: 'error'
          });
        }
      }
    } catch (error) {
      wx.hideLoading();
      console.error('删除消息失败:', error);
      wx.showToast({
        title: '删除失败',
        icon: 'error'
      });
    }
  }

})
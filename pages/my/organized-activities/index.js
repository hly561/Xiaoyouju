Page({
  data: {
    activities: [],
    loading: true,
    isEmpty: false
  },

  onLoad() {
    this.loadOrganizedActivities();
  },

  onShow() {
    // 从其他页面返回时刷新数据
    this.loadOrganizedActivities();
  },

  async loadOrganizedActivities() {
    try {
      this.setData({ loading: true });
      
      const phoneNumber = wx.getStorageSync('phoneNumber');
      if (!phoneNumber) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });
        wx.navigateBack();
        return;
      }

      const db = wx.cloud.database();
      // 分页获取所有数据（数据库单次返回上限为20条）
      const batchSize = 20;
      const baseQuery = db.collection('activities')
        .where({ 'createdBy.phoneNumber': phoneNumber });

      // 先统计总数
      const countRes = await baseQuery.count();
      const total = countRes.total || 0;
      let records = [];
      const batchTimes = Math.ceil(total / batchSize) || 1;
      for (let i = 0; i < batchTimes; i++) {
        const res = await baseQuery
          .orderBy('_createTime', 'desc')
          .skip(i * batchSize)
          .limit(batchSize)
          .get();
        records = records.concat(res.data || []);
      }

      const activities = records.map(activity => {
        let locationText = '';
        if (activity.activityType === 'online' || activity.meetingLink) {
          locationText = '线上活动';
        } else if (activity.location && typeof activity.location === 'object') {
          const { province = '', city = '', address = '' } = activity.location;
          locationText = `${province}${city} ${address}`;
        } else if (typeof activity.location === 'string') {
          locationText = activity.location;
        }

        // 判断活动状态
        const now = new Date();
        const startTime = new Date(activity.activityStartTimeValue);
        const endTime = new Date(activity.activityEndTimeValue);
        
        let status = 'upcoming'; // 未开始
        let statusText = '未开始';
        let statusColor = '#0052d9';
        
        // 报名状态判断（仅在未开始状态下显示）
        let registrationStatus = '';
        let registrationText = '';
        let registrationColor = '';
        
        if (now > endTime) {
          status = 'ended';
          statusText = '已结束';
          statusColor = '#999';
        } else if (now >= startTime && now <= endTime) {
          status = 'ongoing';
          statusText = '进行中';
          statusColor = '#00a870';
        } else {
          // 活动未开始，判断报名状态
          const registrationDeadline = activity.registrationDeadline ? new Date(activity.registrationDeadline) : startTime;
          
          if (now <= registrationDeadline) {
            registrationStatus = 'open';
            registrationText = '报名中';
            registrationColor = '#00a870';
          } else {
            registrationStatus = 'closed';
            registrationText = '报名已截止';
            registrationColor = '#d54941';
          }
        }

        // 根据活动状态设置icon颜色
        let iconColor = '#666'; // 默认灰色
        if (status === 'upcoming' || status === 'ongoing') {
          iconColor = '#0052d9'; // 蓝色
        }

        return {
          ...activity,
          locationText,
          participantCount: activity.participants ? activity.participants.length : 0,
          maxParticipants: activity.participantLimit || '不限',
          status,
          statusText,
          statusColor,
          registrationStatus,
          registrationText,
          registrationColor,
          iconColor
        };
      });

      // 按发布时间排序，越晚发布的在越上面
      activities.sort((a, b) => {
        const timeA = new Date(a.createdAt || a._createTime || 0);
        const timeB = new Date(b.createdAt || b._createTime || 0);
        return timeB - timeA; // 降序排列，最新的在前面
      });

      this.setData({
        activities,
        loading: false,
        isEmpty: activities.length === 0
      });

    } catch (error) {
      console.error('加载我组织的活动失败:', error);
      this.setData({ loading: false });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  onActivityTap(e) {
    const activityId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/activity-detail/index?id=${activityId}`
    });
  },

  onEditActivity(e) {
    e.stopPropagation();
    const activityId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/release/index?id=${activityId}&mode=edit`
    });
  },

  onDeleteActivity(e) {
    e.stopPropagation();
    const activityId = e.currentTarget.dataset.id;
    const activityTitle = e.currentTarget.dataset.title;
    
    wx.showModal({
      title: '确认删除',
      content: `确定要删除活动"${activityTitle}"吗？此操作不可撤销。`,
      success: (res) => {
        if (res.confirm) {
          this.deleteActivity(activityId, activityTitle);
        }
      }
    });
  },

  async deleteActivity(activityId, activityTitle) {
    try {
      wx.showLoading({ title: '删除中...' });
      
      const db = wx.cloud.database();
      
      // 获取活动详情，用于通知参与者
      const activityResult = await db.collection('activities').doc(activityId).get();
      const activity = activityResult.data;
      
      // 如果有参与者，发送取消通知
      if (activity.participants && activity.participants.length > 0) {
        try {
          await wx.cloud.callFunction({
            name: 'sendNotification',
            data: {
              type: 'cancel',
              activityId,
              activityTitle,
              message: `很抱歉，您报名的活动「${activityTitle}」已被组织者取消。如有疑问，请联系组织者。`,
              operatorPhone: wx.getStorageSync('phoneNumber')
            }
          });
        } catch (notifyError) {
          console.error('发送取消通知失败:', notifyError);
        }
      }
      
      // 删除活动
      await db.collection('activities').doc(activityId).remove();
      
      wx.hideLoading();
      wx.showToast({
        title: '删除成功',
        icon: 'success'
      });
      
      // 重新加载数据
      this.loadOrganizedActivities();
      
    } catch (error) {
      wx.hideLoading();
      console.error('删除活动失败:', error);
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      });
    }
  },

  onPullDownRefresh() {
    this.loadOrganizedActivities().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  async onCreateActivity() {
    // 检查用户是否已登录
    const phoneNumber = wx.getStorageSync('phoneNumber');
    if (!phoneNumber) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    // 检查用户认证状态
    const db = wx.cloud.database();
    try {
      const userResult = await db.collection('users').where({ phoneNumber }).get();
      if (userResult.data && userResult.data.length > 0) {
        const userInfo = userResult.data[0];
        const educations = Array.isArray(userInfo.educations) ? userInfo.educations : [];
        const hasApproved = educations.some(e => e && e.status === 'approved');
        const hasPending = educations.some(e => e && e.status === 'pending');
        const verifyStatus = hasApproved ? 'approved' : (hasPending ? 'pending' : 'unverified');
        
        if (verifyStatus === 'unverified') {
          wx.showModal({
            title: '认证提示',
            content: '您还未进行校友认证，无法发布活动。请先完成校友认证。',
            showCancel: true,
            cancelText: '取消',
            confirmText: '去认证',
            success: (res) => {
              if (res.confirm) {
                wx.navigateTo({
                  url: '/pages/my/verify/index'
                });
              }
            }
          });
          return;
        } else if (verifyStatus === 'pending') {
          wx.showModal({
            title: '认证提示',
            content: '您的校友认证正在审核中，暂时无法发布活动。请等待审核完成。',
            showCancel: false,
            confirmText: '知道了'
          });
          return;
        }
      } else {
        // 如果没有找到用户信息，说明用户未注册或未认证
        wx.showModal({
          title: '认证提示',
          content: '您还未进行校友认证，无法发布活动。请先完成校友认证。',
          showCancel: true,
          cancelText: '取消',
          confirmText: '去认证',
          success: (res) => {
            if (res.confirm) {
              wx.navigateTo({
                url: '/pages/my/verify/index'
              });
            }
          }
        });
        return;
      }
    } catch (error) {
      console.error('检查用户认证状态失败:', error);
      wx.showToast({
        title: '认证状态检查失败',
        icon: 'none'
      });
      return;
    }

    // 认证通过，跳转到发布页面
    wx.navigateTo({
      url: '/pages/release/index'
    });
  }
});
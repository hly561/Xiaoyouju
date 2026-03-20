Page({
  data: {
    activities: [],
    loading: true,
    isEmpty: false
  },

  onLoad() {
    this.loadParticipatedActivities();
  },

  onShow() {
    // 从其他页面返回时刷新数据
    this.loadParticipatedActivities();
  },

  async loadParticipatedActivities() {
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
      const _ = db.command;
      // 分页获取所有数据，兼容participants为数组字符串或对象的历史结构
      const batchSize = 20;
      const baseQuery = db.collection('activities')
        .where(_.or([
          { participants: _.in([phoneNumber]) },
          { participants: _.elemMatch({ phoneNumber }) }
        ]));

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
      console.error('加载我参加的活动失败:', error);
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

  // 取消报名相关方法已移除

  onPullDownRefresh() {
    this.loadParticipatedActivities().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  onBrowseActivities() {
    wx.switchTab({
      url: '/pages/home/index'
    });
  }
});
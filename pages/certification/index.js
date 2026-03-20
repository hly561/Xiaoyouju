Page({
  data: {
    certifications: [],
    listSource: 'certifications',
  },

  onLoad(options) {
    this.loadCertifications();
  },

  onShow() {
    // 返回该页面时，先读取本地刷新负载进行乐观更新，再拉取远端校准
    try {
      const payload = wx.getStorageSync('eduRefreshPayload');
      if (payload && payload.item) {
        const mapItem = (item) => {
          const status = item.status || 'pending';
          let statusText = '审核中';
          let statusColor = '#999';
          if (status === 'approved') {
            statusText = '已认证';
            statusColor = '#0052d9';
          } else if (status === 'rejected' || status === 'unverified') {
            statusText = '认证失败';
            statusColor = '#d54941';
          }
          return {
            ...item,
            statusText,
            statusColor,
            graduationYear: item.graduationYear || (item.endDate ? item.endDate.split('-')[0] : ''),
          };
        };

        const mappedItem = mapItem(payload.item);
        const list = (this.data.certifications || []).slice();
        if (payload.type === 'edit' && typeof payload.index === 'number' && payload.index >= 0 && payload.index < list.length) {
          list[payload.index] = { ...list[payload.index], ...mappedItem };
        } else if (payload.type === 'add') {
          list.push(mappedItem);
        }
        this.setData({ certifications: list });
        // 清理本地负载，避免重复应用
        try { wx.removeStorageSync('eduRefreshPayload'); } catch (e) {}
      }
    } catch (e) {}
    // 远端拉取，保证与服务端一致
    this.loadCertifications();
  },

  loadCertifications() {
    const db = wx.cloud.database();
    const phoneNumber = wx.getStorageSync('phoneNumber');
    if (!phoneNumber) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    db.collection('users').where({ phoneNumber }).get({
      success: (res) => {
        if (res.data.length > 0) {
          // 若存在多个文档，优先选择最近审核的或已通过的文档
          const users = res.data.slice();
          try {
            users.sort((a, b) => {
              const ta = a.reviewTime ? new Date(a.reviewTime).getTime() : 0;
              const tb = b.reviewTime ? new Date(b.reviewTime).getTime() : 0;
              return tb - ta;
            });
          } catch (e) {}
          let user = users[0];
          try {
            const approvedDoc = users.find(u => {
              const list = Array.isArray(u.educations) ? u.educations : (Array.isArray(u.eductions) ? u.eductions : (Array.isArray(u.certifications) ? u.certifications : []));
              return list.some(e => e && e.status === 'approved');
            });
            if (approvedDoc) user = approvedDoc;
          } catch (e) {}
          const listSource = user.educations
            ? 'educations'
            : (user.eductions ? 'eductions' : 'certifications');

          const rawList = user.educations || user.eductions || user.certifications || [];
          const mapped = rawList.map(item => {
            const status = item.status || 'pending';
            let statusText = '审核中';
            let statusColor = '#999'; // 审核中：灰色
            if (status === 'approved') {
              statusText = '已认证';
              statusColor = '#0052d9'; // 已认证：蓝色
            } else if (status === 'rejected' || status === 'unverified') {
              statusText = '认证失败';
              statusColor = '#d54941'; // 认证失败：红色
            }
            return {
              ...item,
              statusText,
              statusColor,
              // 兼容老数据把 endDate 衍生为毕业年份
              graduationYear: item.graduationYear || (item.endDate ? item.endDate.split('-')[0] : ''),
            };
          });

          this.setData({
            certifications: mapped,
            userId: user._id,
            listSource,
          });
        } else {
          this.setData({ certifications: [] });
        }
      },
      fail: (err) => {
        console.error('Failed to load certifications', err);
        wx.showToast({ title: '加载失败', icon: 'none' });
      },
    });
  },

  onAdd() {
    wx.navigateTo({
      url: '/pages/my/verify/index',
    });
  },

  onEdit(e) {
    const { index } = e.currentTarget.dataset;
    // 若来源为旧的 certifications，走原有编辑页；否则跳转到“我的-认证”页并在那边进入编辑态
    if (this.data.listSource === 'certifications') {
      wx.navigateTo({
        url: `/pages/certification/certification-form/index?index=${index}`,
      });
    } else {
      try {
        wx.setStorageSync('educationEditIndex', index);
      } catch (e) {}
      wx.navigateTo({ url: '/pages/my/verify/index' });
    }
  },

  onDelete(e) {
    const { index } = e.currentTarget.dataset;
    const db = wx.cloud.database();
    const phoneNumber = wx.getStorageSync('phoneNumber');
    if (!phoneNumber) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    (async () => {
      try {
        const userRes = await db.collection('users').where({ phoneNumber }).get();
        if (!userRes.data || !userRes.data.length) return;
        // 若页面已记录 userId，则优先用该文档，避免多文档混淆
        const preferredId = this.data.userId;
        let user = userRes.data[0];
        if (preferredId) {
          const match = userRes.data.find(u => u._id === preferredId);
          if (match) user = match;
        }

        const listSource = this.data.listSource;
        const fullList = (user.educations || user.eductions || user.certifications || []).slice();
        if (!fullList.length || typeof index !== 'number' || index < 0 || index >= fullList.length) return;
        const target = fullList[index];

        // 统计删除前是否会失去“最后一个已认证”
        const getStatus = (item) => (item && (item.status || item.verifyStatus)) || '';
        const approvedCountByStatus = fullList.filter(item => getStatus(item) === 'approved').length;
        const hasTopLevelApproved = user.verifyStatus === 'approved';
        const approvedCountBefore = approvedCountByStatus > 0 ? approvedCountByStatus : (hasTopLevelApproved ? 1 : 0);
        const isTargetApproved = getStatus(target) === 'approved';
        const isSingleItemWithTopLevelApproved = approvedCountByStatus === 0 && hasTopLevelApproved && fullList.length === 1;
        const willLoseLastApproved = (approvedCountBefore === 1) && (isTargetApproved || isSingleItemWithTopLevelApproved);

        wx.showModal({
          title: '确认删除',
          content: willLoseLastApproved
            ? '删除后您将不再拥有已认证学历：您报名的活动中仍在首页展示的将自动取消（进行中或已结束的不取消），您发布的活动中仍在首页展示的将自动删除（进行中或已结束的不删除）。是否确认删除？'
            : '确定要删除此学历信息吗？',
          success: async (res) => {
            if (!res.confirm) return;
            try {
              const currentList = fullList.slice();
              currentList.splice(index, 1);
              const updateData = {};
              if (listSource === 'educations') {
                updateData.educations = currentList;
                if (Array.isArray(user.eductions)) updateData.eductions = currentList;
              } else if (listSource === 'eductions') {
                updateData.eductions = currentList;
                if (Array.isArray(user.educations)) updateData.educations = currentList;
              } else {
                updateData.certifications = currentList;
              }

              // 删除后判断是否需要触发清理
              const approvedCountAfterByStatus = currentList.filter(item => getStatus(item) === 'approved').length;
              const approvedCountAfter = approvedCountAfterByStatus > 0
                ? approvedCountAfterByStatus
                : (hasTopLevelApproved && currentList.length === 0 ? 0 : (hasTopLevelApproved ? 1 : 0));
              const shouldCleanup = approvedCountBefore > 0 && approvedCountAfter === 0;

              const updateResult = await db.collection('users').doc(user._id).update({ data: updateData });
              if (updateResult.stats && updateResult.stats.updated) {
                wx.showToast({ title: '已删除', icon: 'success' });
                this.loadCertifications();

                if (shouldCleanup) {
                  try {
                    wx.showLoading({ title: '清理中...' });
                    const cleanupRes = await wx.cloud.callFunction({
                      name: 'cleanupUserActivities',
                      data: { phoneNumber }
                    });
                    wx.hideLoading();
                    const result = (cleanupRes && cleanupRes.result) || {};
                    const deletedActivities = result.deletedActivities || 0;
                    const canceledRegistrations = result.canceledRegistrations || 0;
                    wx.showModal({
                      title: '已完成关联清理',
                      content: `因取消已认证学历，已取消您在首页展示的活动中的 ${canceledRegistrations} 个报名，并删除您发布的 ${deletedActivities} 个首页展示中的活动（进行中或已结束的活动未取消/未删除）。`,
                      showCancel: false
                    });
                  } catch (cleanupErr) {
                    console.error('删除后清理失败:', cleanupErr);
                    wx.showToast({ title: '清理失败', icon: 'none' });
                  }
                }
              } else {
                wx.showToast({ title: '删除失败', icon: 'none' });
              }
            } catch (err) {
              console.error('Failed to delete certification', err);
              wx.showToast({ title: '删除失败', icon: 'none' });
            }
          },
        });
      } catch (preErr) {
        console.error('删除前检查失败', preErr);
        wx.showToast({ title: '加载失败', icon: 'none' });
      }
    })();
  },
});
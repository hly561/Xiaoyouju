Page({
  data: {
    pendingEducations: [],
    currentManagerRole: '', // 当前管理员角色：school_manager 或 general_manager
    currentManagerSchools: [], // 当前管理员所属学校列表（manager_school 可为数组；否则从已通过学历汇总）
    showManagerSchoolsVisible: false
  },
  onLoad() {
    this.getCurrentManagerInfo();
  },
  
  // 获取当前管理员信息
  async getCurrentManagerInfo() {
    try {
      const phoneNumber = wx.getStorageSync('phoneNumber');
      if (!phoneNumber) {
        wx.showToast({ title: '请先登录', icon: 'none' });
        return;
      }
      
      const db = wx.cloud.database();
      const res = await db.collection('users')
        .where({ phoneNumber: phoneNumber })
        .get();
      
      if (res.data.length > 0) {
        const currentUser = res.data[0];
        const role = currentUser.role;
        // 归一化 manager_school 为数组
        let managerSchools = [];
        if (role === 'school_manager') {
          const ms = currentUser.manager_school;
          if (Array.isArray(ms)) {
            managerSchools = ms.map(s => String(s || '').trim()).filter(Boolean);
          } else if (typeof ms === 'string') {
            const s = String(ms).trim();
            if (s) managerSchools = [s];
          }
        }
        // 若未显式指定，回退到已通过学历中的所有学校（去重）
        if (managerSchools.length === 0) {
          const educations = Array.isArray(currentUser.educations) ? currentUser.educations : [];
          const approvedSchools = educations
            .filter(e => e && e.status === 'approved' && e.school)
            .map(e => String(e.school).trim())
            .filter(Boolean);
          managerSchools = Array.from(new Set(approvedSchools));
        }
        this.setData({
          currentManagerRole: role,
          currentManagerSchools: managerSchools
        });
        console.log('当前管理员信息:', {
          role: currentUser.role,
          schools: managerSchools
        });
        
        // 获取管理员信息后再获取待审核学历条目
        this.getPendingUsers();
      } else {
        wx.showToast({ title: '管理员信息获取失败', icon: 'none' });
      }
    } catch (error) {
      console.error('获取管理员信息失败:', error);
      wx.showToast({ title: '获取管理员信息失败', icon: 'none' });
    }
  },
  onShowManagerSchools() {
    if (this.data.currentManagerRole !== 'school_manager') return;
    this.setData({ showManagerSchoolsVisible: true });
  },
  onHideManagerSchools() {
    this.setData({ showManagerSchoolsVisible: false });
  },
  async getPendingUsers() {
    const db = wx.cloud.database();
    const _ = db.command;
    try {
      // 获取包含至少一个待审核学历条目的用户
      const res = await db.collection('users').where({
        educations: _.elemMatch({ status: 'pending' })
      }).get();
      const users = res.data || [];

      // 展平为待审核学历条目列表
      let pendingItems = [];
      users.forEach(user => {
        const edus = Array.isArray(user.educations) ? user.educations : [];
        edus.forEach((edu, idx) => {
          if (edu && edu.status === 'pending') {
            pendingItems.push({
              userId: user._id,
              userName: user.name || '未填写昵称',
              phoneNumber: user.phoneNumber,
              educationIndex: idx,
              realname: edu.realname,
              school: edu.school,
              degree: edu.degree,
              major: edu.major,
              graduationYear: edu.graduationYear,
              verifyImage: edu.verifyImage,
              schoolInputMethod: edu.schoolInputMethod,
              customSchool: user.customSchool || null,
              image: user.image
            });
          }
        });
      });

      console.log('待审核学历条目数量:', pendingItems.length);

      // 根据当前管理员角色筛选条目
      const currentRole = this.data.currentManagerRole;
      const currentSchools = Array.isArray(this.data.currentManagerSchools) ? this.data.currentManagerSchools : [];
      if (currentRole === 'school_manager' && currentSchools.length > 0) {
        const set = new Set(currentSchools.map(s => String(s || '').trim()).filter(Boolean));
        pendingItems = pendingItems.filter(item => set.has(item.school));
        console.log(`校管理员筛选后的条目数量: ${pendingItems.length}，学校: ${Array.from(set).join('、')}`);
      } else if (currentRole === 'general_manager') {
        // 总管理员：可查看所有学校的待审核条目（不再根据是否有校管理员进行过滤）
        console.log(`总管理员查看全部待审核条目，数量: ${pendingItems.length}`);
      }

      // 收集所有 fileID 并替换为临时链接
      const fileList = pendingItems
        .filter(i => i.verifyImage && i.verifyImage.startsWith('cloud://'))
        .map(i => i.verifyImage);
      const fileMap = {};
      if (fileList.length > 0) {
        const tempRes = await wx.cloud.getTempFileURL({ fileList });
        tempRes.fileList.forEach(f => {
          fileMap[f.fileID] = f.tempFileURL;
        });
      }
      pendingItems = pendingItems.map(i => ({
        ...i,
        verifyImage: fileMap[i.verifyImage] || i.verifyImage
      }));

      this.setData({ pendingEducations: pendingItems });
    } catch (e) {
      console.error('获取待审核用户失败:', e);
      wx.showToast({ title: '获取待审核用户失败', icon: 'none' });
    }
  },
  
  // 筛选没有校管理员的学校的条目
  async filterItemsWithoutSchoolManager(items) {
    try {
      const db = wx.cloud.database();
      const filteredItems = [];
      // 获取所有学校的管理员信息（根据管理员已认证的学校）
      const schoolManagersRes = await db.collection('users')
        .where({ role: 'school_manager' })
        .field({ educations: true, manager_school: true })
        .get();
      const schoolsWithManagers = new Set();
      schoolManagersRes.data.forEach(manager => {
        const ms = manager.manager_school;
        let list = [];
        if (Array.isArray(ms)) {
          list = ms.map(s => String(s || '').trim()).filter(Boolean);
        } else if (typeof ms === 'string') {
          const s = String(ms).trim();
          if (s) list = [s];
        }
        if (list.length === 0) {
          const edus = Array.isArray(manager.educations) ? manager.educations : [];
          list = edus
            .filter(e => e && e.status === 'approved' && e.school)
            .map(e => String(e.school).trim())
            .filter(Boolean);
        }
        list.forEach(s => schoolsWithManagers.add(s));
      });
      console.log('有校管理员的学校:', Array.from(schoolsWithManagers));
      // 筛选出没有校管理员的学校的条目
      for (const item of items) {
        if (!schoolsWithManagers.has(item.school)) {
          filteredItems.push(item);
        }
      }
      return filteredItems;
    } catch (error) {
      console.error('筛选用户失败:', error);
      return items; // 出错时返回所有条目
    }
  },
  onPreviewImage(e) {
    const img = e.currentTarget.dataset.img;
    if (img) {
      wx.previewImage({
        urls: [img],
        current: img
      });
    }
  },
  async onApproveUser(e) {
    const userId = e.currentTarget.dataset.userId;
    const educationIndex = Number(e.currentTarget.dataset.educationIndex);
    const db = wx.cloud.database();
    
    wx.showModal({
      title: '确认操作',
      content: '是否确认通过？',
      confirmText: '通过',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          try {
            console.log('开始更新用户状态，用户ID:', userId);
            console.log('用户ID类型:', typeof userId);
            
            // 先查询记录是否存在
            const checkResult = await db.collection('users').doc(userId).get();
            console.log('查询用户记录结果:', checkResult);
            
            if (!checkResult.data) {
              throw new Error('用户记录不存在');
            }
            
            // 不再使用顶层verifyStatus
            console.log('用户完整数据:', checkResult.data);
            console.log('准备更新的userId:', userId);
            console.log('准备更新的条目索引:', educationIndex);
            console.log('准备更新的字段:', { status: 'approved' });
            
            // 使用云函数更新用户状态（避免客户端权限限制）
            const updateResult = await wx.cloud.callFunction({
              name: 'reviewUser',
              data: {
                userId: userId,
                action: 'approve',
                verifyStatus: 'approved',
                educationIndex
              },
              timeout: 10000
            });
            
            console.log('云函数调用结果:', updateResult);
            
            if (updateResult.errMsg !== 'cloud.callFunction:ok') {
              throw new Error('云函数调用失败: ' + updateResult.errMsg);
            }
            
            if (!updateResult.result.success) {
              throw new Error('审核操作失败: ' + (updateResult.result.error || '未知错误'));
            }
            
            // 注意：微信小程序云数据库在字段值相同时可能返回updated:0，这是正常的
            // 只要errMsg为ok，就认为更新成功，不再检查stats.updated
            
            // 验证更新是否成功（可选，用于调试）
            const verifyResult = await db.collection('users').doc(userId).get();
            const updatedItem = (verifyResult.data.educations || [])[educationIndex];
            console.log('验证更新后的学历条目状态:', updatedItem && updatedItem.status);
            
            // 注意：由于数据库同步延迟或缓存问题，验证可能不准确
            // 只要update操作返回成功，就认为更新成功
            // 鉴于数据库同步延迟，验证可能不准确
            
            // 如果用户有自定义学校，将其添加到学校列表
            if (checkResult.data.customSchool && checkResult.data.customSchool.isCustomInput) {
              await this.addSchoolToList(checkResult.data.customSchool);
            }
            
            // 向用户发送系统消息
            await this.sendApprovalMessage(userId);
            
            wx.showToast({ title: '已通过', icon: 'success' });
            // 乐观移除本地待审核列表中的该条目，避免视觉残留
            try {
              const list = (this.data.pendingEducations || []).slice();
              const removeIdx = list.findIndex(item => item.userId === userId && item.educationIndex === educationIndex);
              if (removeIdx >= 0) {
                list.splice(removeIdx, 1);
                this.setData({ pendingEducations: list });
              }
            } catch (e) {}
            // 重新拉取一次，保证与云端一致
            this.getPendingUsers();
          } catch (err) {
            console.error('审核通过操作失败:', err);
            console.error('错误详情:', {
              message: err.message,
              code: err.code,
              errCode: err.errCode,
              errMsg: err.errMsg
            });
            wx.showToast({ 
              title: `操作失败: ${err.message || '未知错误'}`, 
              icon: 'none',
              duration: 3000
            });
          }
        }
      }
    });
  },
  
  // 将自定义学校添加到学校列表
  async addSchoolToList(customSchool) {
    try {
      const { region, subRegion, schoolName } = customSchool;
      
      console.log('准备添加学校到代码数据:', { region, subRegion, schoolName });
      
      // 通知学校选择器页面添加新学校
      const pages = getCurrentPages();
      const schoolSelectorPage = pages.find(page => page.route === 'pages/school-selector/index');
      
      if (schoolSelectorPage && schoolSelectorPage.addSchoolToData) {
        schoolSelectorPage.addSchoolToData(region, subRegion, schoolName);
        console.log('学校已添加到学校选择器数据');
      } else {
        // 如果学校选择器页面不在栈中，使用全局事件
        getApp().globalData = getApp().globalData || {};
        getApp().globalData.newSchools = getApp().globalData.newSchools || [];
        getApp().globalData.newSchools.push({
          region,
          subRegion,
          schoolName,
          addTime: new Date()
        });
        console.log('学校已添加到全局数据');
      }
      
      // 更新自定义学校状态为已批准
      const db = wx.cloud.database();
      await db.collection('users')
        .where({
          'customSchool.schoolName': schoolName,
          'customSchool.region': region,
          'customSchool.subRegion': subRegion
        })
        .update({
          data: {
            'customSchool.status': 'approved'
          }
        });
      
      console.log('自定义学校状态已更新为approved');
      
    } catch (error) {
      console.error('添加学校到列表失败:', error);
      // 不抛出错误，避免影响审核流程
    }
  },
  
  // 发送校友认证通过消息
  async sendApprovalMessage(userId) {
    const db = wx.cloud.database();
    try {
      // 获取用户信息
      const userRes = await db.collection('users').doc(userId).get();
      const user = userRes.data;
      
      if (!user) {
        console.error('用户不存在');
        return;
      }
      
      // 创建系统消息
      const message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: user.phoneNumber || userId, // 优先使用手机号作为用户标识
        phoneNumber: user.phoneNumber, // 明确保存手机号
        openid: user.openid || user._openid, // 保存openid
        targetUserId: userId, // 原始用户ID
        type: 'system',
        name: '系统消息',
        avatar: '',
        time: this.formatTime(new Date()),
        lastMessage: '恭喜您！您的校友认证已通过审核，现在可以享受更多校友专属功能。',
        content: '恭喜您！您的校友认证已通过审核，现在可以享受更多校友专属功能。',
        isRead: false,
        createdAt: new Date()
      };
      

      
      // 检查并创建messages集合，然后存储消息
      try {
        await db.collection('messages').add({
          data: message
        });
        
        // 更新接收消息用户的messageAllread状态
        try {
          await wx.cloud.callFunction({
            name: 'updateAllUsersMessageStatus',
            data: {
              phoneNumbers: [user.phoneNumber]
            }
          });
          console.log('更新接收消息用户messageAllread状态成功');
        } catch (updateError) {
          console.error('更新接收消息用户messageAllread状态失败:', updateError);
        }

      } catch (collectionError) {
        if (collectionError.errCode === -502005) {
          // 集合不存在，先创建集合再添加数据

          try {
            // 创建集合的方式是直接添加第一条数据
            await db.collection('messages').add({
              data: message
            });

          } catch (createError) {
            console.error('创建messages集合失败:', createError);
            // 如果还是失败，可能需要在云开发控制台手动创建集合
            wx.showToast({
              title: '消息发送失败，请联系管理员',
              icon: 'none'
            });
          }
        } else {
          throw collectionError;
        }
      }
    } catch (error) {
      console.error('发送系统消息失败:', error);
    }
  },
  
  // 格式化时间
  formatTime(date) {
    const now = new Date();
    const target = new Date(date);
    const diff = now - target;
    
    if (diff < 60000) { // 1分钟内
      return '刚刚';
    } else if (diff < 3600000) { // 1小时内
      return `${Math.floor(diff / 60000)}分钟前`;
    } else if (diff < 86400000) { // 24小时内
      return `${Math.floor(diff / 3600000)}小时前`;
    } else {
      return `${target.getMonth() + 1}月${target.getDate()}日`;
    }
  },
  
  async onRejectUser(e) {
    const userId = e.currentTarget.dataset.userId;
    const educationIndex = Number(e.currentTarget.dataset.educationIndex);
    const db = wx.cloud.database();
    wx.showModal({
      title: '确认操作',
      content: '是否确认拒绝？',
      confirmText: '拒绝',
      cancelText: '取消',
      success: async (res) => {
        if (res.confirm) {
          try {
            console.log('开始拒绝用户，用户ID:', userId);
            console.log('用户ID类型:', typeof userId);
            
            // 先查询记录是否存在
            const checkResult = await db.collection('users').doc(userId).get();
            console.log('查询用户记录结果:', checkResult);
            
            if (!checkResult.data) {
              throw new Error('用户记录不存在');
            }
            
            // 不再使用顶层verifyStatus
            console.log('用户完整数据:', checkResult.data);
            console.log('准备更新的userId:', userId);
            console.log('准备更新的条目索引:', educationIndex);
            console.log('准备更新的字段:', { status: 'rejected' });
            
            // 使用云函数更新用户状态（避免客户端权限限制）
            const updateResult = await wx.cloud.callFunction({
              name: 'reviewUser',
              data: {
                userId: userId,
                action: 'reject',
                verifyStatus: 'unverified',
                educationIndex
              },
              timeout: 10000
            });
            
            console.log('云函数调用结果:', updateResult);
            
            if (updateResult.errMsg !== 'cloud.callFunction:ok') {
              throw new Error('云函数调用失败: ' + updateResult.errMsg);
            }
            
            if (!updateResult.result.success) {
              throw new Error('审核操作失败: ' + (updateResult.result.error || '未知错误'));
            }
            
            // 注意：微信小程序云数据库在字段值相同时可能返回updated:0，这是正常的
            // 只要errMsg为ok，就认为更新成功，不再检查stats.updated
            
            // 验证更新是否成功（可选，用于调试）
            const verifyResult = await db.collection('users').doc(userId).get();
            const updatedItem = (verifyResult.data.educations || [])[educationIndex];
            console.log('验证更新后的学历条目状态:', updatedItem && updatedItem.status);
            
            // 注意：由于数据库同步延迟或缓存问题，验证可能不准确
            // 只要update操作返回成功，就认为更新成功
            // 鉴于数据库同步延迟，验证可能不准确
            
            // 向用户发送拒绝消息
            await this.sendRejectionMessage(userId);
            
            wx.showToast({ title: '已拒绝', icon: 'success' });
            // 乐观移除本地待审核列表中的该条目，避免视觉残留
            try {
              const list = (this.data.pendingEducations || []).slice();
              const removeIdx = list.findIndex(item => item.userId === userId && item.educationIndex === educationIndex);
              if (removeIdx >= 0) {
                list.splice(removeIdx, 1);
                this.setData({ pendingEducations: list });
              }
            } catch (e) {}
            // 重新拉取一次，保证与云端一致
            this.getPendingUsers();
          } catch (err) {
            console.error('拒绝操作失败:', err);
            console.error('错误详情:', {
              message: err.message,
              code: err.code,
              errCode: err.errCode,
              errMsg: err.errMsg
            });
            wx.showToast({ 
              title: `操作失败: ${err.message || '未知错误'}`, 
              icon: 'none',
              duration: 3000
            });
          }
        }
      }
    });
  },
  
  // 发送校友认证拒绝消息
  async sendRejectionMessage(userId) {
    const db = wx.cloud.database();
    try {
      // 获取用户信息
      const userRes = await db.collection('users').doc(userId).get();
      const user = userRes.data;
      
      if (!user) {
        console.error('用户不存在');
        return;
      }
      
      // 创建系统消息
      const message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        userId: user.phoneNumber || userId, // 优先使用手机号作为用户标识
        phoneNumber: user.phoneNumber, // 明确保存手机号
        openid: user.openid || user._openid, // 保存openid
        targetUserId: userId, // 原始用户ID
        type: 'system',
        name: '系统消息',
        avatar: '',
        time: this.formatTime(new Date()),
        lastMessage: '很抱歉，您的校友认证未通过审核。如有疑问，请重新提交认证材料或联系管理员。',
        content: '很抱歉，您的校友认证未通过审核。如有疑问，请重新提交认证材料或联系管理员。',
        isRead: false,
        createdAt: new Date()
      };
      

      
      // 检查并创建messages集合，然后存储消息
      try {
        await db.collection('messages').add({
          data: message
        });
        
        // 更新接收消息用户的messageAllread状态
        try {
          await wx.cloud.callFunction({
            name: 'updateAllUsersMessageStatus',
            data: {
              phoneNumbers: [user.phoneNumber]
            }
          });
          console.log('更新接收消息用户messageAllread状态成功');
        } catch (updateError) {
          console.error('更新接收消息用户messageAllread状态失败:', updateError);
        }

      } catch (collectionError) {
        if (collectionError.errCode === -502005) {
          // 集合不存在，先创建集合再添加数据

          try {
            // 创建集合的方式是直接添加第一条数据
            await db.collection('messages').add({
              data: message
            });
            
            // 更新接收消息用户的messageAllread状态
            try {
              await wx.cloud.callFunction({
                name: 'updateAllUsersMessageStatus',
                data: {
                  phoneNumbers: [user.phoneNumber]
                }
              });
              console.log('更新接收消息用户messageAllread状态成功');
            } catch (updateError) {
              console.error('更新接收消息用户messageAllread状态失败:', updateError);
            }

          } catch (createError) {
            console.error('创建messages集合失败:', createError);
            // 如果还是失败，可能需要在云开发控制台手动创建集合
            wx.showToast({
              title: '消息发送失败，请联系管理员',
              icon: 'none'
            });
          }
        } else {
          throw collectionError;
        }
      }
    } catch (error) {
      console.error('发送拒绝消息失败:', error);
    }
  }
});

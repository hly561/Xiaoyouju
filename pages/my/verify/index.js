import request from '../../../api/request.js';



Page({
  data: {
    formData: {
      realname: '',
      degree: '',
      school: '',
      major: '',
      graduationYear: '',
      verifyImage: ''
    },
    rules: {
      realname: { required: true, message: '请输入真实姓名' },
      school: { required: true, message: '请输入毕业学校' },
      major: { required: true, message: '请输入专业' },
      graduationYear: { required: true, message: '请选择毕业年份' },
      verifyImage: { required: true, message: '请上传认证图片' }
    },
    years: [],
    selectedYearIndex: -1,
    degreeOptions: ['本科', '硕士', '博士'],
    degreeIndex: -1,

    currentYear: new Date().getFullYear(),
    // 已填学历列表（用于卡片展示）
    educationList: [],
    // 当前是否在编辑某条学历
    editingIndex: -1
  },

  onLoad() {
    this.initYearList();
  },

  onShow() {
    // 当从学校选择器返回时，检查学校数据
    const currentFormData = this.data.formData;
    if (currentFormData.school) {
      console.log('学校已选择:', currentFormData.school);
    }

    // 获取并展示用户已填的学历列表（兼容 educations / eductions 两种字段名）
    try {
      const phoneNumber = wx.getStorageSync('phoneNumber');
      if (!phoneNumber) return;
      const db = wx.cloud.database();
      db.collection('users').where({ phoneNumber }).get().then(res => {
        if (res.data && res.data.length > 0) {
          const user = res.data[0];
          const educationList = user.educations || user.eductions || [];
          this.setData({ educationList });

          // 如果从“认证”页进入了编辑态，则读取索引并自动载入
          try {
            const editIndex = wx.getStorageSync('educationEditIndex');
            if (typeof editIndex === 'number' && editIndex >= 0 && editIndex < educationList.length) {
              this.onEditEducation({ currentTarget: { dataset: { index: editIndex } } });
              wx.removeStorageSync('educationEditIndex');
            }
          } catch (e) {}
        }
      }).catch(() => {});
    } catch (e) {}
  },

  initYearList() {
    const currentYear = new Date().getFullYear();
    const years = [];
    
    // 添加未来年份：2026、2027、2028、2029、2030
    const futureYears = [2030, 2029, 2028, 2027, 2026];
    for (const year of futureYears) {
      if (year > currentYear) {
        years.push(year);
      }
    }
    
    // 添加当前年份及过去60年
    for (let i = currentYear; i >= currentYear - 60; i--) {
      years.push(i);
    }
    
    this.setData({ 
      years,
      currentYear 
    });
  },

  onInputChange(e) {
    const { field } = e.currentTarget.dataset;
    const { value } = e.detail;
    
    if (field === 'graduationYear') {
      // 对于毕业年份，使用years数组中的实际年份值
      const selectedYear = this.data.years[value];
      this.setData({
        [`formData.${field}`]: selectedYear,
        selectedYearIndex: value // 保存选中的索引
      });
    } else if (field === 'degree') {
      const selectedDegree = this.data.degreeOptions[value];
      this.setData({
        [`formData.${field}`]: selectedDegree,
        degreeIndex: value
      });
    } else {
      this.setData({
        [`formData.${field}`]: value
      });
    }
  },

  // 选择学校
  onSelectSchool() {
    wx.navigateTo({
      url: '/pages/school-selector/index'
    });
  },

  onSchoolNotFound() {
    // 直接弹出输入框让用户填写学校名称
    wx.showModal({
      title: '添加学校',
      content: '',
      editable: true,
      placeholderText: '请输入您的学校全称',
      success: async (res) => {
        if (res.confirm && res.content && res.content.trim()) {
          const schoolName = res.content.trim();
          
          // 直接设置学校名称到表单数据
          this.setData({
            'formData.school': schoolName
          });
          
          console.log('用户自定义学校:', schoolName);

          // 保存自定义学校到数据库，标记为“手动”新增，供提交时识别
          try {
            const db = wx.cloud.database();
            const phoneNumber = wx.getStorageSync('phoneNumber');
            if (phoneNumber) {
              await db.collection('users').where({ phoneNumber }).update({
                data: {
                  customSchool: {
                    region: '未知',
                    subRegion: '未知',
                    schoolName: schoolName,
                    isCustomInput: true,
                    createTime: new Date(),
                    status: 'pending'
                  },
                  updateTime: db.serverDate()
                }
              });
              console.log('已保存自定义学校到数据库（来自认证页“没有找到我的学校”）：', schoolName);
            }
          } catch (err) {
            console.warn('保存自定义学校失败（不影响填写）:', err);
          }
          
          wx.showModal({
             title: '添加成功',
             content: '感谢您的反馈！审核通过后会将学校添加到学校列表中。',
             showCancel: false,
             confirmText: '知道了'
           });
        } else if (res.confirm) {
          wx.showToast({
            title: '请输入有效的学校名称',
            icon: 'none'
          });
        }
      }
    });
  },





  async onChooseImage() {
    try {
      const res = await wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera']
      });

      const tempFilePath = res.tempFilePaths[0];
      
      // 检查图片大小
      const imageInfo = await wx.getFileInfo({
        filePath: tempFilePath
      });
      
      const maxSize = 10 * 1024 * 1024; // 10MB
      if (imageInfo.size > maxSize) {
        wx.showToast({
          title: '图片大小不能超过10MB',
          icon: 'none'
        });
        return;
      }

      this.setData({
        'formData.verifyImage': tempFilePath
      });
    } catch (error) {
      console.error('选择图片失败:', error);
      wx.showToast({
        title: '选择图片失败',
        icon: 'none'
      });
    }
  },

  async uploadImage(tempFilePath) {
    try {
      if (!tempFilePath || (typeof tempFilePath === 'string' && tempFilePath.trim() === '')) {
        throw new Error('图片路径无效');
      }
      if (typeof tempFilePath === 'string' && tempFilePath.startsWith('cloud://')) {
        // 已是云文件ID，直接返回
        return tempFilePath;
      }
      const cloudPath = `verify/${Date.now()}-${Math.random().toString(36).substr(2)}.jpg`;
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath,
        filePath: tempFilePath
      });
      return uploadResult.fileID;
    } catch (error) {
      console.error('上传图片失败:', error);
      throw error;
    }
  },

  async onSubmit() {
    try {
      const { formData } = this.data;
      
      // 检查网络状态
      const networkType = await wx.getNetworkType();
      if (networkType.networkType === 'none') {
        wx.showToast({
          title: '网络连接不可用',
          icon: 'none'
        });
        return;
      }

      // 检查手机号是否存在
      const phoneNumber = wx.getStorageSync('phoneNumber');
      if (!phoneNumber) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });
        setTimeout(() => {
          wx.navigateTo({
            url: '/pages/login/index'
          });
        }, 1500);
        return;
      }
      
      // 表单验证
      for (const key in this.data.rules) {
        const rule = this.data.rules[key];
        const value = formData[key];
        
        // 检查必填字段
        if (rule.required) {
          if (!value) {
            wx.showToast({
              title: rule.message,
              icon: 'none'
            });
            return;
          }
          
          // 对字符串类型的字段进行 trim 检查
          if (typeof value === 'string' && value.trim() === '') {
            wx.showToast({
              title: rule.message,
              icon: 'none'
            });
            return;
          }
        }
      }
      
      // 验证学校名称长度
      if (formData.school && formData.school.trim().length < 2) {
        wx.showToast({
          title: '学校名称至少需要2个字符',
          icon: 'none'
        });
        return;
      }

      wx.showLoading({ title: '提交中...' });

      try {
        // 处理认证材料图片：如果是 cloud:// 文件ID则复用，否则执行上传
        const imageVal = formData.verifyImage;
        if (!imageVal || (typeof imageVal === 'string' && imageVal.trim() === '')) {
          throw new Error('请先选择认证图片');
        }

        let fileID = imageVal;
        const isCloudId = typeof imageVal === 'string' && imageVal.startsWith('cloud://');
        if (!isCloudId) {
          // 非云ID，视为本地临时路径，执行上传
          fileID = await this.uploadImage(imageVal);
          if (!fileID) {
            throw new Error('图片上传失败');
          }
        }

        // 保存认证信息到数据库
        const db = wx.cloud.database();
        const _ = db.command;
        
        // 先获取用户当前信息，检查是否有自定义学校数据
        const userResult = await db.collection('users').where({
          phoneNumber: phoneNumber
        }).get();
        
        // 仅更新通用字段（例如更新时间），认证信息改为写入educations数组
        let updateData = {
          updateTime: db.serverDate()
        };
        
        // 如果用户有自定义学校信息，仅当当前选择的学校与自定义学校一致时才标记为“手动”
        if (userResult.data && userResult.data.length > 0) {
          const userData = userResult.data[0];
          const hasCustom = !!(userData.customSchool && userData.customSchool.isCustomInput);
          const matchCustom = hasCustom && (formData.school === userData.customSchool.schoolName);

          // 决定学校录入方式（仅用于本次学历条目）
          const inputMethod = matchCustom ? '手动' : '选择';
          // 清除可能残留的自定义学校相关字段，避免误用顶层字段（认证信息只存在于educations中）
          updateData.schoolRegion = _.remove();
          updateData.schoolSubRegion = _.remove();
          // 保留customSchool用于学校新增流程（不移除）

          console.log(matchCustom ? '用户通过手动方式填写学校' : '用户通过列表选择学校', {
            school: formData.school,
            inputMethod
          });
          // 将inputMethod传递到条目构建阶段
          this._currentSchoolInputMethod = inputMethod;

          try {
            const baseRaw = Array.isArray(userData.educations)
              ? userData.educations
              : (Array.isArray(userData.eductions)
                ? userData.eductions
                : (Array.isArray(userData.certifications)
                  ? userData.certifications
                  : []));
            const baseApproved = (baseRaw || []).filter(e => {
              const s = e && (e.status || e.verifyStatus);
              return s === 'approved';
            });
            const mapped = baseApproved.map(e => {
              const y = e && (e.graduationYear || (e.endDate ? String(e.endDate).split('-')[0] : ''));
              return {
                school: (e && e.school) || '',
                major: (e && e.major) || '',
                degree: (e && e.degree) || '',
                graduationYear: y || ''
              };
            }).filter(x => x.school || x.major || x.graduationYear || x.degree);
            const seen = new Set();
            const dedup = [];
            mapped.forEach(ed => {
              const k = `${ed.school}|${ed.major}|${ed.degree}|${ed.graduationYear}`;
              if (!seen.has(k)) { seen.add(k); dedup.push(ed); }
            });
            if (dedup.length > 0) {
              updateData.approvedEducationSnapshot = dedup;
            }
          } catch (e) {}
        }
        
        // 组装本次学历条目（用于多段学历存储）
        const newEducationItem = {
          realname: formData.realname,
          degree: formData.degree,
          school: formData.school,
          major: formData.major,
          graduationYear: formData.graduationYear,
          verifyImage: fileID,
          status: 'pending',
          schoolInputMethod: this._currentSchoolInputMethod || '选择',
          createdAt: db.serverDate()
        };

        // 新增：将本次提交作为一个批次写入到 education_submissions 集合（支持一次提交多个学历）
        let submissionId = ''
        if (userResult.data && userResult.data.length > 0) {
          const userData = userResult.data[0]
          const submissionData = {
            userId: userData._id,
            phoneNumber,
            items: [newEducationItem],
            status: 'pending',
            createdAt: db.serverDate(),
            updatedAt: db.serverDate()
          }
          let addRes
          try {
            addRes = await db.collection('education_submissions').add({ data: submissionData })
          } catch (err) {
            const msg = (err && err.errMsg) || ''
            // 集合不存在：尝试创建集合后重试一次
            if (msg.includes('collection not exists') || msg.includes('Db or Table not exist') || err.errCode === -502005) {
              try {
                await wx.cloud.callFunction({ name: 'initEducationSubmissions' })
              } catch (fnErr) {
                console.warn('创建集合云函数不可用，跳过批次写入：', fnErr)
              }
              try {
                addRes = await db.collection('education_submissions').add({ data: submissionData })
              } catch (retryErr) {
                console.warn('批次集合仍不可用，跳过批次写入：', retryErr)
                addRes = null
              }
            } else {
              console.warn('写入批次失败，跳过批次写入，仅保存到用户档案：', err)
              addRes = null
            }
          }
          submissionId = addRes && addRes._id ? addRes._id : ''
        }

        // 将批次ID写入用户的 educations 条目，便于联查
        const newEducationItemWithLink = submissionId
          ? { ...newEducationItem, submissionId }
          : newEducationItem

        // 判断用户是否已有educations数组，选择push或初始化
        let educationUpdate;
        if (userResult.data && userResult.data.length > 0 && Array.isArray(userResult.data[0].educations)) {
          educationUpdate = { educations: _.push([newEducationItemWithLink]) };
        } else {
          educationUpdate = { educations: [newEducationItemWithLink] };
        }

        // 更新users集合中的用户认证信息（支持新增或编辑）
        let updateResult;
        const isEditing = this.data.editingIndex >= 0;
        // 供上一页乐观更新使用的变量
        let replacedVar = null;
        let idxVar = -1;
        if (!isEditing) {
          updateResult = await db.collection('users').where({ phoneNumber }).update({ data: { ...updateData, ...educationUpdate } });
        } else {
          const userRes2 = await db.collection('users').where({ phoneNumber }).get();
          if (!userRes2.data || !userRes2.data.length) throw new Error('用户不存在');
          const user2 = userRes2.data[0];
          const currentList = (user2.educations || user2.eductions || []).slice();
          const idx = this.data.editingIndex;
          const oldItem = currentList[idx] || {};
          const replaced = {
            ...oldItem,
            ...newEducationItemWithLink,
            createdAt: oldItem.createdAt || newEducationItemWithLink.createdAt,
            updatedAt: db.serverDate()
          };
          currentList[idx] = replaced;
          // 记录供上一页乐观更新使用
          replacedVar = replaced;
          idxVar = idx;
          const updateDataEditing = {
            ...updateData,
            educations: currentList
          };
          // 若存在 eductions 字段，也同步更新
          if (Array.isArray(user2.eductions)) {
            updateDataEditing.eductions = currentList;
          }
          try {
            const baseRaw = Array.isArray(user2.educations)
              ? user2.educations
              : (Array.isArray(user2.eductions)
                ? user2.eductions
                : (Array.isArray(user2.certifications)
                  ? user2.certifications
                  : []));
            const baseApproved = (baseRaw || []).filter(e => {
              const s = e && (e.status || e.verifyStatus);
              return s === 'approved';
            });
            const mapped = baseApproved.map(e => {
              const y = e && (e.graduationYear || (e.endDate ? String(e.endDate).split('-')[0] : ''));
              return {
                school: (e && e.school) || '',
                major: (e && e.major) || '',
                degree: (e && e.degree) || '',
                graduationYear: y || ''
              };
            }).filter(x => x.school || x.major || x.graduationYear || x.degree);
            const seen = new Set();
            const dedup = [];
            mapped.forEach(ed => {
              const k = `${ed.school}|${ed.major}|${ed.degree}|${ed.graduationYear}`;
              if (!seen.has(k)) { seen.add(k); dedup.push(ed); }
            });
            if (dedup.length > 0) {
              updateDataEditing.approvedEducationSnapshot = dedup;
            }
          } catch (e) {}
          updateResult = await db.collection('users').doc(user2._id).update({ data: updateDataEditing });
        }

        if (!updateResult.stats.updated) {
          throw new Error('更新数据失败');
        }

        // 若处于编辑态且本次选择的是本地新图片，更新成功后删除旧的云端图片以实现替换
        try {
          const oldImageFileID = (typeof oldItem !== 'undefined') ? oldItem.verifyImage : '';
          const replacedImageFileID = fileID;
          const shouldDeleteOld = this.data.editingIndex >= 0
            && typeof oldImageFileID === 'string'
            && oldImageFileID.startsWith('cloud://')
            && typeof replacedImageFileID === 'string'
            && replacedImageFileID.startsWith('cloud://')
            && oldImageFileID !== replacedImageFileID
            && !isCloudId; // 本次提交前选择的是本地临时路径

          if (shouldDeleteOld) {
            await wx.cloud.deleteFile({ fileList: [oldImageFileID] });
          }
        } catch (delErr) {
          console.warn('删除旧认证图片失败（不影响提交）：', delErr);
        }

        wx.hideLoading();
        if (isEditing) {
          wx.showToast({ title: '修改成功', icon: 'success' });
        } else {
          wx.showToast({ title: '提交成功', icon: 'success' });
        }

        // 写入本地刷新负载，上一页（认证列表）可在onShow中立即乐观更新
        try {
          const payload = {
            type: isEditing ? 'edit' : 'add',
            index: isEditing ? idxVar : -1,
            item: isEditing ? replacedVar : newEducationItemWithLink
          };
          wx.setStorageSync('eduRefreshPayload', payload);
        } catch (e) {}

        // 返回上一页前主动刷新上一页列表，确保实时更新
        setTimeout(() => {
          // 编辑后刷新列表并清理编辑态
          this.setData({ editingIndex: -1 });
          try {
            const pages = getCurrentPages();
            const prevPage = pages[pages.length - 2];
            if (prevPage && typeof prevPage.loadCertifications === 'function') {
              prevPage.loadCertifications();
            }
          } catch (e) {
            console.warn('刷新上一页失败（不影响返回）：', e);
          }
          wx.navigateBack();
        }, 800);

      } catch (uploadError) {
        throw new Error(uploadError.message || '提交失败');
      }

    } catch (error) {
      console.error('提交认证信息失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: error.message || '提交失败，请重试',
        icon: 'none'
      });
    }
  },

  // 点击“修改”按钮：将选中卡片数据载入表单进行编辑
  onEditEducation(e) {
    try {
      const index = e.currentTarget.dataset.index;
      const item = this.data.educationList[index];
      if (!item) return;
      this.setData({
        editingIndex: index,
        formData: {
          realname: item.realname || '',
          degree: item.degree || '',
          school: item.school || '',
          major: item.major || '',
          graduationYear: item.graduationYear || '',
          verifyImage: item.verifyImage || ''
        },
        degreeIndex: this.data.degreeOptions.indexOf(item.degree || '')
      });
      wx.showToast({ title: '已载入，可修改后提交', icon: 'none' });
    } catch (err) {}
  },

  // 点击“删除”按钮：移除该条学历
  async onDeleteEducation(e) {
    const index = e.currentTarget.dataset.index;
    const target = this.data.educationList[index];
    if (!target) return;
    const phoneNumber = wx.getStorageSync('phoneNumber');
    if (!phoneNumber) {
      wx.showToast({ title: '请先登录', icon: 'none' });
      return;
    }
    try {
      const db = wx.cloud.database();
      // 读取最新用户数据，基于云端判断是否为“最后一个已认证”
      const userRes = await db.collection('users').where({ phoneNumber }).get();
      if (!userRes.data || !userRes.data.length) return;
      const user = userRes.data[0];
      const currentList = (user.educations || user.eductions || []).slice();

      const approvedCountByStatus = currentList.filter(item => item && item.status === 'approved').length;
      const hasTopLevelApproved = user.verifyStatus === 'approved';
      const approvedCountBefore = approvedCountByStatus > 0 ? approvedCountByStatus : (hasTopLevelApproved ? 1 : 0);
      const isTargetApproved = target && target.status === 'approved';
      const isSingleItemWithTopLevelApproved = approvedCountByStatus === 0 && hasTopLevelApproved && currentList.length === 1;
      const willLoseLastApproved = (approvedCountBefore === 1) && (isTargetApproved || isSingleItemWithTopLevelApproved);

      wx.showModal({
        title: '确认删除',
        content: willLoseLastApproved
          ? '删除后您将不再拥有已认证学历：您报名的活动中仍在首页展示的将自动取消（进行中或已结束的不取消），您发布的活动中仍在首页展示的将自动删除（进行中或已结束的不删除）。是否确认删除？'
          : '确定删除该学历信息吗？',
        success: async (res) => {
          if (!res.confirm) return;
          try {
            const list = currentList.slice();
            if (!list.length) return;
            list.splice(index, 1);
            const update = {};
            // 同步两个字段，尽可能保持一致
            update.educations = list;
            if (Array.isArray(user.eductions)) {
              update.eductions = list;
            }

            // 删除后再次判断是否需要触发清理（考虑旧数据顶层verifyStatus）
            const approvedCountAfterByStatus = list.filter(item => item && item.status === 'approved').length;
            const approvedCountAfter = approvedCountAfterByStatus > 0 ? approvedCountAfterByStatus : (hasTopLevelApproved && list.length === 0 ? 0 : (hasTopLevelApproved ? 1 : 0));
            const shouldCleanup = approvedCountBefore > 0 && approvedCountAfter === 0;

            const updateResult = await db.collection('users').doc(user._id).update({ data: update });
            if (updateResult.stats && updateResult.stats.updated) {
              this.setData({ educationList: list, editingIndex: -1 });
              wx.showToast({ title: '已删除', icon: 'success' });

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
                  wx.hideLoading();
                  console.error('删除后清理失败:', cleanupErr);
                  wx.showToast({ title: '清理失败，请稍后重试', icon: 'none' });
                }
              }
            } else {
              wx.showToast({ title: '删除失败', icon: 'none' });
            }
          } catch (err) {
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      });
    } catch (err) {
      wx.showToast({ title: '操作失败', icon: 'none' });
    }
  }
});
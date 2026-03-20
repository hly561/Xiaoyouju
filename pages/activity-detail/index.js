const db = wx.cloud.database();

Page({
  data: {
    activity: {},
    loading: true,
    qrCodeError: false,
    questionnaireVisible: false,
    questionnaireFields: [],
    needRealName: false,
    needPhoneNumber: false,
    questionnaireAnswers: {},
    qnName: '',
    qnPhone: '',
    questionnaireHasInfo: false,
    isCreator: null,
    leaveMessageVisible: false,
    leaveMessageText: ''
  },

  onToggleShowRegisteredCount(e) {
    const v = !!(e && e.detail && e.detail.value);
    const activityId = (this.data.activity && this.data.activity._id) || this.activityId || '';
    if (!activityId) return;
    const db = wx.cloud.database();
    db.collection('activities').doc(activityId).update({ data: { showRegisteredCountToParticipants: v } })
      .then(() => {
        this.setData({ 'activity.showRegisteredCountToParticipants': v });
      })
      .catch(() => {});
  },

  onRegisteredCountOptionChange(e) {
    const val = e && e.detail ? e.detail.value : 'allow';
    const v = val === 'allow';
    const activityId = (this.data.activity && this.data.activity._id) || this.activityId || '';
    if (!activityId) {
      this.setData({ 'activity.showRegisteredCountToParticipants': v });
      return;
    }
    const db = wx.cloud.database();
    db.collection('activities').doc(activityId).update({ data: { showRegisteredCountToParticipants: v } })
      .then(() => {
        this.setData({ 'activity.showRegisteredCountToParticipants': v });
      })
      .catch(() => {
        this.setData({ 'activity.showRegisteredCountToParticipants': v });
      });
  },

  onLoad: function(options) {
    const { id } = options;
    this.activityId = id;
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] });
    if (id) {
      this.getActivityDetail(id);
    } else {
      wx.showToast({
        title: '活动信息不存在',
        icon: 'error'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  onShow: function() {
    // 页面显示时重新加载活动数据，确保修改后的内容能立即显示
    // 但如果刚刚进行了报名操作，则不重新加载，避免覆盖本地状态
    if (this.activityId && !this.justRegistered) {
      this.getActivityDetail(this.activityId);
    }
    // 重置标志
    this.justRegistered = false;
  },

  onShareAppMessage: function() {
    const activity = this.data.activity || {};
    const title = activity.title || '活动详情';
    const path = `/pages/activity-detail/index?id=${activity._id || this.activityId || ''}`;
    const imageUrl = (Array.isArray(activity.imageUrls) && activity.imageUrls.length > 0) ? activity.imageUrls[0] : '';
    return { title, path, imageUrl };
  },

  onShareTimeline: function() {
    const activity = this.data.activity || {};
    const title = activity.title || '活动详情';
    const query = `id=${activity._id || this.activityId || ''}`;
    const imageUrl = (Array.isArray(activity.imageUrls) && activity.imageUrls.length > 0) ? activity.imageUrls[0] : '';
    return { title, query, imageUrl };
  },

  getActivityDetail: function(activityId) {
    wx.showLoading({
      title: '加载中...'
    });
    
    // 从云数据库获取活动详情
    db.collection('activities').doc(activityId).get().then(async res => {
      if (res.data) {
        const activity = res.data;
        // 处理地点显示
        let locationText = '';
        if (activity.activityType === 'online' || activity.meetingLink) {
          locationText = '线上';
        } else if (activity.location && typeof activity.location === 'object') {
          const { province = '', city = '', address = '' } = activity.location;
          locationText = [province, city, address].filter(Boolean).join(' ');
        } else if (typeof activity.location === 'string') {
          locationText = activity.location;
        } else {
          locationText = '未设置';
        }
        activity.locationText = locationText;

        // 检查当前用户是否已报名
        const phoneNumber = wx.getStorageSync('phoneNumber');
        console.log('当前用户手机号:', phoneNumber);
        console.log('活动参与者列表:', activity.participants);
        if (phoneNumber && activity.participants && activity.participants.includes(phoneNumber)) {
          activity.isRegistered = true;
          console.log('用户已报名');
        } else {
          activity.isRegistered = false;
          console.log('用户未报名');
        }

        // 检查当前用户是否为活动发布者（兼容手机号或 openid）
        const appUser = getApp().globalData.userInfo || {};
        const appOpenid = appUser.openid || '';
        const isCreatorByPhone = !!(phoneNumber && activity.createdBy && activity.createdBy.phoneNumber === phoneNumber);
        const isCreatorByOpenid = !!(appOpenid && activity.createdBy && activity.createdBy.openid === appOpenid);
        activity.isCreator = isCreatorByPhone || isCreatorByOpenid;

        // 处理活动图片/海报临时链接
        try {
          const imgs = Array.isArray(activity.images) ? activity.images.slice(0, 9) : [];
          const cloudIds = imgs.filter(u => typeof u === 'string' && u.startsWith('cloud://'));
          let urlMap = {};
          if (cloudIds.length > 0) {
            const resTemp = await wx.cloud.getTempFileURL({ fileList: cloudIds });
            resTemp.fileList.forEach(f => {
              if (f.tempFileURL) {
                const clean = f.tempFileURL.trim().replace(/[`"']/g, '');
                urlMap[f.fileID] = clean;
              }
            });
          }
          const imageUrls = imgs.map(u => (u && u.startsWith('cloud://')) ? (urlMap[u] || '') : (String(u || '').trim())).filter(Boolean);
          activity.imageUrls = imageUrls;
        } catch (e) {
          activity.imageUrls = Array.isArray(activity.images) ? activity.images : [];
        }

        // 查询创建者信息
        const creatorPromise = activity.createdBy && activity.createdBy.phoneNumber ? 
          db.collection('users')
            .where({
              phoneNumber: activity.createdBy.phoneNumber
            })
            .get()
            .then(async res => {
              console.log('创建者查询结果:', res.data);
              if (res.data && res.data.length > 0) {
                // 选择最近审核或已通过的用户文档，兼容重复数据
                let creatorInfo = res.data[0];
                try {
                  res.data.sort((a, b) => {
                    const ta = a.reviewTime ? new Date(a.reviewTime).getTime() : 0;
                    const tb = b.reviewTime ? new Date(b.reviewTime).getTime() : 0;
                    return tb - ta;
                  });
                  creatorInfo = res.data[0];
                } catch (e) {}
                try {
                  const approvedDoc = res.data.find(u => {
                    const list = Array.isArray(u.educations) ? u.educations : [];
                    return list.some(e => e && e.status === 'approved');
                  });
                  if (approvedDoc) creatorInfo = approvedDoc;
                } catch (e) {}

                activity.creatorName = creatorInfo.name;
                console.log('设置创建者昵称:', activity.creatorName);

                // 处理头像临时链接并归一化学历信息
                try {
                  let pick = creatorInfo;
                  try {
                    const snapDoc = res.data.find(u => Array.isArray(u.approvedEducationSnapshot) && u.approvedEducationSnapshot.length > 0);
                    if (snapDoc) pick = snapDoc;
                  } catch (e) {}
                  const processed = await this.processUserAvatars([pick], activity);
                  const organizer = processed && processed[0] ? processed[0] : pick;
                  // 确保手机号存在
                  organizer.phoneNumber = organizer.phoneNumber || (activity.createdBy && activity.createdBy.phoneNumber) || '';
                  const list = Array.isArray(organizer.educationEntries) ? organizer.educationEntries : [];
                  const display = activity.isCreator ? list : list.filter(e => e && e.visible !== false);
                  organizer.educationEntries = display;
                  this.setData({ organizer });
                } catch (e) {
                  console.error('处理创建者头像/学历失败:', e);
                  const fallbackOrganizer = {
                    name: activity.creatorName || '未设置',
                    phoneNumber: (activity.createdBy && activity.createdBy.phoneNumber) || '',
                    image: '',
                    educationEntries: []
                  };
                  this.setData({ organizer: fallbackOrganizer });
                }
              } else {
                console.log('未找到创建者信息，手机号:', activity.createdBy.phoneNumber);
                const fallbackOrganizer = {
                  name: activity.creatorName || '未设置',
                  phoneNumber: (activity.createdBy && activity.createdBy.phoneNumber) || '',
                  image: '',
                  educationEntries: []
                };
                this.setData({ organizer: fallbackOrganizer });
              }
              return activity;
            }) : 
          Promise.resolve(activity);

        // 批量查询所有已报名用户信息（头像、昵称等）
        const participantsPromise = activity.participants && activity.participants.length > 0 ?
          db.collection('users')
            .where({
              phoneNumber: db.command.in(activity.participants)
            })
      .get()
      .then(async res => {
              console.log('查询到的用户数据:', res.data);
              const users = res.data.sort((a, b) => {
                const indexA = activity.participants.indexOf(a.phoneNumber);
                const indexB = activity.participants.indexOf(b.phoneNumber);
                return indexB - indexA;
              });
              
              console.log('排序后的用户数据:', users);
              console.log('用户头像字段检查:', users.map(u => ({ name: u.name, image: u.image })));
              
              // 详细检查每个用户的头像字段
              users.forEach((user, index) => {
                console.log(`用户${index} - 姓名: ${user.name}, 头像: ${user.image}, 头像类型: ${typeof user.image}`);
                if (user.image && user.image.startsWith('cloud://')) {
                  console.log(`用户${index}的头像是云存储文件:`, user.image);
                } else if (user.image) {
                  console.log(`用户${index}的头像是其他类型:`, user.image);
                } else {
                  console.log(`用户${index}没有设置头像`);
                }
              });
              
              const bestByPhone = {};
              users.forEach(u => {
                const p = u.phoneNumber;
                if (!p) return;
                const cur = bestByPhone[p];
                const hasSnap = Array.isArray(u.approvedEducationSnapshot) && u.approvedEducationSnapshot.length > 0;
                const hasApproved = Array.isArray(u.educations) && u.educations.some(e => e && e.status === 'approved');
                const curHasSnap = cur && Array.isArray(cur.approvedEducationSnapshot) && cur.approvedEducationSnapshot.length > 0;
                const curHasApproved = cur && Array.isArray(cur.educations) && cur.educations.some(e => e && e.status === 'approved');
                if (!cur) {
                  bestByPhone[p] = u;
                } else if ((hasSnap && !curHasSnap) || (hasApproved && !curHasApproved)) {
                  bestByPhone[p] = u;
                } else {
                  const ta = u.reviewTime ? new Date(u.reviewTime).getTime() : 0;
                  const tb = cur.reviewTime ? new Date(cur.reviewTime).getTime() : 0;
                  if (ta > tb) bestByPhone[p] = u;
                }
              });
              const dedupedUsers = [];
              for (const k in bestByPhone) {
                if (Object.prototype.hasOwnProperty.call(bestByPhone, k)) {
                  dedupedUsers.push(bestByPhone[k]);
                }
              }
              const processedUsers = await this.processUserAvatars(dedupedUsers, activity);
              console.log('processUserAvatars处理完成，结果:', processedUsers);
              const enforcedUsers = (processedUsers || []).map(u => {
                const entries = Array.isArray(u.educationEntries) ? u.educationEntries : [];
                if (entries.length > 0) return u;
                const userSnap = Array.isArray(u.approvedEducationSnapshot) ? u.approvedEducationSnapshot : [];
                const final = (userSnap && userSnap.length > 0) ? userSnap : entries;
                return { ...u, educationEntries: final };
              });
              const participationMap = activity.participation || {};
              activity.registeredUsers = (enforcedUsers || []).map(u => {
                const list = Array.isArray(u.educationEntries) ? u.educationEntries : [];
                const display = u.phoneNumber === phoneNumber ? list : list.filter(e => e && e.visible !== false);
                const part = participationMap[u.phoneNumber] || {};
                const ans = part.answers || {};
                const overrideRealName = ans.name || part.name || '';
                const overridePhone = ans.phone || part.phone || '';
                return { ...u, realName: overrideRealName || '', displayPhone: overridePhone || u.phoneNumber, isSelf: u.phoneNumber === phoneNumber, educationEntries: display };
              });
              const msgs = Array.isArray(activity.messages) ? activity.messages : [];
              const byPhone = {};
              msgs.forEach(m => {
                const p = m && m.phoneNumber;
                if (!p) return;
                if (!byPhone[p]) byPhone[p] = [];
                byPhone[p].push(m);
              });
              activity.registeredUsers = activity.registeredUsers.map(u => {
                const list = (byPhone[u.phoneNumber] || []).slice();
                try { list.sort((a,b)=>{const ta=a.updatedAt?new Date(a.updatedAt).getTime(): (a.createdAt?new Date(a.createdAt).getTime():0); const tb=b.updatedAt?new Date(b.updatedAt).getTime(): (b.createdAt?new Date(b.createdAt).getTime():0); return ta-tb;}); } catch(e) {}
                const last = list.length ? [list[list.length - 1]] : [];
                return { ...u, messages: last };
              });
              
              return activity;
            }) :
          Promise.resolve(activity);

        // 等待所有查询完成后再更新页面
        Promise.all([creatorPromise, participantsPromise])
          .then(() => {
            // 检查报名截止时间是否已过
            const now = new Date();
            const registrationDeadline = activity.registrationDeadlineValue ? new Date(activity.registrationDeadlineValue) : null;
            const registrationDeadlinePassed = registrationDeadline && now > registrationDeadline;
            
            // 检查活动状态（进行中或已结束）
            const startTime = new Date(activity.activityStartTimeValue);
            const endTime = new Date(activity.activityEndTimeValue);
            const isOngoing = now >= startTime && now <= endTime;
            const isEnded = now > endTime;
            const isOngoingOrEnded = isOngoing || isEnded;
            
            const questionnaire = activity.questionnaire || {};
            const rawFields = Array.isArray(questionnaire.fields) ? questionnaire.fields : [];
            const fields = rawFields.map(f => {
              const type = f && f.type ? f.type : 'text';
              let options = [];
              if (type === 'single' || type === 'multi') {
                const src = Array.isArray(f.options) ? f.options : [];
                options = src
                  .map(o => {
                    if (typeof o === 'string') return { value: o };
                    const v = o && o.value ? o.value : '';
                    return v ? { value: v } : null;
                  })
                  .filter(Boolean);
              }
              return { ...f, type, options };
            });
            const hasResponses = !!(activity.questionnaireResponses && Object.keys(activity.questionnaireResponses).length > 0);
            const questionnaireHasInfo = !!(questionnaire && (questionnaire.enabled || questionnaire.needRealName || questionnaire.needPhoneNumber || fields.length > 0) || hasResponses);

            activity.showRegisteredCountToParticipants = activity.showRegisteredCountToParticipants !== false;
            this.setData({
              registrationDeadlinePassed: registrationDeadlinePassed,
              isOngoingOrEnded: isOngoingOrEnded,
              questionnaireHasInfo
            });
            // 处理群聊二维码URL
        if (activity.qrcodeUrl && activity.qrcodeUrl.startsWith('cloud://')) {
          // 如果是云文件ID，获取临时链接用于显示
          console.log('正在获取二维码临时链接:', activity.qrcodeUrl);
          wx.cloud.getTempFileURL({
            fileList: [activity.qrcodeUrl],
            success: res => {
              console.log('获取临时链接结果:', res);
              const tempFile = res.fileList[0];
              if (tempFile && tempFile.tempFileURL) {
                console.log('二维码临时链接获取成功:', tempFile.tempFileURL);
                // 清理URL中的空格、反引号和引号
                const cleanQrUrl = tempFile.tempFileURL.trim().replace(/[`"']/g, '');
                console.log('清理后的二维码URL:', cleanQrUrl);
                this.setData({
                  'activity.qrcodeUrl': cleanQrUrl,
                  qrCodeError: false
                });
              } else if (tempFile && tempFile.errMsg) {
                 console.error('二维码文件获取失败:', tempFile.errMsg);
                 let errorMsg = '二维码文件不存在或已过期';
                 
                 // 根据具体错误类型提供更准确的提示
                 if (tempFile.errMsg.includes('STORAGE_EXCEED_AUTHORITY')) {
                   errorMsg = '二维码访问权限不足，请联系活动组织者';
                 } else if (tempFile.errMsg.includes('FILE_NOT_FOUND')) {
                   errorMsg = '二维码文件已被删除';
                 } else if (tempFile.errMsg.includes('EXPIRED')) {
                   errorMsg = '二维码链接已过期';
                 }
                 
                 this.setData({
                   qrCodeError: true,
                   qrCodeErrorMsg: errorMsg
                 });
              }
            },
            fail: err => {
              console.error('获取二维码临时链接失败', err);
              this.setData({
                qrCodeError: true,
                qrCodeErrorMsg: '二维码加载失败，请稍后重试'
              });
            }
          });
        } else if (!activity.qrcodeUrl) {
          // 如果没有二维码，设置错误状态
          this.setData({
            qrCodeError: true,
            qrCodeErrorMsg: '暂无群聊二维码'
          });
        } else {
          // 如果是普通URL，直接使用
          this.setData({
            qrCodeError: false
          });
        }
          this.setData({
            activity: activity,
            questionnaireFields: fields,
            needRealName: !!questionnaire.needRealName,
            needPhoneNumber: !!questionnaire.needPhoneNumber,
            loading: false,
            isCreator: !!activity.isCreator
            });
          });
          
          // 设置页面标题
          wx.setNavigationBarTitle({
            title: activity.title || '活动详情'
          });
        } else {
          throw new Error('活动不存在');
        }
      })
      .catch(err => {
        this.setData({
          loading: false
        });
        wx.showToast({
          title: '获取活动详情失败',
          icon: 'error'
        });
        console.error('获取活动详情失败：', err);
      })
      .finally(() => {
        wx.hideLoading();
      });
  },

  previewPoster(e) {
    const index = e.currentTarget.dataset.index;
    const urls = (this.data.activity && this.data.activity.imageUrls) || [];
    if (!urls || urls.length === 0) return;
    const current = urls[index] || urls[0];
    wx.previewImage({ current, urls });
  },
  
  // 复制会议链接
  copyMeetingLink: function() {
    const { meetingLink } = this.data.activity;
    if (meetingLink) {
      wx.setClipboardData({
        data: meetingLink,
        success: function() {
          wx.showToast({
            title: '会议链接已复制',
            icon: 'success'
          });
        }
      });
    }
  },

  // 二维码加载错误处理
  onQrCodeError: function() {
    console.log('二维码加载失败');
    this.setData({
      qrCodeError: true
    });
  },

  // 二维码加载成功处理
  onQrCodeLoad: function() {
    console.log('二维码加载成功');
    this.setData({
      qrCodeError: false
    });
  },

  // 用户头像加载失败处理
  onUserAvatarError: function(e) {
    const index = e.currentTarget.dataset.index;
    console.log('用户头像加载失败，索引:', index);
    
    // 将失败的头像设置为空，触发默认头像显示
    const updateKey = `activity.registeredUsers[${index}].image`;
    this.setData({
      [updateKey]: ''
    });
  },

  // 组织者头像加载失败处理
  onOrganizerAvatarError: function() {
    console.log('组织者头像加载失败');
    this.setData({
      'organizer.image': ''
    });
  },

  // 重试加载二维码
  retryLoadQrCode: function() {
    const activity = this.data.activity;
    if (activity.qrcodeUrl && activity.qrcodeUrl.startsWith('cloud://')) {
      console.log('重试获取二维码临时链接:', activity.qrcodeUrl);
      
      wx.showLoading({
        title: '重新加载中...'
      });
      
      // 重新获取临时链接
      wx.cloud.getTempFileURL({
        fileList: [activity.qrcodeUrl],
        success: res => {
          wx.hideLoading();
          console.log('重试获取临时链接结果:', res);
          const tempFile = res.fileList[0];
          if (tempFile && tempFile.tempFileURL) {
            console.log('重试成功，二维码临时链接:', tempFile.tempFileURL);
            // 清理URL中的空格、反引号和引号
            const cleanRetryUrl = tempFile.tempFileURL.trim().replace(/[`"']/g, '');
            console.log('重试清理后的二维码URL:', cleanRetryUrl);
            this.setData({
              'activity.qrcodeUrl': cleanRetryUrl,
              qrCodeError: false,
              qrCodeErrorMsg: ''
            });
            wx.showToast({
              title: '加载成功',
              icon: 'success'
            });
          } else if (tempFile && tempFile.errMsg) {
             console.error('重试失败，二维码文件问题:', tempFile.errMsg);
             let errorMsg = '二维码文件不存在或已过期';
             let toastMsg = '二维码文件不存在';
             
             // 根据具体错误类型提供更准确的提示
             if (tempFile.errMsg.includes('STORAGE_EXCEED_AUTHORITY')) {
               errorMsg = '二维码访问权限不足，请联系活动组织者';
               toastMsg = '访问权限不足';
             } else if (tempFile.errMsg.includes('FILE_NOT_FOUND')) {
               errorMsg = '二维码文件已被删除';
               toastMsg = '文件已被删除';
             } else if (tempFile.errMsg.includes('EXPIRED')) {
               errorMsg = '二维码链接已过期';
               toastMsg = '链接已过期';
             }
             
             this.setData({
               qrCodeError: true,
               qrCodeErrorMsg: errorMsg
             });
             wx.showToast({
               title: toastMsg,
               icon: 'none'
             });
          }
        },
        fail: err => {
          wx.hideLoading();
          console.error('重试获取二维码临时链接失败', err);
          this.setData({
            qrCodeError: true,
            qrCodeErrorMsg: '二维码加载失败，请稍后重试'
          });
          wx.showToast({
            title: '重试失败',
            icon: 'none'
          });
        }
      });
    } else {
      wx.showToast({
        title: '无二维码数据',
        icon: 'none'
      });
    }
  },

  // 预览群聊二维码
  previewQrCode: function() {
    const { qrcodeUrl } = this.data.activity;
    if (qrcodeUrl) {
      // 检查是否是云文件ID或路径
      if (qrcodeUrl.startsWith('cloud://')) {
        wx.cloud.getTempFileURL({
          fileList: [qrcodeUrl],
          success: res => {
            // getTempFileURL成功，使用临时链接预览
            const tempFile = res.fileList[0];
            if (tempFile && tempFile.tempFileURL) {
              wx.previewImage({
                current: tempFile.tempFileURL, // 当前显示图片的http链接
                urls: [tempFile.tempFileURL] // 需要预览的图片http链接列表
              });
            } else {
              wx.showToast({
                title: '获取图片链接失败',
                icon: 'none'
              });
            }
          },
          fail: err => {
            // getTempFileURL失败
            wx.showToast({
              title: '获取图片链接失败',
              icon: 'none'
            });
            console.error('获取临时链接失败', err);
          }
        });
      } else {
        // 如果不是云文件，直接使用原链接预览
        wx.previewImage({
          current: qrcodeUrl, // 当前显示图片的http链接
          urls: [qrcodeUrl] // 需要预览的图片http链接列表
        });
      }
    } else {
      wx.showToast({
        title: '无二维码图片',
        icon: 'none'
      });
    }
  },

  // 处理用户头像的云存储链接
  async processUserAvatars(users, activity) {
    console.log('processUserAvatars方法被调用，输入参数:', users);
    
    if (!users || users.length === 0) {
      console.log('用户数据为空，直接返回');
      return users;
    }
    
    // 收集所有云存储头像路径
    const cloudAvatars = users
      .filter(user => user.image && user.image.startsWith('cloud://'))
      .map(user => user.image);
    
    try {
      let urlMap = {};
      if (cloudAvatars.length > 0) {
        console.log('正在处理用户头像云存储链接:', cloudAvatars);
        // 批量获取临时链接
        const result = await wx.cloud.getTempFileURL({
          fileList: cloudAvatars
        });
        console.log('头像临时链接获取结果:', result);
        // 创建云存储路径到临时链接的映射
        urlMap = {};
        result.fileList.forEach(file => {
          if (file.tempFileURL) {
            // 清理URL中的空格、反引号和引号
            const cleanUrl = file.tempFileURL.trim().replace(/[`"']/g, '');
            urlMap[file.fileID] = cleanUrl;
            console.log('清理后的头像URL:', cleanUrl);
          } else {
            console.error('头像文件获取失败:', file.fileID, file.errMsg);
          }
        });
      }
      
      // 替换用户头像为临时链接，同时归一化用户教育信息列表
      const processedUsers = users.map(user => {
        const image = user.image && user.image.startsWith('cloud://')
          ? (urlMap[user.image] || user.image)
          : (user.image && user.image.startsWith('wxfile://')
            ? ''
            : user.image);

        // 归一化教育经历，兼容 educations / eductions / certifications
        const rawList = Array.isArray(user.educations)
          ? user.educations
          : (Array.isArray(user.eductions)
            ? user.eductions
            : (Array.isArray(user.certifications)
              ? user.certifications
              : []));

        // 仅保留审核通过的学历条目
        const approvedRawList = (rawList || []).filter(e => {
          const status = e && (e.status || e.verifyStatus);
          return status === 'approved';
        });
        const pendingRawList = (rawList || []).filter(e => {
          const status = e && (e.status || e.verifyStatus);
          return status === 'pending';
        });
        const rejectedRawList = (rawList || []).filter(e => {
          const status = e && (e.status || e.verifyStatus);
          return status === 'rejected' || status === 'unverified';
        });

        const mapped = approvedRawList.map(e => {
          const year = e && (e.graduationYear || (e.endDate ? String(e.endDate).split('-')[0] : ''));
          return {
            school: (e && e.school) || '',
            major: (e && e.major) || '',
            degree: (e && e.degree) || '',
            graduationYear: year || ''
          };
        }).filter(x => x.school || x.major || x.graduationYear || x.degree);
        const mappedPending = pendingRawList.map(e => {
          const year = e && (e.graduationYear || (e.endDate ? String(e.endDate).split('-')[0] : ''));
          return {
            school: (e && e.school) || '',
            major: (e && e.major) || '',
            degree: (e && e.degree) || '',
            graduationYear: year || ''
          };
        }).filter(x => x.school || x.major || x.graduationYear || x.degree);
        const mappedRejected = rejectedRawList.map(e => {
          const year = e && (e.graduationYear || (e.endDate ? String(e.endDate).split('-')[0] : ''));
          return {
            school: (e && e.school) || '',
            major: (e && e.major) || '',
            degree: (e && e.degree) || '',
            graduationYear: year || ''
          };
        }).filter(x => x.school || x.major || x.graduationYear || x.degree);

        // 如有重复，按 school|major|graduationYear 去重
        const seen = new Set();
        const educationEntries = [];
        mapped.forEach(ed => {
          const key = `${ed.school}|${ed.major}|${ed.degree}|${ed.graduationYear}`;
          if (!seen.has(key)) {
            seen.add(key);
            educationEntries.push(ed);
          }
        });

        let finalEducationEntries = educationEntries;
        try {
          const userSnapshot = Array.isArray(user.approvedEducationSnapshot) ? user.approvedEducationSnapshot : [];
          if (Array.isArray(userSnapshot) && userSnapshot.length > 0) {
            finalEducationEntries = userSnapshot.slice();
          } else if (educationEntries.length === 0) {
            const unionAwait = [...mappedPending, ...mappedRejected];
            if (unionAwait.length > 0) finalEducationEntries = unionAwait;
          }
        } catch (e) {}

        const visRoot = activity && activity.participation && user.phoneNumber ? activity.participation[user.phoneNumber] : undefined;
        const visibilityMap = (visRoot && visRoot.educationVisibility)
          ? visRoot.educationVisibility
          : (activity && activity.participantEducationVisibility && user.phoneNumber ? activity.participantEducationVisibility[user.phoneNumber] : undefined);
        const withKey = (finalEducationEntries || []).map(ed => {
          const k = `${ed.school || ''}|${ed.major || ''}|${ed.degree || ''}|${ed.graduationYear || ''}`;
          const v = visibilityMap && Object.prototype.hasOwnProperty.call(visibilityMap, k) ? !!visibilityMap[k] : true;
          return { ...ed, _key: k, visible: v };
        });
        return {
          ...user,
          image,
          educationEntries: withKey
        };
      });
      
      console.log('处理后的用户数据:', processedUsers);
      return processedUsers;
      
    } catch (error) {
      console.error('处理用户头像失败:', error);
      return users; // 出错时返回原始数据
    }
  },

  async onRegister() {
    const phoneNumber = wx.getStorageSync('phoneNumber');
    if (!phoneNumber) {
      const activityId = (this.data.activity && this.data.activity._id) || this.activityId || '';
      const from = encodeURIComponent(`/pages/activity-detail/index?id=${activityId}`);
      wx.showModal({
        title: '登录提示',
        content: '登录后才能报名活动，是否前往登录？',
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

    // 检查用户认证状态
    const db = wx.cloud.database();
    let verifiedRealName = '';
    try {
      const userResult = await db.collection('users').where({ phoneNumber }).get();
      if (userResult.data && userResult.data.length > 0) {
        // 选择最近审核或已通过的用户文档，兼容重复数据
        const users = userResult.data.slice();
        try {
          users.sort((a, b) => {
            const ta = a.reviewTime ? new Date(a.reviewTime).getTime() : 0;
            const tb = b.reviewTime ? new Date(b.reviewTime).getTime() : 0;
            return tb - ta;
          });
        } catch (e) {}
        let userInfo = users[0];
        try {
          const approvedDoc = users.find(u => {
            const list = Array.isArray(u.educations) ? u.educations : [];
            return list.some(e => e && e.status === 'approved');
          });
          if (approvedDoc) userInfo = approvedDoc;
        } catch (e) {}
        const educations = Array.isArray(userInfo.educations) ? userInfo.educations : [];
        const hasApproved = educations.some(e => e && e.status === 'approved');
        const hasPending = educations.some(e => e && e.status === 'pending');
        const verifyStatus = hasApproved ? 'approved' : (hasPending ? 'pending' : 'unverified');
        
        // 所有活动报名都需要校友认证
        if (verifyStatus === 'unverified') {
          wx.showModal({
            title: '认证提示',
            content: '您还未进行校友认证，无法报名活动。请先完成校友认证。',
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
            content: '您的校友认证正在审核中，暂时无法报名活动。请等待审核完成。',
            showCancel: false,
            confirmText: '知道了'
          });
          return;
        }

        // 预填真实姓名：取第一个已认证学历的姓名
        try {
          const firstApproved = educations.find(e => e && e.status === 'approved' && e.realname && String(e.realname).trim() !== '');
          if (firstApproved) {
            verifiedRealName = String(firstApproved.realname).trim();
          } else if (userInfo && userInfo.name) {
            verifiedRealName = String(userInfo.name).trim();
          }
        } catch (e) {}
      } else {
        // 如果没有找到用户信息，说明用户未注册或未认证
        wx.showModal({
          title: '认证提示',
          content: '您还未进行校友认证，无法报名活动。请先完成校友认证。',
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

    const activityId = this.data.activity._id;

    // 若活动设置了问卷，先弹出填写
    const q = (this.data.activity && this.data.activity.questionnaire) || {};
    const requiresQuestionnaire = !!(q.enabled || q.needRealName || q.needPhoneNumber || ((q.fields || []).length > 0));
    if (requiresQuestionnaire && !this.data.questionnaireVisible) {
      const defaultPhone = wx.getStorageSync('phoneNumber') || '';
      this.setData({ questionnaireVisible: true, qnPhone: defaultPhone, qnName: this.data.qnName || verifiedRealName || '' });
      return;
    }

    try {
      console.log('正在报名活动:', activityId, '用户手机号:', phoneNumber);
      
      // 调用云函数进行报名
      wx.showLoading({
        title: '报名中...'
      });
      
      const callData = { activityId, phoneNumber, action: 'register' };
      if (requiresQuestionnaire) {
        const needRealName = !!q.needRealName;
        const needPhoneNumber = !!q.needPhoneNumber;
        const answersPayload = {
          name: needRealName ? (this.data.qnName || '') : '',
          phone: needPhoneNumber ? (this.data.qnPhone || '') : '',
          fields: this.data.questionnaireFields.map(f => ({ id: f.id, type: f.type, title: f.title, value: this.data.questionnaireAnswers[f.id] || (f.type === 'multi' ? [] : '') }))
        };
        callData.answers = answersPayload;
      }
      const result = await wx.cloud.callFunction({
        name: 'registerActivity',
        data: callData
      });
      
      wx.hideLoading();
      
      console.log('云函数报名结果:', result);
      
      if (result.result.success) {
        // 报名成功后，从数据库读取完整用户信息并处理学历展示
        const userRes = await db.collection('users').where({ phoneNumber }).get();
        const currentRegisteredUsers = this.data.activity.registeredUsers || [];
        if (userRes.data && userRes.data.length > 0) {
          // 选择最近审核或已通过的用户文档，兼容重复数据
          const users = userRes.data.slice();
          try {
            users.sort((a, b) => {
              const ta = a.reviewTime ? new Date(a.reviewTime).getTime() : 0;
              const tb = b.reviewTime ? new Date(b.reviewTime).getTime() : 0;
              return tb - ta;
            });
          } catch (e) {}
          let userDoc = users[0];
          try {
            const snapDoc = users.find(u => Array.isArray(u.approvedEducationSnapshot) && u.approvedEducationSnapshot.length > 0);
            if (snapDoc) userDoc = snapDoc;
          } catch (e) {}
          try {
            const approvedDoc = users.find(u => {
              const list = Array.isArray(u.educations) ? u.educations : [];
              return list.some(e => e && e.status === 'approved');
            });
            if (approvedDoc) userDoc = approvedDoc;
          } catch (e) {}
          // 处理头像临时链接并归一化学历条目
          const processedArr = await this.processUserAvatars([userDoc], this.data.activity);
          const processedUser = processedArr[0] || userDoc;
          processedUser.isSelf = true;
          const answers = {
            name: q && q.needRealName ? (this.data.qnName || '') : '',
            phone: q && q.needPhoneNumber ? (this.data.qnPhone || '') : ''
          };
          if (answers.name) processedUser.realName = answers.name;
          if (answers.phone) processedUser.displayPhone = answers.phone;
          this.setData({
            'activity.isRegistered': true,
            'activity.participants': result.result.participants,
            'activity.registeredUsers': [processedUser, ...currentRegisteredUsers]
          });
        } else {
          // 未读到用户文档时，仅更新参与者手机号列表
          this.setData({
            'activity.isRegistered': true,
            'activity.participants': result.result.participants
          });
        }

        // 设置标志，防止onShow重新加载覆盖状态
        this.justRegistered = true;
        
        wx.showToast({
          title: '报名成功',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: result.result.error || '报名失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('报名失败:', error);
      wx.showToast({
        title: '报名失败',
        icon: 'none'
      });
    }
  },

  onQnVisibleChange(e) {
    const v = !!e.detail.visible;
    this.setData({ questionnaireVisible: v });
  },
  onQnCancel() {
    this.setData({ questionnaireVisible: false });
  },
  onQnNameChange(e) {
    this.setData({ qnName: e.detail.value || '' });
  },
  onQnPhoneChange(e) {
    this.setData({ qnPhone: e.detail.value || '' });
  },
  onQnTextChange(e) {
    const id = e.currentTarget.dataset.id;
    const value = e.detail.value || '';
    const next = { ...(this.data.questionnaireAnswers || {}) };
    next[id] = value;
    this.setData({ questionnaireAnswers: next });
  },
  onQnSingleChange(e) {
    const id = e.currentTarget.dataset.id;
    const value = e.detail.value;
    const next = { ...(this.data.questionnaireAnswers || {}) };
    next[id] = value;
    this.setData({ questionnaireAnswers: next });
  },
  onQnMultiChange(e) {
    const id = e.currentTarget.dataset.id;
    const value = e.detail.value || [];
    const next = { ...(this.data.questionnaireAnswers || {}) };
    next[id] = value;
    this.setData({ questionnaireAnswers: next });
  },
  async onQnSubmit() {
    // 校验
    if (this.data.needRealName && !String(this.data.qnName || '').trim()) {
      wx.showToast({ title: '请填写真实姓名', icon: 'none' });
      return;
    }
    const phoneInput = String(this.data.qnPhone || '').trim();
    if (this.data.needPhoneNumber && (!phoneInput || !/^1\d{10}$/.test(phoneInput))) {
      wx.showToast({ title: '请填写有效手机号', icon: 'none' });
      return;
    }
    for (const f of (this.data.questionnaireFields || [])) {
      const val = this.data.questionnaireAnswers[f.id];
      if (f.required) {
        if (f.type === 'text' && !String(val || '').trim()) {
          wx.showToast({ title: `请填写：${f.title}`, icon: 'none' });
          return;
        }
        if (f.type === 'single' && !val) {
          wx.showToast({ title: `请选择：${f.title}`, icon: 'none' });
          return;
        }
        if (f.type === 'multi' && (!Array.isArray(val) || val.length === 0)) {
          wx.showToast({ title: `请选择：${f.title}`, icon: 'none' });
          return;
        }
      }
    }
    // 关闭弹窗并直接报名
    this.setData({ questionnaireVisible: false });
    const phoneNumber = wx.getStorageSync('phoneNumber');
    const activityId = this.data.activity._id;
    try {
      wx.showLoading({ title: '报名中...' });
      const needRealName = !!this.data.needRealName;
      const needPhoneNumber = !!this.data.needPhoneNumber;
      const answersPayload = {
        name: needRealName ? String(this.data.qnName || '').trim() : '',
        phone: needPhoneNumber ? String(this.data.qnPhone || '').trim() : '',
        fields: this.data.questionnaireFields.map(f => ({ id: f.id, type: f.type, title: f.title, value: this.data.questionnaireAnswers[f.id] || (f.type === 'multi' ? [] : '') }))
      };
      const result = await wx.cloud.callFunction({
        name: 'registerActivity',
        data: { activityId, phoneNumber, action: 'register', answers: answersPayload }
      });
      wx.hideLoading();
      if (result.result && result.result.success) {
        const userRes = await db.collection('users').where({ phoneNumber }).get();
        const currentRegisteredUsers = this.data.activity.registeredUsers || [];
        if (userRes.data && userRes.data.length > 0) {
          const users = userRes.data.slice();
          try { users.sort((a,b)=>{const ta=a.reviewTime?new Date(a.reviewTime).getTime():0;const tb=b.reviewTime?new Date(b.reviewTime).getTime():0;return tb-ta;}); } catch(e) {}
          let userDoc = users[0];
          try { const snapDoc = users.find(u => Array.isArray(u.approvedEducationSnapshot) && u.approvedEducationSnapshot.length > 0); if (snapDoc) userDoc = snapDoc; } catch(e) {}
          try { const approvedDoc = users.find(u => { const list = Array.isArray(u.educations) ? u.educations : []; return list.some(e => e && e.status === 'approved'); }); if (approvedDoc) userDoc = approvedDoc; } catch(e) {}
          const processedArr = await this.processUserAvatars([userDoc], this.data.activity);
          const processedUser = processedArr[0] || userDoc; processedUser.isSelf = true;
          if (answersPayload.name) processedUser.realName = answersPayload.name;
          if (answersPayload.phone) processedUser.displayPhone = answersPayload.phone;
          this.setData({ 'activity.isRegistered': true, 'activity.participants': result.result.participants, 'activity.registeredUsers': [processedUser, ...currentRegisteredUsers] });
        } else {
          this.setData({ 'activity.isRegistered': true, 'activity.participants': result.result.participants });
        }
        this.justRegistered = true;
        wx.showToast({ title: '报名成功', icon: 'success' });
      } else {
        wx.showToast({ title: (result.result && result.result.error) || '报名失败', icon: 'none' });
      }
    } catch (error) {
      wx.hideLoading();
      wx.showToast({ title: '报名失败', icon: 'none' });
    }
  },

  // 取消报名
  async onCancelRegister() {
    const phoneNumber = wx.getStorageSync('phoneNumber');
    if (!phoneNumber) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      });
      return;
    }

    const activityId = this.data.activity._id;

    try {
      console.log('正在取消报名活动:', activityId, '用户手机号:', phoneNumber);
      
      // 调用云函数进行取消报名
      wx.showLoading({
        title: '取消报名中...'
      });
      
      const result = await wx.cloud.callFunction({
        name: 'registerActivity',
        data: {
          activityId: activityId,
          phoneNumber: phoneNumber,
          action: 'cancel'
        }
      });
      
      wx.hideLoading();
      
      console.log('云函数取消报名结果:', result);
      
      if (result.result.success) {
        // 更新本地状态
        const localParticipants = this.data.activity.participants || [];
        const localRegisteredUsers = this.data.activity.registeredUsers || [];
        
        this.setData({
          'activity.isRegistered': false,
          'activity.participants': result.result.participants,
          'activity.registeredUsers': localRegisteredUsers.filter(u => u.phoneNumber !== phoneNumber)
        });

        // 设置标志，防止onShow重新加载覆盖状态
        this.justRegistered = true;
        
        wx.showToast({
          title: '取消报名成功',
          icon: 'success'
        });
      } else {
        wx.showToast({
          title: result.result.error || '取消报名失败',
          icon: 'none'
        });
      }
    } catch (error) {
      wx.hideLoading();
      console.error('取消报名失败:', error);
      wx.showToast({
        title: '取消报名失败',
        icon: 'none'
      });
    }
  },

  onLeaveMessage() {
    const phoneNumber = wx.getStorageSync('phoneNumber') || '';
    const msgs = (this.data.activity && this.data.activity.messages) || [];
    const existing = msgs.find(m => m && m.phoneNumber === phoneNumber);
    this.setData({ leaveMessageVisible: true, leaveMessageText: existing ? (existing.content || '') : '' });
  },
  onLeaveMessageChange(e) {
    const v = e && e.detail ? (e.detail.value || '') : '';
    this.setData({ leaveMessageText: v });
  },
  onLeaveMessageCancel() {
    this.setData({ leaveMessageVisible: false, leaveMessageText: '' });
  },
  async onLeaveMessageSubmit() {
    const content = String(this.data.leaveMessageText || '').trim();
    if (!content) { wx.showToast({ title: '请输入留言内容', icon: 'none' }); return; }
    if (content.length > 50) { wx.showToast({ title: '最多 50 字', icon: 'none' }); return; }
    const activityId = (this.data.activity && this.data.activity._id) || this.activityId || '';
    if (!activityId) { wx.showToast({ title: '活动信息不存在', icon: 'none' }); return; }
    const phoneNumber = wx.getStorageSync('phoneNumber') || '';
    const nickname = (getApp().globalData.userInfo && getApp().globalData.userInfo.nickName) || '';
    try {
      const db = wx.cloud.database();
      const existingMsgs = (this.data.activity.messages || []).slice();
      const now = new Date();
      const idx = existingMsgs.findIndex(m => m && m.phoneNumber === phoneNumber);
      if (idx >= 0) {
        existingMsgs[idx] = { ...existingMsgs[idx], content, nickname, updatedAt: now };
      } else {
        existingMsgs.push({ phoneNumber, nickname, content, createdAt: now });
      }
      await db.collection('activities').doc(activityId).update({ data: { messages: existingMsgs } });
      const updatedUsers = (this.data.activity.registeredUsers || []).map(u => {
        if (u.phoneNumber !== phoneNumber) return u;
        return { ...u, messages: [{ phoneNumber, nickname, content, createdAt: now }] };
      });
      this.setData({ leaveMessageVisible: false, leaveMessageText: '', 'activity.messages': existingMsgs, 'activity.registeredUsers': updatedUsers });
      wx.showToast({ title: '提交成功', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '留言失败', icon: 'none' });
    }
  },

  // 修改活动
  onEditActivity() {
    const activityId = this.data.activity._id;
    wx.navigateTo({
      url: `/pages/release/index?id=${activityId}&mode=edit`
    });
  },

  // 删除活动
  onDeleteActivity() {
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个活动吗？删除后无法恢复。',
      success: (res) => {
        if (res.confirm) {
          this.deleteActivity();
        }
      }
    });
  },

  // 执行删除活动
  async deleteActivity() {
    const db = wx.cloud.database();
    const activityId = this.data.activity._id;
    const activityTitle = this.data.activity.title;
    const operatorPhone = wx.getStorageSync('phoneNumber');

    try {
      wx.showLoading({
        title: '删除中...'
      });

      // 先发送通知给所有报名用户
      if (this.data.activity.participants && this.data.activity.participants.length > 0) {
        try {
          const notificationResult = await wx.cloud.callFunction({
            name: 'sendNotification',
            data: {
              type: 'delete',
              activityId,
              activityTitle,
              message: `很抱歉，您报名的活动「${activityTitle}」已被组织者取消。如有疑问，请联系组织者。`,
              operatorPhone
            }
          });
          
          console.log('通知发送结果:', notificationResult);
        } catch (notifyError) {
          console.error('发送通知失败:', notifyError);
          // 通知发送失败不影响删除操作，继续执行
        }
      }

      // 删除活动记录
      await db.collection('activities').doc(activityId).remove();

      wx.hideLoading();
      wx.showToast({
        title: '删除成功',
        icon: 'success'
      });

      // 返回上一页
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    } catch (error) {
      wx.hideLoading();
      console.error('删除活动失败:', error);
      wx.showToast({
        title: '删除失败',
        icon: 'none'
      });
    }
  }
  ,
  onEducationVisibilityHelp(e) {
    const role = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.role) || '';
    const content = role === 'organizer'
      ? '点击每条学历右侧的眼睛可设置该学历是否对其他报名者可见。至少需保留一条可见。不同活动可分别设置。'
      : '报名后，点击每条学历右侧的眼睛图标可设置该学历是否对其他报名者可见。至少需保留一条可见。不同活动可分别设置。';
    wx.showModal({
      title: '提示',
      content,
      showCancel: false,
      confirmText: '知道了'
    });
  },
  async onToggleEducationVisibility(e) {
    try {
      const phoneNumber = wx.getStorageSync('phoneNumber');
      const activityId = (this.data.activity && this.data.activity._id) || this.activityId || '';
      const userPhone = e.currentTarget.dataset.userPhone || phoneNumber;
      const key = e.currentTarget.dataset.key || '';
      if (!activityId || !userPhone || !key) return;
      const activity = this.data.activity || {};
      const isOrganizer = (this.data.organizer && this.data.organizer.phoneNumber === userPhone);
      const list = isOrganizer
        ? (((this.data.organizer || {}).educationEntries) || [])
        : ((((activity.registeredUsers || []).find(u => u.phoneNumber === userPhone)) || {}).educationEntries || []);
      const currentVisibleCount = list.filter(ed => ed && ed.visible !== false).length;
      const target = list.find(ed => ed && ed._key === key);
      const current = target ? (target.visible !== false) : true;
      if (current && currentVisibleCount <= 1) {
        wx.showModal({
          title: '提示',
          content: '至少保留一条学历对别人可见',
          showCancel: false,
          confirmText: '知道了'
        });
        return;
      }
      const next = !current;
      const db = wx.cloud.database();
      const path = `participation.${userPhone}.educationVisibility.${key}`;
      await db.collection('activities').doc(activityId).update({ data: { [path]: next } });
      const updatedUsers = (activity.registeredUsers || []).map(u => {
        if (u.phoneNumber !== userPhone) return u;
        const updatedEntries = (u.educationEntries || []).map(ed => ed && ed._key === key ? { ...ed, visible: next } : ed);
        return { ...u, educationEntries: updatedEntries };
      });
      const visUserMap = (((activity.participation || {})[userPhone] || {}).educationVisibility) || {};
      const newVisRoot = { ...((activity.participation || {})[userPhone] || {}), educationVisibility: { ...visUserMap, [key]: next } };
      const newParticipation = { ...(activity.participation || {}), [userPhone]: newVisRoot };
      if (isOrganizer) {
        const orgEntries = ((this.data.organizer || {}).educationEntries || []).map(ed => ed && ed._key === key ? { ...ed, visible: next } : ed);
        this.setData({ 'activity.participation': newParticipation, 'organizer.educationEntries': orgEntries });
      } else {
        this.setData({ 'activity.participation': newParticipation, 'activity.registeredUsers': updatedUsers });
      }
    } catch (error) {}
  },

  onViewQuestionnaireDetails() {
    const activityId = (this.data.activity && this.data.activity._id) || this.activityId || '';
    if (!activityId) {
      wx.showToast({ title: '活动信息不存在', icon: 'none' });
      return;
    }
    if (!this.data.activity || !this.data.isCreator) {
      wx.showToast({ title: '仅组织者可查看', icon: 'none' });
      return;
    }
    if (!this.data.questionnaireHasInfo) {
      wx.showToast({ title: '该活动未收集问卷信息', icon: 'none' });
      return;
    }
    wx.navigateTo({
      url: `/pages/activity-detail/questionnaire-detail/index?id=${activityId}`
    });
  }
})

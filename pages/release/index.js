// pages/release/index.js

// 使用微信小程序原生地图选点功能，无需引入第三方插件

Page({
  /**
   * 页面的初始数据
   */
  data: {
    // 表单数据
    title: '',                         // 活动标题
    
    // 活动类型分类
    // activityCategory: '',               // 活动类型分类的值

    // 活动类型选项（用于单选）
    // activityTypeOptions: [
    //   { text: '运动', value: 'sport' },
    //   { text: '艺术', value: 'art' },
    //   { text: '学习', value: 'study' },
    //   { text: '职业', value: 'career' },
    //   { text: '亲子', value: 'parent-child' },
    //   { text: '娱乐', value: 'entertainment' },
    // ],
    
    // 活动开始时间
    activityStartTime: '',             // 活动开始时间（显示用）
    activityStartTimeValue: '',        // 活动开始时间（字符串）
    activityStartTimeVisible: false,   // 活动开始时间选择器显示状态
    
    // 活动结束时间
    activityEndTime: '',               // 活动结束时间（显示用）
    activityEndTimeValue: '',          // 活动结束时间（字符串）
    activityEndTimeVisible: false,     // 活动结束时间选择器显示状态
    
    // 报名截止时间
    registrationDeadline: '',          // 报名截止时间（显示用）
    registrationDeadlineValue: '',     // 报名截止时间（字符串）
    registrationDeadlineVisible: false, // 报名截止时间选择器显示状态
    
    // 活动形式
    activityType: 'offline',           // 活动形式：线下(offline)或线上(online)
    
    // 线下活动信息
    city: '',                          // 活动城市
    address: '',                       // 活动地址
    latitude: null,                    // 活动地址纬度
    longitude: null,                   // 活动地址经度
    
    // 线上活动信息
    meetingLink: '',                   // 会议链接
    
    // 报名人数上限
    hasParticipantLimit: true,         // 是否启用报名人数上限
    maxParticipants: 30,               // 报名人数上限
    currentParticipantCount: 0,        // 当前已报名人数（编辑模式使用）
    
    // 群聊二维码
    qrcodeFiles: [],                   // 群聊二维码文件
    // 活动图片/海报
    posterFiles: [],                   // 活动图片/海报文件（最多3张）
    
    // 活动介绍
    description: '',                   // 活动介绍内容
    
    // 报名限制
    registrationRestriction: 'all',     // 报名限制：所有人可参加(all)或限本校参加(school)

    // 限本校参加时的学校选择
    restrictedSchoolOptions: [],        // 用户已认证的学校列表（去重）
    restrictedSchool: '',               // 选择的学校

    // 地图选点相关
    // showMapPicker: false, // 控制地图选点弹窗的显示/隐藏
    // selectedAddress: '', // 地图选中的地址

    customCategoryOptions: [
      { text: '运动', value: 'sport' },
      { text: '艺术', value: 'art' },
      { text: '娱乐', value: 'entertainment' },
      { text: '亲子', value: 'parent-child' },
      { text: '职业', value: 'career' },
      { text: '学习', value: 'study' },
      { text: '社交', value: 'social' },
    ],
    selectedCategory: '',

    // 子活动类型数据
    subCategoryData: {
      sport: [
        { text: '篮球', value: 'basketball' },
        { text: '足球', value: 'football' },
        { text: '羽毛球', value: 'badminton' },
        { text: '乒乓球', value: 'pingpong' },
        { text: '网球', value: 'tennis' },
        { text: '排球', value: 'volleyball' },
        { text: '匹克球', value: 'pickleball' },
        { text: '壁球', value: 'squash' },
        { text: '登山', value: 'mountaineering' },
        { text: '徒步', value: 'hiking' },
        { text: '骑行', value: 'cycling' },
        { text: '攀岩', value: 'climbing' },
        { text: '探险', value: 'exploration' },
        { text: '定向越野', value: 'orienteering' },
        { text: '健身', value: 'fitness' },
        { text: '瑜伽', value: 'yoga' },
        { text: '普拉提', value: 'pilates' },
        { text: '搏击', value: 'combat' },
        { text: '操课', value: 'group-fitness' },
        { text: '舞蹈', value: 'dance' },
        { text: '飞盘', value: 'frisbee' },
        { text: '橄榄球', value: 'rugby' },
        { text: '跑步', value: 'running' },
        { text: '马拉松', value: 'marathon' },
        { text: '太极', value: 'tai-chi' },
        { text: '台球', value: 'billiards' },
        { text: '保龄球', value: 'bowling' },
        { text: '射箭', value: 'archery' },
        { text: '高尔夫', value: 'golf' },
        { text: '卡丁车', value: 'karting' },
        { text: '皮划艇', value: 'kayaking' },
        { text: '潜水', value: 'diving' },
        { text: '冲浪', value: 'surfing' },
        { text: '帆船', value: 'sailing' },
        { text: '钓鱼', value: 'fishing' },
        { text: '游泳', value: 'swimming' },
        { text: '滑雪', value: 'skiing' },
        { text: '冰球', value: 'ice-hockey' },
        { text: '滑冰', value: 'skating' },
        { text: '冰壶', value: 'curling' },
      ],
      art: [
        { text: '非遗', value: 'intangible-heritage' },
        { text: '展览', value: 'exhibition' },
        { text: '音乐会', value: 'concert' },
        { text: '演唱会', value: 'singing-concert' },
        { text: '文学', value: 'literature' },
        { text: '电影', value: 'film' },
        { text: '戏剧', value: 'drama' },
        { text: '摄影', value: 'photography' },
        { text: '手工', value: 'handicraft' },
      ],
      career: [
        { text: '行业交流', value: 'industry-exchange' },
        { text: '企业参访', value: 'company-visit' },
        { text: '行业峰会', value: 'industry-summit' },
        { text: '职业培训', value: 'vocational-training' },
      ],
      entertainment: [
        { text: '游戏', value: 'game' },
        { text: '桌游', value: 'board-game' },
        { text: '旅行', value: 'travel' },
        { text: '密室逃脱', value: 'escape-room' },
        { text: '剧本杀', value: 'script-killing' },
        { text: '观赛', value: 'watching-game' },
      ],
      'parent-child': [
        { text: '亲子活动', value: 'parent-child-activity' },
        { text: '教育沙龙', value: 'education-salon' },
        { text: '家庭旅行', value: 'family-travel' },
      ],
      social: [
        { text: '聚餐', value: 'dinner' },
      ],
      study: [
        { text: '讲座', value: 'lecture' },
        { text: '学术交流', value: 'academic-exchange' },
        { text: '语言角', value: 'language-corner' },
        { text: '考试互助', value: 'exam-assistance' },
      ],
    },
    subCategoryOptions: [],
    selectedSubCategories: '',
    questionnaireEnabled: false,
    questionnaireFields: [],
    questionnaireNeedRealName: false,
    questionnaireNeedPhoneNumber: false,
    _draftLoaded: false,
    _internalNavigating: false,
    _initialFormSnapshot: null,
    statusHeight: 0,
    navPaddingTop: 0
  },

  /**
   * 导航栏返回按钮点击事件
   */
  onNavigationBarBackTap() {
    try { console.log('[release] back tap fired'); } catch (_) {}
    const dirty = this.isFormDirty();
    try { console.log('[release] isFormDirty =', dirty, 'data snapshot:', { title: this.data.title, activityStartTimeValue: this.data.activityStartTimeValue, description: this.data.description, qrcodeFilesLen: (this.data.qrcodeFiles || []).length, posterFilesLen: (this.data.posterFiles || []).length, selectedCategory: this.data.selectedCategory, selectedSubCategories: this.data.selectedSubCategories }); } catch (_) {}
    if (dirty) {
      wx.showModal({
        title: '保存草稿',
        content: '是否保存当前未发布的活动为草稿？',
        confirmText: '保存',
        cancelText: '不保存',
        success: async (res) => {
          if (res.confirm) {
            await this.saveDraft();
          } else {
            await this.clearDraft();
          }
          wx.navigateBack({ delta: 1 });
        }
      });
    } else {
      wx.navigateBack({ delta: 1 });
    }
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function(options) {
    console.log('Release page loaded with options:', options);
    try {
      const statusHeight = wx.getWindowInfo().statusBarHeight;
      const topExtra = 34;
      this.setData({ statusHeight, navPaddingTop: statusHeight + topExtra });
    } catch (e) {}

    // 未登录拦截
    const phoneNumber = wx.getStorageSync('phoneNumber');
    if (!phoneNumber) {
      wx.showModal({
        title: '登录提示',
        content: '登录后才能发布活动，是否前往登录？',
        confirmText: '去登录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            const from = encodeURIComponent('/pages/release/index');
            wx.navigateTo({ url: `/pages/login/login?from=${from}` });
          } else {
            // 取消则离开发布页
            wx.navigateBack({
              delta: 1,
              fail: () => wx.switchTab({ url: '/pages/home/index' })
            });
          }
        }
      });
      return; // 中止后续初始化
    }

      // 检查是否为编辑模式
    if (options.id && options.mode === 'edit') {
      // 设置页面标题为编辑模式
      wx.setNavigationBarTitle({
        title: '修改活动'
      });
      // 设置编辑模式数据
      this.setData({
        isEditMode: true,
        activityId: options.id
      });
      this.loadActivityForEdit(options.id);
      } else {
        // 设置页面标题为发布模式
        wx.setNavigationBarTitle({
          title: '发布活动'
        });
        // 设置新建模式数据，不加载任何问卷草稿，默认无问题
        this.setData({
          isEditMode: false,
          activityId: null,
          questionnaireEnabled: false,
          questionnaireFields: [],
          questionnaireNeedRealName: false,
          questionnaireNeedPhoneNumber: false
        });
        this.restoreDraft();
      }

    // 加载用户已认证学校，供“限本校参加”选择
    (async () => {
      try {
        const db = wx.cloud.database();
        const userResult = await db.collection('users').where({ phoneNumber }).get();
        if (userResult.data && userResult.data.length > 0) {
          const userInfo = userResult.data[0];
          const educations = Array.isArray(userInfo.educations) ? userInfo.educations : [];
          const approvedSchools = educations
            .filter(e => e && e.status === 'approved' && e.school && String(e.school).trim() !== '')
            .map(e => String(e.school).trim());
          // 去重
          const uniqueSchools = Array.from(new Set(approvedSchools));
          const toLabel = (e) => {
            const school = e && e.school ? String(e.school).trim() : '';
            const major = e && e.major ? String(e.major).trim() : '';
            const degree = e && e.degree ? String(e.degree).trim() : '';
            const year = e && e.graduationYear ? String(e.graduationYear).trim() : '';
            const parts = [school, major, degree, year && `${year} 届`].filter(Boolean);
            return parts.join(' · ');
          };
          const approvedItems = educations
            .filter(e => e && e.status === 'approved' && e.school && String(e.school).trim() !== '')
            .map(e => ({ school: String(e.school).trim(), label: toLabel(e) }));
          const dedupBySchool = {};
          approvedItems.forEach(it => { if (!dedupBySchool[it.school]) dedupBySchool[it.school] = it; });
          const finalItems = [];
          for (const s in dedupBySchool) {
            if (Object.prototype.hasOwnProperty.call(dedupBySchool, s)) {
              finalItems.push(dedupBySchool[s]);
            }
          }
          // 如果用户profile上有主学校字段，也可作为备选（避免遗漏）
          const profileSchool = userInfo.school && String(userInfo.school).trim() !== '' ? String(userInfo.school).trim() : '';
          if (profileSchool && !uniqueSchools.includes(profileSchool)) {
            uniqueSchools.push(profileSchool);
          }

          if (uniqueSchools.length > 0) {
            // 若只有一个学校，默认选中；多个则等待用户选择
            this.setData({
              restrictedSchoolOptions: uniqueSchools,
              restrictedSchool: uniqueSchools.length === 1 ? uniqueSchools[0] : ''
            });
          } else {
            // 无有效学校，清空选项
            this.setData({
              restrictedSchoolOptions: [],
              restrictedSchool: ''
            });
          }
        }
      } catch (err) {
        console.error('加载用户认证学校失败:', err);
        // 保持为空，避免影响其它流程
        this.setData({ restrictedSchoolOptions: [], restrictedSchool: '' });
      }
    })();

    // 初始化日期时间显示
    // const now = new Date();
    // const formattedDate = this.formatDateTime(now);
    
    // 初始化数据
    // this.setData({
      // activityStartTime: formattedDate,
      // activityStartTimeValue: formattedDate,
      // activityEndTime: formattedDate,
      // activityEndTimeValue: formattedDate,
      // registrationDeadline: formattedDate,
      // registrationDeadlineValue: formattedDate,
    // });

    // 地图相关功能已移除，使用微信小程序自带定位
  },

  /**
   * 格式化日期时间
   */
  formatDateTime(date) {
    if (!date) return '';
    if (typeof date === 'string' || typeof date === 'number') {
      date = new Date(date);
    }
    if (isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  },

  normalizeCity(val) {
    if (!val) return '';
    if (typeof val === 'string') return val.trim();
    if (typeof val === 'object') {
      const cand = [val.city, val.name, val.cityName, val.label, val.text];
      const s = cand.map(x => x && String(x).trim()).find(x => x);
      return s || '';
    }
    return String(val).trim();
  },

  /**
   * 表单字段变更处理函数
   */
  onTitleChange(e) {
    this.setData({ title: e.detail.value });
  },

  onAddressChange(e) {
    const value = e.detail.value;
    // 限制30个字符
    if (value.length <= 30) {
      this.setData({ 
        address: value,
        // 清除之前地图选点的经纬度信息
        latitude: null,
        longitude: null
      });
    }
  },

  onMeetingLinkChange(e) {
    this.setData({ meetingLink: e.detail.value });
  },

  onActivityTypeChange(e) {
    this.setData({ activityType: e.detail.value });
  },

  onMaxParticipantsChange(e) {
    this.setData({ maxParticipants: e.detail.value });
  },

  onHasParticipantLimitChange(e) {
    this.setData({ hasParticipantLimit: e.detail.value });
  },

  onDescriptionChange(e) {
    this.setData({ description: e.detail.value });
  },

  onRegistrationRestrictionChange(e) {
    const value = e.detail.value;
    const { restrictedSchoolOptions } = this.data;
    // 当选择限本校参加时，如果只有一个学校则自动选中；切换到所有人时清空选择
    if (value === 'school') {
      this.setData({
        registrationRestriction: value,
        restrictedSchool: restrictedSchoolOptions.length === 1 ? restrictedSchoolOptions[0] : this.data.restrictedSchool
      });
    } else {
      this.setData({
        registrationRestriction: value,
        restrictedSchool: ''
      });
    }
  },

  onQuestionnaireEnableChange(e) {
    const v = !!e.detail.value;
    this.setData({ questionnaireEnabled: v });
  },
  onQuestionnaireInfoTap() {
    wx.showModal({
      title: '说明',
      content: '根据需要收集用户信息，用户必须完成填写才能报名',
      showCancel: false,
      confirmText: '知道了'
    });
  },
  onPosterInfoTap() {
    wx.showModal({
      title: '说明',
      content: '最多 3 张，第一张图将被显示在首页上',
      showCancel: false,
      confirmText: '知道了'
    });
  },
  onEditQuestionnaire() {
    const that = this;
    this.setData({ _internalNavigating: true });
    wx.navigateTo({
      url: '/pages/release/questionnaire/index',
      events: {
        questionnaireSaved(data) {
          const fields = Array.isArray(data && data.fields) ? data.fields : [];
          that.setData({
            questionnaireFields: fields,
            questionnaireEnabled: (fields.length > 0) || !!(data && data.needRealName) || !!(data && data.needPhoneNumber),
            questionnaireNeedRealName: !!(data && data.needRealName),
            questionnaireNeedPhoneNumber: !!(data && data.needPhoneNumber)
          });
        }
      },
      success(res) {
        res.eventChannel.emit('initData', {
          fields: that.data.questionnaireFields,
          activityId: that.data.activityId || '',
          needRealName: !!that.data.questionnaireNeedRealName,
          needPhoneNumber: !!that.data.questionnaireNeedPhoneNumber
        });
      }
    });
  },

  // 高级选项相关方法已移除

  // 限本校参加的学校选择变更
  onRestrictedSchoolChange(e) {
    const { restrictedSchoolOptions } = this.data;
    const val = e && e.detail ? e.detail.value : undefined;
    let selected = '';

    // 兼容 picker 的索引返回与 radio-group 的值返回
    if (Array.isArray(val)) {
      const index = Number(val[0]);
      selected = restrictedSchoolOptions[index] || '';
    } else if (typeof val === 'number' || /^\d+$/.test(String(val))) {
      const index = Number(val);
      selected = restrictedSchoolOptions[index] || '';
    } else if (typeof val === 'string') {
      selected = restrictedSchoolOptions.includes(val) ? val : '';
    }

    this.setData({ restrictedSchool: selected });
  },

  // 兜底：学校标签点击（直接设置选中项，确保 UI 立即更新）
  onRestrictedSchoolTagTap(e) {
    const value = e.currentTarget && e.currentTarget.dataset ? e.currentTarget.dataset.value : '';
    if (!value) return;
    // 仅在限本校参加时处理；避免无效状态更新
    if (this.data.registrationRestriction !== 'school') return;
    if (this.data.restrictedSchool !== value) {
      this.setData({ restrictedSchool: value });
    }
  },

  /**
   * 活动开始时间选择器相关函数
   */
  showActivityStartTimePicker() {
    const now = new Date();
    const formattedDate = this.formatDateTime(now);
    this.setData({
      activityStartTimeVisible: true,
      activityStartTimeValue: this.data.activityStartTimeValue || formattedDate
    });
  },

  onActivityStartTimeConfirm(e) {
    const value = e.detail.value || e.detail;
    const formattedDate = this.formatDateTime(value);
    this.setData({
      activityStartTimeValue: formattedDate,
      activityStartTime: formattedDate,
      activityStartTimeVisible: false
    });
  },

  onActivityStartTimeCancel() {
    this.setData({ activityStartTimeVisible: false });
  },

  /**
   * 活动结束时间选择器相关函数
   */
  showActivityEndTimePicker() {
    const now = new Date();
    const formattedDate = this.formatDateTime(now);
    this.setData({
      activityEndTimeVisible: true,
      activityEndTimeValue: this.data.activityEndTimeValue || formattedDate
    });
  },

  onActivityEndTimeConfirm(e) {
    const value = e.detail.value || e.detail;
    const formattedDate = this.formatDateTime(value);
    this.setData({
      activityEndTimeValue: formattedDate,
      activityEndTime: formattedDate,
      activityEndTimeVisible: false
    });
  },

  onActivityEndTimeCancel() {
    this.setData({ activityEndTimeVisible: false });
  },

  /**
   * 报名截止时间选择器相关函数
   */
  showRegistrationDeadlinePicker() {
    const now = new Date();
    const formattedDate = this.formatDateTime(now);
    this.setData({
      registrationDeadlineVisible: true,
      registrationDeadlineValue: this.data.registrationDeadlineValue || formattedDate
    });
  },

  onRegistrationDeadlineConfirm(e) {
    const value = e.detail.value || e.detail;
    const formattedDate = this.formatDateTime(value);
    this.setData({
      registrationDeadlineValue: formattedDate,
      registrationDeadline: formattedDate,
      registrationDeadlineVisible: false
    });
  },

  onRegistrationDeadlineCancel() {
    this.setData({ registrationDeadlineVisible: false });
  },

  /**
   * 城市选择器相关函数
   */


  /**
   * 群聊二维码相关函数
   */
  onQrcodeUploadSuccess(e) {
    const { files } = e.detail;
    this.setData({
      qrcodeFiles: files
    });
  },

  onQrcodeRemove(e) {
    const { index } = e.detail;
    const { qrcodeFiles } = this.data;
    qrcodeFiles.splice(index, 1);
    this.setData({
      qrcodeFiles
    });
  },

  onQrcodeClick(e) {
    const { index } = e.detail;
    const { qrcodeFiles } = this.data;
    const current = qrcodeFiles[index].url;
    
    wx.previewImage({
      current,
      urls: qrcodeFiles.map(file => file.url)
    });
  },

  // 活动图片/海报上传
  onPosterUploadSuccess(e) {
    const { files } = e.detail;
    this.setData({ posterFiles: (files || []).slice(0, 3) });
  },
  onPosterRemove(e) {
    const { index } = e.detail;
    const list = (this.data.posterFiles || []).slice();
    list.splice(index, 1);
    this.setData({ posterFiles: list });
  },
  onPosterClick(e) {
    const { index } = e.detail;
    const list = this.data.posterFiles || [];
    const current = list[index] && list[index].url;
    if (current) {
      wx.previewImage({ current, urls: list.map(f => f.url) });
    }
  },

  /**
   * 表单提交
   */
  async submitForm() {
    const { 
      title, activityStartTimeValue, activityEndTimeValue, registrationDeadlineValue, 
      activityType, city, address, meetingLink, hasParticipantLimit,
      maxParticipants, description, qrcodeFiles, registrationRestriction,
      activityStartTime, activityEndTime, registrationDeadline, posterFiles
    } = this.data;

    const cityTextLocal = this.normalizeCity(city) || this.normalizeCity(wx.getStorageSync('selectedCity')) || this.normalizeCity(wx.getStorageSync('currentActivityCity'));
    if (cityTextLocal && cityTextLocal !== city) {
      this.setData({ city: cityTextLocal });
    }

    // 表单验证
    if (!title) {
      this.showToast('请输入活动标题');
      return;
    }

    // 如果启用了人数限制，验证人数上限
    if (hasParticipantLimit && !maxParticipants) {
      this.showToast('请设置报名人数上限');
      return;
    }
    
    // 编辑模式下，检查人数限制不能低于已报名人数
    if (this.data.isEditMode && hasParticipantLimit && this.data.currentParticipantCount) {
      if (maxParticipants < this.data.currentParticipantCount) {
        this.showToast(`报名人数上限不能低于当前已报名人数（${this.data.currentParticipantCount}人）`);
        return;
      }
    }
    if (!activityStartTimeValue) {
      this.showToast('请选择活动开始时间');
      return;
    }
    if (!activityEndTimeValue) {
      this.showToast('请选择活动结束时间');
      return;
    }
    if (!registrationDeadlineValue) {
      this.showToast('请选择报名截止时间');
      return;
    }
    
    // 时间逻辑验证
    if (activityStartTimeValue > activityEndTimeValue) {
      this.showToast('活动开始时间不能晚于结束时间');
      return;
    }
    if (registrationDeadlineValue > activityStartTimeValue) {
      this.showToast('报名截止时间不能晚于活动开始时间');
      return;
    }
    
    // 活动形式相关验证
    if (activityType === 'offline') {
      console.log('提交调试 - 城市验证:', {
        city: city,
        cityType: typeof city,
        cityLength: city ? city.length : 0,
        isEmpty: !city,
        isTrimmedEmpty: !city || !city.trim()
      });
      if (!cityTextLocal) {
        this.showToast('请选择活动城市');
        return;
      }
      if (!address || !address.trim()) {
        this.showToast('请输入活动地点');
        return;
      }
      if (address.length > 30) {
        this.showToast('活动地点不能超过30个字');
        return;
      }
    } else if (activityType === 'online') {
      if (!meetingLink) {
        this.showToast('请输入会议链接');
        return;
      }
    }
    
    if (!description) {
      this.showToast('请输入活动介绍');
      return;
    }

    // 主分类校验：未选择主分类则不允许发布
    if (!this.data.selectedCategory || (typeof this.data.selectedCategory === 'string' && this.data.selectedCategory.trim() === '')) {
      this.showToast('请选择活动类型');
      return;
    }

    // 子分类校验：未选择子分类则不允许发布
    if (
      !this.data.selectedSubCategories ||
      (Array.isArray(this.data.selectedSubCategories) && this.data.selectedSubCategories.length === 0) ||
      (typeof this.data.selectedSubCategories === 'string' && this.data.selectedSubCategories.trim() === '')
    ) {
      this.showToast('请选择活动子分类');
      return;
    }

    // 群聊二维码校验：必须上传二维码
    if (!qrcodeFiles || qrcodeFiles.length === 0) {
      this.showToast('请上传群聊二维码');
      return;
    }

    // 当选择限本校参加时，需选择具体学校（若用户有多个已认证学校）
    if (registrationRestriction === 'school') {
      const { restrictedSchoolOptions, restrictedSchool } = this.data;
      if (restrictedSchoolOptions.length === 0) {
        this.showToast('未检测到已认证学校，请先完成校友认证');
        return;
      }
      if (restrictedSchoolOptions.length > 1 && !restrictedSchool) {
        this.showToast('请选择参加学校');
        return;
      }
      // 单学校情况，若未选则自动带入唯一值
      if (restrictedSchoolOptions.length === 1 && !restrictedSchool) {
        this.setData({ restrictedSchool: restrictedSchoolOptions[0] });
      }
    }
    
    // 检查用户是否已登录
    const phoneNumber = wx.getStorageSync('phoneNumber');
    if (!phoneNumber) {
      this.showToast('请先登录');
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

        

        // 新建发布需通过认证；编辑模式不再拦截
        if (!this.data.isEditMode) {
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
        }
      }
    } catch (error) {
      console.error('检查用户认证状态失败:', error);
    }
    
    // 获取用户信息
    const userInfo = getApp().globalData.userInfo || {};

    // 显示加载提示
    wx.showLoading({
      title: '正在发布...',
      mask: true
    });

    // 处理群聊二维码上传
    let qrcodeUrl = '';
    const uploadQrcode = async () => {
      if (qrcodeFiles && qrcodeFiles.length > 0) {
        const qrcodeFile = qrcodeFiles[0];
        
        // 如果是编辑模式且二维码URL是云存储地址，直接使用原有的URL
        if (this.data.isEditMode && qrcodeFile.url && qrcodeFile.url.startsWith('cloud://')) {
          return qrcodeFile.url;
        }
        
        // 如果是新上传的文件，需要上传到云存储
        if (qrcodeFile.url && !qrcodeFile.url.startsWith('cloud://')) {
          try {
            // 上传二维码到云存储
            const uploadResult = await wx.cloud.uploadFile({
              cloudPath: `qrcodes/${new Date().getTime()}_${Math.random().toString(36).substring(2)}.${qrcodeFile.url.split('.').pop()}`,
              filePath: qrcodeFile.url,
            });
            return uploadResult.fileID;
          } catch (error) {
            console.error('二维码上传失败', error);
            throw error;
          }
        }
      }
      return '';
    };

    // 处理活动图片/海报上传（最多3张）
    const uploadPosters = async () => {
      const files = Array.isArray(this.data.posterFiles) ? this.data.posterFiles.slice(0, 3) : [];
      const ids = [];
      for (const f of files) {
        if (this.data.isEditMode && f.url && f.url.startsWith('cloud://')) {
          ids.push(f.url);
          continue;
        }
        if (f.url && !f.url.startsWith('cloud://')) {
          try {
            const ext = (f.url.split('.').pop() || 'jpg').split('?')[0];
            const uploadRes = await wx.cloud.uploadFile({
              cloudPath: `activity-images/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`,
              filePath: f.url,
            });
            ids.push(uploadRes.fileID);
          } catch (e) {
            console.error('上传活动图片失败', e);
          }
        }
      }
      return ids;
    };

    // 构建活动数据
    const buildActivityData = (qrcodeUrl) => {
      return {
        title,
        activityStartTime,
        activityEndTime,
        registrationDeadline,
        activityStartTimeValue,
        activityEndTimeValue,
        registrationDeadlineValue,
        activityType,
        location: activityType === 'offline' ? { city: cityTextLocal, address } : { meetingLink },
        participantLimit: hasParticipantLimit ? maxParticipants : null,
        description,
        qrcodeUrl,
        registrationRestriction,
        // 若为限本校参加，记录具体学校，便于后续筛选
        restrictedSchool: registrationRestriction === 'school' ? (this.data.restrictedSchool || this.data.restrictedSchoolOptions[0] || '') : '',
        createdBy: {
          openid: userInfo.openid || '',
          phoneNumber: phoneNumber,
          nickName: userInfo.nickName || '',
          avatarUrl: userInfo.avatarUrl || ''
        },
        
        participants: [],
        createdAt: new Date(),
        status: 'active',
        category: this.data.selectedCategory,
        subCategory: Array.isArray(this.data.selectedSubCategories)
          ? (this.data.selectedSubCategories[0] || '')
          : (this.data.selectedSubCategories || ''),
        questionnaire: {
          enabled: !!(this.data.questionnaireEnabled || this.data.questionnaireNeedRealName || this.data.questionnaireNeedPhoneNumber || (Array.isArray(this.data.questionnaireFields) && this.data.questionnaireFields.length > 0)),
          fields: Array.isArray(this.data.questionnaireFields) ? this.data.questionnaireFields : [],
          needRealName: !!this.data.questionnaireNeedRealName,
          needPhoneNumber: !!this.data.questionnaireNeedPhoneNumber
        },
        images: []
      };
    };

    // 执行数据库操作
    Promise.all([uploadQrcode(), uploadPosters()])
      .then(([qrcodeFileID, posterFileIDs]) => {
        // 获取数据库引用
        const db = wx.cloud.database();
        
        if (this.data.isEditMode && this.data.activityId) {
          // 编辑模式：更新现有活动
          const updateData = buildActivityData(qrcodeFileID);
          updateData.images = posterFileIDs || [];
          // 移除不应该更新的字段
          delete updateData.createdAt;
          delete updateData.participants;
          delete updateData.createdBy;
          delete updateData.createdByEducationSnapshot;
          // 添加更新时间
          updateData.updatedAt = new Date();
          
          return db.collection('activities').doc(this.data.activityId).update({
            data: updateData
          });
        } else {
          // 新建模式：添加新活动
          const data = buildActivityData(qrcodeFileID);
          data.images = posterFileIDs || [];
          return db.collection('activities').add({
            data
          });
        }
      })
      .then(async (result) => {
        // 如果是编辑模式，发送通知消息给所有报名用户
        if (this.data.isEditMode && this.data.activityId) {
          await this.sendNotificationToParticipants();
        } else {
          // 新建模式：发送活动推荐通知给匹配的用户
          await this.sendRecommendationToMatchedUsers(result._id);
        }
        
        wx.hideLoading();
        const successMessage = this.data.isEditMode ? '活动修改成功' : '活动发布成功';
        this.showToast(successMessage, 'success');
        
        // 延迟跳转
        setTimeout(() => {
          if (this.data.isEditMode) {
            // 编辑模式返回活动详情页
            wx.navigateBack();
          } else {
            // 新建模式直接跳转到首页，避免页面栈问题
            wx.reLaunch({
              url: '/pages/home/index'
            });
          }
        }, 1500);
        try {
          const phoneNumber = wx.getStorageSync('phoneNumber');
          if (phoneNumber) {
            const db = wx.cloud.database();
            const _ = db.command;
            await db.collection('users').where({ phoneNumber }).update({ data: { releaseDraft: _.remove() } });
          }
        } catch (_) {}
      })
      .catch(error => {
        wx.hideLoading();
        const errorMessage = this.data.isEditMode ? '活动修改失败' : '活动发布失败';
        console.error(errorMessage, error);
        this.showToast(errorMessage + '，请重试');
      });
  },

  /**
   * 显示提示信息
   */
  showToast(message, type = 'error') {
    const Toast = this.selectComponent('#t-toast');
    if (Toast) {
      Toast.show({
        message,
        theme: type,
        direction: 'column',
      });
    }
  },

  // 移除地图选点方法，改为手动输入

  onChooseCity() {
    this.setData({ _internalNavigating: true });
    wx.navigateTo({
      url: '/pages/city-selector/index?from=release'
    });
  },

  onShow() {
    this.setData({ _internalNavigating: false });
    // 监听城市选择页面返回的城市
    const selectedCity = wx.getStorageSync('selectedCity');
    const selectedCityText = this.normalizeCity(selectedCity);
    
    console.log('onShow调试 - 缓存中的城市:', selectedCity);
    console.log('onShow调试 - 当前页面城市:', this.data.city);
    
    if (selectedCityText) {
      this.setData({
        city: selectedCityText
      });
      console.log('onShow调试 - 设置城市后:', this.data.city);
      // 将城市信息也保存到本地存储，作为备份
      wx.setStorageSync('currentActivityCity', selectedCityText);
      // 清除临时缓存
      wx.removeStorageSync('selectedCity');
    } else {
      // 如果没有临时缓存，尝试从备份中恢复
      const backupCity = wx.getStorageSync('currentActivityCity');
      if (backupCity && !this.data.city) {
        this.setData({
          city: backupCity
        });
        console.log('onShow调试 - 从备份恢复城市:', backupCity);
      }
    }
    
    console.log('onShow调试 - 最终城市状态:', this.data.city);
  },

  /**
   * 加载活动信息用于编辑
   */
  async loadActivityForEdit(activityId) {
    try {
      wx.showLoading({
        title: '加载中...',
        mask: true
      });
      
      const db = wx.cloud.database();
      const result = await db.collection('activities').doc(activityId).get();
      
      if (result.data) {
        const activity = result.data;
        
        // 获取当前已报名人数
        const currentParticipantCount = activity.participants ? activity.participants.length : 0;
        
        // 预填充表单数据
        this.setData({
          title: activity.title || '',
          activityStartTimeValue: activity.activityStartTimeValue || '',
          activityEndTimeValue: activity.activityEndTimeValue || '',
          registrationDeadlineValue: activity.registrationDeadlineValue || '',
          activityStartTime: activity.activityStartTime || '',
          activityEndTime: activity.activityEndTime || '',
          registrationDeadline: activity.registrationDeadline || '',
          activityType: activity.activityType || 'offline',
          city: activity.location?.city || '',
          address: activity.location?.address || '',
          meetingLink: activity.location?.meetingLink || '',
          hasParticipantLimit: activity.participantLimit ? true : false,
          maxParticipants: activity.participantLimit || '',
          description: activity.description || '',
          registrationRestriction: activity.registrationRestriction || 'none',
          restrictedSchool: activity.restrictedSchool || '',
          selectedCategory: activity.category || '',
          selectedSubCategories: (typeof activity.subCategory === 'string'
            ? activity.subCategory
            : (Array.isArray(activity.subCategory) ? (activity.subCategory[0] || '') : '')),
          currentParticipantCount: currentParticipantCount,
          questionnaireEnabled: !!(activity.questionnaire && activity.questionnaire.enabled),
          questionnaireFields: (activity.questionnaire && Array.isArray(activity.questionnaire.fields)) ? activity.questionnaire.fields : [],
          questionnaireNeedRealName: !!(activity.questionnaire && activity.questionnaire.needRealName),
          questionnaireNeedPhoneNumber: !!(activity.questionnaire && activity.questionnaire.needPhoneNumber)
        });
        const subOptions = activity.category ? (this.data.subCategoryData[activity.category] || []) : [];
        this.setData({ subCategoryOptions: subOptions });
        this.captureInitialSnapshot();
        
        // 如果有二维码，预填充二维码信息
        if (activity.qrcodeUrl) {
          this.setData({
            qrcodeFiles: [{
              url: activity.qrcodeUrl,
              name: 'qrcode.jpg',
              type: 'image'
            }]
          });
        }
        // 预填充活动图片/海报
        if (Array.isArray(activity.images) && activity.images.length > 0) {
          this.setData({
            posterFiles: activity.images.map((u, i) => ({ url: u, name: `image_${i+1}.jpg`, type: 'image' }))
          });
        }
        
        wx.hideLoading();
      } else {
        wx.hideLoading();
        this.showToast('活动信息加载失败');
        wx.navigateBack();
      }
    } catch (error) {
      wx.hideLoading();
      console.error('加载活动信息失败:', error);
      this.showToast('活动信息加载失败');
      wx.navigateBack();
    }
  },

  /**
   * 发送通知消息给所有报名用户（除发布者外）
   */
  async sendNotificationToParticipants() {
    try {
      const operatorPhone = wx.getStorageSync('phoneNumber');
      
      // 使用云函数发送通知
      const notificationResult = await wx.cloud.callFunction({
        name: 'sendNotification',
        data: {
          type: 'update',
          activityId: this.data.activityId,
          activityTitle: this.data.title,
          message: `您报名的活动「${this.data.title}」信息已更新，请查看最新详情。`,
          operatorPhone
        }
      });
      
      console.log('活动更新通知发送结果:', notificationResult);
      
      if (notificationResult.result && notificationResult.result.success) {
        console.log(`活动修改通知已发送给 ${notificationResult.result.notifiedCount} 位用户`);
      } else {
        console.error('发送通知失败:', notificationResult.result?.error);
      }
      
    } catch (error) {
      console.error('发送通知消息失败:', error);
      // 通知发送失败不影响活动更新，只记录错误
    }
  },

  /**
   * 发送活动推荐通知给匹配的用户
   */
  async sendRecommendationToMatchedUsers(activityId) {
    try {
      const publisherPhone = wx.getStorageSync('phoneNumber');
      
      console.log('准备发送推荐通知，参数:', {
        activityId: activityId,
        activityTitle: this.data.title,
        activityCity: this.data.city,
        subCategory: this.data.selectedSubCategories,
        activityType: this.data.activityType,
        publisherPhone
      });
      
      // 检查必要参数
      if (
        !this.data.selectedSubCategories ||
        (Array.isArray(this.data.selectedSubCategories) && this.data.selectedSubCategories.length === 0)
      ) {
        console.warn('未选择活动子分类，跳过推荐通知发送');
        return;
      }
      
      // 使用云函数发送推荐通知
      const recommendationResult = await wx.cloud.callFunction({
        name: 'sendRecommendation',
        data: {
          activityId: activityId,
          activityTitle: this.data.title,
          activityCity: this.data.city,
          subCategory: Array.isArray(this.data.selectedSubCategories)
            ? (this.data.selectedSubCategories[0] || '')
            : this.data.selectedSubCategories,
          activityType: this.data.activityType,
          registrationRestriction: this.data.registrationRestriction,
          publisherPhone
        }
      });
      
      console.log('活动推荐通知发送结果:', recommendationResult);
      
      if (recommendationResult.result && recommendationResult.result.success) {
        console.log(`活动推荐通知已发送给 ${recommendationResult.result.notifiedCount} 位用户`);
      } else {
        console.error('发送推荐通知失败:', recommendationResult.result?.error);
      }
      
    } catch (error) {
      console.error('发送推荐通知失败:', error);
      // 推荐通知发送失败不影响活动发布，只记录错误
    }
  },

  /**
   * 格式化时间
   */
  formatTime(date) {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes();
    
    return `${month}/${day} ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  },

  onUnload() {
    try { wx.disableAlertBeforeUnload && wx.disableAlertBeforeUnload(); } catch (_) {}
    // 页面卸载时的清理工作
    // 清除城市备份数据
    wx.removeStorageSync('currentActivityCity');
    wx.removeStorageSync('selectedCity');
  },

  onHide() {
    try { console.log('[release] onHide, _internalNavigating=', this.data._internalNavigating); } catch (_) {}
    if (this.data._internalNavigating) return;
    const dirty = this.isFormDirty();
    try { console.log('[release] onHide isFormDirty =', dirty); } catch (_) {}
    if (!dirty) return;
    wx.showModal({
      title: '保存草稿',
      content: '是否保存当前未发布的活动为草稿？',
      confirmText: '保存',
      cancelText: '不保存',
      success: async (res) => {
        if (res.confirm) {
          await this.saveDraft();
        } else {
          await this.clearDraft();
        }
        try {
          wx.navigateBack({
            delta: 1,
            fail: () => wx.switchTab({ url: '/pages/home/index' })
          });
        } catch (e) {}
      }
    });
  },

  getFormState() {
    const d = this.data;
    const normalizeFiles = (list) => (Array.isArray(list) ? list.map(f => f && f.url ? String(f.url) : '').filter(Boolean) : []);
    return {
      title: String(d.title || ''),
      activityStartTimeValue: String(d.activityStartTimeValue || ''),
      activityEndTimeValue: String(d.activityEndTimeValue || ''),
      registrationDeadlineValue: String(d.registrationDeadlineValue || ''),
      activityType: String(d.activityType || ''),
      city: String(d.city || ''),
      address: String(d.address || ''),
      meetingLink: String(d.meetingLink || ''),
      hasParticipantLimit: !!d.hasParticipantLimit,
      maxParticipants: d.hasParticipantLimit ? Number(d.maxParticipants || 0) : 0,
      description: String(d.description || ''),
      registrationRestriction: String(d.registrationRestriction || 'all'),
      restrictedSchool: String(d.restrictedSchool || ''),
      selectedCategory: String(d.selectedCategory || ''),
      selectedSubCategories: String(d.selectedSubCategories || ''),
      qrcodeFiles: normalizeFiles(d.qrcodeFiles),
      posterFiles: normalizeFiles(d.posterFiles),
      questionnaireEnabled: !!d.questionnaireEnabled,
      questionnaireFieldsLen: Array.isArray(d.questionnaireFields) ? d.questionnaireFields.length : 0,
      questionnaireNeedRealName: !!d.questionnaireNeedRealName,
      questionnaireNeedPhoneNumber: !!d.questionnaireNeedPhoneNumber
    };
  },

  captureInitialSnapshot() {
    try {
      const snap = this.getFormState();
      this.setData({ _initialFormSnapshot: snap });
      console.log('[release] initial snapshot captured', snap);
    } catch (_) {}
  },

  isFormDirty() {
    const d = this.data;
    if (d.isEditMode) return false;
    const current = this.getFormState();
    const initial = d._initialFormSnapshot;
    if (!initial) {
      // 若尚未捕获初始快照，则以“有内容”作为判断
      const basic = [current.title, current.activityStartTimeValue, current.activityEndTimeValue, current.registrationDeadlineValue, current.description].some(v => !!(v && String(v).trim()));
      const place = current.activityType === 'offline' ? (!!(current.city && String(current.city).trim()) || !!(current.address && String(current.address).trim())) : !!(current.meetingLink && String(current.meetingLink).trim());
      const limit = current.hasParticipantLimit && !!current.maxParticipants;
      const files = (current.qrcodeFiles && current.qrcodeFiles.length) || (current.posterFiles && current.posterFiles.length);
      const types = !!(current.selectedCategory) || !!(current.selectedSubCategories);
      return !!(basic || place || limit || files || types);
    }
    try {
      const a = JSON.stringify(initial);
      const b = JSON.stringify(current);
      return a !== b;
    } catch (_) {
      return true;
    }
  },

  async saveDraft() {
    try {
      const phoneNumber = wx.getStorageSync('phoneNumber');
      if (!phoneNumber) return;
      const db = wx.cloud.database();
      const draft = {
        title: this.data.title || '',
        activityStartTimeValue: this.data.activityStartTimeValue || '',
        activityEndTimeValue: this.data.activityEndTimeValue || '',
        registrationDeadlineValue: this.data.registrationDeadlineValue || '',
        activityType: this.data.activityType || 'offline',
        city: this.data.city || '',
        address: this.data.address || '',
        meetingLink: this.data.meetingLink || '',
        hasParticipantLimit: !!this.data.hasParticipantLimit,
        maxParticipants: this.data.hasParticipantLimit ? (this.data.maxParticipants || 0) : 0,
        description: this.data.description || '',
        registrationRestriction: this.data.registrationRestriction || 'all',
        restrictedSchool: this.data.restrictedSchool || '',
        selectedCategory: this.data.selectedCategory || '',
        selectedSubCategories: this.data.selectedSubCategories || '',
        qrcodeFiles: (this.data.qrcodeFiles || []).map(f => ({ url: f.url })),
        posterFiles: (this.data.posterFiles || []).slice(0,3).map(f => ({ url: f.url })),
        questionnaireEnabled: !!this.data.questionnaireEnabled,
        questionnaireFields: this.data.questionnaireFields || [],
        questionnaireNeedRealName: !!this.data.questionnaireNeedRealName,
        questionnaireNeedPhoneNumber: !!this.data.questionnaireNeedPhoneNumber,
        savedAt: new Date()
      };
      await db.collection('users').where({ phoneNumber }).update({ data: { releaseDraft: draft } });
      wx.showToast({ title: '草稿已保存', icon: 'success' });
    } catch (e) {
      wx.showToast({ title: '草稿保存失败', icon: 'none' });
    }
  },

  async clearDraft() {
    try {
      const phoneNumber = wx.getStorageSync('phoneNumber');
      if (!phoneNumber) return;
      const db = wx.cloud.database();
      const _ = db.command;
      await db.collection('users').where({ phoneNumber }).update({ data: { releaseDraft: _.remove() } });
    } catch (e) {}
  },

  async restoreDraft() {
    try {
      if (this.data._draftLoaded) return;
      const phoneNumber = wx.getStorageSync('phoneNumber');
      if (!phoneNumber) return;
      const db = wx.cloud.database();
      const res = await db.collection('users').where({ phoneNumber }).field({ releaseDraft: true }).get();
      const user = (res.data && res.data[0]) || null;
      const draft = user && user.releaseDraft ? user.releaseDraft : null;
      if (!draft) return;
      const posterFiles = Array.isArray(draft.posterFiles) ? draft.posterFiles.map((f, i) => ({ url: f.url, name: `image_${i+1}.jpg`, type: 'image' })) : [];
      const qrcodeFiles = Array.isArray(draft.qrcodeFiles) ? draft.qrcodeFiles.map((f) => ({ url: f.url, name: 'qrcode.jpg', type: 'image' })) : [];
      const subOptions = draft.selectedCategory ? (this.data.subCategoryData[draft.selectedCategory] || []) : [];
      this.setData({
        title: draft.title || '',
        activityStartTimeValue: draft.activityStartTimeValue || '',
        activityEndTimeValue: draft.activityEndTimeValue || '',
        registrationDeadlineValue: draft.registrationDeadlineValue || '',
        activityType: draft.activityType || 'offline',
        city: draft.city || '',
        address: draft.address || '',
        meetingLink: draft.meetingLink || '',
        hasParticipantLimit: !!draft.hasParticipantLimit,
        maxParticipants: draft.maxParticipants || 0,
        description: draft.description || '',
        registrationRestriction: draft.registrationRestriction || 'all',
        restrictedSchool: draft.restrictedSchool || '',
        selectedCategory: draft.selectedCategory || '',
        selectedSubCategories: draft.selectedSubCategories || '',
        subCategoryOptions: subOptions,
        qrcodeFiles,
        posterFiles,
        questionnaireEnabled: !!draft.questionnaireEnabled,
        questionnaireFields: draft.questionnaireFields || [],
        questionnaireNeedRealName: !!draft.questionnaireNeedRealName,
        questionnaireNeedPhoneNumber: !!draft.questionnaireNeedPhoneNumber,
        _draftLoaded: true
      });
      wx.showToast({ title: '已恢复草稿', icon: 'success' });
      this.captureInitialSnapshot();
    } catch (e) {}
  },

  // 地图区域视野变化事件
  // onMapRegionChange(e) {
  //   // 视野变化结束后触发
  //   if (e.type === 'end') {
  //     // 获取地图中心点
  //     this.mapCtx = wx.createMapContext('myMap');
  //     this.mapCtx.getCenterLocation({
  //       success: (res) => {
  //         this.setData({
  //           latitude: res.latitude,
  //           longitude: res.longitude
  //         });
  //         // 根据新的中心点进行逆地理编码
  //         this.reverseGeocode(res.latitude, res.longitude);
  //       },
  //       fail: (err) => {
  //         console.error('获取地图中心点失败', err);
  //       }
  //     });
  //   }
  // },

  // 逆地理编码功能已移除，改用微信小程序自带定位

  // 确认选择的位置
  // onConfirmLocation() {
  //   if (this.data.selectedAddress && this.data.longitude !== null && this.data.latitude !== null) {
  //     this.setData({
  //       address: this.data.selectedAddress,
  //       longitude: this.data.longitude,
  //       latitude: this.data.latitude,
  //       showMapPicker: false // 隐藏地图选点弹窗
  //     });
  //   } else {
  //     this.showToast('请选择有效的地址');
  //   }
  // },

  // 获取当前位置作为地图中心点
  // getCurrentLocation() {
  //   // 调用 wx.getFuzzyLocation 获取当前位置
  //   wx.getFuzzyLocation({
  //     type: 'gcj02', // 使用 gcj02 坐标系
  //     success: (res) => {
  //       this.setData({
  //         latitude: res.latitude,
  //         longitude: res.longitude
  //       });
  //       // 获取到位置后进行逆地理编码
  //       this.reverseGeocode(res.latitude, res.longitude);
  //     },
  //     fail: (err) => {
  //       console.error('获取当前位置失败', err);
  //       this.showToast('获取当前位置失败，请手动选择或检查权限');
  //       // 如果获取位置失败，可以设置一个默认的中心点，例如城市中心
  //       // this.setData({ latitude: 39.909729, longitude: 116.398419 }); 
  //     }
  //   });
  // }

  // 新增的活动类型选择器相关函数
  // showActivityTypeSelector() {
  //   this.setData({ activityTypeSelectorVisible: true });
  // },

  // hideActivityTypeSelector() {
  //   this.setData({ activityTypeSelectorVisible: false });
  // },

  // onActivityTypeSelect(e) {
  //   const { value, text } = e.detail;
  //   this.setData({
  //     activityType: value, // 更新 activityType 字段
  //     activityTypeName: text, // 更新显示名称
  //     activityTypeSelectorVisible: false // 隐藏选择器
  //   });
  // },

  onSelectCategory(e) {
    const selectedValue = e.currentTarget.dataset.value;
    const subOptions = this.data.subCategoryData[selectedValue] || [];

    this.setData({
      selectedCategory: selectedValue,
      subCategoryOptions: subOptions,
      selectedSubCategories: '',
    });
  },

  onSelectSubCategory(e) {
    const selectedValue = e.currentTarget.dataset.value;
    this.setData({
      selectedSubCategories: this.data.selectedSubCategories === selectedValue ? '' : selectedValue
    });
    console.log('选择的子分类:', selectedValue, '当前selectedSubCategories:', this.data.selectedSubCategories);
  },
});

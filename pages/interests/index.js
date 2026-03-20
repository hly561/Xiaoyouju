Page({
  data: {
    customCategoryOptions: [
      { text: '运动', value: 'sport' },
      { text: '艺术', value: 'art' },
      { text: '娱乐', value: 'entertainment' },
      { text: '亲子', value: 'parent-child' },
      { text: '职业', value: 'career' },
      { text: '学习', value: 'study' },
      { text: '社交', value: 'social' },
    ],
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
    selectedSubCategories: [],
    selectedInterests: [],
  },

  onLoad: function() {
    console.log('页面加载，初始selectedSubCategories：', this.data.selectedSubCategories);
    this.loadUserInterests(); // 加载用户之前的选择
  },

  async loadUserInterests() {
    try {
      const db = wx.cloud.database();
      const phoneNumber = wx.getStorageSync('phoneNumber');
      
      if (!phoneNumber) {
        console.error('未找到手机号码');
        return;
      }

      const userResult = await db.collection('users').where({
        phoneNumber: phoneNumber
      }).get();
      
      if (userResult.data && userResult.data.length > 0) {
        const userInterests = userResult.data[0].interests || [];
        const userSubCategories = userResult.data[0].subCategories || [];
        this.setData({ 
          selectedInterests: userInterests,
          selectedSubCategories: userSubCategories
        });
      }
    } catch (error) {
      console.error('获取用户兴趣失败:', error);
      wx.showToast({
        title: '获取兴趣信息失败',
        icon: 'none'
      });
    }
  },

  toggleInterest(e) {
    const interest = e.currentTarget.dataset.interest;
    console.log('点击了兴趣：', interest); // 调试
    const selectedInterests = [...this.data.selectedInterests];
    const index = selectedInterests.indexOf(interest);

    if (index === -1) {
      selectedInterests.push(interest);
    } else {
      selectedInterests.splice(index, 1);
    }

    this.setData({ selectedInterests }, () => {
      console.log('当前已选兴趣：', this.data.selectedInterests); // 调试
      // this.saveUserInterests(); // 只在确认时保存
    });
  },

  async saveUserInterests() {
    try {
      const db = wx.cloud.database();
      const phoneNumber = wx.getStorageSync('phoneNumber');
      
      if (!phoneNumber) {
        console.error('未找到手机号码');
        return false;
      }

      await db.collection('users').where({
        phoneNumber: phoneNumber
      }).update({
        data: {
          interests: this.data.selectedInterests,
          subCategories: this.data.selectedSubCategories
        }
      });

      return true;
    } catch (error) {
      console.error('保存用户兴趣失败:', error);
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
      return false;
    }
  },

  async onConfirm() {
    const success = await this.saveUserInterests();
    if (success) {
      wx.showToast({
        title: '兴趣已保存',
        icon: 'success',
        duration: 1500
      });
      
      // 延迟返回上一页面
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  onSelectSubCategory(e) {
    const value = e.currentTarget.dataset.value;
    console.log('点击的子分类值：', value);
    console.log('点击前selectedSubCategories：', this.data.selectedSubCategories);
    
    let selected = [...this.data.selectedSubCategories];
    const idx = selected.indexOf(value);
    if (idx > -1) {
      selected.splice(idx, 1);
      console.log('移除选择：', value);
    } else {
      selected.push(value);
      console.log('添加选择：', value);
    }
    
    console.log('更新后的数组：', selected);
    this.setData({ selectedSubCategories: selected }, () => {
      console.log('setData完成，当前已选子类：', this.data.selectedSubCategories);
    });
  },
});
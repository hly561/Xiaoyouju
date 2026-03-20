import Message from 'tdesign-miniprogram/message/index';
import request from '../../api/request.js';
import QQMapWX from '../../utils/qqmap-wx-jssdk';
import { config } from '../../config/index';
const locationPermissionManager = require('../../utils/locationPermission');

// 获取应用实例
// const app = getApp()

// 初始化云数据库查询指令
const db = wx.cloud.database();
const _ = db.command;

  Page({
    data: {
      enable: false,
      swiperList: [],
      cardInfo: [],
      activities: [], // 存储从云数据库获取的活动数据
      selectedCity: '选择城市', // 默认城市
      currentTab: 'recommend', // 当前选中的标签页
      currentCategory: '', // 当前选中的分类
      currentSubcategory: '', // 当前选中的子分类
      selectedInterestFilter: '', // 当前选中的兴趣筛选
      selectedSubcategoryFilter: '', // 当前选中的子分类筛选
      followTabLabel: '同校',
      // 学校筛选相关
      selectedSchoolFilter: '', // 为空或''表示全部
      schoolOptions: [], // 去重后的学校列表
      schoolDropdownVisible: false,
      schoolLoading: false,
      schoolFilterVisible: false, // 是否显示学校筛选（根据 educations 学校数量）
      currentSubcategoryOptions: [], // 当前兴趣分类下的子分类选项
      interestOptions: [
        { text: '运动', value: 'sport' },
        { text: '艺术', value: 'art' },
        { text: '娱乐', value: 'entertainment' },
      { text: '亲子', value: 'parent-child' },
      { text: '职业', value: 'career' },
      { text: '学习', value: 'study' },
      { text: '社交', value: 'social' },
    ],
    subcategories: [
      '运动竞技', '文化艺术', '职业创业', '休闲娱乐', '亲子', '社交', '学习'
    ],
    // 级联选择器相关
    cascaderVisible: false,
    cascaderLeftSelected: '运动竞技', // 当前选中的左侧分类
    cascaderRightOptions: [], // 右侧选项列表
    cascaderOptions: [
      {
        label: '运动竞技',
        value: '运动竞技',
        children: [
          { label: '足球', value: '足球' },
          { label: '篮球', value: '篮球' },
          { label: '羽毛球', value: '羽毛球' },
          { label: '乒乓球', value: '乒乓球' },
          { label: '游泳', value: '游泳' }
        ]
      },
      {
        label: '文化艺术',
        value: '文化艺术',
        children: [
          { label: '音乐', value: '音乐' },
          { label: '舞蹈', value: '舞蹈' },
          { label: '绘画', value: '绘画' },
          { label: '书法', value: '书法' },
          { label: '摄影', value: '摄影' }
        ]
      },
      {
        label: '职业创业',
        value: '职业创业',
        children: [
          { label: '行业交流', value: '行业交流' },
          { label: '职业分享', value: '职业分享' },
          { label: '创业沙龙', value: '创业沙龙' },
          { label: '招聘会', value: '招聘会' }
        ]
      },
      {
        label: '休闲娱乐',
        value: '休闲娱乐',
        children: [
          { label: '桌游', value: '桌游' },
          { label: '电影', value: '电影' },
          { label: '旅游', value: '旅游' },
          { label: 'K歌', value: 'K歌' }
        ]
      },
      {
        label: '亲子',
        value: '亲子',
        children: [
          { label: '亲子教育', value: '亲子教育' },
          { label: '亲子活动', value: '亲子活动' },
          { label: '亲子游戏', value: '亲子游戏' }
        ]
      },
      {
        label: '社交',
        value: '社交',
        children: [
          { label: '聚会', value: '聚会' },
          { label: '交友', value: '交友' },
          { label: '相亲', value: '相亲' }
        ]
      },
      {
        label: '学习',
        value: '学习',
        children: [
          { label: '读书会', value: '读书会' },
          { label: '讲座', value: '讲座' },
          { label: '培训', value: '培训' },
          { label: '研讨会', value: '研讨会' }
        ]
      }
    ],
    cascaderValue: [],
    searchValue: '',
    allActivities: [],

    // 发布
    motto: 'Hello World',
    userInfo: {},
    hasUserInfo: false,
    canIUse: wx.canIUse('button.open-type.getUserInfo'),
    canIUseGetUserProfile: false,
    canIUseOpenData: wx.canIUse('open-data.type.userAvatarUrl') && wx.canIUse('open-data.type.userNickName'), // 如需尝试获取用户信息可改为false
    showInterestGuide: true,
  },
  // 生命周期
  // 获取用户城市信息
  async getUserCity() {
    const db = wx.cloud.database();
    const phoneNumber = wx.getStorageSync('phoneNumber');
    let selectedCity = '选择城市';
    
    if (phoneNumber) {
      const userRes = await db.collection('users').where({
        phoneNumber: phoneNumber
      }).get();
      
      if (userRes.data && userRes.data.length > 0) {
        selectedCity = userRes.data[0].selectedCity || '选择城市';
      }
    }
    
    // 如果用户没有选择城市，尝试获取定位城市
    if (selectedCity === '选择城市') {
      try {
        const locationCity = await this.getCurrentLocationCity();
        if (locationCity) {
          selectedCity = locationCity;
        }
      } catch (error) {
        console.log('获取定位城市失败:', error);
      }
    }
    
    return selectedCity;
  },

  // 获取当前定位城市
  getCurrentLocationCity() {
    return new Promise(async (resolve, reject) => {
      try {
        // 使用静默模式获取定位权限，不显示任何提示
        const permissionGranted = await locationPermissionManager.checkAndRequestPermission({
          silent: true
        });
        
        if (permissionGranted) {
          this.doGetFuzzyLocationForCity(resolve, reject);
        } else {
          console.log('定位权限未授权，跳过定位');
          reject(new Error('定位权限未授权'));
        }
      } catch (error) {
        console.error('获取定位权限失败:', error);
        reject(error);
      }
    });
  },

  // 执行模糊定位获取城市
  doGetFuzzyLocationForCity(resolve, reject) {
    locationPermissionManager.getFuzzyLocation({
        type: 'gcj02',
        success: (res) => {
        // 如果配置了腾讯地图API密钥，使用腾讯地图逆地理编码
        if (config.qqMapKey && config.qqMapKey !== 'YOUR_QQ_MAP_KEY_HERE') {
          this.useQQMapReverseGeocode(res.latitude, res.longitude, resolve, reject);
        } else {
          // 降级使用简化的城市判断逻辑
          console.warn('未配置腾讯地图API密钥，使用简化定位逻辑');
          const cityInfo = this.getCityByCoordinates(res.latitude, res.longitude);
          resolve(cityInfo);
        }
        },
        fail: (err) => {
          reject(err);
        }
      });
  },

  // 使用腾讯地图逆地理编码获取精确位置
  useQQMapReverseGeocode(latitude, longitude, resolve, reject) {
    const qqmapsdk = new QQMapWX({
      key: config.qqMapKey
    });

    qqmapsdk.reverseGeocoder({
      location: {
        latitude: latitude,
        longitude: longitude
      },
      success: (res) => {
        console.log('腾讯地图逆地理编码成功:', res);
        const result = res.result;
        if (result && result.address_component) {
          const city = result.address_component.city || result.address_component.district;
          if (city) {
            resolve(city.replace('市', ''));
          } else {
            // 降级到简化定位逻辑
            const cityInfo = this.getCityByCoordinates(latitude, longitude);
            resolve(cityInfo);
          }
        } else {
          // 降级到简化定位逻辑
          const cityInfo = this.getCityByCoordinates(latitude, longitude);
          resolve(cityInfo);
        }
      },
      fail: (error) => {
        console.error('腾讯地图逆地理编码失败:', error);
        // 降级到简化定位逻辑
        const cityInfo = this.getCityByCoordinates(latitude, longitude);
        resolve(cityInfo);
      }
    });
  },

  // 根据经纬度判断城市（与城市选择器相同的逻辑）
  getCityByCoordinates(lat, lng) {
    const cityRanges = [
      { name: '北京', latMin: 39.4, latMax: 41.1, lngMin: 115.4, lngMax: 117.5 },
      { name: '上海', latMin: 30.7, latMax: 31.9, lngMin: 120.9, lngMax: 122.1 },
      { name: '广州', latMin: 22.5, latMax: 23.9, lngMin: 112.9, lngMax: 114.5 },
      { name: '深圳', latMin: 22.4, latMax: 22.9, lngMin: 113.7, lngMax: 114.6 },
      { name: '杭州', latMin: 29.9, latMax: 30.6, lngMin: 119.7, lngMax: 120.7 },
      { name: '南京', latMin: 31.8, latMax: 32.4, lngMin: 118.4, lngMax: 119.2 },
      { name: '武汉', latMin: 30.1, latMax: 31.0, lngMin: 113.7, lngMax: 115.0 },
      { name: '成都', latMin: 30.1, latMax: 31.4, lngMin: 103.5, lngMax: 104.9 },
      { name: '重庆', latMin: 28.8, latMax: 32.2, lngMin: 105.3, lngMax: 110.2 },
      { name: '西安', latMin: 33.8, latMax: 34.8, lngMin: 108.0, lngMax: 109.8 },
      { name: '天津', latMin: 38.8, latMax: 40.3, lngMin: 116.8, lngMax: 118.0 },
      { name: '苏州', latMin: 31.0, latMax: 31.8, lngMin: 120.0, lngMax: 121.2 },
      { name: '青岛', latMin: 35.8, latMax: 36.9, lngMin: 119.8, lngMax: 121.1 },
      { name: '郑州', latMin: 34.4, latMax: 35.0, lngMin: 113.0, lngMax: 114.2 },
      { name: '大连', latMin: 38.8, latMax: 39.9, lngMin: 121.1, lngMax: 122.2 },
      { name: '宁波', latMin: 29.1, latMax: 30.0, lngMin: 121.0, lngMax: 122.0 },
      { name: '厦门', latMin: 24.2, latMax: 24.7, lngMin: 117.8, lngMax: 118.4 }
    ];

    for (const city of cityRanges) {
      if (lat >= city.latMin && lat <= city.latMax && 
          lng >= city.lngMin && lng <= city.lngMax) {
        return city.name;
      }
    }

    return null;
  },

  async onReady() {
    const timeout = 15000; // 设置15秒超时
    try {
      const loadDataPromise = Promise.all([
        Promise.race([
          request('/home/cards').then((res) => res.data),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('加载卡片数据超时')), timeout)
          )
        ]),
        // 添加云数据库查询活动数据
        Promise.race([
          this.getActivities(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('加载活动数据超时')), timeout)
          )
        ])
      ]);

      const [cardRes, activitiesData] = await loadDataPromise;
      const selectedCity = await Promise.race([
        this.getUserCity(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('获取城市信息超时')), timeout)
        )
      ]);

      this.setData({
        cardInfo: cardRes.data,
        focusCardInfo: cardRes.data.slice(0, 3),
        selectedCity,
        allActivities: activitiesData // 设置所有活动数据
      });
      
      // 根据当前标签页和选择的城市筛选活动
      this.filterActivitiesByTab(this.data.currentTab);
      
      console.log('活动数据已加载:', activitiesData);
    } catch (error) {
      console.error('加载数据失败:', error);
      wx.showToast({
        title: error.message || '加载数据失败',
        icon: 'none',
        duration: 2000
      });
    }
  },
  async onLoad(option) {
    if (wx.getUserProfile) {
      this.setData({
        canIUseGetUserProfile: true,
      });
    }
    wx.showShareMenu({ withShareTicket: true, menus: ['shareAppMessage', 'shareTimeline'] });

    const selectedCity = await this.getUserCity();
    
    // 初始化级联选择器右侧选项
    const leftSelected = '运动竞技';
    const leftOption = this.data.cascaderOptions.find(item => item.value === leftSelected);
    const rightOptions = leftOption ? leftOption.children : [];
    
    this.setData({
      selectedCity,
      cascaderLeftSelected: leftSelected,
      cascaderRightOptions: rightOptions
    });

    if (option.oper) {
      let content = '';
      if (option.oper === 'release') {
        content = '发布成功';
      } else if (option.oper === 'save') {
        content = '保存成功';
      }
      this.showOperMsg(content);
    }
  },
  onShareAppMessage() {
    const city = this.data.selectedCity && this.data.selectedCity !== '选择城市' ? this.data.selectedCity : '';
    const activities = Array.isArray(this.data.activities) ? this.data.activities : [];
    const first = activities[0] || null;
    const title = city ? `发现${city}的精彩活动` : '发现附近的精彩活动';
    const imageUrl = first && first.firstPoster ? first.firstPoster : '';
    return { title, path: '/pages/home/index', imageUrl };
  },
  onShareTimeline() {
    const city = this.data.selectedCity && this.data.selectedCity !== '选择城市' ? this.data.selectedCity : '';
    const activities = Array.isArray(this.data.activities) ? this.data.activities : [];
    const first = activities[0] || null;
    const title = city ? `发现${city}的精彩活动` : '发现附近的精彩活动';
    const query = '';
    const imageUrl = first && first.firstPoster ? first.firstPoster : '';
    return { title, query, imageUrl };
  },
  // 标签切换事件
  async onTabChange(e) {
    const value = e.detail.value;
    // 初始化级联选择器右侧选项
    const leftSelected = '运动竞技';
    const leftOption = this.data.cascaderOptions.find(item => item.value === leftSelected);
    const rightOptions = leftOption ? leftOption.children : [];
    
    const dataToSet = {
      currentTab: value,
      currentSubcategory: '',
      cascaderVisible: false,
      cascaderLeftSelected: leftSelected,
      cascaderRightOptions: rightOptions,
      selectedSubcategoryFilter: '',
    };

    if (value === 'recommend') {
      dataToSet.selectedInterestFilter = '';
      dataToSet.currentSubcategoryOptions = [];
    } else if (value === 'city' || value === 'follow' || value === 'online') {
      dataToSet.currentSubcategoryOptions = this.data.selectedInterestFilter ? 
        this.getSubcategoryOptions(this.data.selectedInterestFilter) : [];
    }
    
    if (value === 'follow') {
      dataToSet.schoolDropdownVisible = false;
      dataToSet.followTabLabel = '同校';
    }
    this.setData(dataToSet);

    // 进入同校标签时加载学校选项（仅加载一次或需要时刷新）
    if (value === 'follow') {
      try {
        await this.loadSchoolOptions();
      } catch (err) {
        console.error('加载学校选项失败:', err);
      }
    }
    
    // 根据标签页筛选活动
    await this.filterActivitiesByTab(value);
  },

  // 加载用户库中的去重学校列表（来自 users.educations[].school 或顶层 user.school）
  async loadSchoolOptions() {
    if (this.data.schoolLoading) return;
    this.setData({ schoolLoading: true });
    try {
      const phoneNumber = wx.getStorageSync('phoneNumber');
      const schoolsSet = new Set();
      const eduSchoolsSet = new Set();

      if (phoneNumber) {
        const res = await db.collection('users')
          .where({ phoneNumber })
          .field({ educations: true, school: true })
          .get();
        if (res.data && res.data.length > 0) {
          const user = res.data[0];
          if (Array.isArray(user.educations)) {
            user.educations.forEach(edu => {
              if (edu && edu.school) {
                schoolsSet.add(edu.school);
                eduSchoolsSet.add(edu.school);
              }
            });
          }
          if (user.school) {
            schoolsSet.add(user.school);
          }
        }
      }

      const schools = Array.from(schoolsSet).filter(Boolean).sort();
      const eduSchools = Array.from(eduSchoolsSet).filter(Boolean);
      const schoolFilterVisible = eduSchools.length > 1;
      this.setData({ schoolOptions: schools, schoolLoading: false, schoolFilterVisible });
    } catch (error) {
      console.error('获取学校列表失败:', error);
      this.setData({ schoolLoading: false, schoolFilterVisible: false });
    }
  },

  // 显示/隐藏学校下拉
  toggleSchoolDropdown() {
    const next = !this.data.schoolDropdownVisible;
    this.setData({ 
      schoolDropdownVisible: next,
      followTabLabel: '同校'
    });
  },

  // 选择学校筛选
  async onSchoolFilterSelect(e) {
    const value = e.currentTarget.dataset.value;
    // value 为 '' 表示全部
    this.setData({ 
      selectedSchoolFilter: value || '', 
      schoolDropdownVisible: false,
      followTabLabel: '同校'
    });
    await this.filterActivitiesByTab(this.data.currentTab);
  },
  
  // 子分类选择事件
  onSubcategoryTap(e) {
    const subcategory = e.currentTarget.dataset.subcategory;
    this.setData({
      currentSubcategory: subcategory,
      cascaderVisible: false
    });
  },
  
  // 显示/隐藏级联选择器
  showCascader() {
    // 如果级联选择器未显示，则初始化右侧选项
    if (!this.data.cascaderVisible) {
      const leftSelected = this.data.cascaderLeftSelected || '运动竞技';
      const leftOption = this.data.cascaderOptions.find(item => item.value === leftSelected);
      const rightOptions = leftOption ? leftOption.children : [];
      
      this.setData({
        cascaderVisible: true,
        cascaderLeftSelected: leftSelected,
        cascaderRightOptions: rightOptions
      });
    } else {
      this.setData({
        cascaderVisible: false
      });
    }
  },
  
  // 级联选择器左侧选择事件
  onCascaderLeftSelect(e) {
    const value = e.currentTarget.dataset.value;
    const leftOption = this.data.cascaderOptions.find(item => item.value === value);
    const rightOptions = leftOption ? leftOption.children : [];
    
    this.setData({
      cascaderLeftSelected: value,
      cascaderRightOptions: rightOptions
    });
  },
  
  // 级联选择器右侧选择事件
  onCascaderRightSelect(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({
      currentSubcategory: value,
      cascaderVisible: false
    });
  },
  
  // 级联选择器关闭事件
  onCascaderClose() {
    this.setData({
      cascaderVisible: false
    });
  },
  
  onRefresh() {
    this.refresh();
  },
  async refresh() {
    const timeout = 15000; // 设置15秒超时
    this.setData({
      enable: true,
    });
    try {
      // 保存当前的筛选状态
      const currentFilters = {
        currentTab: this.data.currentTab,
        selectedInterestFilter: this.data.selectedInterestFilter,
        selectedSubcategoryFilter: this.data.selectedSubcategoryFilter
      };

      const loadDataPromise = Promise.all([
        Promise.race([
          request('/home/cards').then((res) => res.data),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('刷新卡片数据超时')), timeout)
          )
        ]),
        // 刷新时也更新活动数据
        Promise.race([
          this.getActivities(),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('刷新活动数据超时')), timeout)
          )
        ])
      ]);

      const [cardRes, activitiesData] = await loadDataPromise;
      const selectedCity = await Promise.race([
        this.getUserCity(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('获取城市信息超时')), timeout)
        )
      ]);

      setTimeout(async () => {
        this.setData({
          enable: false,
          cardInfo: cardRes.data,
          selectedCity,
          // 恢复筛选状态
          currentTab: currentFilters.currentTab,
          selectedInterestFilter: currentFilters.selectedInterestFilter,
          selectedSubcategoryFilter: currentFilters.selectedSubcategoryFilter
        });
        // 刷新完成后，重新应用当前的筛选条件
        await this.filterActivitiesByTab(currentFilters.currentTab);
      }, 1500);
    } catch (error) {
      console.error('刷新数据失败:', error);
      wx.showToast({
        title: error.message || '刷新数据失败',
        icon: 'none',
        duration: 2000
      });
      this.setData({
        enable: false
      });
    }
  },
  showOperMsg(content) {
    Message.success({
      context: this,
      offset: [120, 32],
      duration: 4000,
      content,
    });
  },
  async goRelease() {
    const phoneNumber = wx.getStorageSync('phoneNumber');
    const accessToken = wx.getStorageSync('access_token');
    const userInfo = wx.getStorageSync('userInfo');
    const isLoggedIn = !!(phoneNumber && accessToken && userInfo);
    if (!isLoggedIn) {
      wx.showModal({
        title: '登录提示',
        content: '登录后才能使用发布功能，是否前往登录？',
        confirmText: '去登录',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            const from = encodeURIComponent('/pages/release/index');
            wx.navigateTo({ url: `/pages/login/login?from=${from}` });
          }
        }
      });
      return;
    }

    // 检查用户认证状态
    const db = wx.cloud.database();
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
        let userInfoDoc = users[0];
        try {
          const approvedDoc = users.find(u => {
            const list = Array.isArray(u.educations) ? u.educations : [];
            return list.some(e => e && e.status === 'approved');
          });
          if (approvedDoc) userInfoDoc = approvedDoc;
        } catch (e) {}
        const educations = Array.isArray(userInfoDoc.educations) ? userInfoDoc.educations : [];
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
                wx.navigateTo({ url: '/pages/my/verify/index' });
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
    } catch (error) {
      console.error('检查用户认证状态失败:', error);
    }

    // 认证通过，跳转到发布页面
  wx.navigateTo({ url: '/pages/release/index' });
  },
  
  // 安全解析日期：支持 Date/时间戳/字符串(兼容 iOS 的 'YYYY/MM/DD HH:mm')
  safeParseDate(val) {
    if (!val) return null;
    if (val instanceof Date) {
      const time = val.getTime();
      return isNaN(time) ? null : val;
    }
    if (typeof val === 'number') {
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof val === 'string') {
      // 兼容 WeChat+iOS 对 'YYYY-MM-DD HH:mm' 的解析问题
      const normalized = val.replace(/-/g, '/');
      const d = new Date(normalized);
      return isNaN(d.getTime()) ? null : d;
    }
    return null;
  },

  // 规范化城市名称（去除后缀如“市/自治区/特别行政区”等）
  normalizeCityName(name) {
    if (!name || typeof name !== 'string') return '';
    const s = name.trim();
    return s.replace(/(市|自治州|地区|特别行政区|自治区|盟)$/,'');
  },

  // 城市匹配，支持模糊和规范化
  cityMatches(a, b) {
    const ca = this.normalizeCityName(a);
    const cb = this.normalizeCityName(b);
    if (!ca || !cb) return false;
    return ca === cb || ca.includes(cb) || cb.includes(ca);
  },

  // 格式化时间显示
  formatTime(timeStr) {
    if (!timeStr) return '';
    const date = this.safeParseDate(timeStr);
    if (!date) return '';
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${month}-${day} ${hour}:${minute}`;
  },
  
  // 从云数据库获取活动数据
  async getActivities() {
    try {
      // 按 createdAt 字段倒序排列
      const activitiesRes = await db.collection('activities')
        .orderBy('createdAt', 'desc')
        .get();
      
      // 提前处理首图临时链接映射（仅取第一张）
      const cloudFirstIds = (activitiesRes.data || [])
        .map(a => (Array.isArray(a.images) && a.images.length > 0 ? a.images[0] : ''))
        .filter(u => typeof u === 'string' && u.startsWith('cloud://'));
      let urlMap = {};
      if (cloudFirstIds.length > 0) {
        try {
          const tempRes = await wx.cloud.getTempFileURL({ fileList: cloudFirstIds });
          tempRes.fileList.forEach(f => {
            if (f.tempFileURL) {
              const clean = f.tempFileURL.trim().replace(/[`"']/g, '');
              urlMap[f.fileID] = clean;
            }
          });
        } catch (e) {}
      }

      // 格式化时间和地点显示，并过滤只显示未开始的活动
      const activities = activitiesRes.data
        .map(activity => {
        let locationText = '';
        if (activity.activityType === 'online' || activity.meetingLink) {
          locationText = '线上';
        } else if (activity.location && typeof activity.location === 'object') {
          const { province = '', city = '', address = '' } = activity.location;
          locationText = [province, city, address].filter(Boolean).join(' ');
        } else if (typeof activity.location === 'string') {
          locationText = activity.location;
        } else {
          locationText = '';
        }
        const first = Array.isArray(activity.images) && activity.images.length > 0 ? activity.images[0] : '';
        const firstPoster = first
          ? (first.startsWith('cloud://') ? (urlMap[first] || '') : String(first).trim())
          : '';
        return {
          ...activity,
          activityStartTime: this.formatTime(activity.activityStartTime),
          activityEndTime: this.formatTime(activity.activityEndTime),
          locationText,
          firstPoster
        };
        })
        .filter(activity => {
          // 只显示未开始且报名未截止的活动
          const now = new Date();
          // 验证活动开始时间是否有效
          if (!activity.activityStartTimeValue) {
            return false; // 如果没有开始时间，不显示该活动
          }
          const startTime = this.safeParseDate(activity.activityStartTimeValue);
          // 验证日期是否有效
          if (!startTime) {
            return false; // 如果日期无效，不显示该活动
          }
          
          // 检查活动是否未开始
          if (now >= startTime) {
            return false; // 活动已开始或已结束，不在首页显示
          }
          
          // 检查报名是否已截止
          if (activity.registrationDeadlineValue) {
            const registrationDeadline = this.safeParseDate(activity.registrationDeadlineValue);
            if (registrationDeadline && now > registrationDeadline) {
              return false; // 报名已截止，不在首页显示
            }
          }
          
          return true; // 活动未开始且报名未截止，在首页显示
      });
      
      // 设置allActivities，然后根据当前标签页筛选activities
      this.setData({
        allActivities: activities
      });
      
      // 根据当前标签页筛选活动
      this.filterActivitiesByTab(this.data.currentTab);
      
      return activities || [];
    } catch (error) {
      console.error('获取活动数据失败:', error);
      return [];
    }
  },
  
  // 根据条件查询活动
  async getActivitiesByCondition(condition) {
    try {
      // 使用查询指令构建复杂查询
      // 示例：查询进行中的活动（状态为1）或者即将开始的活动（状态为0）
      const activitiesRes = await db.collection('activities')
        .where(_.or([
          { status: _.eq(1) }, // 进行中
          { status: _.eq(0) }  // 即将开始
        ]))
        .get();
      
      return activitiesRes.data || [];
    } catch (error) {
      console.error('条件查询活动失败:', error);
      return [];
    }
  },

  async onSearchInput(e) {
    const value = e.detail.value || '';
    this.setData({ searchValue: value });
    if (!value) {
      // 清空搜索时，重新应用城市和兴趣筛选
      await this.filterActivitiesByTab(this.data.currentTab);
      return;
    }
    
    // 先根据城市筛选活动，再在筛选结果中搜索
    const selectedCity = this.data.selectedCity || '选择城市';
    const selectedInterestFilter = this.data.selectedInterestFilter;
    let filteredActivities = this.data.allActivities.filter(activity => {
      // 线上活动不限城市，全部显示
      if (activity.activityType === 'online' || activity.meetingLink) {
        return true;
      }
      
      // 如果用户未选择城市，只显示线上活动
      if (selectedCity === '选择城市') {
        return false;
      }
      
      // 线下活动只显示与用户选择城市相同的活动
      if (activity.location && typeof activity.location === 'object') {
        return activity.location.city === selectedCity;
      } else if (typeof activity.location === 'string') {
        return activity.location.includes(selectedCity);
      }
      
      return false;
    });
    
    // 应用兴趣标签筛选
    if (selectedInterestFilter) {
      filteredActivities = filteredActivities.filter(activity => {
        // 检查活动的 category 字段是否匹配选中的兴趣
        if (activity.category) {
          return activity.category === selectedInterestFilter;
        }
        return false;
      });
    }
    
    // 应用子分类筛选
    const selectedSubcategoryFilter = this.data.selectedSubcategoryFilter;
    if (selectedSubcategoryFilter) {
      filteredActivities = filteredActivities.filter(activity => {
        // 检查活动的 subCategory 字段是否匹配选中的子分类
        if (activity.subCategory) {
          return activity.subCategory === selectedSubcategoryFilter;
        }
        return false;
      });
    }
    
    // 在筛选结果中进行关键词搜索
    const searchFiltered = filteredActivities.filter(item =>
      item.title && item.title.indexOf(value) !== -1
    );
    this.setData({ activities: searchFiltered });
  },

  async onSearchClear() {
    this.setData({
      searchValue: ''
    });
    // 清空搜索时，重新应用城市和兴趣筛选
    await this.filterActivitiesByTab(this.data.currentTab);
  },

  // 查看活动详情
  onViewDetail: function(e) {
    const activityId = e.currentTarget.dataset.id;
    wx.navigateTo({
      url: `/pages/activity-detail/index?id=${activityId}`
    });
  },

  // 页面显示时的处理（城市选择器会直接更新selectedCity，无需额外处理）
  onShow() {
    // 城市选择器已经通过prevPage.setData直接更新了selectedCity
    // 重新获取最新的活动数据，确保修改后的活动信息能及时显示
    this.getActivities();
    // 进入首页时，触发消息未读数与红点状态的刷新
    try {
      const app = getApp();
      if (app && typeof app.getUnreadNum === 'function') {
        app.getUnreadNum();
      }
      if (app && typeof app.updateUserMessageAllreadStatus === 'function') {
        app.updateUserMessageAllreadStatus();
      }
    } catch (e) {
      console.warn('进入首页刷新消息红点失败:', e);
    }
  },

  // 根据标签页筛选活动
  async filterActivitiesByTab(tabValue) {
    const selectedCity = this.data.selectedCity || '选择城市';
    const selectedInterestFilter = this.data.selectedInterestFilter;
    let filteredActivities = this.data.allActivities;

    // 应用城市筛选：推荐页在未选择城市时不过滤线下活动
    filteredActivities = this.data.allActivities.filter(activity => {
      // 线上活动不限城市，全部显示
      if (activity.activityType === 'online') {
        return true;
      }
      // 未选择城市：仅在同城页过滤线下活动，其它页不过滤
      if (selectedCity === '选择城市') {
        return tabValue !== 'city';
      }
      // 线下活动匹配城市（支持“北京市/北京”等差异）
      if (activity.location && typeof activity.location === 'object') {
        return this.cityMatches(activity.location.city, selectedCity);
      } else if (typeof activity.location === 'string') {
        return this.cityMatches(activity.location, selectedCity);
      }
      return false;
    });

    // 同城标签页的特殊处理：只显示线下活动
    if (tabValue === 'city') {
      // 过滤掉线上活动，只显示线下活动
      filteredActivities = filteredActivities.filter(activity => {
        return !(activity.activityType === 'online' || activity.meetingLink);
      });
      
      // 如果用户未选择城市，不显示任何活动
      if (selectedCity === '选择城市') {
        filteredActivities = [];
      }
      
      // 过滤掉限本校参加但发布者学校与当前用户学校不同的活动
      try {
        const phoneNumber = wx.getStorageSync('phoneNumber');
        if (phoneNumber) {
          const userResult = await db.collection('users').where({
            phoneNumber: phoneNumber
          }).get();
          
          if (userResult.data && userResult.data.length > 0) {
            const userData = userResult.data[0];
            // 使用 educations 中已通过审核的学校集合进行匹配
            const eduSchools = Array.isArray(userData.educations)
              ? userData.educations
                  .filter(e => e && e.status === 'approved' && e.school && String(e.school).trim() !== '')
                  .map(e => String(e.school).trim())
              : [];
            const currentUserSchoolSet = new Set(eduSchools);
            
            // 若活动已明确 restrictedSchool，则直接用它比较，减少不必要的查询
            filteredActivities = filteredActivities.filter(activity => {
              if (activity.registrationRestriction === 'school') {
                const rs = activity.restrictedSchool && String(activity.restrictedSchool).trim() !== '' ? String(activity.restrictedSchool).trim() : null;
                if (rs) {
                  return currentUserSchoolSet.size > 0 ? currentUserSchoolSet.has(rs) : false;
                }
              }
              return true; // 非限本校或未明确 restrictedSchool 的活动暂留，后续处理
            });

            if (currentUserSchoolSet.size > 0) {
              const schoolRestrictedActivities = filteredActivities.filter(activity => 
                activity.registrationRestriction === 'school' && 
                activity.createdBy && 
                activity.createdBy.phoneNumber && 
                !(activity.restrictedSchool && String(activity.restrictedSchool).trim() !== '')
              );
              
              if (schoolRestrictedActivities.length > 0) {
                const publisherPhones = [...new Set(schoolRestrictedActivities.map(activity => activity.createdBy.phoneNumber))];
                const publishersResult = await db.collection('users').where({
                  phoneNumber: db.command.in(publisherPhones)
                }).get();
                
                const publisherSchoolMap = {};
                publishersResult.data.forEach(user => {
                  const primarySchool = user.school || (Array.isArray(user.educations) ? (user.educations.find(e => e && e.status === 'approved' && e.school && String(e.school).trim() !== '')?.school || null) : null);
                  publisherSchoolMap[user.phoneNumber] = primarySchool;
                });
                
                filteredActivities = filteredActivities.filter(activity => {
                  if (activity.registrationRestriction === 'school' && 
                      activity.createdBy && 
                      activity.createdBy.phoneNumber) {
                    // 已设置 restrictedSchool 的活动已在前一步筛过，这里处理其余活动
                    const publisherSchool = publisherSchoolMap[activity.createdBy.phoneNumber];
                    return publisherSchool ? currentUserSchoolSet.has(publisherSchool) : false;
                  }
                  return true; // 非限本校活动正常显示
                });
              }
            } else {
              // 用户未设置学校，过滤掉所有限本校参加的活动
              filteredActivities = filteredActivities.filter(activity => 
                activity.registrationRestriction !== 'school'
              );
            }
          } else {
            // 找不到用户信息，过滤掉所有限本校参加的活动
            filteredActivities = filteredActivities.filter(activity => 
              activity.registrationRestriction !== 'school'
            );
          }
        } else {
          // 用户未登录，过滤掉所有限本校参加的活动
          filteredActivities = filteredActivities.filter(activity => 
            activity.registrationRestriction !== 'school'
          );
        }
      } catch (error) {
        console.error('过滤同城限本校活动失败:', error);
        // 出错时过滤掉所有限本校参加的活动
        filteredActivities = filteredActivities.filter(activity => 
          activity.registrationRestriction !== 'school'
        );
      }
    }

    // 推荐标签页的特殊处理：只显示与用户兴趣标签匹配的活动
    if (tabValue === 'recommend') {
      let userHasInterest = false;
      let currentUserSchoolSet = new Set();
      try {
        const phoneNumber = wx.getStorageSync('phoneNumber');
        if (phoneNumber) {
          const userResult = await db.collection('users').where({
            phoneNumber: phoneNumber
          }).get();
          if (userResult.data && userResult.data.length > 0) {
            const userData = userResult.data[0];
            const userSubCategories = userData.subCategories || [];
            // 使用 educations 中已通过审核的学校集合进行匹配
            const eduSchools = Array.isArray(userData.educations)
              ? userData.educations
                  .filter(e => e && e.status === 'approved' && e.school && String(e.school).trim() !== '')
                  .map(e => String(e.school).trim())
              : [];
            currentUserSchoolSet = new Set(eduSchools);
            
             if (userSubCategories.length > 0) {
              userHasInterest = true;
              filteredActivities = filteredActivities.filter(activity => {
                const sc = activity.subCategory;
                if (Array.isArray(sc)) {
                  return sc.some(item => userSubCategories.includes(item));
                }
                if (typeof sc === 'string') {
                  return userSubCategories.includes(sc);
                }
                return false;
              });
            }

            // 若活动明确 restrictedSchool，则直接按学校限制过滤
            filteredActivities = filteredActivities.filter(activity => {
              if (activity.registrationRestriction === 'school') {
                const rs = activity.restrictedSchool && String(activity.restrictedSchool).trim() !== '' ? String(activity.restrictedSchool).trim() : null;
                if (rs) {
                  return currentUserSchoolSet.size > 0 ? currentUserSchoolSet.has(rs) : false;
                }
              }
              return true;
            });
          }
        }
      } catch (error) {
        console.error('获取用户兴趣失败:', error);
      }
      
      // 过滤掉限本校参加但发布者学校与当前用户学校不同的活动
      if (currentUserSchoolSet.size > 0) {
        try {
          const schoolRestrictedActivities = filteredActivities.filter(activity => 
            activity.registrationRestriction === 'school' && 
            activity.createdBy && 
            activity.createdBy.phoneNumber &&
            !(activity.restrictedSchool && String(activity.restrictedSchool).trim() !== '')
          );
          
          if (schoolRestrictedActivities.length > 0) {
            const publisherPhones = [...new Set(schoolRestrictedActivities.map(activity => activity.createdBy.phoneNumber))];
            const publishersResult = await db.collection('users').where({
              phoneNumber: db.command.in(publisherPhones)
            }).get();
            
            const publisherSchoolMap = {};
            publishersResult.data.forEach(user => {
              const primarySchool = user.school || (Array.isArray(user.educations) ? (user.educations.find(e => e && e.status === 'approved' && e.school && String(e.school).trim() !== '')?.school || null) : null);
              publisherSchoolMap[user.phoneNumber] = primarySchool;
            });
            
            filteredActivities = filteredActivities.filter(activity => {
              if (activity.registrationRestriction === 'school' && 
                  activity.createdBy && 
                  activity.createdBy.phoneNumber) {
                const rs = activity.restrictedSchool && String(activity.restrictedSchool).trim() !== '' ? String(activity.restrictedSchool).trim() : null;
                if (rs) return true; // 已由前置过滤处理
                const publisherSchool = publisherSchoolMap[activity.createdBy.phoneNumber];
                return publisherSchool ? currentUserSchoolSet.has(publisherSchool) : false;
              }
              return true; // 非限本校活动正常显示
            });
          }
        } catch (error) {
          console.error('过滤限本校活动失败:', error);
        }
      } else {
        // 用户未设置学校，过滤掉所有限本校参加的活动
        filteredActivities = filteredActivities.filter(activity => 
          activity.registrationRestriction !== 'school'
        );
      }
      
      this.setData({ showInterestGuide: !userHasInterest });
    } else {
      this.setData({ showInterestGuide: false });
    }

    // 线上标签页的特殊处理：只显示线上活动
    if (tabValue === 'online') {
      // 只显示线上活动
      filteredActivities = filteredActivities.filter(activity => {
        return activity.activityType === 'online' || activity.meetingLink;
      });
      try {
        const phoneNumber = wx.getStorageSync('phoneNumber');
        if (phoneNumber) {
          const userResult = await db.collection('users').where({
            phoneNumber: phoneNumber
          }).get();
          if (userResult.data && userResult.data.length > 0) {
            const userData = userResult.data[0];
            const eduSchools = Array.isArray(userData.educations)
              ? userData.educations
                  .filter(e => e && e.status === 'approved' && e.school && String(e.school).trim() !== '')
                  .map(e => String(e.school).trim())
              : [];
            const currentUserSchoolSet = new Set(eduSchools);
            filteredActivities = filteredActivities.filter(activity => {
              if (activity.registrationRestriction === 'school') {
                const rs = activity.restrictedSchool && String(activity.restrictedSchool).trim() !== '' ? String(activity.restrictedSchool).trim() : null;
                if (rs) {
                  return currentUserSchoolSet.size > 0 ? currentUserSchoolSet.has(rs) : false;
                }
              }
              return true;
            });
            if (currentUserSchoolSet.size > 0) {
              const schoolRestrictedActivities = filteredActivities.filter(activity => 
                activity.registrationRestriction === 'school' && 
                activity.createdBy && 
                activity.createdBy.phoneNumber && 
                !(activity.restrictedSchool && String(activity.restrictedSchool).trim() !== '')
              );
              if (schoolRestrictedActivities.length > 0) {
                const publisherPhones = [...new Set(schoolRestrictedActivities.map(activity => activity.createdBy.phoneNumber))];
                const publishersResult = await db.collection('users').where({
                  phoneNumber: db.command.in(publisherPhones)
                }).get();
                const publisherSchoolMap = {};
                publishersResult.data.forEach(user => {
                  const primarySchool = user.school || (Array.isArray(user.educations) ? (user.educations.find(e => e && e.status === 'approved' && e.school && String(e.school).trim() !== '')?.school || null) : null);
                  publisherSchoolMap[user.phoneNumber] = primarySchool;
                });
                filteredActivities = filteredActivities.filter(activity => {
                  if (activity.registrationRestriction === 'school' && 
                      activity.createdBy && 
                      activity.createdBy.phoneNumber) {
                    const rs = activity.restrictedSchool && String(activity.restrictedSchool).trim() !== '' ? String(activity.restrictedSchool).trim() : null;
                    if (rs) return true;
                    const publisherSchool = publisherSchoolMap[activity.createdBy.phoneNumber];
                    return publisherSchool ? currentUserSchoolSet.has(publisherSchool) : false;
                  }
                  return true;
                });
              }
            } else {
              filteredActivities = filteredActivities.filter(activity => 
                activity.registrationRestriction !== 'school'
              );
            }
          } else {
            filteredActivities = filteredActivities.filter(activity => 
              activity.registrationRestriction !== 'school'
            );
          }
        } else {
          filteredActivities = filteredActivities.filter(activity => 
            activity.registrationRestriction !== 'school'
          );
        }
      } catch (error) {
        filteredActivities = filteredActivities.filter(activity => 
          activity.registrationRestriction !== 'school'
        );
      }
    }

    // 同校标签页的特殊处理：发布者与该用户的学校相同且活动为"限本校参加"
    if (tabValue === 'follow') {
      try {
        const phoneNumber = wx.getStorageSync('phoneNumber');
        if (phoneNumber) {
          // 获取当前用户的学校信息
          const currentUserResult = await db.collection('users').where({
            phoneNumber: phoneNumber
          }).get();
          
          if (currentUserResult.data && currentUserResult.data.length > 0) {
            const currentUserData = currentUserResult.data[0];
            // 收集用户所有学校：顶层 school + educations 中已通过审核的学校
            const userSchoolsSet = new Set();
            if (currentUserData.school && String(currentUserData.school).trim() !== '') {
              userSchoolsSet.add(String(currentUserData.school).trim());
            }
            if (Array.isArray(currentUserData.educations)) {
              currentUserData.educations.forEach(e => {
                const s = e && e.school && String(e.school).trim() !== '' ? String(e.school).trim() : null;
                if (s && (!e.status || e.status === 'approved')) {
                  userSchoolsSet.add(s);
                }
              });
            }
            const selectedSchool = this.data.selectedSchoolFilter; // '' 表示全部（使用用户所有学校）
            const targetSchools = (selectedSchool && selectedSchool !== '') 
              ? [selectedSchool]
              : Array.from(userSchoolsSet);

            if (targetSchools && targetSchools.length > 0) {
              // 获取所有发布者的手机号
              const publisherPhones = [...new Set(filteredActivities
                .filter(activity => activity.registrationRestriction === 'school' && activity.createdBy && activity.createdBy.phoneNumber)
                .map(activity => activity.createdBy.phoneNumber))];
              
              if (publisherPhones.length > 0) {
                // 批量查询发布者的学校信息
                const publishersResult = await db.collection('users').where({
                  phoneNumber: db.command.in(publisherPhones)
                }).get();
                
                // 创建发布者手机号到学校的映射
                const publisherSchoolMap = {};
                publishersResult.data.forEach(user => {
                  const primarySchool = user.school || (Array.isArray(user.educations) ? (user.educations.find(e => e && e.status === 'approved' && e.school && String(e.school).trim() !== '')?.school || null) : null);
                  publisherSchoolMap[user.phoneNumber] = primarySchool;
                });
                
                // 筛选：限本校活动，若活动设置了 restrictedSchool 则优先按其与目标学校(集合)匹配；否则按发布者学校匹配
                filteredActivities = filteredActivities.filter(activity => {
                  if (activity.registrationRestriction === 'school' && 
                      activity.createdBy && 
                      activity.createdBy.phoneNumber) {
                    const rs = activity.restrictedSchool && String(activity.restrictedSchool).trim() !== '' ? String(activity.restrictedSchool).trim() : null;
                    if (rs) {
                      return targetSchools.includes(rs);
                    }
                    const publisherSchool = publisherSchoolMap[activity.createdBy.phoneNumber];
                    return targetSchools.includes(publisherSchool);
                  }
                  return false;
                });
              } else {
                // 没有符合条件的活动
                filteredActivities = [];
              }
            } else {
              // 当前用户没有设置学校，不显示任何同校活动
              filteredActivities = [];
            }
          } else {
            // 找不到当前用户信息
            filteredActivities = [];
          }
        } else {
          // 用户未登录
          filteredActivities = [];
        }
      } catch (error) {
        console.error('获取同校活动失败:', error);
        filteredActivities = [];
      }
    }

    // 应用兴趣标签筛选
    if (selectedInterestFilter) {
      filteredActivities = filteredActivities.filter(activity => {
        // 检查活动的 category 字段是否匹配选中的兴趣
        if (activity.category) {
          return activity.category === selectedInterestFilter;
        }
        return false;
      });
    }
    
    // 应用子分类筛选
    const selectedSubcategoryFilter = this.data.selectedSubcategoryFilter;
    if (selectedSubcategoryFilter) {
      filteredActivities = filteredActivities.filter(activity => {
        const sc = activity.subCategory;
        if (!sc) return false;
        if (Array.isArray(sc)) {
          return sc.includes(selectedSubcategoryFilter);
        }
        if (typeof sc === 'string') {
          return sc === selectedSubcategoryFilter;
        }
        return false;
      });
    }

    this.setData({
      activities: filteredActivities
    });
  },

  // 兴趣筛选变更事件
  async onInterestFilterChange(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({
      selectedInterestFilter: value,
      selectedSubcategoryFilter: '', // 重置子分类筛选
      currentSubcategoryOptions: value ? this.getSubcategoryOptions(value) : [] // 更新子分类选项
    });
    // 重新筛选活动
    await this.filterActivitiesByTab(this.data.currentTab);
  },
  
  // 获取子分类选项
  getSubcategoryOptions(interestValue) {
    // 根据兴趣分类获取对应的子分类选项，与"我的兴趣"页面保持一致
    const subCategoryMap = {
      'sport': [
        { label: '篮球', value: 'basketball' },
        { label: '足球', value: 'football' },
        { label: '羽毛球', value: 'badminton' },
        { label: '乒乓球', value: 'pingpong' },
        { label: '网球', value: 'tennis' },
        { label: '排球', value: 'volleyball' },
        { label: '匹克球', value: 'pickleball' },
        { label: '壁球', value: 'squash' },
        { label: '登山', value: 'mountaineering' },
        { label: '徒步', value: 'hiking' },
        { label: '骑行', value: 'cycling' },
        { label: '攀岩', value: 'climbing' },
        { label: '探险', value: 'exploration' },
        { label: '定向越野', value: 'orienteering' },
        { label: '健身', value: 'fitness' },
        { label: '瑜伽', value: 'yoga' },
        { label: '普拉提', value: 'pilates' },
        { label: '搏击', value: 'combat' },
        { label: '操课', value: 'group-fitness' },
        { label: '舞蹈', value: 'dance' },
        { label: '飞盘', value: 'frisbee' },
        { label: '橄榄球', value: 'rugby' },
        { label: '跑步', value: 'running' },
        { label: '马拉松', value: 'marathon' },
        { label: '太极', value: 'tai-chi' },
        { label: '台球', value: 'billiards' },
        { label: '保龄球', value: 'bowling' },
        { label: '射箭', value: 'archery' },
        { label: '高尔夫', value: 'golf' },
        { label: '卡丁车', value: 'karting' },
        { label: '皮划艇', value: 'kayaking' },
        { label: '潜水', value: 'diving' },
        { label: '冲浪', value: 'surfing' },
        { label: '帆船', value: 'sailing' },
        { label: '钓鱼', value: 'fishing' },
        { label: '游泳', value: 'swimming' },
        { label: '滑雪', value: 'skiing' },
        { label: '冰球', value: 'ice-hockey' },
        { label: '滑冰', value: 'skating' },
        { label: '冰壶', value: 'curling' }
      ],
      'art': [
        { label: '非遗', value: 'intangible-heritage' },
        { label: '展览', value: 'exhibition' },
        { label: '音乐会', value: 'concert' },
        { label: '演唱会', value: 'singing-concert' },
        { label: '文学', value: 'literature' },
        { label: '电影', value: 'film' },
        { label: '戏剧', value: 'drama' },
        { label: '摄影', value: 'photography' },
        { label: '手工', value: 'handicraft' }
      ],
      'career': [
        { label: '行业交流', value: 'industry-exchange' },
        { label: '企业参访', value: 'company-visit' },
        { label: '行业峰会', value: 'industry-summit' },
        { label: '职业培训', value: 'vocational-training' }
      ],
      'entertainment': [
        { label: '游戏', value: 'game' },
        { label: '桌游', value: 'board-game' },
        { label: '旅行', value: 'travel' },
        { label: '密室逃脱', value: 'escape-room' },
        { label: '剧本杀', value: 'script-killing' },
        { label: '观赛', value: 'watching-game' }
      ],
      'parent-child': [
        { label: '亲子活动', value: 'parent-child-activity' },
        { label: '教育沙龙', value: 'education-salon' },
        { label: '家庭旅行', value: 'family-travel' }
      ],
      'social': [
        { label: '聚餐', value: 'dinner' }
      ],
      'study': [
        { label: '讲座', value: 'lecture' },
        { label: '学术交流', value: 'academic-exchange' },
        { label: '语言角', value: 'language-corner' },
        { label: '考试互助', value: 'exam-assistance' }
      ]
    };
    
    return subCategoryMap[interestValue] || [];
  },
  
  // 子分类筛选变更事件
  async onSubcategoryFilterChange(e) {
    const value = e.currentTarget.dataset.value;
    this.setData({
      selectedSubcategoryFilter: value
    });
      // 重新筛选活动
    await this.filterActivitiesByTab(this.data.currentTab);
  },

  goToInterestsPage() {
    const phoneNumber = wx.getStorageSync('phoneNumber');
    const accessToken = wx.getStorageSync('access_token');
    const userInfo = wx.getStorageSync('userInfo');
    const isLoggedIn = !!(phoneNumber && accessToken && userInfo);
    if (!isLoggedIn) {
      const from = encodeURIComponent('/pages/interests/index');
      wx.showModal({
        title: '登录提示',
        content: '登录后才能设置兴趣，是否前往登录？',
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
    wx.navigateTo({ url: '/pages/interests/index' });
  },
});

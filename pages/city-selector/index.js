const { cityList } = require('./city-data.js');
const { provinceList } = require('./province-city-data.js');
import cityData from './city-data';
import QQMapWX from '../../utils/qqmap-wx-jssdk';
import { config } from '../../config/index';
const locationPermissionManager = require('../../utils/locationPermission');

let touchEndy = 0;
let rightheight = 0;
let timer = null;
let that = null;

Page({
  data: {
    currentCity: '',
    hotCities: ['北京', '上海', '广州', '深圳', '杭州', '南京'],
    cityList: cityList,
    letters: ['定位', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'],

    searchResult: [],
    isSearching: false,
    searchKeyword: ''
  },

  onBackTap() {
    wx.navigateBack({
      delta: 1
    });
  },

  onLoad() {
    that = this;
    
    // 初始化城市列表
    this.initCityList();
    
    // 设置定位中状态并自动执行定位
    this.setData({
      currentCity: '定位中...'
    });
    
    // 自动执行定位获取当前城市
    this.getCurrentLocation();
  },

  onReady() {
    // 获取右侧字母索引条高度
    const query = wx.createSelectorQuery();
    query.select('#right').boundingClientRect();
    query.exec((res) => {
      if (res && res[0]) {
        rightheight = res[0].height;
      }
    });
  },

  // 获取当前位置
  async getCurrentLocation() {
    console.log('=== 开始定位流程 ===');
    console.log('当前时间:', new Date().toLocaleTimeString());
    
    // 清除之前的超时定时器
    if (this.locationTimeout) {
      console.log('清除之前的超时定时器');
      clearTimeout(this.locationTimeout);
      this.locationTimeout = null;
    }
    
    // 静默检查权限并尝试定位
    try {
      // 先检查是否已有权限
      const authSetting = await new Promise((resolve) => {
        wx.getSetting({
          success: (res) => resolve(res.authSetting),
          fail: () => resolve({})
        });
      });
      
      if (authSetting['scope.userLocation']) {
        // 已有权限，直接定位
        console.log('✅ 已有定位权限，直接开始定位');
        this.doGetFuzzyLocation();
      } else {
        // 没有权限，静默申请
        console.log('🔍 静默申请定位权限...');
        const permissionGranted = await locationPermissionManager.checkAndRequestPermission({
          title: '定位权限',
          content: '需要获取您的位置信息来为您推荐附近的城市，请在设置中开启定位权限',
          silent: true
        });
        
        if (permissionGranted) {
          console.log('✅ 权限申请成功，开始执行定位');
          this.doGetFuzzyLocation();
        } else {
          console.log('❌ 权限申请失败，设置为当前位置');
          // 权限被拒绝时，静默设置为当前位置，不显示错误提示
          this.setData({
            currentCity: '当前位置'
          });
        }
      }
    } catch (error) {
      console.error('❌ 定位过程出错:', error);
      // 出错时静默设置为当前位置
      this.setData({
        currentCity: '当前位置'
      });
    }
  },

  // 执行模糊定位
  doGetFuzzyLocation() {
    console.log('=== 开始执行模糊定位 ===');
    console.log('定位开始时间:', new Date().toLocaleTimeString());
    
    // 权限已在getCurrentLocation中申请过，直接执行定位
    console.log('权限已申请，直接开始定位...');
    this.executeLocationRequest();
  },

  executeLocationRequest() {
    // 更新状态为定位中
    this.setData({
      currentCity: '定位中...'
    });
    
    // 设置定位超时
    console.log('设置8秒定位超时定时器');
    this.locationTimeout = setTimeout(() => {
      console.warn('⏰ 定位超时，切换到手动选择');
      console.log('超时时间:', new Date().toLocaleTimeString());
      this.setData({
        currentCity: '定位超时，点击重试'
      });
      wx.showToast({
        title: '定位超时，请重试或手动选择',
        icon: 'none',
        duration: 3000
      });
      this.locationTimeout = null;
    }, 8000); // 8秒超时
    
    console.log('调用 getFuzzyLocation API...');
    locationPermissionManager.getFuzzyLocation({
      type: 'gcj02', // 使用国测局坐标系
      success: (res) => {
        console.log('✅ 定位成功:', res);
        console.log('定位完成时间:', new Date().toLocaleTimeString());
        console.log('坐标信息:', `纬度: ${res.latitude}, 经度: ${res.longitude}`);
        
        // 清除超时定时器
        if (this.locationTimeout) {
          console.log('清除定位超时定时器');
          clearTimeout(this.locationTimeout);
          this.locationTimeout = null;
        }
        // 使用微信小程序自带的逆地理编码
        this.reverseGeocode(res.latitude, res.longitude);
      },
      fail: (err) => {
        console.error('❌ 定位失败:', err);
        console.log('定位失败时间:', new Date().toLocaleTimeString());
        
        // 清除超时定时器
        if (this.locationTimeout) {
          console.log('清除定位超时定时器');
          clearTimeout(this.locationTimeout);
          this.locationTimeout = null;
        }
        wx.showToast({
          title: '定位失败，请手动选择城市',
          icon: 'none'
        });
        this.setData({
          currentCity: '定位失败，点击重试'
        });
      }
    });
  },

  // 点击定位按钮时的处理
  async onLocationTap() {
    const currentCity = this.data.currentCity;
    console.log('🔘 用户点击定位按钮，当前状态:', currentCity);
    
    // 如果是定位中状态，不重复触发
    if (currentCity === '定位中...') {
      console.log('⚠️ 定位正在进行中，忽略重复点击');
      return;
    }
    
    // 如果已经有有效的定位城市，直接选择
    if (currentCity && 
        currentCity !== '当前位置' && 
        currentCity !== '定位中...') {
      await this.selectLocationCity(currentCity);
    } else {
      // 否则开始定位
      await this.getCurrentLocation();
    }
  },

  // 逆地理编码获取城市信息
  reverseGeocode(latitude, longitude) {
    console.log('开始逆地理编码，坐标:', latitude, longitude);
    
    // 如果配置了腾讯地图API密钥，使用腾讯地图逆地理编码
    if (config.qqMapKey && config.qqMapKey !== 'YOUR_QQ_MAP_KEY_HERE') {
      console.log('使用腾讯地图逆地理编码');
      this.useQQMapReverseGeocode(latitude, longitude);
    } else {
      // 降级使用简化的城市判断逻辑
      console.warn('未配置腾讯地图API密钥，使用简化定位逻辑');
      this.fallbackToSimpleLocation(latitude, longitude);
    }
  },

  // 使用腾讯地图逆地理编码获取精确位置
  useQQMapReverseGeocode(latitude, longitude) {
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
            const cityName = city.replace('市', '');
            console.log('解析到城市:', cityName);
            this.setData({
              currentCity: cityName
            });
            return;
          }
        }
        
        console.warn('腾讯地图返回数据格式异常，降级到简化定位');
        this.fallbackToSimpleLocation(latitude, longitude);
      },
      fail: (error) => {
        console.error('腾讯地图逆地理编码失败:', error);
        console.error('错误详情:', JSON.stringify(error));
        this.fallbackToSimpleLocation(latitude, longitude);
      }
    });
  },

  // 降级到简化定位逻辑
  fallbackToSimpleLocation(latitude, longitude) {
    console.log('使用简化定位逻辑，坐标:', latitude, longitude);
    const cityInfo = this.getCityByCoordinates(latitude, longitude);
    
    if (cityInfo) {
      console.log('简化定位成功，城市:', cityInfo);
      this.setData({
        currentCity: cityInfo
      });
    } else {
      console.warn('简化定位也无法确定城市，使用手动定位');
      this.fallbackToManualLocation();
    }
  },

  // 根据经纬度简单判断城市（基于常见城市坐标范围）
  getCityByCoordinates(lat, lng) {
    // 主要城市的大致坐标范围
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

    // 如果没有匹配到具体城市，返回null
    return null;
  },

  // 备用定位方案：根据经纬度大致判断城市
  fallbackToManualLocation() {
    // 简化处理，设置为当前位置，让用户手动选择
    this.setData({
      currentCity: '当前位置'
    });
  },

  initCityList() {
    // 使用预定义的城市数据
    // 过滤掉没有城市的字母
    const validLetters = ['定位', ...cityList.map(section => section.initial)];
    this.setData({
      cityList,
      letters: validLetters
    });
  },

  onSearch(e) {
    const keyword = e.detail.value.trim();
    this.setData({
      searchKeyword: e.detail.value
    });
    
    if (!keyword) {
      this.setData({
        isSearching: false,
        searchResult: []
      });
      return;
    }

    const result = [];
    this.data.cityList.forEach(section => {
      const matchedCities = section.cities.filter(city =>
        city.indexOf(keyword) > -1
      );
      result.push(...matchedCities);
    });

    // 对搜索结果进行排序，优先显示以关键词开头的城市
    result.sort((a, b) => {
      const aStartsWithKeyword = a.startsWith(keyword);
      const bStartsWithKeyword = b.startsWith(keyword);
      
      if (aStartsWithKeyword && !bStartsWithKeyword) {
        return -1;
      } else if (!aStartsWithKeyword && bStartsWithKeyword) {
        return 1;
      } else {
        return a.localeCompare(b);
      }
    });

    this.setData({
      isSearching: true,
      searchResult: result
    });
  },

  // 清空搜索框
  clearSearch() {
    this.setData({
      isSearching: false,
      searchResult: [],
      searchKeyword: ''
    });
  },

  async onCitySelect(e) {
    const city = e.currentTarget.dataset.city;
    wx.setStorageSync('selectedCity', city);
    
    try {
      // 获取用户手机号码
      const phoneNumber = wx.getStorageSync('phoneNumber');
      if (!phoneNumber) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });
        return;
      }

      // 更新数据库中的城市信息
      const db = wx.cloud.database();
      await db.collection('users').where({
        phoneNumber: phoneNumber
      }).update({
        data: {
          selectedCity: city,
          updateTime: db.serverDate()
        }
      });

      // 将选择的城市信息返回给上一页
      const pages = getCurrentPages();
      const prevPage = pages[pages.length - 2];
      if (prevPage) {
        // 根据页面路径设置不同的字段
        if (prevPage.route === 'pages/home/index') {
          prevPage.setData({
            selectedCity: city
          });
        } else {
          prevPage.setData({
            city: city
          });
        }
      }

      wx.showToast({
        title: '城市更新成功',
        icon: 'success'
      });
      
      wx.navigateBack();
    } catch (error) {
      console.error('更新城市失败:', error);
      wx.showToast({
        title: '更新城市失败',
        icon: 'none'
      });
    }
  },

  // 选择定位城市
  async selectLocationCity(city) {
    wx.setStorageSync('selectedCity', city);
    
    try {
      // 获取用户手机号码
      const phoneNumber = wx.getStorageSync('phoneNumber');
      if (!phoneNumber) {
        wx.showToast({
          title: '请先登录',
          icon: 'none'
        });
        return;
      }

      // 更新数据库中的城市信息
      const db = wx.cloud.database();
      await db.collection('users').where({
        phoneNumber: phoneNumber
      }).update({
        data: {
          selectedCity: city,
          updateTime: db.serverDate()
        }
      });

      // 将选择的城市信息返回给上一页
      const pages = getCurrentPages();
      const prevPage = pages[pages.length - 2];
      if (prevPage) {
        // 根据页面路径设置不同的字段
        if (prevPage.route === 'pages/home/index') {
          prevPage.setData({
            selectedCity: city
          });
        } else {
          prevPage.setData({
            city: city
          });
        }
      }

      wx.showToast({
        title: '定位城市已选择',
        icon: 'success'
      });
      
      wx.navigateBack();
    } catch (error) {
      console.error('选择定位城市失败:', error);
      wx.showToast({
        title: '选择城市失败',
        icon: 'none'
      });
    }
  },

  // 触摸开始事件
  touchStart(e) {
    touchEndy = e.touches[0].pageY;
  },

  // 触摸移动事件
  touchMove(e) {
    touchEndy = e.touches[0].pageY;
    const lindex = parseInt(touchEndy / rightheight * 27);
    if (lindex >= 0 && lindex < this.data.letters.length) {
      const value = this.data.letters[lindex];
      if (value !== '定位') {
        this.setData({
          toView: value
        });
      }
    }
  },

  // 触摸结束事件
  touchEnd(e) {
    const lindex = parseInt(touchEndy / rightheight * 27);
    if (lindex >= 0 && lindex < this.data.letters.length) {
      const value = this.data.letters[lindex];
      if (value !== '定位') {
        this.setData({
          toView: value
        });
      }
    }
  },

  // 字母点击事件
  letterclick(e) {
    const letter = e.currentTarget.dataset.letter;
    
    if (letter === '定位') {
      this.setData({
        toView: 'dw'
      });
    } else {
      // 设置toView为对应字母的城市分区ID
      this.setData({
        toView: letter
      });
      // 确保滚动到正确位置
      wx.nextTick(() => {
        this.setData({
          toView: letter
        });
      });
    }
  },


});
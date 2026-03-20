import request from '../../api/request.js';
import QQMapWX from '../../utils/qqmap-wx-jssdk';
import { config } from '../../config/index';
const locationPermissionManager = require('../../utils/locationPermission');

Page({
  data: {
    // 移除radioValue
    showContainer: true,
    startX: 0,
    startY: 0,
    fromUrl: '',
    isLeaving: false,
    // 已移除登录页图片
  },

  onLoad(options) {
    // 记录来源页
    if (options && options.from) {
      try {
        this.setData({ fromUrl: decodeURIComponent(options.from) });
      } catch (e) {
        this.setData({ fromUrl: options.from });
      }
    }
    // 允许直接离开，不再启用返回前确认
    wx.disableAlertBeforeUnload && wx.disableAlertBeforeUnload();
  },
  
  // 返回按钮点击事件
  onBackTap() {
    // 标记即将离开，并关闭容器，避免白屏
    this.setData({ isLeaving: true, showContainer: false });
    setTimeout(() => {
      this.goBackToSource();
    }, 0);
  },
  
  // 根据来源返回
  goBackToSource() {
    const fromUrl = this.data.fromUrl;
    // 判断是否已登录
    const phoneNumber = wx.getStorageSync('phoneNumber');
    const accessToken = wx.getStorageSync('access_token');
    const userInfo = wx.getStorageSync('userInfo');
    const isLoggedIn = !!(phoneNumber && accessToken && userInfo);

    if (isLoggedIn && fromUrl) {
      if (this.isTabPage(fromUrl)) {
        wx.switchTab({ url: fromUrl });
      } else {
        wx.redirectTo({ url: fromUrl });
      }
      return;
    }
    // 未登录或无来源：返回上一页，失败则首页
    wx.navigateBack({
      delta: 1,
      fail: () => {
        wx.switchTab({ url: '/pages/home/index' });
      }
    });
  },

  isTabPage(url) {
    const tabPages = ['/pages/home/index', '/pages/message/index', '/pages/my/index'];
    // 仅比较路径部分
    const pathOnly = url.split('?')[0];
    return tabPages.includes(pathOnly);
  },
  
  // 触摸开始事件
  onTouchStart(e) {
    this.setData({
      startX: e.touches[0].clientX,
      startY: e.touches[0].clientY
    });
  },
  
  // 触摸移动事件
  onTouchMove(e) {
    const moveX = e.touches[0].clientX;
    const moveY = e.touches[0].clientY;
    const diffX = moveX - this.data.startX;
    const diffY = moveY - this.data.startY;
    
    // 如果是从左边缘向右滑动，执行返回操作
    if (this.data.startX < 50 && diffX > 100 && Math.abs(diffY) < 150) {
      this.goBackToSource();
    }
  },
  
  // 不再阻止滑动返回
  preventSwipeBack: function() {},

  onShow() {
    // 不再隐藏导航栏返回按钮
    wx.offBackPress && wx.offBackPress();
    wx.disableAlertBeforeUnload && wx.disableAlertBeforeUnload();
    
    // 仅在未离开时保持容器显示
    if (!this.data.isLeaving) {
      this.setData({ showContainer: true });
    }
  },

  onUnload() {
    wx.disableAlertBeforeUnload && wx.disableAlertBeforeUnload();
  },

  // 已移除登录页图片相关逻辑

  // 用户协议选择变更
  // 已移除onCheckChange方法及相关状态
  
  // 第二步：获取手机号
  async getPhoneNumber(e) {
    console.log('获取手机号事件:', e);
    
    if (e.detail.errMsg !== 'getPhoneNumber:ok') {
      wx.showToast({
        title: '用户拒绝授权手机号',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    const cloudID = e.detail.cloudID;
    if (!cloudID) {
      wx.showToast({
        title: '获取手机号cloudID失败',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    await this.completeLogin(cloudID);
  },

  // 完成登录流程
  async completeLogin(cloudID) {
    if (!cloudID) {
      wx.showToast({
        title: '请先授权手机号',
        icon: 'none',
        duration: 2000
      });
      return;
    }

    wx.showLoading({
      title: '登录中...'
    });

    try {
      // 使用cloudID调用云函数获取手机号
      let phoneNumber = null;
      try {
        const result = await wx.cloud.callFunction({
          name: 'getPhoneNumber',
          data: {
            cloudID: cloudID
          }
        });
        
        if (result.result && result.result.success && result.result.phoneNumber) {
          phoneNumber = result.result.phoneNumber;
          console.log('获取到真实手机号:', phoneNumber);
        } else {
          const errorMsg = result.result ? result.result.error : '获取手机号失败';
          throw new Error(errorMsg);
        }
      } catch (error) {
        console.error('获取手机号失败:', error);
        wx.hideLoading();
        wx.showToast({
          title: '获取手机号失败，请重试',
          icon: 'none',
          duration: 2000
        });
        return;
      }
      
      // 获取微信登录信息
      const loginRes = await wx.login();
      console.log('微信登录结果:', loginRes);
      
      const app = getApp();
      let userInfo = {
        openid: loginRes.code ? `openid_${loginRes.code.slice(-8)}` : 'mock_openid_' + Date.now(),
        access_token: 'token_' + Date.now(),
        loginType: 'phone'
      };
      
      console.log('初始用户信息:', userInfo);
      
      // 查询数据库中是否已存在该手机号的用户
      const db = wx.cloud.database();
      const existingUser = await db.collection('users')
        .where({
          phoneNumber: phoneNumber
        })
        .get();
      
      if (existingUser.data.length > 0) {
        // 找到已存在的用户，直接登录该账号
        const existingUserData = existingUser.data[0];
        userInfo = {
          _id: existingUserData._id,
          openid: existingUserData.openid || userInfo.openid,
          phoneNumber: existingUserData.phoneNumber,
          access_token: 'token_' + Date.now(),
          loginType: 'phone',
          name: existingUserData.name || '校友',
          // 保留原有用户的其他信息
          ...existingUserData
        };
        
        // 更新该用户的登录时间
        await db.collection('users').doc(existingUserData._id).update({
          data: {
            lastLoginTime: new Date(),
            loginType: 'phone'
          }
        });
        
        console.log('找到已存在用户，直接登录:', userInfo);
      } else {
        // 没有找到已存在用户，创建新用户
        console.log('未找到已存在用户，开始创建新用户');
        
        const newUserData = {
          openid: userInfo.openid,
          phoneNumber: phoneNumber,
          name: '校友',
          loginType: 'phone',
          educations: [],
          createTime: new Date(),
          lastLoginTime: new Date(),
          messageAllread: true
        };
        
        console.log('新用户数据:', newUserData);
        
        const newUser = await db.collection('users').add({
          data: newUserData
        });
        
        userInfo = {
          ...userInfo,
          _id: newUser._id,
          phoneNumber: phoneNumber,
          name: '校友'
        };
        
        console.log('创建新用户成功:', userInfo);
      }
      
      // 保存手机号到本地存储
      wx.setStorageSync('phoneNumber', userInfo.phoneNumber);
      
      // 保存用户信息到全局和本地存储
      app.globalData.userInfo = userInfo;
      wx.setStorageSync('access_token', userInfo.access_token);
      wx.setStorageSync('loginType', 'phone');
      wx.setStorageSync('userInfo', userInfo);
      
      // 登录后立即刷新未读数与红点状态
      try {
        await app.getUnreadNum();
        await app.updateUserMessageAllreadStatus();
      } catch (e) {
        console.warn('登录后刷新未读与红点状态失败', e);
      }
      
      console.log('登录信息保存完成:', {
        phoneNumber: userInfo.phoneNumber,
        userId: userInfo._id,
        name: userInfo.name
      });
      
      wx.hideLoading();
      wx.showToast({
        title: '登录成功',
        icon: 'success',
        duration: 1500
      });
      
      // 关闭容器并标记离开，避免跳转中白屏
      this.setData({ isLeaving: true, showContainer: false });
      
      // 登录成功后返回来源页/上一页
      const fromUrl = this.data.fromUrl;
      setTimeout(() => {
        if (fromUrl) {
          if (this.isTabPage(fromUrl)) {
            wx.switchTab({ url: fromUrl });
          } else {
            wx.redirectTo({ url: fromUrl });
          }
        } else {
          wx.navigateBack({
            delta: 1,
            fail: () => wx.switchTab({ url: '/pages/home/index' })
          });
        }
      }, 1500);
      
    } catch (error) {
      console.error('微信登录失败:', error);
      wx.hideLoading();
      wx.showToast({
        title: '登录失败，请重试',
        icon: 'none',
        duration: 2000
      });
    }
  },

  // 登录成功后自动获取定位
  async autoGetLocationAfterLogin(userInfo) {
    try {
      console.log('开始自动获取定位...');
      
      // 静默获取定位权限（不显示权限弹窗和加载提示）
      const permissionGranted = await locationPermissionManager.checkAndRequestPermission({
        silent: true
      });
      
      if (permissionGranted) {
        // 获取模糊定位
        const locationResult = await locationPermissionManager.getFuzzyLocation();
        
        if (locationResult && locationResult.latitude && locationResult.longitude) {
          console.log('定位成功:', locationResult);
          
          // 根据坐标解析城市信息
          const cityInfo = await this.getCityByCoordinates(
            locationResult.latitude, 
            locationResult.longitude
          );
          
          if (cityInfo) {
            // 保存城市信息到数据库
            await this.saveCityToDatabase(userInfo.id, cityInfo);
            console.log('自动定位完成，城市信息已保存:', cityInfo);
            // 静默保存，不显示定位成功提示
          }
        }
      } else {
        console.log('定位权限未授权，跳过自动定位');
      }
    } catch (error) {
      console.error('自动定位失败:', error);
      // 静默失败，不显示错误提示，保持良好的用户体验
    }
  },

  // 根据坐标获取城市信息
  async getCityByCoordinates(lat, lng) {
    return new Promise((resolve) => {
      // 使用腾讯地图逆地址解析
      const qqmapsdk = new QQMapWX({
        key: config.qqMapKey
      });
      
      qqmapsdk.reverseGeocoder({
        location: {
          latitude: lat,
          longitude: lng
        },
        success: (res) => {
          if (res.status === 0 && res.result) {
            const city = res.result.address_component.city || res.result.address_component.district;
            resolve(city);
          } else {
            console.log('逆地址解析失败:', res);
            resolve(null);
          }
        },
        fail: (error) => {
          console.log('逆地址解析失败:', error);
          resolve(null);
        }
      });
    });
  },

  // 保存城市信息到数据库
  async saveCityToDatabase(userId, cityInfo) {
    try {
      const db = wx.cloud.database();
      await db.collection('users').doc(userId).update({
        data: {
          selectedCity: cityInfo,
          lastLocationTime: new Date()
        }
      });
      console.log('城市信息已保存到数据库:', cityInfo);
    } catch (error) {
      console.error('保存城市信息失败:', error);
      throw error;
    }
  },

  onBeforeLeave() {
    // 允许离开
    return true;
  },
  
  // 不再拦截返回
  onBackPress() {
    return false; // 允许返回
  }
});

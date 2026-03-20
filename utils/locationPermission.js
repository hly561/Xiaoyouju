/**
 * 定位权限管理工具
 * 统一处理小程序定位权限申请、检查和错误处理
 */
const LocationPermissionManager = {
  isRequesting: false,

  /**
   * 检查并申请权限的主要方法
   */
  checkAndRequestPermission(options = {}) {
    const { success, fail, title, content, silent = false } = options;
    
    console.log('=== 开始权限申请流程 ===');
    
    if (this.isRequesting) {
      console.log('权限申请正在进行中，跳过重复申请');
      if (fail) fail(new Error('权限申请正在进行中'));
      return Promise.resolve(false);
    }
    
    // 静默模式下不显示加载提示
    if (!silent) {
      wx.showLoading({
        title: '检查定位权限...',
        mask: true
      });
    }

    this.isRequesting = true;
    
    console.log('开始检查定位权限...');
    
    // 1. 检查基础库版本
    const systemInfo = this.getSystemInfo();
    if (!this.isVersionSupported(systemInfo.SDKVersion)) {
      console.error('基础库版本过低，不支持 getFuzzyLocation');
      wx.showToast({
        title: '基础库版本过低',
        icon: 'none'
      });
      if (fail) fail(new Error('基础库版本过低'));
      this.isRequesting = false;
      return Promise.resolve(false);
    }

    // 2. 返回Promise链
    return this.diagnosePermissionStatus().then(() => {
      
      // 3. 检查当前权限状态
      console.log('获取权限设置...');
      return this.getSetting();
    }).then((settingRes) => {
      console.log('当前权限状态:', settingRes.authSetting);

      if (settingRes.authSetting['scope.userFuzzyLocation'] === false) {
        // 用户已拒绝，静默模式下直接返回失败，非静默模式引导到设置页面
        console.log('用户已拒绝权限');
        if (silent) {
          console.log('静默模式，不显示权限引导弹窗');
          if (fail) fail(new Error('用户已拒绝权限'));
          return false;
        } else {
          console.log('引导到设置页面');
          return this.showPermissionModal(
            title || '需要位置权限',
            content || '为了提供更好的服务，需要获取您的位置信息',
            () => this.openSetting(),
            () => false
          ).then((modalResult) => {
            if (modalResult) {
              if (success) success();
              return true;
            } else {
              if (fail) fail(new Error('用户拒绝权限'));
              return false;
            }
          });
        }
      }

      // 4. 尝试申请权限
      return this.authorize().then(() => {
        console.log('权限申请成功');
        if (success) success();
        return true;
      }).catch((error) => {
        console.error('权限申请失败:', error);
        if (fail) fail(error);
        return false;
      });
    }).catch((error) => {
      console.error('权限检查过程出错:', error);
      if (fail) fail(error);
      return false;
    }).finally(() => {
      this.isRequesting = false;
      // 隐藏加载提示
      if (!silent) {
        wx.hideLoading();
      }
    });
  },

  /**
   * 权限诊断工具
   */
  diagnosePermissionStatus() {
    console.log('=== 权限诊断开始 ===');
    
    // 检查系统信息
    const systemInfo = this.getSystemInfo();
    console.log('系统信息:', {
      platform: systemInfo.platform,
      version: systemInfo.version,
      SDKVersion: systemInfo.SDKVersion
    });

    // 检查系统级设置（如果支持新API）
    if (systemInfo.locationEnabled !== undefined) {
      console.log('系统级设置:', {
        locationEnabled: systemInfo.locationEnabled,
        bluetoothEnabled: systemInfo.bluetoothEnabled,
        wifiEnabled: systemInfo.wifiEnabled,
        deviceOrientation: systemInfo.deviceOrientation
      });
      
      if (!systemInfo.locationEnabled) {
        console.warn('⚠️ 系统级地理位置开关已关闭，请在手机设置中开启');
      }
    }

    // 检查账号信息
    const accountInfo = wx.getAccountInfoSync();
    console.log('账号信息:', {
      appId: accountInfo.miniProgram.appId,
      envVersion: accountInfo.miniProgram.envVersion
    });

    // 检查权限设置
    return this.getSetting().then((setting) => {
      console.log('所有权限设置:', setting.authSetting);
      console.log('模糊定位权限:', setting.authSetting['scope.userFuzzyLocation']);
      console.log('精确定位权限:', setting.authSetting['scope.userLocation']);
      console.log('=== 权限诊断结束 ===');
      
      // 返回诊断结果
      return {
        systemInfo,
        accountInfo,
        authSetting: setting.authSetting,
        fuzzyLocationPermission: setting.authSetting['scope.userFuzzyLocation'],
        preciseLocationPermission: setting.authSetting['scope.userLocation'],
        systemLocationEnabled: systemInfo.locationEnabled
      };
    }).catch((error) => {
      console.error('获取权限设置失败:', error);
      console.log('=== 权限诊断结束 ===');
      
      // 返回错误信息
      return {
        error: error.message || '获取权限设置失败',
        systemInfo,
        accountInfo
      };
    });
  },

  /**
   * 重置权限状态（用于测试）
   */
  resetPermission() {
    console.log('开始重置权限状态...');
    return this.openSetting().then((res) => {
      if (res.authSetting['scope.userFuzzyLocation']) {
        console.log('权限重置成功，用户已重新授权');
        return true;
      } else {
        console.log('权限重置后，用户仍未授权');
        return false;
      }
    }).catch((error) => {
      console.error('权限重置失败:', error);
      return false;
    });
  },

  /**
   * 获取系统信息（兼容新旧API）
   */
  getSystemInfo() {
    try {
      // 优先使用新的 wx.getSystemSetting() API (基础库 2.20.1+)
      if (wx.getSystemSetting) {
        const systemSetting = wx.getSystemSetting();
        const systemInfo = wx.getSystemInfoSync(); // 仍需要获取版本信息
        
        return {
          ...systemInfo,
          locationEnabled: systemSetting.locationEnabled,
          bluetoothEnabled: systemSetting.bluetoothEnabled,
          wifiEnabled: systemSetting.wifiEnabled,
          deviceOrientation: systemSetting.deviceOrientation
        };
      } else {
        // 降级使用旧的 wx.getSystemInfoSync() API
        console.warn('基础库版本较低，使用 wx.getSystemInfoSync()');
        return wx.getSystemInfoSync();
      }
    } catch (error) {
      console.error('获取系统信息失败:', error);
      // 最后的降级方案
      return wx.getSystemInfoSync();
    }
  },

  /**
   * 检查基础库版本是否支持 getFuzzyLocation
   */
  isVersionSupported(version) {
    const minVersion = '2.20.1';
    return this.compareVersion(version, minVersion) >= 0;
  },

  /**
   * 版本号比较
   */
  compareVersion(v1, v2) {
    const arr1 = v1.split('.');
    const arr2 = v2.split('.');
    const length = Math.max(arr1.length, arr2.length);

    for (let i = 0; i < length; i++) {
      const num1 = parseInt(arr1[i] || '0');
      const num2 = parseInt(arr2[i] || '0');
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    return 0;
  },

  /**
   * 获取用户设置
   */
  getSetting() {
    return new Promise((resolve, reject) => {
      wx.getSetting({
        success: resolve,
        fail: reject
      });
    });
  },

  /**
   * 申请权限
   */
  authorize() {
    return new Promise((resolve, reject) => {
      wx.authorize({
        scope: 'scope.userFuzzyLocation',
        success: resolve,
        fail: reject
      });
    });
  },

  /**
   * 打开设置页面
   */
  openSetting() {
    return new Promise((resolve, reject) => {
      wx.openSetting({
        success: resolve,
        fail: reject
      });
    });
  },

  /**
   * 显示权限申请弹窗
   */
  showPermissionModal(title, content, success, fail) {
    return new Promise((resolve) => {
      wx.showModal({
        title,
        content,
        confirmText: '去设置',
        cancelText: '取消',
        success: (modalRes) => {
          if (modalRes.confirm) {
            try {
              const result = success();
              if (result && typeof result.then === 'function') {
                result.then(resolve).catch((error) => {
                  console.error('设置页面操作失败:', error);
                  resolve(false);
                });
              } else {
                resolve(result);
              }
            } catch (error) {
              console.error('设置页面操作失败:', error);
              resolve(false);
            }
          } else {
            const result = fail ? fail() : false;
            resolve(result);
          }
        }
      });
    });
  },

  /**
   * 执行模糊定位
   */
  getFuzzyLocation(options = {}) {
    const defaultOptions = {
      type: 'gcj02',
      success: () => {},
      fail: () => {}
    };

    const finalOptions = { ...defaultOptions, ...options };

    console.log('开始执行模糊定位...');
    
    // 先检查权限状态
    this.getSetting().then((setting) => {
      console.log('当前权限状态:', setting.authSetting);
      
      // 检查是否有模糊定位权限
      if (setting.authSetting['scope.userFuzzyLocation'] === false) {
        console.warn('用户已拒绝模糊定位权限');
        if (finalOptions.fail) {
          finalOptions.fail({
            errMsg: 'getFuzzyLocation:fail auth deny',
            errCode: 104
          });
        }
        return;
      }
      
      // 如果没有权限记录，先尝试授权
      if (setting.authSetting['scope.userFuzzyLocation'] === undefined) {
        console.log('尝试授权模糊定位权限...');
        this.authorize('scope.userFuzzyLocation').then(() => {
          console.log('模糊定位权限授权成功');
          this.executeFuzzyLocation(finalOptions);
        }).catch((authError) => {
          console.warn('模糊定位权限授权失败:', authError);
          // 继续尝试调用，让系统弹出权限申请
          this.executeFuzzyLocation(finalOptions);
        });
      } else {
        // 已有权限，直接执行定位
        this.executeFuzzyLocation(finalOptions);
      }
    }).catch((error) => {
      console.warn('权限检查失败，继续尝试定位:', error);
      this.executeFuzzyLocation(finalOptions);
    });
  },

  /**
   * 执行模糊定位的具体实现
   */
  executeFuzzyLocation(finalOptions) {
    wx.getFuzzyLocation({
      type: finalOptions.type,
      success: (res) => {
        console.log('模糊定位成功:', res);
        // 调用原始的成功回调
        if (finalOptions.success) {
          finalOptions.success(res);
        }
      },
      fail: (error) => {
        console.error('模糊定位失败:', error);
        console.error('定位权限错误，可能的原因：');
        console.error('1. 小程序管理后台未开通"获取模糊位置信息"接口');
        console.error('2. app.json 中权限配置不正确');
        console.error('3. 用户拒绝了权限申请');
        console.error('4. 小程序未重新发布生效');
        console.error('5. 需要在真机上测试');
        
        // 调用原始的失败回调
        if (finalOptions.fail) {
          finalOptions.fail(error);
        }
      }
    });
  }
};

module.exports = LocationPermissionManager;
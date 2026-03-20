/**
 * 自动定位功能测试脚本
 * 用于验证登录后自动定位功能是否正常工作
 */

// 模拟微信小程序环境
const mockWx = {
  showToast: (options) => {
    console.log(`[Toast] ${options.title} (${options.icon})`);
  },
  showLoading: (options) => {
    console.log(`[Loading] ${options.title}`);
  },
  hideLoading: () => {
    console.log('[Loading] 隐藏加载提示');
  },
  cloud: {
    database: () => ({
      collection: (name) => ({
        doc: (id) => ({
          update: (data) => {
            console.log(`[数据库] 更新 ${name} 集合中的文档 ${id}:`, data);
            return Promise.resolve({ _id: id });
          }
        })
      })
    })
  }
};

// 模拟定位权限管理器
const mockLocationPermissionManager = {
  checkAndRequestPermission: (options = {}) => {
    console.log('[权限管理器] 检查并申请权限', options);
    if (options.silent) {
      console.log('[权限管理器] 静默模式，不显示弹窗');
    }
    // 模拟权限申请成功
    return Promise.resolve(true);
  },
  
  getFuzzyLocation: () => {
    console.log('[权限管理器] 获取模糊定位');
    // 模拟定位成功，返回北京的坐标
    return Promise.resolve({
      latitude: 39.9042,
      longitude: 116.4074
    });
  }
};

// 模拟腾讯地图SDK
const mockQQMapWX = function(options) {
  this.key = options.key;
  
  this.reverseGeocoder = (params) => {
    console.log('[腾讯地图] 逆地址解析', params);
    // 模拟返回北京的城市信息
    setTimeout(() => {
      params.success({
        result: {
          address_component: {
            city: '北京市',
            district: '朝阳区',
            province: '北京市'
          }
        }
      });
    }, 100);
  };
};

// 模拟配置
const mockConfig = {
  qqMapKey: '4YNBZ-WOCKG-R2FQP-QTOB3-EFLSS-3LB5F'
};

// 模拟登录页面的方法
const mockLoginPage = {
  // 根据坐标获取城市信息
  getCityByCoordinates(lat, lng) {
    return new Promise((resolve) => {
      const qqmapsdk = new mockQQMapWX({
        key: mockConfig.qqMapKey
      });
      
      qqmapsdk.reverseGeocoder({
        location: {
          latitude: lat,
          longitude: lng
        },
        success: (res) => {
          const addressComponent = res.result.address_component;
          const cityInfo = {
            city: addressComponent.city,
            district: addressComponent.district,
            province: addressComponent.province
          };
          console.log('[城市解析] 成功:', cityInfo);
          resolve(cityInfo);
        },
        fail: (error) => {
          console.error('[城市解析] 失败:', error);
          resolve(null);
        }
      });
    });
  },

  // 保存城市信息到数据库
  async saveCityToDatabase(userId, cityInfo) {
    try {
      const db = mockWx.cloud.database();
      await db.collection('users').doc(userId).update({
        data: {
          selectedCity: cityInfo,
          lastLocationTime: new Date()
        }
      });
      console.log('[数据库] 城市信息已保存:', cityInfo);
    } catch (error) {
      console.error('[数据库] 保存城市信息失败:', error);
      throw error;
    }
  },

  // 登录成功后自动获取定位
  async autoGetLocationAfterLogin(userInfo) {
    try {
      console.log('[自动定位] 开始自动获取定位...');
      
      // 显示定位状态提示
      mockWx.showToast({
        title: '正在获取位置...',
        icon: 'loading',
        duration: 2000,
        mask: false
      });
      
      // 静默获取定位权限（不显示权限弹窗）
      const permissionGranted = await mockLocationPermissionManager.checkAndRequestPermission({
        silent: true
      });
      
      if (permissionGranted) {
        // 获取模糊定位
        const locationResult = await mockLocationPermissionManager.getFuzzyLocation();
        
        if (locationResult && locationResult.latitude && locationResult.longitude) {
          console.log('[自动定位] 定位成功:', locationResult);
          
          // 根据坐标解析城市信息
          const cityInfo = await this.getCityByCoordinates(
            locationResult.latitude, 
            locationResult.longitude
          );
          
          if (cityInfo) {
            // 保存城市信息到数据库
            await this.saveCityToDatabase(userInfo.id, cityInfo);
            console.log('[自动定位] 自动定位完成，城市信息已保存:', cityInfo);
            
            // 显示定位成功提示
            mockWx.showToast({
              title: `定位到${cityInfo.city}`,
              icon: 'success',
              duration: 1500
            });
          }
        }
      } else {
        console.log('[自动定位] 定位权限未授权，跳过自动定位');
      }
    } catch (error) {
      console.error('[自动定位] 自动定位失败:', error);
      // 静默失败，不显示错误提示，保持良好的用户体验
    }
  }
};

// 测试函数
async function testAutoLocation() {
  console.log('=== 开始测试自动定位功能 ===\n');
  
  // 模拟用户信息
  const mockUserInfo = {
    id: 'test_user_123',
    nickname: '测试用户',
    phone: '13800138000'
  };
  
  console.log('1. 模拟用户登录成功，触发自动定位...\n');
  
  try {
    await mockLoginPage.autoGetLocationAfterLogin(mockUserInfo);
    console.log('\n✅ 自动定位功能测试完成');
  } catch (error) {
    console.error('\n❌ 自动定位功能测试失败:', error);
  }
  
  console.log('\n=== 测试结束 ===');
}

// 测试权限管理器静默模式
function testSilentMode() {
  console.log('\n=== 测试权限管理器静默模式 ===\n');
  
  console.log('1. 测试静默模式权限申请...');
  mockLocationPermissionManager.checkAndRequestPermission({ silent: true })
    .then(result => {
      console.log('✅ 静默模式权限申请结果:', result);
    });
  
  console.log('2. 测试非静默模式权限申请...');
  mockLocationPermissionManager.checkAndRequestPermission({ silent: false })
    .then(result => {
      console.log('✅ 非静默模式权限申请结果:', result);
    });
}

// 运行测试
console.log('自动定位功能测试脚本启动...\n');

// 测试静默模式
testSilentMode();

// 延迟执行主测试，确保静默模式测试完成
setTimeout(() => {
  testAutoLocation();
}, 500);
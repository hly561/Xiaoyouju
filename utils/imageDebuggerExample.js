/**
 * 图片调试工具使用示例
 * 展示如何在小程序中使用 imageDebugger 工具诊断和修复图片加载问题
 */

import imageDebugger from './imageDebugger.js';

// 示例1：检查单个图片路径
function checkSingleImage() {
  const imagePath = '/static/avatar1.png';
  const result = imageDebugger.checkImage(imagePath);
  
  console.log('图片检查结果:', result);
  // 输出示例：
  // {
  //   path: '/static/avatar1.png',
  //   isValid: true,
  //   issues: [],
  //   type: 'local'
  // }
}

// 示例2：批量检查图片路径
function checkMultipleImages() {
  const imagePaths = [
    '/static/avatar1.png',
    'cloud://cloud1-8g1w7r28e2de3747.636c-cloud1-8g1w7r28e2de3747-1330048123/avatar.jpg',
    'https://example.com/image.jpg',
    '/images/location.svg'
  ];
  
  const results = imageDebugger.checkImages(imagePaths);
  console.log('批量检查结果:', results);
}

// 示例3：生成诊断报告
function generateDiagnosticReport() {
  const imagePaths = [
    '/static/avatar1.png',
    '/static/bg_navbar.png',
    'cloud://cloud1-8g1w7r28e2de3747.636c-cloud1-8g1w7r28e2de3747-1330048123/qrcode.jpg',
    '/images/location.svg',
    'invalid path with spaces.jpg', // 无效路径
    'https://example.com/image.jpg'
  ];
  
  const report = imageDebugger.diagnose(imagePaths);
  console.log('诊断报告:', report);
  
  // 输出示例：
  // {
  //   total: 6,
  //   valid: 4,
  //   invalid: 2,
  //   byType: { local: 3, cloud: 1, network: 1, relative: 0, unknown: 1 },
  //   issues: [{ path: 'invalid path with spaces.jpg', issues: ['图片路径包含空格'] }],
  //   recommendations: ['检查云存储图片是否正确获取了临时URL', '确认网络图片域名已在小程序后台配置为合法域名']
  // }
}

// 示例4：处理云存储图片（在页面中使用）
Page({
  data: {
    userList: []
  },
  
  async onLoad() {
    // 模拟从数据库获取的用户数据
    const userData = [
      {
        id: 1,
        name: '用户1',
        avatar: 'cloud://cloud1-8g1w7r28e2de3747.636c-cloud1-8g1w7r28e2de3747-1330048123/avatar1.jpg'
      },
      {
        id: 2,
        name: '用户2',
        avatar: 'cloud://cloud1-8g1w7r28e2de3747.636c-cloud1-8g1w7r28e2de3747-1330048123/avatar2.jpg'
      }
    ];
    
    try {
      // 使用图片调试工具处理云存储图片
      const processedData = await imageDebugger.processCloudImages(userData, 'avatar');
      
      this.setData({
        userList: processedData
      });
      
      console.log('处理后的用户数据:', processedData);
    } catch (error) {
      console.error('处理云存储图片失败:', error);
      wx.showToast({
        title: '图片加载失败',
        icon: 'none'
      });
    }
  }
});

// 示例5：处理复杂嵌套数据中的云存储图片
async function processNestedCloudImages() {
  const activityData = [
    {
      id: 1,
      title: '活动1',
      creator: {
        name: '创建者1',
        avatar: 'cloud://cloud1-8g1w7r28e2de3747.636c-cloud1-8g1w7r28e2de3747-1330048123/creator1.jpg'
      },
      qrcode: 'cloud://cloud1-8g1w7r28e2de3747.636c-cloud1-8g1w7r28e2de3747-1330048123/qr1.jpg'
    }
  ];
  
  try {
    // 处理多个字段的云存储图片
    const processedData = await imageDebugger.processCloudImages(
      activityData, 
      ['creator.avatar', 'qrcode']
    );
    
    console.log('处理后的活动数据:', processedData);
    return processedData;
  } catch (error) {
    console.error('处理活动图片失败:', error);
    return activityData; // 返回原始数据
  }
}

// 示例6：手动获取单个云存储图片的临时URL
async function getSingleCloudImageUrl() {
  const cloudPath = 'cloud://cloud1-8g1w7r28e2de3747.636c-cloud1-8g1w7r28e2de3747-1330048123/avatar.jpg';
  
  try {
    const tempUrl = await imageDebugger.getCloudUrl(cloudPath);
    console.log('临时URL:', tempUrl);
    return tempUrl;
  } catch (error) {
    console.error('获取临时URL失败:', error);
    return null;
  }
}

// 示例7：批量获取云存储图片的临时URL
async function getBatchCloudImageUrls() {
  const cloudPaths = [
    'cloud://cloud1-8g1w7r28e2de3747.636c-cloud1-8g1w7r28e2de3747-1330048123/avatar1.jpg',
    'cloud://cloud1-8g1w7r28e2de3747.636c-cloud1-8g1w7r28e2de3747-1330048123/avatar2.jpg',
    'cloud://cloud1-8g1w7r28e2de3747.636c-cloud1-8g1w7r28e2de3747-1330048123/qrcode.jpg'
  ];
  
  try {
    const urlMap = await imageDebugger.getCloudUrls(cloudPaths);
    console.log('URL映射:', urlMap);
    // 输出示例：
    // {
    //   'cloud://...avatar1.jpg': 'https://7465-cloud1-8g1w7r28e2de3747-1330048123.tcb.qcloud.la/avatar1.jpg?sign=...',
    //   'cloud://...avatar2.jpg': 'https://7465-cloud1-8g1w7r28e2de3747-1330048123.tcb.qcloud.la/avatar2.jpg?sign=...',
    //   'cloud://...qrcode.jpg': 'https://7465-cloud1-8g1w7r28e2de3747-1330048123.tcb.qcloud.la/qrcode.jpg?sign=...'
    // }
    return urlMap;
  } catch (error) {
    console.error('批量获取临时URL失败:', error);
    return {};
  }
}

// 示例8：在组件中使用图片调试工具
Component({
  properties: {
    imageSrc: {
      type: String,
      value: ''
    }
  },
  
  data: {
    processedImageSrc: '',
    imageLoadError: false
  },
  
  observers: {
    'imageSrc': function(newSrc) {
      this.processImageSrc(newSrc);
    }
  },
  
  methods: {
    async processImageSrc(src) {
      if (!src) {
        this.setData({ processedImageSrc: '', imageLoadError: false });
        return;
      }
      
      // 检查图片路径
      const checkResult = imageDebugger.checkImage(src);
      
      if (!checkResult.isValid) {
        console.warn('无效的图片路径:', checkResult.issues);
        this.setData({ imageLoadError: true });
        return;
      }
      
      // 如果是云存储图片，获取临时URL
      if (checkResult.type === 'cloud') {
        try {
          const tempUrl = await imageDebugger.getCloudUrl(src);
          this.setData({ 
            processedImageSrc: tempUrl,
            imageLoadError: false 
          });
        } catch (error) {
          console.error('获取云存储图片临时URL失败:', error);
          this.setData({ imageLoadError: true });
        }
      } else {
        this.setData({ 
          processedImageSrc: src,
          imageLoadError: false 
        });
      }
    },
    
    onImageError(e) {
      console.error('图片加载失败:', e.detail);
      this.setData({ imageLoadError: true });
    }
  }
});

// 示例9：定期清理过期缓存（在 app.js 中使用）
App({
  onLaunch() {
    // 初始化云开发
    wx.cloud.init({
      env: 'cloud1-8g1w7r28e2de3747'
    });
    
    // 定期清理图片缓存（每30分钟清理一次）
    setInterval(() => {
      imageDebugger.clearCache();
      console.log('已清理过期的图片缓存');
    }, 30 * 60 * 1000);
  }
});

// 示例10：在页面中集成完整的图片加载错误处理
Page({
  data: {
    activities: [],
    imageLoadErrors: new Set()
  },
  
  async onLoad() {
    await this.loadActivities();
  },
  
  async loadActivities() {
    try {
      // 模拟从云数据库获取活动数据
      const db = wx.cloud.database();
      const { data } = await db.collection('activities').get();
      
      // 使用图片调试工具处理云存储图片
      const processedActivities = await imageDebugger.processCloudImages(
        data, 
        ['qrcode', 'creator.avatar']
      );
      
      this.setData({
        activities: processedActivities
      });
      
    } catch (error) {
      console.error('加载活动数据失败:', error);
      wx.showToast({
        title: '数据加载失败',
        icon: 'none'
      });
    }
  },
  
  onImageError(e) {
    const { src } = e.currentTarget.dataset;
    const errors = new Set(this.data.imageLoadErrors);
    errors.add(src);
    
    this.setData({
      imageLoadErrors: errors
    });
    
    console.error('图片加载失败:', src);
    
    // 检查图片路径问题
    const checkResult = imageDebugger.checkImage(src);
    if (!checkResult.isValid) {
      console.error('图片路径问题:', checkResult.issues);
    }
  }
});

export {
  checkSingleImage,
  checkMultipleImages,
  generateDiagnosticReport,
  processNestedCloudImages,
  getSingleCloudImageUrl,
  getBatchCloudImageUrls
};
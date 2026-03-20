/**
 * 图片加载问题诊断工具
 * 用于快速检查和诊断小程序中的图片加载问题
 */

class ImageDebugger {
  constructor() {
    this.issues = [];
    this.cloudImageCache = new Map();
  }

  /**
   * 检查图片路径是否有效
   * @param {string} imagePath 图片路径
   * @returns {Object} 检查结果
   */
  checkImagePath(imagePath) {
    const result = {
      path: imagePath,
      isValid: true,
      issues: [],
      type: 'unknown'
    };

    if (!imagePath) {
      result.isValid = false;
      result.issues.push('图片路径为空');
      return result;
    }

    // 检查图片类型
    if (imagePath.startsWith('cloud://')) {
      result.type = 'cloud';
      result.issues.push('云存储图片需要获取临时URL');
    } else if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      result.type = 'network';
      result.issues.push('网络图片需要配置合法域名');
    } else if (imagePath.startsWith('/')) {
      result.type = 'local';
      // 检查本地图片路径规范
      if (imagePath.includes(' ')) {
        result.isValid = false;
        result.issues.push('图片路径包含空格');
      }
      if (/[\u4e00-\u9fa5]/.test(imagePath)) {
        result.isValid = false;
        result.issues.push('图片路径包含中文字符');
      }
      // 检查文件扩展名
      const ext = imagePath.split('.').pop()?.toLowerCase();
      if (!['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
        result.isValid = false;
        result.issues.push(`不支持的图片格式: ${ext}`);
      }
    } else {
      result.type = 'relative';
      result.issues.push('建议使用绝对路径');
    }

    return result;
  }

  /**
   * 批量检查图片路径
   * @param {Array} imagePaths 图片路径数组
   * @returns {Array} 检查结果数组
   */
  batchCheckImagePaths(imagePaths) {
    return imagePaths.map(path => this.checkImagePath(path));
  }

  /**
   * 获取云存储图片的临时URL
   * @param {string} cloudPath 云存储路径
   * @returns {Promise<string>} 临时URL
   */
  async getCloudImageUrl(cloudPath) {
    if (!cloudPath || !cloudPath.startsWith('cloud://')) {
      throw new Error('无效的云存储路径');
    }

    // 检查缓存
    if (this.cloudImageCache.has(cloudPath)) {
      const cached = this.cloudImageCache.get(cloudPath);
      // 检查缓存是否过期（1.5小时后过期，留出缓冲时间）
      if (Date.now() - cached.timestamp < 5400000) {
        return cached.url;
      }
    }

    try {
      const result = await wx.cloud.getTempFileURL({
        fileList: [cloudPath]
      });
      
      if (result.fileList && result.fileList.length > 0) {
        const tempUrl = result.fileList[0].tempFileURL;
        // 缓存临时URL
        this.cloudImageCache.set(cloudPath, {
          url: tempUrl,
          timestamp: Date.now()
        });
        return tempUrl;
      } else {
        throw new Error('获取临时URL失败');
      }
    } catch (error) {
      console.error('获取云存储图片临时URL失败:', error);
      throw error;
    }
  }

  /**
   * 批量获取云存储图片的临时URL
   * @param {Array} cloudPaths 云存储路径数组
   * @returns {Promise<Object>} 路径到URL的映射对象
   */
  async batchGetCloudImageUrls(cloudPaths) {
    const validPaths = cloudPaths.filter(path => path && path.startsWith('cloud://'));
    const urlMap = {};

    if (validPaths.length === 0) {
      return urlMap;
    }

    try {
      const result = await wx.cloud.getTempFileURL({
        fileList: validPaths
      });
      
      result.fileList.forEach(file => {
        if (file.tempFileURL) {
          urlMap[file.fileID] = file.tempFileURL;
          // 缓存临时URL
          this.cloudImageCache.set(file.fileID, {
            url: file.tempFileURL,
            timestamp: Date.now()
          });
        }
      });
    } catch (error) {
      console.error('批量获取云存储图片临时URL失败:', error);
    }

    return urlMap;
  }

  /**
   * 处理数据中的云存储图片
   * @param {Array} dataList 数据数组
   * @param {string|Array} imageFields 图片字段名或字段名数组
   * @returns {Promise<Array>} 处理后的数据数组
   */
  async processCloudImages(dataList, imageFields) {
    if (!Array.isArray(dataList) || dataList.length === 0) {
      return dataList;
    }

    const fields = Array.isArray(imageFields) ? imageFields : [imageFields];
    const cloudPaths = [];

    // 收集所有云存储图片路径
    dataList.forEach(item => {
      fields.forEach(field => {
        const imagePath = this.getNestedValue(item, field);
        if (imagePath && imagePath.startsWith('cloud://')) {
          cloudPaths.push(imagePath);
        }
      });
    });

    // 批量获取临时URL
    const urlMap = await this.batchGetCloudImageUrls(cloudPaths);

    // 替换云存储路径为临时URL
    return dataList.map(item => {
      const newItem = { ...item };
      fields.forEach(field => {
        const imagePath = this.getNestedValue(newItem, field);
        if (imagePath && imagePath.startsWith('cloud://') && urlMap[imagePath]) {
          this.setNestedValue(newItem, field, urlMap[imagePath]);
        }
      });
      return newItem;
    });
  }

  /**
   * 获取嵌套对象的值
   * @param {Object} obj 对象
   * @param {string} path 路径，如 'user.avatar'
   * @returns {any} 值
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current && current[key], obj);
  }

  /**
   * 设置嵌套对象的值
   * @param {Object} obj 对象
   * @param {string} path 路径，如 'user.avatar'
   * @param {any} value 值
   */
  setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
      if (!current[key]) current[key] = {};
      return current[key];
    }, obj);
    target[lastKey] = value;
  }

  /**
   * 生成图片加载问题诊断报告
   * @param {Array} imagePaths 图片路径数组
   * @returns {Object} 诊断报告
   */
  generateDiagnosticReport(imagePaths) {
    const results = this.batchCheckImagePaths(imagePaths);
    const report = {
      total: results.length,
      valid: 0,
      invalid: 0,
      byType: {
        local: 0,
        cloud: 0,
        network: 0,
        relative: 0,
        unknown: 0
      },
      issues: [],
      recommendations: []
    };

    results.forEach(result => {
      if (result.isValid) {
        report.valid++;
      } else {
        report.invalid++;
        report.issues.push({
          path: result.path,
          issues: result.issues
        });
      }
      report.byType[result.type]++;
    });

    // 生成建议
    if (report.byType.cloud > 0) {
      report.recommendations.push('检查云存储图片是否正确获取了临时URL');
    }
    if (report.byType.network > 0) {
      report.recommendations.push('确认网络图片域名已在小程序后台配置为合法域名');
    }
    if (report.invalid > 0) {
      report.recommendations.push('修复无效的图片路径');
    }

    return report;
  }

  /**
   * 清除过期的缓存
   */
  clearExpiredCache() {
    const now = Date.now();
    for (const [key, value] of this.cloudImageCache.entries()) {
      if (now - value.timestamp >= 5400000) { // 1.5小时
        this.cloudImageCache.delete(key);
      }
    }
  }
}

// 创建全局实例
const imageDebugger = new ImageDebugger();

// 导出工具函数
export default {
  // 检查单个图片路径
  checkImage: (path) => imageDebugger.checkImagePath(path),
  
  // 批量检查图片路径
  checkImages: (paths) => imageDebugger.batchCheckImagePaths(paths),
  
  // 获取云存储图片临时URL
  getCloudUrl: (path) => imageDebugger.getCloudImageUrl(path),
  
  // 批量获取云存储图片临时URL
  getCloudUrls: (paths) => imageDebugger.batchGetCloudImageUrls(paths),
  
  // 处理数据中的云存储图片
  processCloudImages: (data, fields) => imageDebugger.processCloudImages(data, fields),
  
  // 生成诊断报告
  diagnose: (paths) => imageDebugger.generateDiagnosticReport(paths),
  
  // 清除过期缓存
  clearCache: () => imageDebugger.clearExpiredCache(),
  
  // 获取实例（用于高级用法）
  getInstance: () => imageDebugger
};
const cloud = require('wx-server-sdk');

cloud.init();

exports.main = async (event, context) => {
  try {
    const { cloudID } = event;
    if (!cloudID) {
      return {
        success: false,
        error: '缺少cloudID参数'
      };
    }

    // 使用云开发获取开放数据
    const res = await cloud.getOpenData({
      list: [cloudID]
    });
    
    console.log('手机号获取结果:', res);
    
    if (res && res.list && res.list[0] && res.list[0].data && res.list[0].data.phoneNumber) {
      return {
        success: true,
        phoneNumber: res.list[0].data.phoneNumber
      };
    } else {
      return {
        success: false,
        error: '获取手机号失败，返回数据格式异常'
      };
    }
  } catch (error) {
    console.error('获取手机号失败:', error);
    
    return {
      success: false,
      error: error.message || '获取手机号失败'
    };
  }
};
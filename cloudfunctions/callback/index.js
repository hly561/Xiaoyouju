const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

exports.main = async (event, context) => {
  const { OPENID, APPID, ENV } = cloud.getWXContext();
  try {
    return {
      success: true,
      env: ENV,
      openid: OPENID,
      appid: APPID,
      event,
      timestamp: Date.now()
    };
  } catch (e) {
    return {
      success: false,
      error: e.message || 'callback 执行失败'
    };
  }
};

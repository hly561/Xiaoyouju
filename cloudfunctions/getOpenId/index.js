const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
exports.main = async (event, context) => {
  const { OPENID, APPID, UNIONID, ENV } = cloud.getWXContext();
  return { success: true, func: 'getOpenId', env: ENV, openid: OPENID, appid: APPID, unionid: UNIONID || null, ts: Date.now() };
};

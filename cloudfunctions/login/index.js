const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
exports.main = async (event, context) => {
  const { OPENID, ENV } = cloud.getWXContext();
  return { success: true, func: 'login', env: ENV, openid: OPENID, event, ts: Date.now() };
};

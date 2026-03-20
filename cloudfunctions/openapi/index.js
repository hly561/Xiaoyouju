const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
exports.main = async (event, context) => {
  const { ENV } = cloud.getWXContext();
  return { success: true, func: 'openapi', env: ENV, event, ts: Date.now() };
};

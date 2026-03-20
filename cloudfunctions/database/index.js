const cloud = require('wx-server-sdk');
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
exports.main = async (event, context) => {
  const db = cloud.database();
  try {
    await db.collection('system_ping').add({ data: { ts: Date.now() } });
  } catch (_) {}
  return { success: true, func: 'database', ts: Date.now() };
};

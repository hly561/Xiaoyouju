const cloud = require('wx-server-sdk');

// 初始化云开发环境（使用当前环境，避免与控制台配置不一致）
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

/**
 * 清理指定用户的活动关联数据：
 * 1) 删除该用户作为发布者的所有活动（并通知报名用户）
 * 2) 取消该用户在其他活动中的所有报名（从participants移除）
 *
 * @param {string} event.phoneNumber 要清理的用户手机号
 * @returns {Object} 执行结果统计
 */
exports.main = async (event, context) => {
  const { phoneNumber } = event || {};
  if (!phoneNumber || typeof phoneNumber !== 'string') {
    return { success: false, error: '缺少或非法的手机号' };
  }

  try {
    let deletedActivities = 0;
    let canceledRegistrations = 0;

    // 工具：安全解析日期
    const safeParse = (val) => {
      if (!val) return null;
      try {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
      } catch (_) {
        return null;
      }
    };
    // 判断是否在首页展示：未开始且报名未截止（若无报名截止字段则视为未截止）
    const isHomeVisible = (activity) => {
      const now = new Date();
      const start = safeParse(activity.activityStartTimeValue || activity.activityStartTime);
      if (!start) return false; // 无开始时间不在首页显示
      if (now >= start) return false; // 已开始/已结束不在首页显示
      // 报名截止：优先使用 registrationDeadlineValue，其次兼容 registrationDeadline
      const rd = safeParse(activity.registrationDeadlineValue || activity.registrationDeadline);
      if (rd && now > rd) return false; // 报名已截止不在首页显示
      return true;
    };

    // 1) 删除该用户发布的活动（仅删除首页展示的），并通知报名用户
    const pubRes = await db.collection('activities')
      .where({ 'createdBy.phoneNumber': phoneNumber })
      .get();
    const toDelete = Array.isArray(pubRes.data) ? pubRes.data : [];

    for (const activity of toDelete) {
      // 仅删除首页展示的活动，进行中或已结束的活动保留
      if (!isHomeVisible(activity)) {
        continue;
      }
      const activityId = activity._id;
      const activityTitle = activity.title || '';
      const participants = Array.isArray(activity.participants) ? activity.participants : [];
      // 通知报名用户该活动已删除（不通知操作者本人）
      if (participants.length > 0) {
        try {
          await cloud.callFunction({
            name: 'sendNotification',
            data: {
              type: 'delete',
              activityId,
              activityTitle,
              message: `很抱歉，您报名的活动「${activityTitle}」已被组织者取消。如有疑问，请联系组织者。`,
              operatorPhone: phoneNumber
            }
          });
        } catch (notifyErr) {
          console.error('批量删除活动-通知失败:', activityId, notifyErr);
        }
      }

      try {
        await db.collection('activities').doc(activityId).remove();
        deletedActivities++;
      } catch (delErr) {
        console.error('批量删除活动失败:', activityId, delErr);
      }
    }

    // 2) 取消该用户在其他活动中的报名（不区分是否在首页展示、活动状态）
    const baseQuery = db.collection('activities')
      .where(_.or([
        { participants: _.in([phoneNumber]) },
        { participants: _.elemMatch({ phoneNumber }) }
      ]));

    const countRes = await baseQuery.count();
    const total = countRes.total || 0;
    const batchSize = 20;
    const batchTimes = Math.ceil(total / batchSize) || 1;

    for (let i = 0; i < batchTimes; i++) {
      const res = await baseQuery
        .skip(i * batchSize)
        .limit(batchSize)
        .get();

      const records = Array.isArray(res.data) ? res.data : [];
      for (const activity of records) {
        // 仅处理“首页展示”的活动报名取消；进行中或已结束的不取消
        if (!isHomeVisible(activity)) {
          continue;
        }

        const activityId = activity._id;
        const participants = Array.isArray(activity.participants) ? activity.participants : [];

        let updatedParticipants = participants;
        if (participants.length > 0) {
          if (typeof participants[0] === 'object' && participants[0] !== null) {
            // 历史结构：对象数组，形如 { phoneNumber }
            updatedParticipants = participants.filter(p => p && p.phoneNumber !== phoneNumber);
          } else {
            // 现代结构：字符串数组（手机号）
            updatedParticipants = participants.filter(p => p !== phoneNumber);
          }
        }

        try {
          await db.collection('activities').doc(activityId).update({
            data: { participants: updatedParticipants }
          });
          canceledRegistrations++;
        } catch (updErr) {
          console.error('批量取消报名失败:', activityId, updErr);
        }
      }
    }

    return {
      success: true,
      deletedActivities,
      canceledRegistrations
    };
  } catch (error) {
    console.error('cleanupUserActivities 执行失败:', error);
    return { success: false, error: error.message || '清理失败' };
  }
};
const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: 'cloud1-8g1w7r28e2de3747'
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const { type, activityId, activityTitle, message, operatorPhone } = event;
  
  try {
    // 获取活动信息和报名用户列表
    const activityResult = await db.collection('activities').doc(activityId).get();
    
    if (!activityResult.data) {
      return {
        success: false,
        error: '活动不存在'
      };
    }
    
    const activity = activityResult.data;
    const participants = activity.participants || [];
    
    // 过滤掉操作者自己（避免给自己发消息）
    const targetParticipants = participants.filter(phone => phone !== operatorPhone);
    
    if (targetParticipants.length === 0) {
      return {
        success: true,
        message: '没有需要通知的用户',
        notifiedCount: 0
      };
    }
    
    // 批量创建消息记录
    const messages = targetParticipants.map(phoneNumber => ({
      phoneNumber,
      title: `活动${type === 'update' ? '更新' : '取消'}通知`,
      content: message || `您报名的活动「${activityTitle}」已被${type === 'update' ? '更新' : '取消'}，请及时查看。`,
      type: 'activity_notification',
      activityId,
      activityTitle,
      isRead: false,
      createdAt: new Date()
    }));
    
    // 批量插入消息
    const insertPromises = messages.map(msg => 
      db.collection('messages').add({ data: msg })
    );
    
    await Promise.all(insertPromises);
    
    // 批量更新接收消息用户的messageAllread状态
    try {
      await cloud.callFunction({
        name: 'updateAllUsersMessageStatus',
        data: {
          phoneNumbers: targetParticipants
        }
      });
      console.log('批量更新接收消息用户messageAllread状态成功');
    } catch (error) {
      console.error('批量更新接收消息用户messageAllread状态失败:', error);
    }
    
    return {
      success: true,
      message: `成功发送通知给 ${targetParticipants.length} 位用户`,
      notifiedCount: targetParticipants.length,
      targetParticipants
    };
    
  } catch (error) {
    console.error('发送通知失败:', error);
    return {
      success: false,
      error: error.message || '发送通知失败'
    };
  }
};
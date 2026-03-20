const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 云函数入口函数
exports.main = async (event, context) => {
  const { activityId, activityTitle, activityCity, subCategory, activityType, registrationRestriction, publisherPhone } = event;
  
  console.log('收到的参数:', { activityId, activityTitle, activityCity, subCategory, activityType, registrationRestriction, publisherPhone });
  console.log('activityType类型:', typeof activityType, '值:', activityType);
  console.log('activityType === "online":', activityType === 'online');
  console.log('activityType === "offline":', activityType === 'offline');
  
  // 检查必要参数
  if (!subCategory || subCategory === '') {
    console.log('活动子分类为空，无法进行推荐匹配');
    return {
      success: true,
      message: '活动子分类为空，无法进行推荐匹配',
      notifiedCount: 0
    };
  }
  
  try {
    let activityDoc = null;
    try {
      const ares = await db.collection('activities').doc(activityId).get();
      activityDoc = ares.data || null;
    } catch (e) {}
    const parseDate = (val) => {
      if (!val) return null;
      if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
      if (typeof val === 'number') {
        const d = new Date(val);
        return isNaN(d.getTime()) ? null : d;
      }
      if (typeof val === 'string') {
        const d = new Date(val.replace(/-/g, '/'));
        return isNaN(d.getTime()) ? null : d;
      }
      return null;
    };
    const now = new Date();
    const startTime = parseDate((activityDoc && activityDoc.activityStartTimeValue) || (activityDoc && activityDoc.activityStartTime));
    const registrationDeadline = parseDate((activityDoc && activityDoc.registrationDeadlineValue) || (activityDoc && activityDoc.registrationDeadline));
    if (!startTime || now >= startTime) {
      return { success: true, message: '活动不在首页展示范围，跳过推荐', notifiedCount: 0 };
    }
    if (registrationDeadline && now > registrationDeadline) {
      return { success: true, message: '报名已截止，跳过推荐', notifiedCount: 0 };
    }
    // 查询所有用户，找到符合首页推荐栏条件的用户
    const usersResult = await db.collection('users').get();
    
    if (!usersResult.data || usersResult.data.length === 0) {
      return {
        success: true,
        message: '没有用户需要推荐',
        notifiedCount: 0
      };
    }
    
    let publisherSchool = null;
    const restrictedSchool = activityDoc && activityDoc.restrictedSchool && String(activityDoc.restrictedSchool).trim() !== ''
      ? String(activityDoc.restrictedSchool).trim()
      : null;
    if (registrationRestriction === 'school' && !restrictedSchool) {
      const publisherResult = await db.collection('users').where({
        phoneNumber: publisherPhone
      }).get();
      
      if (publisherResult.data && publisherResult.data.length > 0) {
        const pubUser = publisherResult.data[0];
        const primarySchool = (pubUser.school && String(pubUser.school).trim() !== '')
          ? String(pubUser.school).trim()
          : (Array.isArray(pubUser.educations)
            ? (pubUser.educations.find(e => e && e.status === 'approved' && e.school && String(e.school).trim() !== '')?.school || null)
            : null);
        publisherSchool = primarySchool ? String(primarySchool).trim() : null;
        console.log('发布者学校解析为:', publisherSchool);
      } else {
        console.log('找不到发布者信息，跳过学校限制检查');
      }
    }
    
    // 筛选匹配的用户 - 基于新的推荐逻辑
    const matchedUsers = usersResult.data.filter(user => {
      // 排除发布者自己
      if (user.phoneNumber === publisherPhone) {
        return false;
      }
      
      // 检查用户是否有兴趣标签
      const userSubCategories = user.subCategories || [];
      if (userSubCategories.length === 0) {
        return false;
      }
      
      // 检查活动的子标签是否在用户的subCategories列表中
      const hasMatchingInterest = userSubCategories.includes(subCategory);
      
      if (!hasMatchingInterest) {
        console.log(`用户 ${user.phoneNumber}: 兴趣不匹配，用户兴趣=${JSON.stringify(userSubCategories)}, 活动子分类=${subCategory}`);
        return false;
      }
      
      if (registrationRestriction === 'school') {
        const eduSchools = Array.isArray(user.educations)
          ? user.educations
              .filter(e => e && e.status === 'approved' && e.school && String(e.school).trim() !== '')
              .map(e => String(e.school).trim())
          : [];
        const requiredSchool = restrictedSchool || publisherSchool;
        if (eduSchools.length === 0 || !requiredSchool) {
          console.log(`用户 ${user.phoneNumber}: 学校信息缺失或未认证，用户educations=${JSON.stringify(eduSchools)}, 发布者学校=${publisherSchool}`);
          return false;
        }
        const match = eduSchools.includes(String(requiredSchool).trim());
        if (!match) {
          console.log(`用户 ${user.phoneNumber}: 学校不匹配，用户educations=${JSON.stringify(eduSchools)}, 发布者学校=${publisherSchool}`);
          return false;
        }
        console.log(`用户 ${user.phoneNumber}: 学校匹配，用户educations包含发布者学校=${publisherSchool}`);
      }

      const userLastLogin = user.lastLoginTime ? new Date(user.lastLoginTime) : null;
      const activityCreatedAt = activityDoc && activityDoc.createdAt ? new Date(activityDoc.createdAt) : now;
      if (userLastLogin && activityCreatedAt <= userLastLogin) {
        return false;
      }
      
      // 获取用户城市
      const userCity = user.selectedCity;
      
      // 如果是线上活动，直接发送通知（不限制城市）
      const actType = (activityDoc && activityDoc.activityType) || activityType;
      if (actType === 'online') {
        console.log(`用户 ${user.phoneNumber}: 线上活动匹配成功，兴趣匹配=${hasMatchingInterest}`);
        console.log(`用户 ${user.phoneNumber}: activityType值为 "${actType}"，匹配线上活动条件`);
        return true;
      }
      console.log(`用户 ${user.phoneNumber}: activityType值为 "${actType}"，不是线上活动`);
      
      // 如果是线下活动，检查城市是否匹配
      if (actType === 'offline') {
        // 用户必须选择了城市且与活动城市相同
        if (!userCity || userCity === '选择城市') {
          console.log(`用户 ${user.phoneNumber}: 线下活动但用户未选择城市`);
          return false;
        }
        const actCity = (activityDoc && activityDoc.location && activityDoc.location.city) || activityCity;
        const hasSameCity = userCity === actCity;
        console.log(`用户 ${user.phoneNumber}: 线下活动匹配结果，兴趣=${hasMatchingInterest}, 城市匹配=${hasSameCity} (用户城市=${userCity}, 活动城市=${activityCity})`);
        return hasSameCity;
      }
      
      return false;
    });
    
    if (matchedUsers.length === 0) {
      return {
        success: true,
        message: '没有匹配的用户需要推荐',
        notifiedCount: 0
      };
    }
    
    // 批量创建推荐消息记录
    const messages = matchedUsers.map(user => ({
      phoneNumber: user.phoneNumber,
      title: '活动推荐通知',
      content: `发现您可能感兴趣的活动「${activityTitle}」，快来看看吧！`,
      type: 'activity_recommendation',
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
    
    // 批量更新接收推荐用户的messageAllread状态
    try {
      const targetPhoneNumbers = matchedUsers.map(user => user.phoneNumber);
      await cloud.callFunction({
        name: 'updateAllUsersMessageStatus',
        data: {
          phoneNumbers: targetPhoneNumbers
        }
      });
      console.log('批量更新接收推荐用户messageAllread状态成功');
    } catch (error) {
      console.error('批量更新接收推荐用户messageAllread状态失败:', error);
    }
    
    return {
      success: true,
      message: `成功发送推荐通知给 ${matchedUsers.length} 位用户`,
      notifiedCount: matchedUsers.length,
      matchedUsers: matchedUsers.map(u => u.phoneNumber)
    };
    
  } catch (error) {
    console.error('发送推荐通知失败:', error);
    return {
      success: false,
      error: error.message || '发送推荐通知失败'
    };
  }
};
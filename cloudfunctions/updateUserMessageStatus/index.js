// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const { phoneNumber } = event
  
  try {
    console.log('开始更新用户messageAllread状态:', phoneNumber)
    
    if (!phoneNumber) {
      throw new Error('手机号不能为空')
    }
    
    // 查询该用户是否有未读消息
    const unreadResult = await db.collection('messages')
      .where({
        phoneNumber: phoneNumber,
        isRead: false
      })
      .count()
    
    const hasUnreadMessages = unreadResult.total > 0
    const messageAllread = !hasUnreadMessages
    
    console.log('用户未读消息数量:', unreadResult.total, '设置messageAllread为:', messageAllread)
    
    // 更新用户的messageAllread字段
    const updateResult = await db.collection('users')
      .where({
        phoneNumber: phoneNumber
      })
      .update({
        data: {
          messageAllread: messageAllread
        }
      })
    
    console.log('用户messageAllread状态更新结果:', updateResult)
    
    return {
      success: true,
      data: {
        phoneNumber,
        unreadCount: unreadResult.total,
        messageAllread,
        updateResult
      },
      messageAllread // 返回messageAllread状态供调用方使用
    }
  } catch (error) {
    console.error('更新用户messageAllread状态失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
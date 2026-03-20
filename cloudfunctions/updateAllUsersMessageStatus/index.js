// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const { phoneNumbers: targetPhoneNumbers } = event
  
  try {
    console.log('开始更新指定用户的messageAllread状态', targetPhoneNumbers)
    
    let phoneNumbers = []
    
    if (targetPhoneNumbers && Array.isArray(targetPhoneNumbers) && targetPhoneNumbers.length > 0) {
      // 使用传入的用户手机号列表
      phoneNumbers = [...new Set(targetPhoneNumbers.filter(phone => phone))]
      console.log('更新指定用户:', phoneNumbers)
    } else {
      // 如果没有传入用户列表，则获取所有有消息的用户手机号（兼容旧逻辑）
      const messagesResult = await db.collection('messages')
        .field({ phoneNumber: true })
        .get()
      
      if (!messagesResult.data || messagesResult.data.length === 0) {
        return {
          success: true,
          message: '没有消息记录，无需更新',
          updatedCount: 0
        }
      }
      
      phoneNumbers = [...new Set(messagesResult.data.map(msg => msg.phoneNumber).filter(phone => phone))]
      console.log('更新所有有消息的用户:', phoneNumbers.length)
    }
    
    let updatedCount = 0
    const updatePromises = []
    
    // 为每个用户计算messageAllread状态
    for (const phoneNumber of phoneNumbers) {
      const updatePromise = (async () => {
        try {
          // 查询该用户是否有未读消息
          const unreadResult = await db.collection('messages')
            .where({
              phoneNumber: phoneNumber,
              isRead: false
            })
            .count()
          
          const hasUnreadMessages = unreadResult.total > 0
          const messageAllread = !hasUnreadMessages
          
          console.log(`用户 ${phoneNumber}: 未读消息数量=${unreadResult.total}, messageAllread=${messageAllread}`)
          
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
          
          if (updateResult.stats && updateResult.stats.updated > 0) {
            updatedCount++
            console.log(`用户 ${phoneNumber} messageAllread状态更新成功: ${messageAllread}`)
          }
          
        } catch (error) {
          console.error(`更新用户 ${phoneNumber} messageAllread状态失败:`, error)
        }
      })()
      
      updatePromises.push(updatePromise)
    }
    
    // 等待所有更新完成
    await Promise.all(updatePromises)
    
    console.log(`批量更新完成，成功更新 ${updatedCount} 个用户的messageAllread状态`)
    
    return {
      success: true,
      message: `成功更新 ${updatedCount} 个用户的messageAllread状态`,
      totalUsers: phoneNumbers.length,
      updatedCount: updatedCount
    }
    
  } catch (error) {
    console.error('批量更新用户messageAllread状态失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
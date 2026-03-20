// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const { messageId } = event
  
  try {
    console.log('云函数开始更新消息状态:', messageId)
    
    // 先查询消息是否存在
    const queryResult = await db.collection('messages').doc(messageId).get()
    console.log('查询到的消息:', queryResult.data)
    
    if (!queryResult.data) {
      throw new Error('消息不存在')
    }
    
    // 更新消息状态为已读
    const result = await db.collection('messages').doc(messageId).update({
      data: {
        isRead: true,
        readAt: new Date()
      }
    })
    
    console.log('云函数更新结果:', result)
    
    // 再次查询验证更新结果
    const verifyResult = await db.collection('messages').doc(messageId).get()
    console.log('更新后的消息:', verifyResult.data)
    
    return {
      success: true,
      data: result,
      updatedMessage: verifyResult.data
    }
  } catch (error) {
    console.error('云函数更新消息状态失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
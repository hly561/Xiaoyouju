// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const { messageId, phoneNumber } = event
  
  try {
    console.log('云函数开始删除消息:', { messageId, phoneNumber })
    
    // 先查询消息是否存在且属于当前用户
    const queryResult = await db.collection('messages')
      .where({
        _id: messageId,
        phoneNumber: phoneNumber
      })
      .get()
    
    console.log('查询到的消息:', queryResult.data)
    
    if (queryResult.data.length === 0) {
      return {
        success: false,
        error: '消息不存在或无权限删除'
      }
    }
    
    // 执行删除操作
    const deleteResult = await db.collection('messages').doc(messageId).remove()
    
    console.log('云函数删除结果:', deleteResult)
    
    return {
      success: true,
      data: deleteResult,
      message: '删除成功'
    }
  } catch (error) {
    console.error('云函数删除消息失败:', error)
    return {
      success: false,
      error: error.message || '删除失败'
    }
  }
}
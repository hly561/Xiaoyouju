// 云函数：初始化 education_submissions 集合（若不存在则创建）
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const res = await db.createCollection('education_submissions')
    return {
      success: true,
      message: 'education_submissions 集合已创建',
      result: res
    }
  } catch (error) {
    // 集合已存在也视为成功
    const msg = (error && error.errMsg) || ''
    if (msg.includes('already exists') || msg.includes('exists')) {
      return {
        success: true,
        message: 'education_submissions 集合已存在'
      }
    }
    console.error('创建集合失败:', error)
    return {
      success: false,
      message: '创建集合失败',
      error: error.message || error
    }
  }
}
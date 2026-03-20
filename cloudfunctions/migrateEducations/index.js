// 云函数：将旧的单学历字段迁移到 users.educations 数组
// 迁移规则：
// - 针对每个需要迁移的用户，追加一个学历条目到 educations 数组
// - 迁移条目的 degree 统一设置为“本科”（可通过参数覆盖）
// - status 映射：approved/pending/rejected 按原顶层 verifyStatus 映射；否则按是否有 verifyImage 推断为 pending；无数据则跳过
// - 默认移除旧字段（verifyStatus, school, degree, major, graduationYear, verifyImage, schoolInputMethod）
// - 保留 customSchool 等非认证信息字段

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const {
    page = 0,
    batchSize = 50,
    degreeOverride = '本科',
    removeOldFields = true,
    dryRun = false
  } = event || {}

  try {
    // 分页获取用户
    const res = await db.collection('users')
      .skip(page * batchSize)
      .limit(batchSize)
      .get()

    const users = res.data || []
    let migratedCount = 0
    let skippedCount = 0
    const details = []

    for (const user of users) {
      // 已有多段学历且非空，跳过
      if (Array.isArray(user.educations) && user.educations.length > 0) {
        skippedCount++
        details.push({ userId: user._id, action: 'skip_has_educations' })
        continue
      }

      // 判断是否具备迁移的必要信息
      const hasOldFields = !!(user.school || user.degree || user.major || user.graduationYear || user.verifyImage)
      const validStatuses = ['approved', 'pending', 'rejected']
      const hasTopVerifyStatus = validStatuses.includes(user.verifyStatus)

      if (!hasOldFields && !hasTopVerifyStatus) {
        skippedCount++
        details.push({ userId: user._id, action: 'skip_no_old_fields' })
        continue
      }

      // 构造迁移条目
      let status = 'pending'
      if (hasTopVerifyStatus) {
        status = user.verifyStatus
      } else if (!user.verifyImage) {
        // 没有认证图片且无状态，视为不可迁移
        skippedCount++
        details.push({ userId: user._id, action: 'skip_no_status_no_image' })
        continue
      }

      const newEducationItem = {
        realname: user.realname || '',
        degree: degreeOverride, // 统一为“本科”
        school: user.school || '',
        major: user.major || '',
        graduationYear: user.graduationYear || '',
        verifyImage: user.verifyImage || '',
        status,
        schoolInputMethod: user.schoolInputMethod || '选择',
        createdAt: db.serverDate()
      }

      // 组装更新数据
      const updateData = {}
      if (Array.isArray(user.educations)) {
        updateData.educations = _.push([newEducationItem])
      } else {
        updateData.educations = [newEducationItem]
      }

      if (removeOldFields) {
        updateData.verifyStatus = _.remove()
        updateData.school = _.remove()
        updateData.degree = _.remove()
        updateData.major = _.remove()
        updateData.graduationYear = _.remove()
        updateData.verifyImage = _.remove()
        updateData.schoolInputMethod = _.remove()
      }

      if (dryRun) {
        migratedCount++
        details.push({ userId: user._id, action: 'dry_run_migrate', item: newEducationItem })
        continue
      }

      // 执行更新
      const updateRes = await db.collection('users').doc(user._id).update({ data: updateData })

      if (updateRes.errMsg === 'document.update:ok') {
        migratedCount++
        details.push({ userId: user._id, action: 'migrated', item: newEducationItem })
      } else {
        skippedCount++
        details.push({ userId: user._id, action: 'update_failed', errMsg: updateRes.errMsg })
      }
    }

    return {
      success: true,
      page,
      batchSize,
      migratedCount,
      skippedCount,
      totalProcessed: users.length,
      dryRun,
      details
    }
  } catch (error) {
    console.error('迁移执行失败:', error)
    return {
      success: false,
      error: error.message || '迁移执行失败'
    }
  }
}
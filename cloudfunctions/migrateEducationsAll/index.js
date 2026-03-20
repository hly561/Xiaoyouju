// 云函数：一次性迁移所有需要迁移的 users，生成 educations 数组并移除旧字段
// 适用于当前库中已有学校等旧字段的数据批量迁移

const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

exports.main = async (event, context) => {
  const {
    batchSize = 100,
    degreeOverride = '本科',
    removeOldFields = true,
    dryRun = false
  } = event || {}

  let migratedCount = 0
  let skippedCount = 0
  let totalProcessed = 0
  const details = []

  try {
    // 分页遍历全量 users 集合
    let page = 0
    while (true) {
      const res = await db.collection('users')
        .skip(page * batchSize)
        .limit(batchSize)
        .get()

      const users = res.data || []
      if (users.length === 0) break

      for (const user of users) {
        totalProcessed++

        // 已有多段学历且非空，跳过
        if (Array.isArray(user.educations) && user.educations.length > 0) {
          skippedCount++
          details.push({ userId: user._id, action: 'skip_has_educations' })
          continue
        }

        // 旧字段存在性判断
        const hasOldFields = !!(user.school || user.degree || user.major || user.graduationYear || user.verifyImage)
        const validStatuses = ['approved', 'pending', 'rejected']
        const hasTopVerifyStatus = validStatuses.includes(user.verifyStatus)

        if (!hasOldFields && !hasTopVerifyStatus) {
          skippedCount++
          details.push({ userId: user._id, action: 'skip_no_old_fields' })
          continue
        }

        // 状态映射/推断
        let status = 'pending'
        if (hasTopVerifyStatus) {
          status = user.verifyStatus
        } else if (!user.verifyImage) {
          skippedCount++
          details.push({ userId: user._id, action: 'skip_no_status_no_image' })
          continue
        }

        // 构造新的学历条目
        const newEducationItem = {
          realname: user.realname || '',
          degree: degreeOverride,
          school: user.school || '',
          major: user.major || '',
          graduationYear: user.graduationYear || '',
          verifyImage: user.verifyImage || '',
          status,
          schoolInputMethod: user.schoolInputMethod || '选择',
          createdAt: db.serverDate()
        }

        // 更新数据组装
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

      page++
    }

    return {
      success: true,
      batchSize,
      migratedCount,
      skippedCount,
      totalProcessed,
      dryRun,
      details
    }
  } catch (error) {
    console.error('全量迁移失败:', error)
    return {
      success: false,
      error: error.message || '全量迁移失败'
    }
  }
}
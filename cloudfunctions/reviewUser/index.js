// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 为减少云函数执行耗时，审核结果消息由客户端页面负责发送
// 此处不再在云函数中调用其他云函数或写入消息集合

// 云函数入口函数
exports.main = async (event, context) => {
  const { userId, action, verifyStatus, educationIndex } = event
  // 统一解析索引为数字类型
  const idxParam = (typeof educationIndex === 'number')
    ? educationIndex
    : (typeof educationIndex === 'string' ? parseInt(educationIndex, 10) : undefined)
  const wxContext = cloud.getWXContext()
  
  console.log('云函数reviewUser被调用:', {
    userId,
    action,
    verifyStatus,
    openid: wxContext.OPENID
  })
  
  try {
    // 验证参数
    if (!userId || !action || !verifyStatus) {
      return {
        success: false,
        error: '参数不完整'
      }
    }
    
    // 验证操作类型
    if (!['approve', 'reject'].includes(action)) {
      return {
        success: false,
        error: '无效的操作类型'
      }
    }
    
    // 验证状态值（支持 approved / unverified）
    if (!['approved', 'unverified'].includes(verifyStatus)) {
      return {
        success: false,
        error: '无效的状态值'
      }
    }
    
    // 检查用户是否存在
    const userCheck = await db.collection('users').doc(userId).get()
    if (!userCheck.data) {
      return {
        success: false,
        error: '用户不存在'
      }
    }
    
    // 更新用户审核信息（不再写入顶层verifyStatus字段，统一更新各数组字段）
    const updateData = {
      reviewTime: new Date(),
      reviewerId: wxContext.OPENID
    }
    
    // 同步更新各版本字段（educations / eductions / certifications）
    try {
      const userDoc = userCheck.data
      // 计算要更新的索引：优先使用传入索引，否则从末尾选择第一个pending的条目
      const pickIndex = (arr) => {
        if (!Array.isArray(arr) || arr.length === 0) return -1
        if (Number.isFinite(idxParam) && idxParam >= 0 && idxParam < arr.length) {
          return idxParam
        }
        for (let i = arr.length - 1; i >= 0; i--) {
          if (arr[i] && arr[i].status === 'pending') return i
        }
        return arr.length - 1
      }

      // 使用点路径只更新目标条目的status，避免整数组替换不生效
      if (Array.isArray(userDoc.educations) && userDoc.educations.length > 0) {
        const arr = userDoc.educations
        const idx = pickIndex(arr)
        if (idx >= 0 && idx < arr.length) {
          updateData[`educations.${idx}.status`] = verifyStatus
        }
      }

      if (Array.isArray(userDoc.eductions) && userDoc.eductions.length > 0) {
        const arr = userDoc.eductions
        const idx = pickIndex(arr)
        if (idx >= 0 && idx < arr.length) {
          updateData[`eductions.${idx}.status`] = verifyStatus
        }
      }

      if (Array.isArray(userDoc.certifications) && userDoc.certifications.length > 0) {
        const arr = userDoc.certifications
        const idx = pickIndex(arr)
        if (idx >= 0 && idx < arr.length) {
          updateData[`certifications.${idx}.status`] = verifyStatus
        }
      }

      if (verifyStatus === 'approved') {
        const collectApproved = (arr) => {
          if (!Array.isArray(arr)) return []
          return arr.filter(e => {
            const s = e && (e.status || e.verifyStatus)
            return s === 'approved'
          })
        }
        const allApproved = []
        ;[userDoc.educations, userDoc.eductions, userDoc.certifications].forEach(arr => {
          collectApproved(arr).forEach(e => allApproved.push(e))
        })
        const idxEdu = (Array.isArray(userDoc.educations) ? pickIndex(userDoc.educations) : -1)
        if (idxEdu >= 0 && Array.isArray(userDoc.educations) && userDoc.educations[idxEdu]) {
          allApproved.push(userDoc.educations[idxEdu])
        }
        const idxEdx = (Array.isArray(userDoc.eductions) ? pickIndex(userDoc.eductions) : -1)
        if (idxEdx >= 0 && Array.isArray(userDoc.eductions) && userDoc.eductions[idxEdx]) {
          allApproved.push(userDoc.eductions[idxEdx])
        }
        const idxCert = (Array.isArray(userDoc.certifications) ? pickIndex(userDoc.certifications) : -1)
        if (idxCert >= 0 && Array.isArray(userDoc.certifications) && userDoc.certifications[idxCert]) {
          allApproved.push(userDoc.certifications[idxCert])
        }
        const mapped = allApproved.map(e => {
          const y = e && (e.graduationYear || (e.endDate ? String(e.endDate).split('-')[0] : ''))
          return {
            school: (e && e.school) || '',
            major: (e && e.major) || '',
            degree: (e && e.degree) || '',
            graduationYear: y || ''
          }
        }).filter(x => x.school || x.major || x.graduationYear || x.degree)
        const seen = new Set()
        const dedup = []
        mapped.forEach(ed => {
          const k = `${ed.school}|${ed.major}|${ed.degree}|${ed.graduationYear}`
          if (!seen.has(k)) { seen.add(k); dedup.push(ed) }
        })
        if (dedup.length > 0) {
          updateData.approvedEducationSnapshot = dedup
        }
      }
      if (verifyStatus === 'unverified') {
        try {
          const hasSnapshot = Array.isArray(userDoc.approvedEducationSnapshot) && userDoc.approvedEducationSnapshot.length > 0
          if (!hasSnapshot) {
            const collectApproved = (arr) => {
              if (!Array.isArray(arr)) return []
              return arr.filter(e => {
                const s = e && (e.status || e.verifyStatus)
                return s === 'approved'
              })
            }
            const allApproved = []
            ;[userDoc.educations, userDoc.eductions, userDoc.certifications].forEach(arr => {
              collectApproved(arr).forEach(e => allApproved.push(e))
            })
            const mapped = allApproved.map(e => {
              const y = e && (e.graduationYear || (e.endDate ? String(e.endDate).split('-')[0] : ''))
              return {
                school: (e && e.school) || '',
                major: (e && e.major) || '',
                degree: (e && e.degree) || '',
                graduationYear: y || ''
              }
            }).filter(x => x.school || x.major || x.graduationYear || x.degree)
            const seen = new Set()
            const dedup = []
            mapped.forEach(ed => {
              const k = `${ed.school}|${ed.major}|${ed.degree}|${ed.graduationYear}`
              if (!seen.has(k)) { seen.add(k); dedup.push(ed) }
            })
            if (dedup.length > 0) {
              updateData.approvedEducationSnapshot = dedup
            }
          }
        } catch (_) {}
      }
    } catch (e) {
      console.warn('更新学历状态时发生错误:', e)
    }

    console.log('准备更新的数据:', updateData)

    const updateResult = await db.collection('users').doc(userId).update({
      data: updateData
    })
    
    console.log('数据库更新结果:', updateResult)
    
    // 注意：在云开发中，如果字段值相同可能返回 updated: 0，这并不表示失败
    // 为减少执行时间，不再进行二次查询与消息发送，结果交由客户端校验与处理
    
      return {
        success: true,
        message: `用户学历条目状态已更新为${verifyStatus}`,
        data: {
          userId,
          educationIndex: Number.isFinite(idxParam) ? idxParam : undefined,
          newStatus: verifyStatus,
          updateTime: updateData.reviewTime
        }
      }
    
  } catch (error) {
    console.error('云函数执行错误:', error)
    return {
      success: false,
      error: error.message || '云函数执行失败'
    }
  }
}
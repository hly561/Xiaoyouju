const cloud = require('wx-server-sdk');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();
const _ = db.command;

// 云函数入口函数
exports.main = async (event, context) => {
  const { activityId, phoneNumber, action, answers } = event;
  
  console.log('收到报名请求:', { activityId, phoneNumber, action });
  
  try {
    const normalizeParticipants = (arr) => Array.isArray(arr) ? arr.map(p => (typeof p === 'string') ? p : (p && p.phoneNumber ? p.phoneNumber : '')).filter(Boolean) : [];

    if (action === 'register') {
      // 报名操作
      console.log('执行报名操作');
      
      // 获取当前活动数据
      const activityResult = await db.collection('activities').doc(activityId).get();
      
      if (!activityResult.data) {
        return {
          success: false,
          error: '活动不存在'
        };
      }
      
      const activity = activityResult.data;
      const currentParticipants = activity.participants || [];
      const normalized = normalizeParticipants(currentParticipants);
      const pending = normalizeParticipants(activity.pendingParticipants || []);
      
      // 检查用户是否已经报名（包含待审核）
      if (normalized.includes(phoneNumber) || pending.includes(phoneNumber)) {
        return {
          success: false,
          error: '您已经报名过了'
        };
      }
      
      // 检查人数限制
      if (activity.participantLimit && normalized.length >= activity.participantLimit) {
        return {
          success: false,
          error: `报名人数已达上限（${activity.participantLimit}人）`
        };
      }
      
      // 检查报名截止时间
      if (activity.registrationDeadlineValue) {
        const now = new Date();
        const deadline = new Date(activity.registrationDeadlineValue);
        if (now > deadline) {
          return {
            success: false,
            error: '报名时间已截止'
          };
        }
      }
      
      // 问卷校验
      const needQuestionnaire = activity.questionnaire && activity.questionnaire.enabled && ((Array.isArray(activity.questionnaire.fields) ? activity.questionnaire.fields.length > 0 : false) || activity.questionnaire.needRealName || activity.questionnaire.needPhoneNumber);
      if (needQuestionnaire) {
        if (!answers || typeof answers !== 'object') {
          return { success: false, error: '请先填写报名问卷' };
        }
        // 基本校验
        if (activity.questionnaire.needRealName && !String(answers.name || '').trim()) {
          return { success: false, error: '请填写真实姓名' };
        }
        const phoneInput = String((answers.phone || '')).trim();
        if (activity.questionnaire.needPhoneNumber && (!phoneInput || !/^\d{6,}$/.test(phoneInput))) {
          return { success: false, error: '请填写有效手机号' };
        }
        const fields = Array.isArray(activity.questionnaire.fields) ? activity.questionnaire.fields : [];
        const ansMap = (answers.fields || []).reduce((acc, cur) => { acc[cur.id] = cur.value; return acc; }, {});
        for (const f of fields) {
          if (!f.required) continue;
          const v = ansMap[f.id];
          if (f.type === 'text' && !(String(v || '').trim())) return { success: false, error: `请填写：${f.title}` };
          if (f.type === 'single' && !v) return { success: false, error: `请选择：${f.title}` };
          if (f.type === 'multi' && (!Array.isArray(v) || v.length === 0)) return { success: false, error: `请选择：${f.title}` };
        }
      }

      // 高级筛选：仅允许符合条件的校友报名（学校/学历/毕业年份）
      const allowedFilters = Array.isArray(activity.allowedEducationFilters) ? activity.allowedEducationFilters : [];
      if (allowedFilters.length > 0) {
        try {
          const userRes = await db.collection('users').where({ phoneNumber }).field({ educations: true }).get();
          const userDoc = (userRes.data && userRes.data[0]) || null;
          const edus = Array.isArray(userDoc && userDoc.educations) ? userDoc.educations : [];
          const approvedEdus = edus.filter(e => e && e.status === 'approved' && e.school && String(e.school).trim() !== '');
          const match = approvedEdus.some(e => {
            const sch = String(e.school || '').trim();
            const deg = String(e.degree || '').trim().toLowerCase();
            const year = String(e.graduationYear || '').trim();
            return allowedFilters.some(f => {
              const fSchool = String(f && f.school ? f.school : '').trim();
              const fDeg = String(f && f.degree ? f.degree : '').trim().toLowerCase();
              const fYear = String(f && f.year ? f.year : '').trim();
              const schoolOk = !!fSchool && sch === fSchool;
              const degreeOk = !fDeg || (deg && deg === fDeg);
              const yearOk = !fYear || (year && year === fYear);
              return schoolOk && degreeOk && yearOk;
            });
          });
          if (!match) {
            return { success: false, error: '不符合报名条件（非指定校友）' };
          }
        } catch (e) {
          return { success: false, error: '无法验证报名资格，请稍后再试' };
        }
      }

      const approvalRequired = !!activity.approvalRequired;
      const updatedParticipants = approvalRequired ? normalized : [...normalized, phoneNumber];
      const updatedPending = approvalRequired ? [...pending, phoneNumber] : pending;
      const updatePayload = approvalRequired ? { pendingParticipants: updatedPending } : { participants: updatedParticipants };
      if (needQuestionnaire) {
        const pathKey = approvalRequired ? `questionnairePending.${phoneNumber}` : `questionnaireResponses.${phoneNumber}`;
        const providedPhone = answers && answers.phone ? String(answers.phone).trim() : '';
        updatePayload[pathKey] = {
          name: (answers && answers.name) || '',
          phone: providedPhone, // 仅保存用户填写的手机号；未填写则为空
          fields: answers && Array.isArray(answers.fields) ? answers.fields : [],
          submittedAt: new Date()
        };
      }

      const updateResult = await db.collection('activities').doc(activityId).update({ data: updatePayload });

      console.log('报名更新结果:', updateResult);

      if (approvalRequired) {
        return {
          success: true,
          message: '报名已提交，待发布者审核',
          pendingParticipants: updatedPending
        };
      } else {
        return {
          success: true,
          message: '报名成功',
          participants: updatedParticipants
        };
      }
      
    } else if (action === 'cancel') {
      // 取消报名操作
      console.log('执行取消报名操作');
      
      // 获取当前活动数据
      const activityResult = await db.collection('activities').doc(activityId).get();
      
      if (!activityResult.data) {
        return {
          success: false,
          error: '活动不存在'
        };
      }
      
      const activity = activityResult.data;
      const currentParticipants = activity.participants || [];
      const normalized = normalizeParticipants(currentParticipants);
      const pending = normalizeParticipants(activity.pendingParticipants || []);
      
      // 检查用户是否已报名或处于待审核
      if (!normalized.includes(phoneNumber) && !pending.includes(phoneNumber)) {
        return {
          success: false,
          error: '您还未报名此活动'
        };
      }

      const updatedParticipants = normalized.filter(p => p !== phoneNumber);
      const updatedPending = pending.filter(p => p !== phoneNumber);
      const updateResult = await db.collection('activities').doc(activityId).update({
        data: {
          participants: updatedParticipants,
          pendingParticipants: updatedPending
        }
      });

      console.log('取消报名更新结果:', updateResult);

      return {
        success: true,
        message: '取消报名成功',
        participants: updatedParticipants,
        pendingParticipants: updatedPending
      };
      
    } else {
      return {
        success: false,
        error: '无效的操作类型'
      };
    }
    
  } catch (error) {
    console.error('云函数执行失败:', error);
    return {
      success: false,
      error: '服务器错误：' + error.message
    };
  }
};

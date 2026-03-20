const db = wx.cloud.database();
const _ = db.command;

const pad = (num) => (num < 10 ? `0${num}` : `${num}`);
const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'number' || typeof value === 'string') {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (value && typeof value === 'object' && value.$date) {
    const d = new Date(value.$date);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const formatTime = (value) => {
  const d = toDate(value);
  if (!d) return '';
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatAnswerValue = (value) => {
  if (Array.isArray(value)) {
    return value.length ? value.join('、') : '未填写';
  }
  if (value === 0 || value === false) {
    return String(value);
  }
  return value ? String(value) : '未填写';
};

Page({
  data: {
    loading: true,
    participants: [],
    activityTitle: '',
    questionnaireFields: [],
    needRealName: false,
    needPhoneNumber: false
  },

  onLoad(options) {
    this.activityId = options.id || '';
    wx.setNavigationBarTitle({ title: '报名者详细信息' });
    if (!this.activityId) {
      wx.showToast({ title: '活动信息不存在', icon: 'none' });
      this.setData({ loading: false });
      return;
    }
    this.loadQuestionnaireDetails();
  },

  async loadQuestionnaireDetails() {
    wx.showLoading({ title: '加载中...' });
    try {
      const res = await db.collection('activities').doc(this.activityId).get();
      if (!res.data) {
        wx.showToast({ title: '活动不存在', icon: 'none' });
        this.setData({ loading: false });
        return;
      }
      const activity = res.data;
      const questionnaire = activity.questionnaire || {};
      const fields = Array.isArray(questionnaire.fields) ? questionnaire.fields : [];
      const needRealName = !!questionnaire.needRealName;
      const needPhoneNumber = !!questionnaire.needPhoneNumber;
      const fieldMap = {};
      fields.forEach(field => {
        if (field && field.id) fieldMap[field.id] = field;
      });

      const responses = activity.questionnaireResponses || {};
      const phoneList = Object.keys(responses);

      let userMap = {};
      if (phoneList.length) {
        try {
          const userRes = await db.collection('users').where({
            phoneNumber: _.in(phoneList)
          }).get();
          const users = userRes.data || [];
          const cloudAvatars = users.filter(u => u.image && u.image.startsWith('cloud://')).map(u => u.image);
          let avatarMap = {};
          if (cloudAvatars.length) {
            try {
              const tempRes = await wx.cloud.getTempFileURL({ fileList: cloudAvatars });
              avatarMap = (tempRes.fileList || []).reduce((acc, cur) => {
                if (cur && cur.fileID && cur.tempFileURL) {
                  acc[cur.fileID] = cur.tempFileURL;
                }
                return acc;
              }, {});
            } catch (e) {}
          }
          users.forEach(u => {
            const phone = u.phoneNumber;
            if (!phone) return;
            let image = u.image || '';
            if (image && image.startsWith('cloud://')) {
              image = avatarMap[image] || image;
            }
            userMap[phone] = {
              nickname: u.name || '',
              avatar: image
            };
          });
        } catch (e) {
          console.error('查询报名用户信息失败:', e);
        }
      }

      const participantsRaw = Object.keys(responses).map(phone => {
        const resp = responses[phone] || {};
        const submittedAt = toDate(resp.submittedAt);
        const answerMap = {};
        const baseList = [];
        const hasName = !!String(resp.name || '').trim();
        const hasPhone = !!String(resp.phone || '').trim();
        if (hasName) {
          baseList.push({
            id: '__realname',
            title: '姓名',
            value: formatAnswerValue(resp.name)
          });
        }
        if (hasPhone) {
          baseList.push({
            id: '__phone',
            title: '手机号',
            value: formatAnswerValue(resp.phone)
          });
        }
        const sourceFields = Array.isArray(resp.fields) ? resp.fields.filter(ans => ans && ans.id) : [];
        const answerList = sourceFields.map(ans => {
          const def = fieldMap[ans.id];
          const valueText = formatAnswerValue(ans.value);
          const titleText = ans && ans.title ? String(ans.title).trim() : (def ? String(def.title || '').trim() : '');
          answerMap[ans.id] = valueText;
          return {
            id: ans.id || `${phone}-${Math.random()}`,
            title: titleText || '未命名字段',
            value: valueText
          };
        }).filter(it => String(it.title || '').trim() || String(it.value || '').trim());
        const mergedList = [...baseList, ...answerList].filter(it => String(it.title || '').trim() || String(it.value || '').trim());
        const userProfile = userMap[phone] || {};
        return {
          nickname: userProfile.nickname || '未填写昵称',
          avatar: userProfile.avatar || '',
          realName: resp.name || '',
          phoneNumber: resp.phone || phone,
          submittedText: submittedAt ? formatTime(submittedAt) : '',
          submittedAt: submittedAt ? submittedAt.getTime() : 0,
          answerList: mergedList,
          answerMap
        };
      });

      const participants = participantsRaw
        .filter(p => Array.isArray(p.answerList) && p.answerList.length > 0)
        .sort((a, b) => b.submittedAt - a.submittedAt);

      this.setData({
        participants,
        activityTitle: activity.title || '',
        questionnaireFields: fields,
        needRealName,
        needPhoneNumber,
        loading: false
      });
    } catch (error) {
      console.error('加载问卷详情失败:', error);
      wx.showToast({ title: '加载失败，请稍后重试', icon: 'none' });
      this.setData({ loading: false });
    } finally {
      wx.hideLoading();
    }
  }
});

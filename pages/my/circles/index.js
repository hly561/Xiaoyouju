const db = wx.cloud.database();

const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;

Page({
  data: {
    circles: [],
    leftCircles: [],
    rightCircles: [],
    loading: true,
    schoolOptions: [],
    schoolIndex: 0,
    schoolSelectVisible: false,
    selectedSchool: '',
    schoolLoading: false,
    formVisible: false,
    formName: '',
    formFiles: [],
    formDesc: '',
    searchQuery: '',
    suppressReload: false,
    manageVisible: false,
    manageLoading: false,
    manageList: [],
    manageLeft: [],
    manageRight: [],
    manageGroups: [],
    manageEditVisible: false,
    manageEditingId: '',
    manageEditName: '',
    manageEditDesc: '',
    manageEditFiles: [],
    manageEditingImageId: '',
    manageEditOriginalUrl: '',
    needRefreshAfterManage: false
  },

  onLoad() {
    wx.setNavigationBarTitle({ title: '校友圈子' });
  },

  onShow() {
    if (this.data && (this.data.formVisible || this.data.suppressReload)) return;
    this.loadUserSchools().then(() => this.loadCircles());
  },

  async loadCircles() {
    if (this.data && (this.data.formVisible || this.data.suppressReload)) {
      return;
    }
    const ownerPhone = wx.getStorageSync('phoneNumber') || '';
    if (!ownerPhone) {
      this.setData({ loading: false, circles: [], leftCircles: [], rightCircles: [] });
      return;
    }
    try {
      const shouldShowLoading = !(this.data && (this.data.formVisible || this.data.suppressReload));
      if (shouldShowLoading) wx.showLoading({ title: '加载中...' });
      const selected = String(this.data.selectedSchool || '').trim();
      const search = String(this.data.searchQuery || '').trim();
      if (!selected) {
        this.setData({ loading: false, circles: [], leftCircles: [], rightCircles: [] });
        wx.hideLoading();
        return;
      }
      const cond = { school: selected };
      if (search) cond.title = db.RegExp({ regexp: search, options: 'i' });
      const res = await db.collection('circles').where(cond).orderBy('createdAt', 'desc').get();
      const list = res.data || [];
      const ownerPhones = [...new Set(list.map(it => it && it.ownerPhoneNumber).filter(Boolean))];
      let ownerMap = {};
      if (ownerPhones.length) {
        const ownersRes = await db.collection('users').where({ phoneNumber: db.command.in(ownerPhones) }).field({ phoneNumber: true, name: true, image: true, educations: true }).get();
        ownerMap = (ownersRes.data || []).reduce((acc, u) => { acc[u.phoneNumber] = u; return acc; }, {});
      }
      const fileIds = list.filter(it => it.image && String(it.image).startsWith('cloud://')).map(it => it.image);
      for (const k in ownerMap) {
        if (Object.prototype.hasOwnProperty.call(ownerMap, k)) {
          const u = ownerMap[k];
          if (u && u.image && String(u.image).startsWith('cloud://')) fileIds.push(String(u.image));
        }
      }
      let urlMap = {};
      if (fileIds.length) {
        try {
          const temp = await wx.cloud.getTempFileURL({ fileList: fileIds });
          urlMap = (temp.fileList || []).reduce((acc, cur) => { if (cur && cur.fileID && cur.tempFileURL) acc[cur.fileID] = cur.tempFileURL.trim().replace(/[`"']/g, ''); return acc; }, {});
        } catch (_) {}
      }
      const circles = list.map(it => {
        const owner = ownerMap[it.ownerPhoneNumber] || null;
        const ownerName = owner ? String(owner.name || '') : '';
        const ownerAvatarId = owner && owner.image ? String(owner.image) : '';
        const ownerAvatarUrl = ownerAvatarId && ownerAvatarId.startsWith('cloud://') ? (urlMap[ownerAvatarId] || '') : ownerAvatarId;
        const edus = Array.isArray(owner && owner.educations) ? owner.educations : [];
        const approvedEdus = edus.filter(e => e && e.status === 'approved' && e.school && String(e.school).trim() !== '');
        const circleSchool = String(it.school || '').trim();
        const matchingEdus = circleSchool ? approvedEdus.filter(e => String(e.school).trim() === circleSchool) : approvedEdus.slice(0, 1);
        const toLines = (arr) => arr.map(ed => {
          const major = ed && ed.major ? String(ed.major).trim() : '';
          const graduationYear = ed && ed.graduationYear ? String(ed.graduationYear).trim() : '';
          const degreeRaw = ed && ed.degree ? String(ed.degree).trim() : '';
          let degreeLabel = '';
          if (degreeRaw) {
            const lower = degreeRaw.toLowerCase();
            if (lower.includes('本科') || lower.includes('bachelor') || lower.includes('undergraduate')) degreeLabel = '本科';
            else if (lower.includes('硕士') || lower.includes('master')) degreeLabel = '硕士';
            else if (lower.includes('博士') || lower.includes('phd') || lower.includes('doctor')) degreeLabel = '博士';
            else degreeLabel = degreeRaw;
          }
          const cohort = graduationYear ? `${graduationYear} 届` : '';
          return [major, cohort, degreeLabel].filter(Boolean).join(' ');
        });
        const eduLines = matchingEdus.length ? toLines(matchingEdus) : toLines(approvedEdus.slice(0, 1));
        return {
          _id: it._id,
          url: (it.image && it.image.startsWith('cloud://')) ? (urlMap[it.image] || '') : (it.image || ''),
          timeText: it.createdAt ? fmt(new Date(it.createdAt)) : '',
          title: String(it.title || ''),
          description: String(it.description || ''),
          ownerName: ownerName,
          ownerAvatar: ownerAvatarUrl,
          school: circleSchool,
          eduLines: eduLines
        };
      }).filter(it => it.url);
      const left = [];
      const right = [];
      circles.forEach((c, idx) => { (idx % 2 === 0 ? left : right).push(c); });
      this.setData({ circles, leftCircles: left, rightCircles: right, loading: false });
    } catch (e) {
      this.setData({ loading: false, circles: [], leftCircles: [], rightCircles: [] });
    } finally {
      wx.hideLoading();
    }
  },

  async loadUserSchools() {
    const ownerPhone = wx.getStorageSync('phoneNumber') || '';
    if (!ownerPhone) {
      this.setData({ schoolOptions: [], schoolIndex: 0, schoolSelectVisible: false, selectedSchool: '' });
      return;
    }
    try {
      this.setData({ schoolLoading: true });
      const res = await db.collection('users')
        .where({ phoneNumber: ownerPhone })
        .field({ educations: true, circleSelectedSchool: true })
        .get();
      const user = (res.data && res.data[0]) || null;
      const edus = Array.isArray(user && user.educations) ? user.educations : [];
      const approved = edus
        .filter(e => e && e.status === 'approved' && e.school && String(e.school).trim() !== '')
        .map(e => String(e.school).trim());
      const unique = Array.from(new Set(approved));
      const selectVisible = unique.length >= 2;
      const persisted = user && user.circleSelectedSchool ? String(user.circleSelectedSchool).trim() : '';
      const hasPersisted = persisted && unique.includes(persisted);
      const firstIndex = hasPersisted ? unique.indexOf(persisted) : 0;
      const firstValue = hasPersisted ? persisted : (unique.length > 0 ? unique[0] : '');
      this.setData({
        schoolOptions: unique,
        schoolIndex: firstIndex,
        schoolSelectVisible: selectVisible,
        selectedSchool: firstValue,
        schoolLoading: false
      });
    } catch (e) {
      this.setData({ schoolLoading: false, schoolOptions: [], schoolIndex: 0, schoolSelectVisible: false, selectedSchool: '' });
    }
  },

  onSchoolPickerChange(e) {
    const idx = (e.detail && typeof e.detail.value === 'number') ? e.detail.value : 0;
    const opts = this.data.schoolOptions || [];
    const val = opts[idx] || '';
    this.setData({ schoolIndex: idx, selectedSchool: val }, () => { if (!this.data.suppressReload && !this.data.formVisible) { this.saveSelectedSchool(val); this.loadCircles(); } else { this.saveSelectedSchool(val); } });
  },

  async onSchoolBarTap() {
    const opts = this.data.schoolOptions || [];
    if (!opts.length) return;
    try {
      const res = await wx.showActionSheet({ itemList: opts });
      const idx = typeof res.tapIndex === 'number' ? res.tapIndex : 0;
      const val = opts[idx] || '';
      this.setData({ schoolIndex: idx, selectedSchool: val }, () => { if (!this.data.suppressReload && !this.data.formVisible) { this.saveSelectedSchool(val); this.loadCircles(); } else { this.saveSelectedSchool(val); } });
    } catch (e) {
    }
  },

  async saveSelectedSchool(val) {
    const ownerPhone = wx.getStorageSync('phoneNumber') || '';
    if (!ownerPhone) return;
    try {
      await db.collection('users').where({ phoneNumber: ownerPhone }).update({ data: { circleSelectedSchool: String(val || '') } });
    } catch (e) {}
  },

  onSearchChange(e) {
    const v = (e && e.detail && typeof e.detail.value === 'string') ? e.detail.value : '';
    this.setData({ searchQuery: v }, () => { if (!this.data.suppressReload && !this.data.formVisible) { this.loadCircles(); } });
  },
  onSearchSubmit(e) {
    const v = (e && e.detail && typeof e.detail.value === 'string') ? e.detail.value : '';
    this.setData({ searchQuery: v }, () => { if (!this.data.suppressReload && !this.data.formVisible) { this.loadCircles(); } });
  },
  onSearchClear() {
    this.setData({ searchQuery: '' }, () => { if (!this.data.suppressReload && !this.data.formVisible) { this.loadCircles(); } });
  },

  onCreateCircle() {
    const ownerPhone = wx.getStorageSync('phoneNumber') || '';
    if (!ownerPhone) {
      wx.showModal({ title: '登录提示', content: '请先登录后再新建圈子', showCancel: false });
      return;
    }
    (async () => {
      try {
        const db = wx.cloud.database();
        const userResult = await db.collection('users').where({ phoneNumber: ownerPhone }).get();
        if (userResult.data && userResult.data.length > 0) {
          const userInfo = userResult.data[0];
          const educations = Array.isArray(userInfo.educations) ? userInfo.educations : [];
          const hasApproved = educations.some(e => e && e.status === 'approved');
          const hasPending = educations.some(e => e && e.status === 'pending');
          if (!hasApproved) {
            if (hasPending) {
              wx.showModal({
                title: '认证提示',
                content: '您的校友认证正在审核中，暂时无法新建圈子。请等待审核完成。',
                showCancel: false,
                confirmText: '知道了'
              });
              return;
            }
            wx.showModal({
              title: '认证提示',
              content: '您还未进行校友认证，无法新建圈子。请先完成校友认证。',
              showCancel: true,
              cancelText: '取消',
              confirmText: '去认证',
              success: (res) => {
                if (res.confirm) {
                  wx.navigateTo({ url: '/pages/my/verify/index' });
                }
              }
            });
            return;
          }
        }
        this.setData({ formVisible: true, formName: '', formFiles: [], formDesc: '', suppressReload: true });
      } catch (err) {
        // 容错：查询失败时仍允许进入表单，避免因网络问题阻塞
        this.setData({ formVisible: true, formName: '', formFiles: [], formDesc: '', suppressReload: true });
      }
    })();
  },

  onPreviewImage(e) {
    const url = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.url) ? e.currentTarget.dataset.url : '';
    if (!url) return;
    const urls = (this.data.circles || []).map(c => c && c.url).filter(u => !!u);
    const list = urls.length ? urls : [url];
    wx.previewImage({ current: url, urls: list });
  },

  onFormVisibleChange(e) {
    const v = !!(e && e.detail && e.detail.visible);
    this.setData({ formVisible: v });
  },

  onFormNameChange(e) {
    const v = (e && e.detail && typeof e.detail.value === 'string') ? e.detail.value : '';
    this.setData({ formName: v });
  },

  onFormUploadSuccess(e) {
    const files = (e && e.detail && Array.isArray(e.detail.files)) ? e.detail.files : [];
    this.setData({ formFiles: files });
  },

  onFormUploadRemove(e) {
    const idx = (e && e.detail && typeof e.detail.index === 'number') ? e.detail.index : -1;
    const files = (this.data.formFiles || []).filter((_, i) => i !== idx);
    this.setData({ formFiles: files });
  },

  onFormDescChange(e) {
    const v = (e && e.detail && typeof e.detail.value === 'string') ? e.detail.value : '';
    this.setData({ formDesc: v });
  },

  async onFormCancel() {
    this.setData({ formVisible: false, formName: '', formFiles: [], formDesc: '', suppressReload: false });
  },

  async onFormSubmit() {
    const ownerPhone = wx.getStorageSync('phoneNumber') || '';
    if (!ownerPhone) {
      wx.showModal({ title: '登录提示', content: '请先登录后再新建圈子', showCancel: false });
      return;
    }
    const name = String(this.data.formName || '').trim();
    if (!name) { wx.showToast({ title: '请输入圈子名称', icon: 'none' }); return; }
    if (name.length > 10) { wx.showToast({ title: '名称最多10字', icon: 'none' }); return; }
    const first = (this.data.formFiles || [])[0];
    const localPath = first && first.url ? first.url : '';
    if (!localPath) { wx.showToast({ title: '请上传二维码', icon: 'none' }); return; }
    const desc = String(this.data.formDesc || '').trim().slice(0, 50);
    try {
      wx.showLoading({ title: '提交中...' });
      const ext = localPath.split('.').pop() || 'jpg';
      const cloudPath = `circles/${ownerPhone}_${Date.now()}.${ext}`;
      const uploadRes = await wx.cloud.uploadFile({ cloudPath, filePath: localPath });
      const fileID = uploadRes.fileID;
      const school = this.data.selectedSchool || '';
      const doc = { ownerPhoneNumber: ownerPhone, title: name, description: desc, image: fileID, createdAt: new Date() };
      if (school) doc.school = school;
      await db.collection('circles').add({ data: doc });
      wx.hideLoading();
      wx.showToast({ title: '新建成功', icon: 'success' });
      this.setData({ formVisible: false, formName: '', formFiles: [], formDesc: '', suppressReload: false });
      await this.loadCircles();
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '提交失败', icon: 'none' });
    }
  },

  onOpenManage() {
    const ownerPhone = wx.getStorageSync('phoneNumber') || '';
    if (!ownerPhone) {
      wx.showModal({ title: '登录提示', content: '请先登录后再进行发布管理', showCancel: false });
      return;
    }
    this.setData({ manageVisible: true, suppressReload: true, manageLoading: true, manageEditVisible: false, needRefreshAfterManage: false }, () => {
      this.loadManageCircles();
    });
  },
  onManageVisibleChange(e) {
    const v = !!(e && e.detail && e.detail.visible);
    if (!v) {
      const needRefresh = !!this.data.needRefreshAfterManage;
      this.setData({ manageVisible: false, manageEditVisible: false, suppressReload: false, needRefreshAfterManage: false });
      if (needRefresh) this.loadCircles();
    } else {
      this.setData({ manageVisible: true, suppressReload: true });
    }
  },
  async loadManageCircles() {
    const ownerPhone = wx.getStorageSync('phoneNumber') || '';
    if (!ownerPhone) {
      this.setData({ manageLoading: false, manageList: [] });
      return;
    }
    try {
      const res = await db.collection('circles').where({ ownerPhoneNumber: ownerPhone }).orderBy('createdAt', 'desc').get();
      const list = res.data || [];
      const userRes = await db.collection('users').where({ phoneNumber: ownerPhone }).field({ name: true, image: true, educations: true }).get();
      const userDoc = (userRes.data && userRes.data[0]) || null;
      const ownerName = userDoc ? String(userDoc.name || '') : '';
      const ownerAvatarId = userDoc && userDoc.image ? String(userDoc.image) : '';
      const edus = Array.isArray(userDoc && userDoc.educations) ? userDoc.educations : [];
      const approvedEdus = edus.filter(e => e && e.status === 'approved' && e.school && String(e.school).trim() !== '');
      const fileIds = list.filter(it => it.image && String(it.image).startsWith('cloud://')).map(it => it.image);
      if (ownerAvatarId && String(ownerAvatarId).startsWith('cloud://')) fileIds.push(ownerAvatarId);
      let urlMap = {};
      if (fileIds.length) {
        try {
          const temp = await wx.cloud.getTempFileURL({ fileList: fileIds });
          urlMap = (temp.fileList || []).reduce((acc, cur) => { if (cur && cur.fileID && cur.tempFileURL) acc[cur.fileID] = cur.tempFileURL.trim().replace(/[`"']/g, ''); return acc; }, {});
        } catch (_) {}
      }
      const ownerAvatarUrl = ownerAvatarId && String(ownerAvatarId).startsWith('cloud://') ? (urlMap[ownerAvatarId] || '') : ownerAvatarId;
      const toLines = (arr) => arr.map(ed => {
        const major = ed && ed.major ? String(ed.major).trim() : '';
        const graduationYear = ed && ed.graduationYear ? String(ed.graduationYear).trim() : '';
        const degreeRaw = ed && ed.degree ? String(ed.degree).trim() : '';
        let degreeLabel = '';
        if (degreeRaw) {
          const lower = degreeRaw.toLowerCase();
          if (lower.includes('本科') || lower.includes('bachelor') || lower.includes('undergraduate')) degreeLabel = '本科';
          else if (lower.includes('硕士') || lower.includes('master')) degreeLabel = '硕士';
          else if (lower.includes('博士') || lower.includes('phd') || lower.includes('doctor')) degreeLabel = '博士';
          else degreeLabel = degreeRaw;
        }
        const cohort = graduationYear ? `${graduationYear} 届` : '';
        return [major, cohort, degreeLabel].filter(Boolean).join(' ');
      });
      const manageList = list.map(it => {
        const circleSchool = String(it.school || '').trim();
        const matchingEdus = circleSchool ? approvedEdus.filter(e => String(e.school).trim() === circleSchool) : approvedEdus.slice(0, 1);
        const eduLines = matchingEdus.length ? toLines(matchingEdus) : toLines(approvedEdus.slice(0, 1));
        return {
          _id: it._id,
          title: String(it.title || ''),
          description: String(it.description || ''),
          url: (it.image && it.image.startsWith('cloud://')) ? (urlMap[it.image] || '') : (it.image || ''),
          imageId: it.image || '',
          ownerName: ownerName,
          ownerAvatar: ownerAvatarUrl,
          eduLines: eduLines,
          school: circleSchool,
          createdAt: it.createdAt || null
        };
      });
      const groupsMap = {};
      manageList.forEach(c => {
        const key = c.school || '未设置学校';
        if (!groupsMap[key]) groupsMap[key] = [];
        groupsMap[key].push(c);
      });
      const manageLeft = [];
      const manageRight = [];
      manageList.forEach((c, idx) => { (idx % 2 === 0 ? manageLeft : manageRight).push(c); });
      const manageGroups = Object.keys(groupsMap).map(k => {
        const items = groupsMap[k] || [];
        const left = [];
        const right = [];
        items.forEach((c, idx) => { (idx % 2 === 0 ? left : right).push(c); });
        return { school: k, leftItems: left, rightItems: right };
      });
      this.setData({ manageList, manageLeft, manageRight, manageGroups, manageLoading: false });
    } catch (e) {
      this.setData({ manageLoading: false, manageList: [] });
    }
  },
  onManageEditTap(e) {
    const id = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) ? e.currentTarget.dataset.id : '';
    const title = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.title) ? e.currentTarget.dataset.title : '';
    const desc = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.desc) ? e.currentTarget.dataset.desc : '';
    const imageId = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.image) ? e.currentTarget.dataset.image : '';
    const url = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.url) ? e.currentTarget.dataset.url : '';
    const files = url ? [{ url }] : [];
    this.setData({ manageEditVisible: true, manageEditingId: id, manageEditName: title, manageEditDesc: desc, manageEditFiles: files, manageEditingImageId: imageId, manageEditOriginalUrl: url });
  },
  onManageEditNameChange(e) {
    const v = (e && e.detail && typeof e.detail.value === 'string') ? e.detail.value : '';
    this.setData({ manageEditName: v });
  },
  onManageEditDescChange(e) {
    const v = (e && e.detail && typeof e.detail.value === 'string') ? e.detail.value : '';
    this.setData({ manageEditDesc: v });
  },
  onManageEditUploadSuccess(e) {
    const files = (e && e.detail && Array.isArray(e.detail.files)) ? e.detail.files : [];
    this.setData({ manageEditFiles: files });
  },
  onManageEditUploadRemove(e) {
    const idx = (e && e.detail && typeof e.detail.index === 'number') ? e.detail.index : -1;
    const files = (this.data.manageEditFiles || []).filter((_, i) => i !== idx);
    this.setData({ manageEditFiles: files });
  },
  onManageEditCancel() {
    this.setData({ manageEditVisible: false, manageEditingId: '', manageEditName: '', manageEditDesc: '', manageEditFiles: [], manageEditingImageId: '', manageEditOriginalUrl: '' });
  },
  async onManageEditSubmit() {
    const id = this.data.manageEditingId || '';
    const name = String(this.data.manageEditName || '').trim();
    const desc = String(this.data.manageEditDesc || '').trim().slice(0, 50);
    if (!id) return;
    if (!name) { wx.showToast({ title: '请输入圈子名称', icon: 'none' }); return; }
    if (name.length > 10) { wx.showToast({ title: '名称最多10字', icon: 'none' }); return; }
    try {
      wx.showLoading({ title: '保存中...' });
      const first = (this.data.manageEditFiles || [])[0];
      const currentUrl = first && first.url ? first.url : '';
      const changed = !!currentUrl && currentUrl !== (this.data.manageEditOriginalUrl || '');
      let newFileID = '';
      if (changed) {
        const ownerPhone = wx.getStorageSync('phoneNumber') || '';
        const ext = currentUrl.split('.').pop() || 'jpg';
        const cloudPath = `circles/${ownerPhone}_${Date.now()}.${ext}`;
        const uploadRes = await wx.cloud.uploadFile({ cloudPath, filePath: currentUrl });
        newFileID = uploadRes.fileID || '';
      }
      const updateData = { title: name, description: desc };
      if (newFileID) updateData.image = newFileID;
      await db.collection('circles').doc(id).update({ data: updateData });
      if (newFileID) {
        const oldId = this.data.manageEditingImageId || '';
        if (oldId && String(oldId).startsWith('cloud://') && oldId !== newFileID) {
          try { await wx.cloud.deleteFile({ fileList: [oldId] }); } catch (_) {}
        }
      }
      wx.hideLoading();
      wx.showToast({ title: '保存成功', icon: 'success' });
      this.setData({ manageEditVisible: false, needRefreshAfterManage: true, manageEditFiles: [], manageEditingImageId: '', manageEditOriginalUrl: '' });
      await this.loadManageCircles();
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '保存失败', icon: 'none' });
    }
  },
  async onManageDeleteTap(e) {
    const id = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.id) ? e.currentTarget.dataset.id : '';
    const imageId = (e && e.currentTarget && e.currentTarget.dataset && e.currentTarget.dataset.image) ? e.currentTarget.dataset.image : '';
    if (!id) return;
    try {
      const m = await wx.showModal({ title: '删除确认', content: '确定删除该圈子吗？', confirmText: '删除', cancelText: '取消' });
      if (!m.confirm) return;
      wx.showLoading({ title: '删除中...' });
      await db.collection('circles').doc(id).remove();
      if (imageId && String(imageId).startsWith('cloud://')) {
        try { await wx.cloud.deleteFile({ fileList: [imageId] }); } catch (_) {}
      }
      wx.hideLoading();
      wx.showToast({ title: '已删除', icon: 'success' });
      this.setData({ needRefreshAfterManage: true });
      await this.loadManageCircles();
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: '删除失败', icon: 'none' });
    }
  }
});

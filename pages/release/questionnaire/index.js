Page({
  data: {
    fields: [],
    activityId: '',
    needRealName: false,
    needPhoneNumber: false
  },
  onLoad() {
    const ec = this.getOpenerEventChannel();
    if (ec) {
      ec.on('initData', data => {
        const f = Array.isArray(data && data.fields) ? data.fields : [];
        const letters = ['A','B','C','D','E','F','G'];
        const normalize = (opts) => {
          if (!Array.isArray(opts)) return [];
          return opts.slice(0,7).map((o, i) => {
            if (typeof o === 'string') return { label: letters[i], value: o };
            return { label: letters[i], value: (o && o.value) ? o.value : '' };
          });
        };
        const fields = f.map(x => ({
          id: x.id,
          type: x.type || 'text',
          title: x.title || '',
          desc: x.desc || '',
          required: !!x.required,
          options: (x.type === 'single' || x.type === 'multi') ? normalize(x.options) : []
        }));
        this.setData({
          fields,
          activityId: data && data.activityId ? data.activityId : '',
          needRealName: !!(data && data.needRealName),
          needPhoneNumber: !!(data && data.needPhoneNumber)
        });
      });
    }
  },
  onBack() {
    try {
      const pages = getCurrentPages();
      for (let i = pages.length - 2; i >= 0; i--) {
        if (pages[i] && pages[i].route === 'pages/release/index') {
          const delta = pages.length - 1 - i;
          wx.navigateBack({ delta });
          return;
        }
      }
      wx.redirectTo({ url: '/pages/release/index' });
    } catch (_) {
      wx.redirectTo({ url: '/pages/release/index' });
    }
  },
  onAddField() {
    const id = Date.now() + Math.random();
    const next = [...this.data.fields, { id, type: 'text', title: '', desc: '', required: false, options: [] }];
    this.setData({ fields: next });
    this.autoSave();
  },
  onDeleteField(e) {
    const index = e.currentTarget.dataset.index;
    const next = this.data.fields.filter((_, i) => i !== Number(index));
    this.setData({ fields: next });
    this.autoSave();
  },
  onTitleChange(e) {
    const index = e.currentTarget.dataset.index;
    const value = e.detail.value || '';
    const next = this.data.fields.slice();
    next[Number(index)].title = value;
    this.setData({ fields: next });
    this.autoSave();
  },
  onDescChange(e) {
    const index = e.currentTarget.dataset.index;
    const value = e.detail.value || '';
    const next = this.data.fields.slice();
    next[Number(index)].desc = value;
    this.setData({ fields: next });
    this.autoSave();
  },
  onTypeChange(e) {
    const index = e.currentTarget.dataset.index;
    const value = e.detail.value;
    const next = this.data.fields.slice();
    next[Number(index)].type = value;
    if (value === 'text') {
      next[Number(index)].options = [];
    } else if (value === 'single' || value === 'multi') {
      const letters = ['A','B','C','D','E','F','G'];
      const opts = Array.isArray(next[Number(index)].options) ? next[Number(index)].options.slice() : [];
      while (opts.length < 2) {
        opts.push({ label: letters[opts.length], value: '' });
      }
      for (let i = 0; i < opts.length && i < 7; i++) {
        opts[i].label = letters[i];
      }
      next[Number(index)].options = opts.slice(0,7);
    }
    this.setData({ fields: next });
    this.autoSave();
  },
  onRequiredChange(e) {
    const index = e.currentTarget.dataset.index;
    const value = !!e.detail.value;
    const next = this.data.fields.slice();
    next[Number(index)].required = value;
    this.setData({ fields: next });
    this.autoSave();
  },
  onAddOption(e) {
    const index = e.currentTarget.dataset.index;
    const next = this.data.fields.slice();
    const opts = Array.isArray(next[Number(index)].options) ? next[Number(index)].options.slice() : [];
    if (opts.length >= 7) {
      wx.showToast({ title: '最多7个选项', icon: 'none' });
      return;
    }
    const letters = ['A','B','C','D','E','F','G'];
    opts.push({ label: letters[opts.length], value: '' });
    next[Number(index)].options = opts;
    this.setData({ fields: next });
    this.autoSave();
  },
  onRemoveOption(e) {
    const index = e.currentTarget.dataset.index;
    const optIndex = e.currentTarget.dataset.optIndex;
    const next = this.data.fields.slice();
    const currentOpts = Array.isArray(next[Number(index)].options) ? next[Number(index)].options.slice() : [];
    if (currentOpts.length <= 2) {
      wx.showToast({ title: '至少保留两个选项', icon: 'none' });
      return;
    }
    const opts = currentOpts.filter((_, i) => i !== Number(optIndex));
    const letters = ['A','B','C','D','E','F','G'];
    for (let i = 0; i < opts.length; i++) {
      opts[i].label = letters[i];
    }
    next[Number(index)].options = opts;
    this.setData({ fields: next });
    this.autoSave();
  },
  autoSave() {
    // 不进行任何持久化保存，仅更新本页状态
  },
  onToggleRealName(e) {
    const v = !!e.detail.value;
    this.setData({ needRealName: v });
    this.autoSave();
  },
  onTogglePhoneNumber(e) {
    const v = !!e.detail.value;
    this.setData({ needPhoneNumber: v });
    this.autoSave();
  },
  onOptionChange(e) {
    const index = e.currentTarget.dataset.index;
    const optIndex = e.currentTarget.dataset.optIndex;
    const value = e.detail.value || '';
    const next = this.data.fields.slice();
    const opts = Array.isArray(next[Number(index)].options) ? next[Number(index)].options.slice() : [];
    if (opts[Number(optIndex)]) {
      opts[Number(optIndex)].value = value;
    }
    next[Number(index)].options = opts;
    this.setData({ fields: next });
    this.autoSave();
  },
  async onSave() {
    const fields = (this.data.fields || []).map(f => ({
      id: f.id,
      type: f.type,
      title: String(f.title || '').trim(),
      desc: String(f.desc || '').trim(),
      required: !!f.required,
      options: Array.isArray(f.options) ? f.options.map(o => String((o && typeof o === 'object') ? (o.value || '') : (o || '')).trim()).filter(Boolean) : []
    }));
    for (const f of fields) {
      if (!f.title) {
        wx.showToast({ title: '字段名称不能为空', icon: 'none' });
        return;
      }
      if ((f.type === 'single' || f.type === 'multi') && (!f.options || f.options.length < 2)) {
        wx.showToast({ title: '至少两个选项', icon: 'none' });
        return;
      }
    }
    if (this.data.activityId) {
      try {
        const db = wx.cloud.database();
        await db.collection('activities').doc(this.data.activityId).update({
          data: {
            questionnaire: {
              enabled: fields.length > 0,
              fields,
              needRealName: !!this.data.needRealName,
              needPhoneNumber: !!this.data.needPhoneNumber
            }
          }
        });
        wx.showToast({ title: '已保存', icon: 'success' });
      } catch (e) {
        wx.showToast({ title: '保存失败', icon: 'none' });
        return;
      }
    }
    const ec = this.getOpenerEventChannel();
    if (ec) {
      ec.emit('questionnaireSaved', {
        fields,
        needRealName: !!this.data.needRealName,
        needPhoneNumber: !!this.data.needPhoneNumber
      });
    }
    wx.navigateBack();
  }
});
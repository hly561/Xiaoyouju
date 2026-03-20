// 按地区分类的学校数据（由 CSV 转换的 JS 模块加载）
// 说明：微信小程序运行时不支持直接 require JSON，因此改为加载 .js 模块
const mainlandData = require('./data/mainland_by_province.js');
const hkMacaoTaiwanData = require('./data/hk_macao_taiwan.js');
const foreignData = require('./data/foreign_by_country.js');

const schoolsByRegion = {
  '内地': mainlandData,
  '港澳台': hkMacaoTaiwanData,
  '海外': foreignData
};

// 获取汉字拼音首字母
function getFirstLetter(str) {
  const firstChar = str.charAt(0);
  const code = firstChar.charCodeAt(0);
  
  // 如果是英文字母，直接返回大写
  if ((code >= 65 && code <= 90) || (code >= 97 && code <= 122)) {
    return firstChar.toUpperCase();
  }
  
  // 汉字拼音首字母映射表（简化版）
  const pinyinMap = {
    '安': 'A', '北': 'B', '承': 'C', '大': 'D', '东': 'D', '福': 'F', '广': 'G', '贵': 'G', '哈': 'H', '海': 'H', '河': 'H', '湖': 'H', '华': 'H', '黄': 'H',
    '吉': 'J', '江': 'J', '金': 'J', '昆': 'K', '兰': 'L', '辽': 'L', '内': 'N', '南': 'N', '宁': 'N', '青': 'Q', '山': 'S', '上': 'S', '沈': 'S', '四': 'S',
    '太': 'T', '天': 'T', '同': 'T', '武': 'W', '西': 'X', '新': 'X', '延': 'Y', '云': 'Y', '浙': 'Z', '中': 'Z', '重': 'C','三':'S','临':'L','丽':'L','乌':'W','乐':'L','九':'J','五':'W','井':'J','亳':'B','仰':'Y','仲':'Z','伊':'Y','佛':'F','佳':'J','保':'B','信':'X','六':'L','兴':'X','凯':'K','厦':'X','台':'T','右':'Y','合':'H','吕':'L','周':'Z','呼':'H','咸':'X','唐':'T','商':'S','喀':'K','嘉':'J','国':'G','塔':'T','复':'F','外':'W','宜':'Y','宝':'B','宿':'S','对':'D','岭':'L','岳':'Y','川':'C','巢':'C','常':'C','平':'P','康':'K','廊':'L','张':'Z','徐':'X','德':'D','忻':'X','怀':'H','惠':'H','成':'C','扬':'Y','抚':'F','拉':'L','攀':'P','文':'W','无':'W','昌':'C','星':'X','昭':'Z','晋':'J','普':'P','景':'J','暨':'J','曲':'Q','朝':'C','杭':'H','枣':'Z','柳':'L','桂':'G','梧':'W','楚':'C','榆':'Y','民':'M','汉':'H','汕':'S','池':'C','沧':'C','泉':'Q','泰':'T','洛':'L','济':'J','淄':'Z','淮':'H','深':'S','清':'Q','渤':'B','温':'W','渭':'W','湘':'X','湛':'Z','滁':'C','滇':'D','滨':'B','漯':'L','潍':'W','烟':'Y','燕':'Y','牡':'M','玉':'Y','珠':'Z','琼':'Q','甘':'G','电':'D','白':'B','百':'B','皖':'W','盐':'Y','石':'S','红':'H','绍':'S','绥':'S','绵':'M','聊':'L','肇':'Z','芜':'W','苏':'S','茅':'M','荆':'J','莆':'P','菏':'H','萍':'P','营':'Y','蚌':'B','衡':'H','衢':'Q','许':'X','豫':'Y','贺':'H','赣':'G','赤':'C','运':'Y','连':'L','通':'T','遵':'Z','邢':'X','邯':'H','邵':'S','郑':'Z','鄂':'E','酒':'J','铜':'T','银':'Y','锦':'J','长':'C','闽':'M','阜':'F','防':'F','阳':'Y','阿':'A','陇':'L','陕':'S','集':'J','鞍':'A','韩':'H','韶':'S','顺':'S','首':'S','香':'X','马':'M','鲁':'L','黎':'L','黑':'H','黔':'Q','齐':'Q','龙':'L',
  }
  
  return pinyinMap[firstChar] || '#';
}

Page({
  data: {
    currentRegion: '', // 当前选中的地区
    currentProvince: '', // 当前选中的省份
    regions: ['内地', '港澳台', '海外'], // 地区列表
    provinces: [], // 当前地区的省份列表
    schools: [], // 当前省份的学校列表
    searchKeyword: '', // 学校搜索关键字
    filteredSchools: [], // 学校搜索结果
    areaSearchKeyword: '', // 省份/地区/国家搜索关键字
    filteredProvinces: [], // 省份/地区/国家搜索结果
    showRegionSelector: true, // 显示地区选择
    showProvinceSelector: false, // 显示省份选择
    showSchoolSelector: false, // 显示学校选择
    isCustomMode: false // 是否为自定义添加模式
  },

  onLoad(options) {
    // 检查是否为自定义添加模式
    if (options.mode === 'custom') {
      this.setData({
        isCustomMode: true
      });
      // 修改导航栏标题
      wx.setNavigationBarTitle({
        title: '添加学校'
      });
    }
    
    // 处理全局数据中的新增学校
    this.processGlobalNewSchools();
  },

  // 处理全局数据中的新增学校
  processGlobalNewSchools() {
    try {
      const globalData = getApp().globalData || {};
      const newSchools = globalData.newSchools || [];
      
      if (newSchools.length > 0) {
        console.log('处理全局新增学校数据:', newSchools);
        
        newSchools.forEach(school => {
          this.addSchoolToData(school.region, school.subRegion, school.schoolName);
        });
        
        // 清空全局数据，避免重复处理
        getApp().globalData.newSchools = [];
        console.log('全局新增学校数据已处理完成');
      }
    } catch (error) {
      console.error('处理全局新增学校数据失败:', error);
    }
  },

  // 添加学校到数据中
  addSchoolToData(region, subRegion, schoolName) {
    try {
      // 检查学校是否已存在于硬编码数据中
      if (schoolsByRegion[region] && schoolsByRegion[region][subRegion]) {
        if (!schoolsByRegion[region][subRegion].includes(schoolName)) {
          schoolsByRegion[region][subRegion].push(schoolName);
          console.log(`学校 ${schoolName} 已添加到 ${region}-${subRegion}`);
        } else {
          console.log(`学校 ${schoolName} 已存在于 ${region}-${subRegion}`);
        }
      } else {
        // 如果地区不存在，创建新的地区数组
        if (!schoolsByRegion[region]) {
          schoolsByRegion[region] = {};
        }
        if (!schoolsByRegion[region][subRegion]) {
          schoolsByRegion[region][subRegion] = [];
        }
        schoolsByRegion[region][subRegion].push(schoolName);
        console.log(`新地区 ${region}-${subRegion} 已创建，学校 ${schoolName} 已添加`);
      }
      
      // 如果当前正在显示这个地区的学校，刷新列表
      if (this.data.currentRegion === region && this.data.currentProvince === subRegion && this.data.showSchoolSelector) {
        const updatedSchools = schoolsByRegion[region][subRegion];
        this.setData({
          schools: updatedSchools
        });
        console.log('当前显示的学校列表已更新');
      }
    } catch (error) {
      console.error('添加学校到数据失败:', error);
    }
  },

  // 选择地区
  onSelectRegion(e) {
    const { region } = e.currentTarget.dataset;
    
    const provinces = Object.keys(schoolsByRegion[region] || {});
    
    this.setData({
      currentRegion: region,
      provinces: provinces,
      currentProvince: '',
      schools: [],
      showRegionSelector: false,
      showProvinceSelector: true,
      showSchoolSelector: false,
      searchKeyword: '',
      filteredSchools: [],
      areaSearchKeyword: '',
      filteredProvinces: []
    });
  },

  // 选择省份
  onSelectProvince(e) {
    const { province } = e.currentTarget.dataset;
    
    const schools = schoolsByRegion[this.data.currentRegion] && 
                   schoolsByRegion[this.data.currentRegion][province] ? 
                   schoolsByRegion[this.data.currentRegion][province] : [];
    
    this.setData({
      currentProvince: province,
      schools: schools,
      showRegionSelector: false,
      showProvinceSelector: false,
      showSchoolSelector: true,
      searchKeyword: '',
      filteredSchools: []
    });
  },

  // 返回地区选择
  backToRegion() {
    this.setData({
      currentRegion: '',
      currentProvince: '',
      provinces: [],
      schools: [],
      showRegionSelector: true,
      showProvinceSelector: false,
      showSchoolSelector: false,
      searchKeyword: '',
      filteredSchools: [],
      areaSearchKeyword: '',
      filteredProvinces: []
    });
  },

  // 返回省份选择
  backToProvince() {
    this.setData({
      currentProvince: '',
      schools: [],
      showRegionSelector: false,
      showProvinceSelector: true,
      showSchoolSelector: false,
      searchKeyword: '',
      filteredSchools: [],
      areaSearchKeyword: '',
      filteredProvinces: []
    });
  },

  // 省份/地区/国家 搜索输入
  onAreaSearchInput(e) {
    const { value } = e.detail;
    this.setData({
      areaSearchKeyword: value
    });

    if (value.trim()) {
      const filtered = this.data.provinces.filter(item => item.includes(value.trim()));
      this.setData({
        filteredProvinces: filtered
      });
    } else {
      this.setData({
        filteredProvinces: []
      });
    }
  },

  // 清空 省份/地区/国家 搜索
  onClearAreaSearch() {
    this.setData({
      areaSearchKeyword: '',
      filteredProvinces: []
    });
  },

  // 搜索学校
  onSearchInput(e) {
    const { value } = e.detail;
    this.setData({
      searchKeyword: value
    });
    
    if (value.trim()) {
      const filtered = this.data.schools.filter(school => 
        school.includes(value.trim())
      );
      this.setData({
        filteredSchools: filtered
      });
    } else {
      this.setData({
        filteredSchools: []
      });
    }
  },

  // 选择学校
  onSelectSchool(e) {
    const { school } = e.currentTarget.dataset;
    
    // 如果是自定义模式，不选择现有学校，而是弹出输入框
    if (this.data.isCustomMode) {
      this.showCustomSchoolInput();
      return;
    }
    
    // 普通模式：选择现有学校
    const pages = getCurrentPages();
    const prevPage = pages[pages.length - 2];
    
    if (prevPage) {
      // 获取当前表单数据，只更新学校字段
      const currentFormData = prevPage.data.formData || {};
      const updatedFormData = {
        ...currentFormData,
        school: school
      };
      
      // 设置上一页的学校数据
      prevPage.setData({
        formData: updatedFormData
      }, () => {
        // 数据设置完成后再返回上一页
        console.log('学校数据已设置:', school);
        console.log('完整表单数据:', updatedFormData);

        // 选择现有学校时，清理用户记录中的自定义学校标记，避免审核页误显示“用户新增”
        try {
          const db = wx.cloud.database();
          const _ = db.command;
          const phoneNumber = wx.getStorageSync('phoneNumber');
          if (phoneNumber) {
            db.collection('users').where({ phoneNumber }).update({
              data: {
                customSchool: _.remove(),
                schoolRegion: _.remove(),
                schoolSubRegion: _.remove(),
                updateTime: db.serverDate()
              }
            }).then(() => {
              console.log('已清理自定义学校标记（因选择现有学校）');
            }).catch(err => {
              console.warn('清理自定义学校标记失败（不影响流程）:', err);
            });
          }
        } catch (e) {
          console.warn('清理自定义学校标记异常（不影响流程）:', e);
        }

        wx.navigateBack();
      });
    } else {
      // 如果没有上一页，直接返回
      wx.navigateBack();
    }
  },

  // 清空搜索
  onClearSearch() {
    this.setData({
      searchKeyword: '',
      filteredSchools: []
    });
  },

  // 显示自定义学校输入框
  showCustomSchoolInput() {
    wx.showModal({
      title: `添加${this.data.currentRegion}学校`,
      content: '',
      editable: true,
      placeholderText: '请输入您的学校全称',
      success: (modalRes) => {
        if (modalRes.confirm && modalRes.content) {
          const schoolName = modalRes.content.trim();
          if (schoolName) {
            // 保存自定义学校到数据库
            this.saveCustomSchool(this.data.currentRegion, this.data.currentProvince, schoolName);
            
            // 设置上一页的学校数据
            const pages = getCurrentPages();
            const prevPage = pages[pages.length - 2];
            
            if (prevPage) {
              // 获取当前表单数据，只更新学校字段
              const currentFormData = prevPage.data.formData || {};
              const updatedFormData = {
                ...currentFormData,
                school: schoolName
              };
              
              prevPage.setData({
                formData: updatedFormData
              }, () => {
                console.log('自定义学校数据已设置:', schoolName);
                console.log('完整表单数据:', updatedFormData);
                // 先显示提示信息
                wx.showToast({
                  title: '填写成功，若审核通过，会将学校加入学校列表中',
                  icon: 'none',
                  duration: 2000
                });
                // 延迟返回，确保用户能看到提示
                setTimeout(() => {
                  wx.navigateBack();
                }, 2000);
              });
            } else {
              wx.showToast({
                title: '填写成功，若审核通过，会将学校加入学校列表中',
                icon: 'none',
                duration: 2000
              });
              setTimeout(() => {
                wx.navigateBack();
              }, 2000);
            }
          } else {
            wx.showToast({
              title: '请输入有效的学校名称',
              icon: 'none'
            });
          }
        }
      }
    });
  },

  // 保存自定义学校到数据库
  async saveCustomSchool(region, subRegion, schoolName) {
    try {
      // 获取用户手机号（与校友认证页面保持一致）
      const phoneNumber = wx.getStorageSync('phoneNumber');
      
      if (!phoneNumber) {
        console.log('用户未登录，无法保存学校信息');
        return;
      }

      // 保存到云数据库（使用phoneNumber查询，与校友认证页面一致）
      const db = wx.cloud.database();
      await db.collection('users').where({
        phoneNumber: phoneNumber
      }).update({
        data: {
          customSchool: {
            region: region,           // 大区域：内地/港澳台/海外
            subRegion: subRegion,     // 具体地区：省份/地区/国家
            schoolName: schoolName,   // 学校全称
            isCustomInput: true,      // 标记为用户自定义输入
            createTime: new Date(),   // 创建时间
            status: 'pending'         // 待审核状态
          },
          updateTime: new Date()
        }
      });
      
      console.log('自定义学校信息已保存到数据库:', {
        phoneNumber,
        region,
        subRegion,
        schoolName
      });
    } catch (error) {
      console.error('保存自定义学校信息失败:', error);
      // 如果数据库保存失败，仍然允许用户继续填写表单
    }
  }
});
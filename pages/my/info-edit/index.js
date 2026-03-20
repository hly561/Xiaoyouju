import request from '../../../api/request.js';
import { areaList } from './areaData.js';

Page({
  data: {
    personInfo: {
      name: '',
      image: '',
    },

    gridConfig: {
      column: 3,
      width: 160,
      height: 160,
    },
  },

  onLoad() {
    this.getPersonalInfo();
  },

  async getPersonalInfo() {
    try {
      const db = wx.cloud.database();
      const phoneNumber = wx.getStorageSync('phoneNumber');
      
      if (!phoneNumber) {
        console.error('未找到手机号码');
        return;
      }

      const userResult = await db.collection('users').where({
        phoneNumber: phoneNumber
      }).get();
      
      if (!userResult.data || userResult.data.length === 0) {
        console.error('未找到用户信息');
        return;
      }

      const userInfo = userResult.data[0];
      this.setData({
        personInfo: {
          name: userInfo.name || '校友',
          image: userInfo.image
        }
      });
    } catch (error) {
      console.error('获取用户信息失败:', error);
      wx.showToast({
        title: '获取信息失败',
        icon: 'error',
        duration: 2000
      });
    }
  },
  async onChooseAvatar(e) {
    const { avatarUrl } = e.detail;
    
    console.log('选择的头像路径:', avatarUrl);
    
    // 显示上传提示
    wx.showLoading({
      title: '上传头像中...'
    });
    
    try {
      // 生成唯一的文件名
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substr(2, 9);
      const cloudPath = `avatars/${timestamp}_${randomStr}.jpg`;
      
      console.log('开始上传到云存储，路径:', cloudPath);
      
      // 上传到云存储
      const uploadResult = await wx.cloud.uploadFile({
        cloudPath: cloudPath,
        filePath: avatarUrl
      });
      
      console.log('头像上传成功:', uploadResult.fileID);
      
      // 更新头像为云存储文件ID
      this.setData({
        'personInfo.image': uploadResult.fileID,
      });
      
      wx.hideLoading();
      
      wx.showToast({
        title: '头像上传成功',
        icon: 'success'
      });
      
    } catch (error) {
      wx.hideLoading();
      console.error('头像上传失败:', error);
      
      wx.showToast({
        title: '头像上传失败',
        icon: 'none'
      });
      
      // 上传失败时仍然设置临时路径，但会在保存时提示用户重新选择
      this.setData({
        'personInfo.image': avatarUrl,
      });
    }
  },

  onNameChange(e) {
    const { value } = e.detail;
    this.setData({
      'personInfo.name': value,
    });
  },

  async onSaveInfo() {
    try {
      // 检查头像是否为微信临时文件
      if (this.data.personInfo.image && this.data.personInfo.image.startsWith('wxfile://')) {
        wx.showModal({
          title: '提示',
          content: '头像上传失败，请重新选择头像后再保存',
          showCancel: false,
          confirmText: '知道了'
        });
        return;
      }
      
      const db = wx.cloud.database();
      const phoneNumber = wx.getStorageSync('phoneNumber');
      
      if (!phoneNumber) {
        console.error('未找到手机号码');
        throw new Error('未找到手机号码');
      }

      console.log('开始更新用户信息:', {
        phoneNumber,
        name: this.data.personInfo.name,
        image: this.data.personInfo.image
      });
      
      // 先查询用户是否存在
      const userResult = await db.collection('users').where({
        phoneNumber: phoneNumber
      }).get();
      
      console.log('查询用户结果:', userResult);
      
      if (!userResult.data || userResult.data.length === 0) {
        console.error('未找到对应用户记录');
        throw new Error('未找到对应用户记录');
      }

      // 使用手机号查询并更新用户信息
      const updateResult = await db.collection('users').where({
        phoneNumber: phoneNumber
      }).update({
        data: {
          name: this.data.personInfo.name,
          image: this.data.personInfo.image,
          updateTime: db.serverDate()
        }
      });

      console.log('更新结果:', updateResult);
      
      // 验证更新是否成功
      if (!updateResult.stats || updateResult.stats.updated === 0) {
        console.error('更新操作未生效');
        throw new Error('更新操作未生效');
      }

      wx.showToast({
        title: '保存成功',
        icon: 'success',
        duration: 2000
      });

      // 返回上一页并刷新
      setTimeout(() => {
        wx.navigateBack();
      }, 2000);

    } catch (error) {
      console.error('更新用户信息失败:', error);
      wx.showToast({
        title: error.message || '保存失败，请重试',
        icon: 'error',
        duration: 2000
      });
    }
  },
});

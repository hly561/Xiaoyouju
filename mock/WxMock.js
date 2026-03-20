/* eslint-disable */
// 检查wx对象是否存在，避免在初始化阶段出错
if (typeof wx === 'undefined') {
  console.warn('WxMock: wx对象尚未初始化，跳过Mock设置');
  module.exports = {
    mock: function() {},
    _mocked: {}
  };
} else {
  var __request = wx.request;
  var Mock = require('./mock.js');
  
  // 安全地设置wx.request的可写属性
  try {
    Object.defineProperty(wx, 'request', { writable: true });
    wx.request = function (config) {
      if (typeof Mock._mocked[config.url] == 'undefined') {
        __request(config);
        return;
      }
      var resTemplate = Mock._mocked[config.url].template;
      var response = Mock.mock(resTemplate);
      if (typeof config.success == 'function') {
        config.success(response);
      }
      if (typeof config.complete == 'function') {
        config.complete(response);
      }
    };
  } catch (error) {
    console.error('WxMock: 设置wx.request失败', error);
  }
  
  module.exports = Mock;
}

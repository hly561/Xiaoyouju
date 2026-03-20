import Mock from './WxMock.js';
// 导入包含path和data的对象
import loginMock from './login/index.js';
import homeMock from './home/index.js';
import searchMock from './search/index.js';
import dataCenter from './dataCenter/index.js';
import my from './my/index.js';

export default () => {
  // 在这里添加新的mock数据
  const mockData = [...loginMock, ...homeMock, ...searchMock, ...dataCenter, ...my];
  mockData.forEach((item) => {
    Mock.mock(item.path, { code: 200, success: true, data: item.data });
  });
};

import config from '../config.js';
// 轻量本地Mock：直接使用项目内的数据模块，避免引入大型库
import homeMocks from '../mock/home/index.js';
import searchMocks from '../mock/search/index.js';
import dataCenterMocks from '../mock/dataCenter/index.js';
import myMocks from '../mock/my/index.js';

const { baseUrl } = config;
const LOCAL_MOCKS = [...homeMocks, ...searchMocks, ...dataCenterMocks, ...myMocks];
function getLocalMock(url) {
  return LOCAL_MOCKS.find((item) => item && item.path === url);
}
const delay = config.isMock ? 500 : 0;
function request(url, method = 'GET', data = {}) {
  const header = {
    'content-type': 'application/json',
    // 有其他content-type需求加点逻辑判断处理即可
  };
  // 获取token，有就丢进请求头
  const tokenString = wx.getStorageSync('access_token');
  if (tokenString) {
    header.Authorization = `Bearer ${tokenString}`;
  }
  return new Promise((resolve, reject) => {
    // 当未配置baseUrl时，使用本地Mock数据，避免网络请求失败导致“数据加载失败”
    if (!baseUrl) {
      const mock = getLocalMock(url);
      if (mock) {
        // 统一返回结构：与线上接口一致，外层data承载payload
        return resolve({ code: 200, data: mock.data });
      }
      // 未找到对应mock，明确提示
      return reject({ message: `未找到本地Mock：${url}`, url });
    }

    wx.request({
      url: baseUrl + url,
      method,
      data,
      dataType: 'json', // 微信官方文档中介绍会对数据进行一次JSON.parse
      header,
      success(res) {
        setTimeout(() => {
          // 兼容真实接口与Mock接口的返回结构
          // 真实接口：使用statusCode判断；返回形如{ code, data }
          if (res.statusCode === 200) {
            const payload = res.data;
            // 若后端直接返回payload对象，则包装成统一结构
            if (payload && typeof payload === 'object' && 'code' in payload && 'data' in payload) {
              resolve({ code: payload.code, data: payload.data });
            } else {
              resolve({ code: 200, data: payload });
            }
          } else {
            // wx.request的特性，只要有响应就会走success回调，所以在这里判断状态，非200的均视为请求失败
            reject(res);
          }
        }, delay);
      },
      fail(err) {
        setTimeout(() => {
          // 断网、服务器挂了都会fail回调，直接reject即可
          reject(err);
        }, delay);
      },
    });
  });
}

// 导出请求和服务地址
export default request;

/**
 * 权限测试脚本
 * 用于验证修复后的权限管理方法是否正常工作
 */

const locationPermissionManager = require('./utils/locationPermission');

// 测试1：验证checkAndRequestPermission返回Promise
async function testCheckAndRequestPermission() {
  console.log('=== 测试 checkAndRequestPermission ===');
  
  try {
    const result = await locationPermissionManager.checkAndRequestPermission({
      title: '测试权限',
      content: '这是一个测试'
    });
    
    console.log('✅ checkAndRequestPermission 返回结果:', result);
    console.log('✅ 返回类型:', typeof result);
    
    if (typeof result === 'boolean') {
      console.log('✅ 返回值类型正确');
    } else {
      console.error('❌ 返回值类型错误，期望 boolean，实际:', typeof result);
    }
    
  } catch (error) {
    console.error('❌ checkAndRequestPermission 测试失败:', error);
  }
}

// 测试2：验证diagnosePermissionStatus返回Promise
async function testDiagnosePermissionStatus() {
  console.log('=== 测试 diagnosePermissionStatus ===');
  
  try {
    const result = await locationPermissionManager.diagnosePermissionStatus();
    
    console.log('✅ diagnosePermissionStatus 返回结果:', result);
    console.log('✅ 返回类型:', typeof result);
    
    if (typeof result === 'object' && result !== null) {
      console.log('✅ 返回值类型正确');
      console.log('✅ 包含的字段:', Object.keys(result));
      
      // 检查必要字段
      const requiredFields = ['systemInfo', 'accountInfo', 'authSetting'];
      const missingFields = requiredFields.filter(field => !(field in result));
      
      if (missingFields.length === 0) {
        console.log('✅ 所有必要字段都存在');
      } else {
        console.warn('⚠️ 缺少字段:', missingFields);
      }
      
    } else {
      console.error('❌ 返回值类型错误，期望 object，实际:', typeof result);
    }
    
  } catch (error) {
    console.error('❌ diagnosePermissionStatus 测试失败:', error);
  }
}

// 测试3：验证旧的回调方式仍然有效
function testCallbackStyle() {
  console.log('=== 测试回调方式兼容性 ===');
  
  locationPermissionManager.checkAndRequestPermission({
    title: '回调测试',
    content: '测试回调方式',
    success: () => {
      console.log('✅ 回调方式 success 正常工作');
    },
    fail: (error) => {
      console.log('✅ 回调方式 fail 正常工作:', error.message);
    }
  }).then(result => {
    console.log('✅ Promise 方式也正常工作:', result);
  }).catch(error => {
    console.log('✅ Promise catch 也正常工作:', error.message);
  });
}

// 运行所有测试
async function runAllTests() {
  console.log('🚀 开始权限方法测试...\n');
  
  await testCheckAndRequestPermission();
  console.log('\n');
  
  await testDiagnosePermissionStatus();
  console.log('\n');
  
  testCallbackStyle();
  console.log('\n');
  
  console.log('🎉 所有测试完成！');
}

// 导出测试函数，可以在页面中调用
module.exports = {
  runAllTests,
  testCheckAndRequestPermission,
  testDiagnosePermissionStatus,
  testCallbackStyle
};

// 如果直接运行此文件，执行所有测试
if (typeof wx !== 'undefined') {
  // 在小程序环境中，可以手动调用测试
  console.log('在小程序中使用以下代码运行测试:');
  console.log('const test = require("./权限测试脚本"); test.runAllTests();');
}
# API更新说明

## 更新内容

### 1. 替换废弃的 wx.getSystemInfoSync() API

**问题**：`wx.getSystemInfoSync()` API 已被废弃

**解决方案**：使用新的 `wx.getSystemSetting()` API，并提供兼容性处理

### 2. 更新的文件

#### utils/locationPermission.js
- ✅ 添加 `getSystemInfo()` 方法，提供新旧API兼容
- ✅ 更新 `checkAndRequestPermission()` 方法
- ✅ 更新 `diagnosePermissionStatus()` 方法
- ✅ 增强权限诊断，添加系统级地理位置开关检查

#### 真机测试指南.md
- ✅ 更新代码示例，使用更规范的写法

### 3. 新API特性

#### wx.getSystemSetting() 支持的属性
- `bluetoothEnabled`: 蓝牙的系统开关
- `locationEnabled`: 地理位置的系统开关 ⭐
- `wifiEnabled`: Wi-Fi 的系统开关
- `deviceOrientation`: 设备方向

#### 兼容性处理
```javascript
getSystemInfo() {
  try {
    // 优先使用新的 wx.getSystemSetting() API (基础库 2.20.1+)
    if (wx.getSystemSetting) {
      const systemSetting = wx.getSystemSetting();
      const systemInfo = wx.getSystemInfoSync(); // 仍需要获取版本信息
      
      return {
        ...systemInfo,
        locationEnabled: systemSetting.locationEnabled,
        bluetoothEnabled: systemSetting.bluetoothEnabled,
        wifiEnabled: systemSetting.wifiEnabled,
        deviceOrientation: systemSetting.deviceOrientation
      };
    } else {
      // 降级使用旧的 wx.getSystemInfoSync() API
      console.warn('基础库版本较低，使用 wx.getSystemInfoSync()');
      return wx.getSystemInfoSync();
    }
  } catch (error) {
    console.error('获取系统信息失败:', error);
    // 最后的降级方案
    return wx.getSystemInfoSync();
  }
}
```

### 4. 增强的权限诊断

现在权限诊断会检查：
- ✅ 基础库版本
- ✅ 系统级地理位置开关状态
- ✅ 小程序权限设置
- ✅ 账号信息

**新增功能**：
- 如果系统级地理位置开关关闭，会在控制台显示警告
- 提供更详细的系统设置信息

**使用方式**：
```javascript
// 方式1：使用 async/await
async function checkPermissions() {
  try {
    const result = await LocationPermissionManager.diagnosePermissionStatus();
    console.log('诊断结果:', result);
  } catch (error) {
    console.error('诊断失败:', error);
  }
}

// 方式2：使用 Promise.then()
LocationPermissionManager.diagnosePermissionStatus()
  .then(result => {
    console.log('诊断结果:', result);
  })
  .catch(error => {
    console.error('诊断失败:', error);
  });
```

**返回结果**：
```javascript
{
  systemInfo: {...},           // 系统信息
  accountInfo: {...},          // 账号信息
  authSetting: {...},          // 所有权限设置
  fuzzyLocationPermission: true/false/undefined,  // 模糊定位权限
  preciseLocationPermission: true/false/undefined, // 精确定位权限
  systemLocationEnabled: true/false/undefined     // 系统级定位开关
}
```

### 5. 版本兼容性

- **基础库 2.20.1+**：使用新的 `wx.getSystemSetting()` API
- **基础库 < 2.20.1**：自动降级使用 `wx.getSystemInfoSync()`
- **错误处理**：如果新API调用失败，自动降级到旧API

### 6. 测试建议

1. **开发者工具测试**：验证兼容性处理是否正常
2. **真机测试**：验证新API功能是否正常
3. **低版本测试**：在低版本基础库上测试降级逻辑

### 7. 重要修复

#### 7.1 异步方法返回值修复
**问题**：`checkAndRequestPermission` 和 `diagnosePermissionStatus` 方法没有正确返回 Promise，导致调用者收到 `undefined`

**修复**：
- `checkAndRequestPermission` 现在正确返回 Promise<boolean>
- `diagnosePermissionStatus` 现在返回包含完整诊断信息的 Promise<object>
- 移除了重复的权限申请逻辑

**使用示例**：
```javascript
// ✅ 正确使用方式
const granted = await locationPermissionManager.checkAndRequestPermission({
  title: '定位权限',
  content: '需要获取位置信息'
});

if (granted) {
  // 权限申请成功，执行定位
  console.log('权限申请成功');
} else {
  // 权限申请失败
  console.log('权限申请失败');
}
```

### 8. 新增功能：登录后自动定位

#### 功能描述
用户登录成功后，系统会自动获取用户位置信息并保存到数据库，无需用户手动点击定位按钮。

#### 实现特点
1. **静默权限申请**：使用 `silent: true` 模式，不显示权限申请弹窗
2. **用户体验优化**：显示"正在获取位置..."的加载提示
3. **智能处理**：权限被拒绝时静默跳过，不影响登录流程
4. **成功反馈**：定位成功后显示"定位到XX市"的提示

#### 修改文件
- `pages/login/login.js`：添加自动定位逻辑
- `utils/locationPermission.js`：支持静默模式权限申请

#### 使用示例
```javascript
// 登录成功后自动调用
await this.autoGetLocationAfterLogin(userInfo);
```

### 9. 注意事项

- 新API主要提供系统级开关状态，不影响现有定位功能
- 保持了完全的向后兼容性
- 增强了权限诊断能力，便于问题排查
- 新API在基础库 2.20.1 及以上版本支持
- 低版本会自动降级使用旧API
- 建议在真机上测试新API功能
- 开发者工具可能无法完全模拟新API行为
- 避免重复申请权限，可能导致意外行为
- 自动定位功能采用静默模式，不会打断用户的登录流程
# 活动通知云函数

## 功能说明

这个云函数用于在活动组织者修改或删除活动时，自动向所有报名用户发送通知消息。

## 部署步骤

1. 在微信开发者工具中，右键点击 `cloudfunctions/sendNotification` 文件夹
2. 选择「上传并部署：云端安装依赖（不上传 node_modules）」
3. 等待部署完成

## 使用方法

### 参数说明

- `type`: 通知类型，可选值：
  - `'update'`: 活动更新通知
  - `'delete'`: 活动删除通知
- `activityId`: 活动ID
- `activityTitle`: 活动标题
- `message`: 自定义通知消息（可选）
- `operatorPhone`: 操作者手机号（用于过滤，避免给自己发消息）

### 调用示例

```javascript
const result = await wx.cloud.callFunction({
  name: 'sendNotification',
  data: {
    type: 'update',
    activityId: 'activity_id_here',
    activityTitle: '活动标题',
    message: '您报名的活动信息已更新',
    operatorPhone: '13800138000'
  }
});
```

### 返回值

```javascript
{
  success: true,
  message: '成功发送通知给 3 位用户',
  notifiedCount: 3,
  targetParticipants: ['13800138001', '13800138002', '13800138003']
}
```

## 数据库结构

### activities 集合

活动记录需要包含以下字段：
- `participants`: 数组，存储报名用户的手机号
- `title`: 活动标题

### messages 集合

消息记录包含以下字段：
- `phoneNumber`: 接收者手机号
- `title`: 消息标题
- `content`: 消息内容
- `type`: 消息类型（'activity_notification'）
- `activityId`: 关联的活动ID
- `activityTitle`: 活动标题
- `isRead`: 是否已读
- `createdAt`: 创建时间

## 注意事项

1. 确保云开发环境ID正确配置
2. 确保数据库权限设置正确
3. 操作者不会收到自己发送的通知
4. 如果活动没有报名用户，不会发送任何通知
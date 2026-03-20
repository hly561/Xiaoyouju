# sendRecommendation 云函数

## 功能描述

这个云函数用于在新活动发布时，自动向符合首页推荐栏显示条件的用户发送活动推荐通知。只要首页的"推荐"栏会显示该活动的用户，就会收到推荐通知。

## 部署方法

1. 在微信开发者工具中，右键点击 `cloudfunctions/sendRecommendation` 文件夹
2. 选择「上传并部署：云端安装依赖（不上传 node_modules）」
3. 等待部署完成

## 调用方法

```javascript
wx.cloud.callFunction({
  name: 'sendRecommendation',
  data: {
    activityId: 'activity_id_here',
    activityTitle: '活动标题',
    activityCity: '北京',
    activitySubCategory: '技术交流',
    publisherPhone: '13800138000'
  }
})
```

## 参数说明

- `activityId`: 活动ID
- `activityTitle`: 活动标题
- `activityCity`: 活动城市
- `activitySubCategory`: 活动子分类标签
- `publisherPhone`: 发布者手机号（用于过滤，避免给自己发消息）

## 返回值

成功时返回：
```javascript
{
  success: true,
  message: '成功发送推荐通知给 3 位用户',
  notifiedCount: 3,
  matchedUsers: ['13800138001', '13800138002', '13800138003']
}
```

失败时返回：
```javascript
{
  success: false,
  error: '错误信息'
}
```

## 匹配规则

基于首页推荐栏的显示逻辑：

1. **必须条件**：用户的 `subCategories` 包含活动的 `subCategory`（兴趣匹配）
2. **城市条件**：
   - 线上活动：不限制城市，所有有匹配兴趣的用户都会收到通知
   - 线下活动：用户的 `selectedCity` 必须与活动城市相同
   - 未选择城市的用户：只会收到线上活动的推荐通知
3. **排除条件**：
   - 排除活动发布者本人
   - 排除没有设置兴趣标签的用户

## 数据库操作

### users 集合

查询所有用户记录，筛选匹配条件的用户。

### messages 集合

为匹配的用户创建推荐消息记录，包含以下字段：

- `phoneNumber`: 用户手机号
- `title`: 消息标题（'活动推荐通知'）
- `content`: 消息内容
- `type`: 消息类型（'activity_recommendation'）
- `activityId`: 关联的活动ID
- `activityTitle`: 活动标题
- `isRead`: 是否已读（默认false）
- `createdAt`: 创建时间

## 注意事项

1. 确保云开发环境ID正确
2. 确保 users 和 messages 集合的读写权限配置正确
3. 如果没有匹配的用户，不会发送任何通知
4. 发布者不会收到自己发布活动的推荐通知
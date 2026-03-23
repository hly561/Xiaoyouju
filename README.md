# 项目 README（代码结构+如何部署和测试）

本项目是一套基于微信小程序 + 云开发（CloudBase/TCB）的活动与校友社区应用，包含活动发布与报名、校友认证与审核、消息通知、校友圈子等功能。UI 主要使用 TDesign 小程序组件。

## 技术栈

- 微信小程序（WXML/WXSS/JS）
- TDesign Miniprogram 组件库
- 腾讯云 CloudBase：云函数（SCF）、文档数据库、云存储
- 云开发客户端 SDK：`wx.cloud.database()`、`wx.cloud.callFunction`

## 运行与环境

- 小程序端云初始化在 `app.js`：
  ```js
  wx.cloud.init({ env: '<你的 envId>', traceUser: true })
  ```
- 云函数端统一初始化：
  ```js
  const cloud = require('wx-server-sdk');
  cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
  ```
- 新环境落地须知
  - 数据库需创建集合：`users`、`activities`、`messages`、`circles` 等（见下文“数据模型”）。
  - 云函数需在新环境逐个“上传并部署”。常见错误：
    - `-502005 database collection not exists`：当前环境缺集合
    - `-501000 FUNCTION_NOT_FOUND`：函数未在当前环境创建
    - `UpdateFunctionCode / CreateFailed`：函数首次创建失败，需删除后用最小入口重建

## 部署与测试

- 准备
  - 安装最新版微信开发者工具，登录对应账号并开通“云开发”。
- 切换小程序端环境为 test
  - 修改 [app.js](file:///Users/huzhen/WeChatProjects/miniprogram-7/app.js#L7-L10)：
    ```js
    wx.cloud.init({
      env: 'test-xxxxxxxxx', // 替换为你的环境为 test
      traceUser: true
    });
    ```
  - 右键cloudfunctions文件夹，切换当前环境为“test”
- 构建 npm（如启用了 TDesign npm）
  - 开发者工具 → 详情 → 本地设置：勾选“使用 npm 模块”
  - 工具 → 构建 NPM（输出目录为 `./miniprogram_npm`，已在 [project.config.json](file:///Users/huzhen/WeChatProjects/miniprogram-7/project.config.json#L30-L37) 指定）
- 部署云函数（必须执行）
  - 打开“云开发”面板，顶部环境下拉选择目标环境（如 test）。
  - 展开项目的 `cloudfunctions/` 目录，在列表中对“每一个云函数”右键选择“上传并部署（云端安装依赖）”。
  - 等待部署完成后状态为“已部署”。有 `package.json` 的函数会在云端自动安装依赖（建议保留 `package-lock.json` 以保证一致性）。
  - 若首次在新环境部署，建议先部署最小入口：`callback`、`echo`、`index`、`database`；成功后再部署业务函数（如 `sendNotification`、`sendRecommendation`、`registerActivity`、`reviewUser` 等）。
- 初始化数据库集合
  - 在 test 环境的数据库中创建集合：`users`、`activities`、`messages`、`circles`。
  - 可先执行最小写入校验：调用 `database` 云函数写入 `system_ping` 文档。
- 验证
  - 小程序端执行云函数调用示例：
    ```js
    wx.cloud.callFunction({ name: 'database', data: { action: 'ping' } })
      .then(() => wx.showToast({ title: 'cloud ok', icon: 'success' }))
      .catch(() => wx.showToast({ title: 'cloud failed', icon: 'none' }));
    ```
  - 进入“发布活动”“消息”等页面，观察 DB 读写是否在 test 环境产生数据。
- 常见问题
  - 报 `FUNCTION_NOT_FOUND`：函数未在 test 环境；确认面板环境选择为 test，并重新“上传并部署”。
  - 报 `collection not exists`：test 环境未建目标集合；到数据库创建集合后重试。
  - 构建 npm 失败：在项目根目录执行 `npm install`，确认网络源可用；在开发者工具中删除 `miniprogram_npm` 后重建。

## 目录结构（关键）

```
pages/
  home/                      首页 feed 与分享
  release/                   活动发布
    questionnaire/           报名问卷编辑
  activity-detail/           活动详情与问卷查看
  my/                        个人中心
    verify/                  校友认证提交
    circles/                 校友圈子（新建/管理/列表）
    organized-activities/    我发布的活动
    participated-activities/ 我参加的活动
  review/                    管理员审核中心
  school-selector/           学校选择（含黑龙江省等数据）
  chat/                      消息页

cloudfunctions/
  reviewUser/                审核学历（通过/拒绝，维护快照）
  registerActivity/          活动报名/取消报名（含问卷处理）
  sendNotification/          发送通知
  sendRecommendation/        推荐消息
  update*MessageStatus/      消息已读/全量更新
  getPhoneNumber/            获取手机号
  getOpenId/                 获取 OpenID
  ... 及若干最小入口函数（见下）
```

## 数据模型（核心集合）

- `users`
  - `phoneNumber: string`（主键字段之一）
  - `role: 'school_manager' | 'general_manager' | ''`
  - `manager_school: string | string[]`（校管理员管理的学校；支持多校）
  - `educations: Array<{ school, degree, major, graduationYear, status }>`
    - `status: 'pending' | 'approved' | 'unverified'`
  - `messageAllread: boolean`
  - 其他：头像 `image`、昵称 `name`、圈子选择 `circleSelectedSchool` 等
- `activities`
  - 基本信息：`title/description/type/timeRange/address/meetingLink/...`
  - `participants: string[]`（手机号）
  - 问卷：`questionnaire: { enabled, fields, needRealName, needPhoneNumber }`
  - 其他：`createdAt`、`images` 等
- `messages`
  - `phoneNumber: string`、`title: string`、`isRead: boolean`、`createdAt`
- `circles`
  - `ownerPhoneNumber: string`、`title`、`description`、`image(fileID)`、`school?`、`createdAt`

> 开发期可按上述字段最小化建表，后续再补充索引与安全规则。

## 功能模块说明

### 首页（pages/home）

- 展示活动列表，按 `createdAt`/其他条件排序
- 开启分享：支持会话与朋友圈（标题根据所选城市）

### 活动发布（pages/release）

- 支持报名问卷（在“报名问卷”入口编辑）
- 草稿机制：
  - 变更检测：进入页面时捕获快照，离开/返回时比较，仅在改动时弹“保存草稿”
  - 选择“不保存”：清空草稿
  - 发布成功：清空草稿
- 恢复草稿：进入页面自动加载 `users.releaseDraft`（若存在）
  - 草稿字段覆盖活动表单后，捕获新的初始快照

### 活动详情（pages/activity-detail）

- 展示报名信息与问卷详情
- 头像/图片通过 `wx.cloud.getTempFileURL` 批量换取临时 URL

### 校友认证提交（pages/my/verify）

- 用户提交多个学历条目，初始 `status: 'pending'`
- 支持上传证明材料

### 审核中心（pages/review）

- 角色入口：仅 `school_manager`/`general_manager` 可见
- 校管理员：
  - 支持多校：`manager_school` 可为数组；为空时回退到该账号已通过学历中的学校集合
  - 仅显示自己管理学校的待审条目
- 总管理员：
  - 可查看全部学校的待审条目
- “我管理的学校”：校管理员点击标题右侧图标可查看列表（多校展示）

### 校友圈子（pages/my/circles）

- 列表/搜索/按学校筛选（从 `users.educations[approved]` 推导学校）
- 新建圈子前置校验（与活动发布一致）：
  - 未登录 → 需登录
  - 有 `pending` 但无 `approved` → 提示审核中
  - 没有任何已通过认证 → 引导去认证页
- 上传二维码到云存储，文档写入 `circles` 集合
- 管理页分组显示与编辑

### 学校选择（pages/school-selector）

- 数据按省份分组，位于 `pages/school-selector/data/`
- 已补充黑龙江省若干院校及别名/学院项

## 云函数一览（当前目录）

- 核心业务
  - `reviewUser`：学历审核通过/拒绝，维护 `approvedEducationSnapshot`
  - `registerActivity`：报名/取消报名、问卷入库
  - `sendNotification`、`sendRecommendation`：消息发送
  - `updateUserMessageStatus` / `updateAllUsersMessageStatus` / `updateMessageStatus`：消息已读处理
  - `getPhoneNumber`、`getOpenId`：获取手机号/身份信息
- 快速校验与最小入口（便于新环境快速部署）
  - `callback`、`echo`、`index`、`openapi`、`login`
  - `database`（带一次轻量写入 `system_ping` 以验证 DB）
  - `clean-empty-phones`、`create-activity`、`quickstartFunctions`
  - `sendSMS`、`verifySMS`、`cleanExpiredSMS`（示例入口）

> 建议所有函数均使用 `cloud.DYNAMIC_CURRENT_ENV`；新环境首次部署推荐先用上述最小入口消除 `CreateFailed`，再替换为正式逻辑。

## 开发流程与约定

- 依赖构建
  - 若使用 TDesign npm 版本，请在开发者工具中“构建 npm”，并启用“使用 npm 模块”
- 安全规则（开发期）
  - 可临时放宽数据库读写，线上务必收紧（基于 `auth.openid`/`phoneNumber`）
- 图片访问
  - 统一通过 `wx.cloud.getTempFileURL` 批量换取临时 URL，减少多次调用
- 代码风格
  - 普通对象遍历避免使用 `Object.values`，小程序基础库可能不支持，推荐 `for...in` 并配合 `hasOwnProperty`

## 常见问题排查

- 报 `database collection not exists`
  - 当前环境缺集合；或小程序/云函数指向的 `envId` 与控制台不同
- 报 `FUNCTION_NOT_FOUND` / `FunctionName parameter could not be found`
  - 云函数未在当前环境创建成功（可能 `CreateFailed`）；删除后用最小入口重建
- 首次创建函数 `CreateFailed`
  - 入口/导出缺失、依赖安装超时、包体过大或服务授权未完成

## 快速参考

- 首页分享：\[pages/home/index.js]
- 活动发布草稿与比较快照：\[pages/release/index.js]
- 审核中心多校逻辑与“我管理的学校”弹层：\[pages/review/index.{js,wxml,wxss}]
- 新建圈子认证拦截：\[pages/my/circles/index.js]

> 如需进一步的部署脚本、数据库索引建议或安全规则模板，可在交接后按具体业务再细化完善。


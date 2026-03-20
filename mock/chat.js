/** 模拟网络请求的延迟 */
function delay(ms = 500) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// 模拟聊天数据
const mockData = [
  {
    userId: 1,
    name: 'Sean',
    avatar: '/static/chat/avatar-Sean.png',
    messages: [
      { messageId: 1, from: 1, content: '那明天准时见哦😊', time: 1690646400000, read: true },
      { messageId: 2, from: 0, content: '好的，我会记得的', time: 1690646400000, read: true },
      { messageId: 3, from: 1, content: '在吗？', time: Date.now() - 3600000, read: false },
      {
        messageId: 4,
        from: 1,
        content: '有个问题想咨询一下，关于TDesign组件库如何更好地使用',
        time: Date.now() - 3600000,
        read: false,
      },
    ],
  },
  {
    userId: 2,
    name: 'Mollymolly',
    avatar: '/static/chat/avatar-Mollymolly.png',
    messages: [{ messageId: 5, from: 1, content: '好久不见，最近咋样？', time: 1692100800000, read: true }],
  },
  {
    userId: 3,
    name: 'Andrew',
    avatar: '/static/chat/avatar-Andrew.png',
    messages: [{ messageId: 6, from: 0, content: '现在没空，晚点再联系你哈', time: 1690084800000, read: true }],
  },
  {
    userId: 4,
    name: 'Kingdom',
    avatar: '/static/chat/avatar-Kingdom.png',
    messages: [{ messageId: 7, from: 1, content: '真的吗？', time: 1656880200000, read: true }],
  },
  {
    userId: 5,
    name: 'Paige',
    avatar: '/static/chat/avatar-Paige.png',
    messages: [
      { messageId: 8, from: 1, content: '此次要评审的首页和专区页改版的交互方案', time: 1652963880000, read: true },
    ],
  },
];

// 模拟新增一条消息
async function addNewMessage(userId, from, content) {
  const index = mockData.map((item) => item.userId).indexOf(userId);
  const user = mockData.splice(index, 1)[0];
  mockData.unshift(user);
  let messageId = 0;
  mockData.forEach((item) => {
    messageId += item.messages.length;
  });
  const message = { messageId, from, content, time: Date.now(), read: from === 0 };
  user.messages.push(message);

  // 如果是对方发送的消息(from === 1)，也保存到云数据库
  if (from === 1) {
    try {
      // 获取当前用户手机号
      const phoneNumber = wx.getStorageSync('phoneNumber');
      const userInfo = wx.getStorageSync('userInfo');
      const openid = userInfo ? userInfo.openid : '';
      
      if (phoneNumber || openid) {
        const db = wx.cloud.database();
        const messageData = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          userId: phoneNumber || openid, // 接收方的手机号或openid
          phoneNumber: phoneNumber, // 明确保存接收方手机号
          openid: openid, // 保存接收方openid
          targetUserId: userId, // 消息发送方
          type: 'user',
          name: user.name,
          avatar: user.avatar,
          content: content,
          lastMessage: content,
          isRead: false,
          createdAt: new Date()
        };
        
        await db.collection('messages').add({
          data: messageData
        });
        
        // 更新接收消息用户的messageAllread状态
        try {
          await wx.cloud.callFunction({
            name: 'updateAllUsersMessageStatus',
            data: {
              phoneNumbers: [phoneNumber]
            }
          });
          console.log('更新接收消息用户messageAllread状态成功');
        } catch (updateError) {
          console.error('更新接收消息用户messageAllread状态失败:', updateError);
        }

      }
    } catch (error) {
      console.error('保存对方消息到数据库失败:', error);
    }
  }

  return message;
}

/** 模拟SocketTask */
class MockSocketTask {
  constructor(url) {
    this.url = url;
    this.onopen = () => {};
    this.onmessage = () => {};
    this.onclose = () => {};
    delay(1000).then(() => {
      this.onopen();
    });
  }

  onOpen(callback) {
    if (typeof callback === 'function') this.onopen = callback;
  }

  onMessage(callback) {
    if (typeof callback === 'function') this.onmessage = callback;
  }

  send(data) {
    data = JSON.parse(data);
    if (data.type === 'message') {
      const { userId, content } = data.data;
      delay().then(async () => {
        const message = await addNewMessage(userId, 0, content);
        this.onmessage(JSON.stringify({ type: 'message', data: { userId, message } }));
      });
      // 模拟3秒后对方回复消息
      delay(3000).then(async () => {
        const message = await addNewMessage(userId, 1, ['收到', '好的', '知道了', '👌OK'].at(Math.floor(Math.random() * 4)));
        this.onmessage(JSON.stringify({ type: 'message', data: { userId, message } }));
      });
    }
  }
}

/** 连接WebSocket，返回SocketTask对象 */
export function connectSocket() {
  // return wx.connectSocket({ url: 'url' })
  return new MockSocketTask('ws://localhost:8080');
}

/** 获取未读消息数量 */
export async function fetchUnreadNum() {
  try {
    // 获取当前用户手机号
    const phoneNumber = wx.getStorageSync('phoneNumber');
    if (!phoneNumber) {
      return { code: 200, data: 0 };
    }
    
    // 查询数据库中未读消息数量
    const db = wx.cloud.database();
    const result = await db.collection('messages')
      .where({
        phoneNumber: phoneNumber,
        isRead: false
      })
      .count();
    
    console.log('查询未读消息数量:', result.total);
    return { code: 200, data: result.total };
  } catch (error) {
    console.error('获取未读消息数量失败:', error);
    // 出错时返回0，避免影响应用正常运行
    return { code: 200, data: 0 };
  }
}

/** 获取完整消息列表 */
export function fetchMessageList() {
  return delay().then(() => ({ code: 200, data: JSON.parse(JSON.stringify(mockData)) }));
}

/** 将某个用户的所有消息标记为已读 */
export function markMessagesRead(userId) {
  let index = 0;
  while (index < mockData.length) {
    const user = mockData[index];
    if (user.userId === userId) {
      user.messages.forEach((message) => {
        message.read = true;
      });
      break;
    }
    index += 1;
  }
}

const formatNumber = (n) => {
  n = n.toString();
  return n[1] ? n : `0${n}`;
};

const formatTime = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const second = date.getSeconds();

  return `${[year, month, day].map(formatNumber).join('/')} ${[hour, minute, second].map(formatNumber).join(':')}`;
};

// 复制到本地临时路径，方便预览
const getLocalUrl = (path, name) => {
  try {
    const fs = wx.getFileSystemManager();
    const tempFileName = `${wx.env.USER_DATA_PATH}/${name}`;
    fs.copyFileSync(path, tempFileName);
    return tempFileName;
  } catch (error) {
    console.warn('getLocalUrl failed:', error);
    // 如果复制失败，直接返回原路径
    return path;
  }
};

module.exports = {
  formatTime,
  getLocalUrl,
};

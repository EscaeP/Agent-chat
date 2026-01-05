const fs = require('fs');
const path = require('path');

// 用户数据存储目录
const USER_DATA_DIR = path.join(__dirname, '../user');

// 确保用户数据目录存在
if (!fs.existsSync(USER_DATA_DIR)) {
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });
}

/**
 * 用户偏好管理类
 */
class UserPreferencesManager {
  constructor() {
    this.users = new Map();
    this.loadAllUsers();
  }

  /**
   * 加载所有用户数据
   */
  loadAllUsers() {
    try {
      const files = fs.readdirSync(USER_DATA_DIR);
      for (const file of files) {
        if (file.endsWith('.json')) {
          const userId = file.replace('.json', '');
          this.loadUser(userId);
        }
      }
    } catch (error) {
      console.error('加载用户数据失败:', error);
    }
  }

  /**
   * 加载单个用户数据
   * @param {string} userId - 用户ID
   */
  loadUser(userId) {
    try {
      const filePath = path.join(USER_DATA_DIR, `${userId}.json`);
      if (fs.existsSync(filePath)) {
        const userData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        this.users.set(userId, userData);
      } else {
        // 创建新用户数据
        this.users.set(userId, {
          userId,
          preferences: {},
          chatHistory: []
        });
        this.saveUser(userId);
      }
    } catch (error) {
      console.error(`加载用户 ${userId} 数据失败:`, error);
    }
  }

  /**
   * 保存用户数据
   * @param {string} userId - 用户ID
   */
  saveUser(userId) {
    try {
      const userData = this.users.get(userId);
      if (userData) {
        const filePath = path.join(USER_DATA_DIR, `${userId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(userData, null, 2), 'utf8');
      }
    } catch (error) {
      console.error(`保存用户 ${userId} 数据失败:`, error);
    }
  }

  /**
   * 保存聊天消息
   * @param {string} userId - 用户ID
   * @param {Object} message - 聊天消息
   */
  saveChatMessage(userId, message) {
    try {
      if (!this.users.has(userId)) {
        this.loadUser(userId);
      }

      const userData = this.users.get(userId);
      const chatMessage = {
        ...message,
        timestamp: new Date().toISOString()
      };

      // 保存消息到聊天历史
      userData.chatHistory.push(chatMessage);

      // 限制聊天历史长度，最多保存1000条
      if (userData.chatHistory.length > 1000) {
        userData.chatHistory = userData.chatHistory.slice(-1000);
      }

      // 保存用户数据
      this.saveUser(userId);

      // 从聊天中学习用户偏好
      this.learnFromChat(userId, message);
    } catch (error) {
      console.error(`保存聊天消息失败:`, error);
    }
  }

  /**
   * 从聊天中学习用户偏好
   * @param {string} userId - 用户ID
   * @param {Object} message - 聊天消息
   */
  learnFromChat(userId, message) {
    try {
      if (!this.users.has(userId)) {
        this.loadUser(userId);
      }

      const userData = this.users.get(userId);
      const content = message.content || '';

      // 只处理用户消息
      if (message.role !== 'user') {
        return;
      }

      // 提取用户偏好（简单示例）
      const preferences = this.extractPreferencesFromChat(content);
      
      // 更新用户偏好
      if (preferences) {
        userData.preferences = {
          ...userData.preferences,
          ...preferences
        };
        this.saveUser(userId);
      }
    } catch (error) {
      console.error(`从聊天中学习偏好失败:`, error);
    }
  }

  /**
   * 从聊天内容中提取用户偏好
   * @param {string} content - 聊天内容
   * @returns {Object} 提取的用户偏好
   */
  extractPreferencesFromChat(content) {
    const preferences = {};

    // 简单的偏好提取规则（示例）
    const regexRules = {
      // 提取喜欢的颜色
      favoriteColor: /(喜欢|偏好|喜欢的颜色是?|偏好的颜色是?)\s*(\w+)/i,
      // 提取喜欢的食物
      favoriteFood: /(喜欢吃|爱吃|喜欢的食物|偏好的食物)\s*(\w+)/i,
      // 提取喜欢的运动
      favoriteSport: /(喜欢|偏好|喜欢的运动是?|偏好的运动是?)\s*(\w+)/i,
      // 提取语言偏好
      language: /(使用|说|用|偏好)\s*(中文|英文|英语|Chinese|English)/i,
      // 提取时间格式偏好
      timeFormat: /(时间格式|喜欢的时间格式)\s*(24小时制|12小时制|24h|12h)/i,
      // 提取温度单位偏好
      temperatureUnit: /(温度|气温|温度单位|气温单位)\s*(摄氏度|华氏度|°C|°F)/i,
      // 提取货币单位偏好
      currencyUnit: /(货币|钱|货币单位)\s*(人民币|美元|欧元|CNY|USD|EUR)/i,
      // 提取长度单位偏好
      lengthUnit: /(长度|距离|长度单位|距离单位)\s*(米|英尺|英寸|m|ft|in)/i
    };

    // 应用所有正则规则提取偏好
    for (const [key, regex] of Object.entries(regexRules)) {
      const match = content.match(regex);
      if (match && match[2]) {
        preferences[key] = match[2];
      }
    }

    return Object.keys(preferences).length > 0 ? preferences : null;
  }

  /**
   * 获取用户偏好
   * @param {string} userId - 用户ID
   * @returns {Object} 用户偏好
   */
  getPreferences(userId) {
    if (!this.users.has(userId)) {
      this.loadUser(userId);
    }

    return this.users.get(userId).preferences || {};
  }

  /**
   * 获取用户聊天历史
   * @param {string} userId - 用户ID
   * @param {number} limit - 返回的消息数量限制
   * @returns {Array} 用户聊天历史
   */
  getChatHistory(userId, limit = 100) {
    if (!this.users.has(userId)) {
      this.loadUser(userId);
    }

    const userData = this.users.get(userId);
    if (limit > 0) {
      return userData.chatHistory.slice(-limit);
    }
    return userData.chatHistory;
  }

  /**
   * 更新用户偏好
   * @param {string} userId - 用户ID
   * @param {Object} preferences - 要更新的用户偏好
   */
  updatePreferences(userId, preferences) {
    if (!this.users.has(userId)) {
      this.loadUser(userId);
    }

    const userData = this.users.get(userId);
    userData.preferences = {
      ...userData.preferences,
      ...preferences
    };
    this.saveUser(userId);
  }

  /**
   * 删除用户
   * @param {string} userId - 用户ID
   */
  deleteUser(userId) {
    try {
      this.users.delete(userId);
      const filePath = path.join(USER_DATA_DIR, `${userId}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      console.error(`删除用户 ${userId} 失败:`, error);
    }
  }

  /**
   * 获取所有用户ID
   * @returns {Array} 所有用户ID列表
   */
  getAllUserIds() {
    try {
      const files = fs.readdirSync(USER_DATA_DIR);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
    } catch (error) {
      console.error('获取所有用户ID失败:', error);
      return [];
    }
  }
}

// 导出单例实例
module.exports = new UserPreferencesManager();

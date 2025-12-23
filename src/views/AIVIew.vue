<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { ChatDotRound, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

// 对话消息列表
const messages = ref([
  {
    id: 1,
    role: 'assistant',
    content: '你好！我是你的AI助手，有什么可以帮助你的吗？',
    timestamp: new Date().toLocaleString()
  }
])

// 输入框内容
const inputMessage = ref('')

// 对话区域引用
const chatContainer = ref(null)

// 是否正在生成回复
const isGenerating = ref(false)

// 滚动到底部
const scrollToBottom = () => {
  nextTick(() => {
    if (chatContainer.value) {
      chatContainer.value.scrollTop = chatContainer.value.scrollHeight
    }
  })
}

// 发送消息
const sendMessage = async () => {
  if (!inputMessage.value.trim() || isGenerating.value) {
    return
  }

  // 添加用户消息
  const userMessage = {
    id: Date.now(),
    role: 'user',
    content: inputMessage.value.trim(),
    timestamp: new Date().toLocaleString()
  }
  messages.value.push(userMessage)

  // 清空输入框
  inputMessage.value = ''

  // 开始生成回复
  isGenerating.value = true

  try {
    // 转换消息格式为OpenAI API所需的格式
    const apiMessages = messages.value.map(msg => ({
      role: msg.role,
      content: msg.content
    }))

    // 调用后端API
    const response = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ 
        messages: apiMessages
      })
    })

    if (!response.ok) {
      throw new Error('API请求失败')
    }

    // 处理流式响应
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let aiReply = {
      id: Date.now() + 1,
      role: 'assistant',
      content: '',
      timestamp: new Date().toLocaleString()
    }
    messages.value.push(aiReply)
    
    // 隐藏正在输入指示器
    isGenerating.value = false

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()
          if (data === '[DONE]') break

          try {
            const json = JSON.parse(data)
            if (json.error) {
              throw new Error(json.error)
            }
            if (json.choices && json.choices.length > 0) {
              const delta = json.choices[0].delta
              const content = delta?.content || ''
              if (content) {
                // 更新AI回复内容
                aiReply.content += content
                // 强制更新视图
                messages.value = [...messages.value]
                scrollToBottom()
              }
            }
          } catch (jsonError) {
            console.error('解析JSON错误:', jsonError)
            // 发送错误通知
            ElMessage.error(`流式响应解析错误: ${jsonError.message}`)
          }
        }
      }
    }
  } catch (error) {
    console.error('Error:', error)
    ElMessage.error('获取AI回复失败，请稍后重试')
  } finally {
    isGenerating.value = false
    scrollToBottom()
  }
}

// 组件挂载后滚动到底部
onMounted(() => {
  scrollToBottom()
})
</script>

<template>
  <div class="chat-container">
    <!-- 聊天区域 -->
    <div class="chat-messages" ref="chatContainer">
      <div
        v-for="(message, index) in messages"
        :key="index"
        :class="[
          'message-item',
          message.role === 'assistant' ? 'ai-message' : 'user-message'
        ]"
      >
        <div class="message-content">{{ message.content }}</div>
      </div>
      
      <!-- 正在输入指示器 -->
      <div v-if="isGenerating" class="message-item ai-message">
        <div class="message-content generating">
          <div class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
          </div>
          <span class="typing-text">正在思考...</span>
        </div>
      </div>
    </div>


    
    <!-- 输入区域 -->
    <div class="input-area">
      <el-input
        v-model="inputMessage"
        placeholder="请输入消息..."
        @keyup.enter="sendMessage"
        :disabled="isGenerating"
        type="textarea"
        :rows="3"
        resize="none"
      />
      <el-button
        type="primary"
        @click="sendMessage"
        :disabled="isGenerating || !inputMessage.trim()"
        :icon="isGenerating ? Refresh : ChatDotRound"
        :loading="isGenerating"
      >
        {{ isGenerating ? '生成中...' : '发送' }}
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #f5f5f5;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  background-color: #fafafa;
}

.message-item {
  margin-bottom: 20px;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 正在输入指示器样式 */
.generating {
  display: flex;
  align-items: center;
  gap: 12px;
}

.typing-indicator {
  display: flex;
  gap: 4px;
  padding-top: 2px;
}

.typing-dot {
  width: 8px;
  height: 8px;
  background-color: #0284c7;
  border-radius: 50%;
  animation: typing 1.4s infinite ease-in-out;
}

.typing-dot:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-dot:nth-child(3) {
  animation-delay: 0.4s;
}

.typing-text {
  color: #666;
  font-style: italic;
}

@keyframes typing {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.5;
  }
  30% {
    transform: translateY(-10px);
    opacity: 1;
  }
}

.ai-message {
  justify-content: flex-start;
}

.user-message {
  justify-content: flex-end;
}

.message-content {
  max-width: 70%;
  padding: 14px 18px;
  border-radius: 18px;
  font-size: 15px;
  line-height: 1.5;
  word-wrap: break-word;
}

.ai-message .message-content {
  background-color: #fff;
  border: 1px solid #e8e8e8;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.user-message .message-content {
  background-color: #0284c7;
  color: white;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}



.input-area {
  padding: 20px;
  background-color: #fff;
  border-top: 1px solid #e8e8e8;
}

.input-area :deep(.el-textarea__inner) {
  border-radius: 12px;
  border-color: #e8e8e8;
  resize: none;
  font-size: 15px;
}

.input-area :deep(.el-button) {
  margin-top: 12px;
  border-radius: 12px;
  padding: 8px 24px;
  font-size: 15px;
  background-color: #0284c7;
  border: none;
}

.input-area :deep(.el-button:hover) {
  background-color: #0ea5e9;
}

.input-area :deep(.el-button.is-disabled) {
  background-color: #93c5fd;
  cursor: not-allowed;
}
</style>
<script setup>
import { ref, onMounted, nextTick } from 'vue'
import { ChatDotRound, Refresh } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { marked } from 'marked'
import hljs from 'highlight.js'
import 'highlight.js/styles/github-dark.css'
import katex from 'katex'
import 'katex/dist/katex.min.css'

// 对话消息列表
const messages = ref([
  {
    id: 1,
    role: 'assistant',
    content: '你好！我是你的AI Agent助手，我可以使用工具来帮助你完成任务。我可以进行计算、搜索、文本处理等操作。有什么可以帮助你的吗？',
    timestamp: new Date().toLocaleString()
  }
])

// 输入框内容
const inputMessage = ref('')

// 对话区域引用
const chatContainer = ref(null)

// 是否正在生成回复
const isGenerating = ref(false)

// 配置 marked 以支持代码高亮
marked.setOptions({
  highlight: function(code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(code, { language: lang }).value
      } catch (err) {
        console.error('代码高亮错误:', err)
      }
    }
    return hljs.highlightAuto(code).value
  },
  breaks: true, // 支持换行
  gfm: true // GitHub 风格的 Markdown
})

// 渲染 Markdown 为 HTML，并处理数学公式
const renderMarkdown = (content) => {
  if (!content) return ''
  try {
    // 先渲染 Markdown
    let html = marked.parse(content)
    
    // 处理块级数学公式 $$...$$
    // 先处理包裹在 <p> 标签中的
    html = html.replace(/<p>\$\$([\s\S]*?)\$\$<\/p>/g, (match, formula) => {
      try {
        return `<div class="katex-display-wrapper">${katex.renderToString(formula.trim(), { 
          displayMode: true, 
          throwOnError: false 
        })}</div>`
      } catch (e) {
        return match
      }
    })
    
    // 再处理独立的块级公式（不在 <p> 标签中，也不在已处理的 div 中）
    html = html.replace(/\$\$([\s\S]*?)\$\$/g, (match, formula) => {
      // 如果已经在 div 中（已被处理），跳过
      if (match.includes('katex-display-wrapper')) return match
      try {
        return `<div class="katex-display-wrapper">${katex.renderToString(formula.trim(), { 
          displayMode: true, 
          throwOnError: false 
        })}</div>`
      } catch (e) {
        return match
      }
    })
    
    // 处理行内数学公式 $...$
    // 使用一个函数来避免匹配代码块和已处理的公式
    html = html.replace(/\$([^$\n]+?)\$/g, (match, formula, offset, string) => {
      // 检查是否在代码块中
      const beforeMatch = string.substring(0, offset)
      const afterMatch = string.substring(offset + match.length)
      
      // 检查是否在 <code> 或 <pre> 标签中
      const codeBefore = beforeMatch.lastIndexOf('<code>')
      const codeAfter = beforeMatch.lastIndexOf('</code>')
      const preBefore = beforeMatch.lastIndexOf('<pre>')
      const preAfter = beforeMatch.lastIndexOf('</pre>')
      
      if ((codeBefore > codeAfter) || (preBefore > preAfter)) {
        return match // 在代码块中，不处理
      }
      
      // 检查是否已经被处理过（在 katex 标签中）
      if (beforeMatch.includes('katex') && afterMatch.includes('</span>')) {
        return match // 已经被处理
      }
      
      try {
        return katex.renderToString(formula.trim(), { 
          displayMode: false, 
          throwOnError: false 
        })
      } catch (e) {
        return match
      }
    })
    
    return html
  } catch (error) {
    console.error('Markdown 渲染错误:', error)
    return content
  }
}

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
    // 过滤掉前端显示用的 tool_call 消息，只发送标准角色（user, assistant, system, tool）
    const apiMessages = messages.value
      .filter(msg => {
        // 只保留 API 支持的角色：user, assistant, system, tool
        const validRoles = ['user', 'assistant', 'system', 'tool'];
        return validRoles.includes(msg.role);
      })
      .map(msg => ({
        role: msg.role,
        content: msg.content,
        // 如果是 assistant 消息且有 tool_calls，需要包含
        ...(msg.role === 'assistant' && msg.toolCalls ? { tool_calls: msg.toolCalls } : {}),
        // 如果是 tool 消息，需要包含 tool_call_id 和 name
        ...(msg.role === 'tool' ? {
          tool_call_id: msg.tool_call_id,
          name: msg.name
        } : {})
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
      timestamp: new Date().toLocaleString(),
      toolCalls: []
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
            
            // 处理错误响应
            if (json.error) {
              const errorMessage = typeof json.error === 'string' 
                ? json.error 
                : json.error.message || '未知错误';
              const errorCode = json.error.code || 'UNKNOWN';
              
              console.error('API 错误:', errorCode, errorMessage);
              ElMessage.error(`API 错误 (${errorCode}): ${errorMessage}`);
              
              // 更新 AI 回复显示错误
              if (aiReply) {
                aiReply.content = `错误: ${errorMessage}`;
                messages.value = [...messages.value];
              }
              break;
            }
            
            // 处理工具调用消息（不显示给用户，只在后台处理）
            if (json.type === 'tool_call') {
              // 不添加工具调用消息到界面，只在控制台记录
              console.log('工具调用:', json.tool_name, json.tool_args);
              continue
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
              
              // 处理工具调用
              if (delta?.tool_calls) {
                for (const toolCall of delta.tool_calls) {
                  const index = toolCall.index || 0
                  if (!aiReply.toolCalls[index]) {
                    aiReply.toolCalls[index] = {
                      id: toolCall.id,
                      type: toolCall.type,
                      function: {
                        name: '',
                        arguments: ''
                      }
                    }
                  }
                  if (toolCall.function?.name) {
                    aiReply.toolCalls[index].function.name = toolCall.function.name
                  }
                  if (toolCall.function?.arguments) {
                    aiReply.toolCalls[index].function.arguments += toolCall.function.arguments
                  }
                }
                // 更新视图以显示工具调用
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
        :key="message.id || index"
        :class="[
          'message-item',
          message.role === 'assistant' ? 'ai-message' : 
          message.role === 'tool_call' ? 'tool-call-message' : 
          'user-message'
        ]"
      >
        <!-- 普通消息 -->
        <div v-if="message.role !== 'tool_call'" class="message-content">
          <div 
            v-if="message.content" 
            class="markdown-body"
            v-html="renderMarkdown(message.content)"
          ></div>
          <!-- 隐藏工具调用信息，不显示给用户 -->
        </div>
        
        <!-- 工具调用消息已隐藏，不显示给用户 -->
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

/* 工具调用消息样式 */
.tool-call-message {
  justify-content: flex-start;
}

.tool-call-content {
  max-width: 70%;
  padding: 14px 18px;
  border-radius: 18px;
  background-color: #f0f9ff;
  border: 1px solid #bae6fd;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.tool-call-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  font-weight: 600;
  color: #0369a1;
}

.tool-icon {
  font-size: 18px;
}

.tool-call-details {
  font-size: 13px;
  color: #0c4a6e;
}

.tool-args,
.tool-result {
  margin-top: 10px;
}

.tool-args pre,
.tool-result pre {
  margin-top: 6px;
  padding: 8px;
  background-color: #fff;
  border-radius: 6px;
  border: 1px solid #e0f2fe;
  font-size: 12px;
  overflow-x: auto;
  max-height: 200px;
  overflow-y: auto;
}

.tool-calls-info {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #e0f2fe;
}

.tool-call-badge {
  display: inline-block;
  padding: 4px 10px;
  background-color: #0284c7;
  color: white;
  border-radius: 12px;
  font-size: 12px;
  margin-bottom: 8px;
}

.tool-call-item {
  margin-top: 6px;
  padding: 6px 10px;
  background-color: #e0f2fe;
  border-radius: 6px;
  font-size: 13px;
}

.tool-name {
  color: #0369a1;
  font-weight: 500;
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

/* Markdown 样式 */
.markdown-body {
  line-height: 1.6;
  color: #333;
}

.markdown-body :deep(h1),
.markdown-body :deep(h2),
.markdown-body :deep(h3),
.markdown-body :deep(h4),
.markdown-body :deep(h5),
.markdown-body :deep(h6) {
  margin-top: 24px;
  margin-bottom: 16px;
  font-weight: 600;
  line-height: 1.25;
}

.markdown-body :deep(h1) {
  font-size: 2em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}

.markdown-body :deep(h2) {
  font-size: 1.5em;
  border-bottom: 1px solid #eaecef;
  padding-bottom: 0.3em;
}

.markdown-body :deep(h3) {
  font-size: 1.25em;
}

.markdown-body :deep(p) {
  margin-bottom: 16px;
}

.markdown-body :deep(ul),
.markdown-body :deep(ol) {
  margin-bottom: 16px;
  padding-left: 2em;
}

.markdown-body :deep(li) {
  margin-bottom: 0.25em;
}

.markdown-body :deep(blockquote) {
  padding: 0 1em;
  color: #6a737d;
  border-left: 0.25em solid #dfe2e5;
  margin-bottom: 16px;
}

.markdown-body :deep(code) {
  padding: 0.2em 0.4em;
  margin: 0;
  font-size: 85%;
  background-color: rgba(27, 31, 35, 0.05);
  border-radius: 3px;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
}

.markdown-body :deep(pre) {
  padding: 16px;
  overflow: auto;
  font-size: 85%;
  line-height: 1.45;
  background-color: #1e1e1e;
  border-radius: 6px;
  margin-bottom: 16px;
}

.markdown-body :deep(pre code) {
  display: inline;
  max-width: auto;
  padding: 0;
  margin: 0;
  overflow: visible;
  line-height: inherit;
  word-wrap: normal;
  background-color: transparent;
  border: 0;
  color: #d4d4d4;
}

.markdown-body :deep(pre code::before),
.markdown-body :deep(pre code::after) {
  content: none;
}

.markdown-body :deep(table) {
  border-spacing: 0;
  border-collapse: collapse;
  margin-bottom: 16px;
  width: 100%;
}

.markdown-body :deep(table th),
.markdown-body :deep(table td) {
  padding: 6px 13px;
  border: 1px solid #dfe2e5;
}

.markdown-body :deep(table th) {
  font-weight: 600;
  background-color: #f6f8fa;
}

.markdown-body :deep(table tr) {
  background-color: #fff;
  border-top: 1px solid #c6cbd1;
}

.markdown-body :deep(table tr:nth-child(2n)) {
  background-color: #f6f8fa;
}

.markdown-body :deep(hr) {
  height: 0.25em;
  padding: 0;
  margin: 24px 0;
  background-color: #e1e4e8;
  border: 0;
}

/* KaTeX 数学公式样式 */
.markdown-body :deep(.katex) {
  font-size: 1.1em;
}

.markdown-body :deep(.katex-display) {
  margin: 1em 0;
  text-align: center;
  overflow-x: auto;
  overflow-y: hidden;
}

.markdown-body :deep(.katex-display > .katex) {
  display: inline-block;
  text-align: initial;
}

/* 块级数学公式包装器 */
.markdown-body :deep(.katex-display-wrapper) {
  margin: 1em 0;
  text-align: center;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 0.5em 0;
}

/* 行内数学公式 */
.markdown-body :deep(.katex:not(.katex-display)) {
  margin: 0 0.1em;
  white-space: nowrap;
}

/* 确保数学公式在深色代码块中可见 */
.markdown-body :deep(pre .katex) {
  color: #d4d4d4;
}

/* 代码块中的语法高亮 */
.markdown-body :deep(pre .hljs) {
  background: #1e1e1e;
  color: #d4d4d4;
}

/* 用户消息中的 Markdown（保持白色文字） */
.user-message .markdown-body {
  color: white;
}

.user-message .markdown-body :deep(code) {
  background-color: rgba(255, 255, 255, 0.2);
  color: white;
}

.user-message .markdown-body :deep(pre) {
  background-color: rgba(0, 0, 0, 0.3);
}

.user-message .markdown-body :deep(pre code) {
  color: white;
}
</style>
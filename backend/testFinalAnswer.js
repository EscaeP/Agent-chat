const http = require('http');

// 测试数据：发送一个需要计算的请求，这样会触发思维链
const testData = {
  messages: [
    { role: 'user', content: '计算 123 + 456' }
  ],
  userId: 'test_user'
};

// 创建HTTP请求
const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/chat',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(JSON.stringify(testData))
  }
};

const req = http.request(options, (res) => {
  console.log(`状态码: ${res.statusCode}`);
  console.log('响应头:', res.headers);
  
  let reasoningMessages = [];
  let finalAnswer = '';
  
  res.on('data', (chunk) => {
    const data = chunk.toString();
    
    // 分割SSE事件
    const events = data.split('data: ').filter(Boolean);
    
    events.forEach(event => {
      try {
        const eventData = JSON.parse(event.trim());
        
        if (eventData.type === 'reasoning') {
          // 思维链消息
          reasoningMessages.push(eventData.content);
          console.log(`\n🧠 思维链消息:`);
          console.log(eventData.content);
        } else if (eventData.choices && eventData.choices[0]) {
          const choice = eventData.choices[0];
          if (choice.delta?.content) {
            if (choice.delta.content.includes('Final Answer')) {
              // 最终答案
              finalAnswer = choice.delta.content;
              console.log(`\n✅ 最终答案:`);
              console.log(choice.delta.content);
            } else if (choice.delta.content.trim()) {
              // 普通消息
              console.log(`\n💬 普通消息:`);
              console.log(choice.delta.content);
            }
          }
        }
      } catch (error) {
        // 忽略解析错误，可能是[DONE]或其他非JSON数据
        if (event.trim() !== '[DONE]') {
          console.log(`\n⚠️ 无法解析的事件数据:`);
          console.log(event.trim());
        }
      }
    });
  });
  
  res.on('end', () => {
    console.log('\n\n=== 测试结果分析 ===');
    console.log(`📊 思维链消息数量: ${reasoningMessages.length}`);
    console.log(`✅ 最终答案是否存在: ${finalAnswer ? '是' : '否'}`);
    console.log(`📋 最终答案内容:`);
    console.log(finalAnswer);
    
    if (reasoningMessages.length > 0 && finalAnswer) {
      console.log('\n🎉 测试成功！思维链已折叠，最终答案单独展示。');
    } else {
      console.log('\n❌ 测试失败！可能是思维链未折叠或最终答案未单独展示。');
    }
  });
});

req.on('error', (error) => {
  console.error(`\n❌ 请求失败: ${error.message}`);
});

// 发送请求数据
req.write(JSON.stringify(testData));
req.end();

const http = require('http');
const https = require('https');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

const API_KEY = process.env.XUNFEI_API_KEY;
const PORT = process.env.PORT || 3000;

// 创建与简化版服务器完全相同的HTTP服务器
const server = http.createServer((req, res) => {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // 处理OPTIONS请求
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }
  
  // 只处理POST请求到/api/chat
  if (req.method === 'POST' && req.url === '/api/chat') {
    let body = '';
    
    // 接收请求体
    req.on('data', (chunk) => {
      body += chunk;
    });
    
    req.on('end', () => {
      try {
        const requestData = JSON.parse(body);
        const { messages } = requestData;
        
        console.log('=== 收到请求 ===');
        console.log('消息:', messages);
        
        // 所有请求都使用流式处理
        handleStreamRequest(messages, res);
      } catch (error) {
        console.error('解析请求体错误:', error);
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: '请求格式错误' }));
      }
    });
  } else if (req.method === 'GET' && req.url === '/health') {
    // 健康检查端点
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ status: 'ok', message: 'AI Chat API is running' }));
  } else {
    res.statusCode = 404;
    res.end();
  }
});

// 处理流式请求
function handleStreamRequest(messages, res) {
  // 创建与简化版服务器完全相同的请求体
  const requestBody = {
    model: 'xop3qwen1b7',
    messages: messages,
    max_tokens: 4000,
    temperature: 0.7,
    stream: true
  };
  
  // 创建与简化版服务器完全相同的请求选项
  const options = {
    hostname: 'maas-api.cn-huabei-1.xf-yun.com',
    port: 443,
    path: '/v1/chat/completions',
    method: 'POST',
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`,
      'User-Agent': 'Node.js-Client',
      'Accept': '*/*'
    }
  };
  
  console.log('发送到MaaS的请求体:', JSON.stringify(requestBody, null, 2));
  console.log('请求选项:', JSON.stringify(options, null, 2));
  
  // 创建请求（与简化版服务器完全相同的方式）
  const maasReq = https.request(options, (maasRes) => {
    console.log('\n=== MaaS API 响应 ===');
    console.log('状态码:', maasRes.statusCode);
    console.log('响应头:', maasRes.headers);
    
    // 设置SSE响应头
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    
    // 直接将MaaS响应的数据发送给客户端
    maasRes.pipe(res);
    
    // 响应结束时记录日志
    maasRes.on('end', () => {
      console.log('\n=== 响应结束 ===');
      // 不再手动发送[DONE]，因为pipe()已经关闭了连接
    });
  });
  
  // 错误处理
  maasReq.on('error', (error) => {
    console.error('\n=== 请求错误 ===');
    console.error('错误:', error);
    
    res.write(`data: {"error": "流式请求失败：${error.message}"} \n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  });
  
  // 超时处理
  maasReq.on('timeout', () => {
    console.error('\n=== 请求超时 ===');
    maasReq.destroy();
    
    res.write(`data: {"error": "请求超时"} \n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  });
  
  // 发送请求体
  maasReq.write(JSON.stringify(requestBody));
  maasReq.end();
  
  console.log('\n=== 请求已发送 ===');
}

// 启动服务器
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

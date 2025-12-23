// Agent 工具库

// 计算器工具
function calculate(expression) {
  try {
    // 安全的数学表达式计算
    const sanitized = expression.replace(/[^0-9+\-*/().\s]/g, '');
    const result = Function(`"use strict"; return (${sanitized})`)();
    return {
      success: true,
      result: result,
      expression: expression
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// 获取当前时间工具
function getCurrentTime(format = 'full') {
  const now = new Date();
  const options = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  };
  
  if (format === 'date') {
    return now.toLocaleDateString('zh-CN');
  } else if (format === 'time') {
    return now.toLocaleTimeString('zh-CN', { hour12: false });
  } else {
    return now.toLocaleString('zh-CN', options);
  }
}

// 搜索工具（模拟）
function searchWeb(query) {
  // 这是一个模拟的搜索工具
  // 实际应用中可以调用真实的搜索 API
  const mockResults = [
    `关于"${query}"的搜索结果1：相关信息...`,
    `关于"${query}"的搜索结果2：更多信息...`,
    `关于"${query}"的搜索结果3：详细内容...`
  ];
  
  return {
    query: query,
    results: mockResults,
    count: mockResults.length
  };
}

// 文本处理工具
function textProcess(text, operation) {
  switch (operation) {
    case 'uppercase':
      return text.toUpperCase();
    case 'lowercase':
      return text.toLowerCase();
    case 'reverse':
      return text.split('').reverse().join('');
    case 'count':
      return {
        characters: text.length,
        words: text.split(/\s+/).filter(w => w).length,
        lines: text.split('\n').length
      };
    default:
      return { error: '不支持的操作' };
  }
}

// 工具定义（用于发送给 AI）
const toolDefinitions = [
  {
    type: 'function',
    function: {
      name: 'calculate',
      description: '执行数学计算。可以计算基本的数学表达式，如加法、减法、乘法、除法等。',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description: '要计算的数学表达式，例如: "2 + 2", "10 * 5", "(3 + 4) * 2"'
          }
        },
        required: ['expression']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getCurrentTime',
      description: '获取当前日期和时间。',
      parameters: {
        type: 'object',
        properties: {
          format: {
            type: 'string',
            enum: ['full', 'date', 'time'],
            description: '时间格式：full(完整日期时间), date(仅日期), time(仅时间)'
          }
        },
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'searchWeb',
      description: '在网络上搜索信息。当用户需要查找信息、新闻、资料等时使用此工具。',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '搜索关键词或查询内容'
          }
        },
        required: ['query']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'textProcess',
      description: '对文本进行各种处理操作，如大小写转换、反转、统计等。',
      parameters: {
        type: 'object',
        properties: {
          text: {
            type: 'string',
            description: '要处理的文本内容'
          },
          operation: {
            type: 'string',
            enum: ['uppercase', 'lowercase', 'reverse', 'count'],
            description: '操作类型：uppercase(转大写), lowercase(转小写), reverse(反转), count(统计)'
          }
        },
        required: ['text', 'operation']
      }
    }
  }
];

// 工具执行器
function executeTool(toolName, arguments_) {
  console.log(`\n=== 执行工具: ${toolName} ===`);
  console.log('参数:', arguments_);
  
  let result;
  
  try {
    switch (toolName) {
      case 'calculate':
        result = calculate(arguments_.expression);
        break;
      case 'getCurrentTime':
        result = getCurrentTime(arguments_.format);
        break;
      case 'searchWeb':
        result = searchWeb(arguments_.query);
        break;
      case 'textProcess':
        result = textProcess(arguments_.text, arguments_.operation);
        break;
      default:
        result = { error: `未知的工具: ${toolName}` };
    }
    
    console.log('工具执行结果:', result);
    return result;
  } catch (error) {
    console.error('工具执行错误:', error);
    return { error: error.message };
  }
}

module.exports = {
  toolDefinitions,
  executeTool
};


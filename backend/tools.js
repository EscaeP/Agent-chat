// Agent 工具库

const axios = require('axios');

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

async function searchWeb(query, limit = 5) {
  console.log(`🔍 使用百度百科搜索: "${query}"`);
  
  try {

    const baiduResult = await searchWithBaiduBaike(query, limit);
    if (baiduResult.success && baiduResult.results.length > 0) {
      console.log(`✅ 百度百科搜索成功，找到 ${baiduResult.results.length} 条结果`);
      return baiduResult;
    }
  } catch (error) {
    console.error('❌ 百度搜索失败:', error.message);
    return getLocalKnowledgeData(query, error.message);
  }
}

// 百度百科搜索函数
async function searchWithBaiduBaike(query, limit = 5) {
  console.log(`📚 查询百度百科: "${query}"`);
  
  try {

    const response = await axios.get(`https://baike.baidu.com/item/${encodeURIComponent(query)}`, {
      timeout: 12000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Referer': 'https://baike.baidu.com/'
      }
    });
    
    const html = response.data;
    console.log(`📄 收到HTML，长度: ${(html.length / 1024).toFixed(1)} KB`);
    
    const results = [];
    
    // === 1. 提取标题和基本信息 ===
    const titleMatch = html.match(/<h1[^>]*>\s*(?:<span[^>]*>)?([^<]+?)(?:<\/span>)?\s*<\/h1>/);
    let title = titleMatch ? titleMatch[1].trim() : query;
    
    // 尝试从title标签获取
    if (!title || title.length < 2) {
      const pageTitle = html.match(/<title>([^<]+)<\/title>/);
      if (pageTitle) {
        title = pageTitle[1].replace(/_百度百科$/, '').replace(/- 百度百科$/, '').trim();
      }
    }
    
    results.push(`📖 ${title}`);
    
    // === 2. 提取副标题/别名 ===
    const subTitleMatch = html.match(/<h2[^>]*>\s*<span[^>]*>([^<]+)<\/span>\s*<\/h2>/);
    if (subTitleMatch) {
      const subTitle = subTitleMatch[1].trim();
      if (subTitle !== title && !subTitle.includes('目录') && !subTitle.includes('参考资料')) {
        results.push(`📌 别名: ${subTitle}`);
      }
    }
    
    // === 3. 提取摘要（lemma-summary）=== 
    let summaryText = '';
    const summaryMatch = html.match(/<div[^>]*class="lemma-summary"[^>]*>([\s\S]*?)<\/div>/);
    
    if (summaryMatch) {
      summaryText = summaryMatch[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#[0-9]+;/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\[\d+\]/g, '')  // 移除引用标记
        .trim();
      
      if (summaryText.length > 30) {
        // 分割成多个句子，每句单独一行
        const sentences = summaryText.split(/[。！？；\.\!\?\;]/).filter(s => s.trim().length > 10);
        sentences.slice(0, 3).forEach(sentence => {
          const trimmed = sentence.trim();
          if (trimmed && !results.some(r => r.includes(trimmed.substring(0, 20)))) {
            results.push(`📝 ${trimmed}。`);
          }
        });
      }
    }
    
    // === 4. 提取基本信息卡片（关键-值对）===
    const basicInfoRegex = /<dt[^>]*>(?:<span[^>]*>)?([^<]+?)(?:<\/span>)?<\/dt>\s*<dd[^>]*>(?:<span[^>]*>)?([\s\S]*?)(?:<\/span>)?<\/dd>/g;
    let basicMatch;
    let basicCount = 0;
    
    while ((basicMatch = basicInfoRegex.exec(html)) !== null && basicCount < 6) {
      let key = basicMatch[1]
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      let value = basicMatch[2]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\[\d+\]/g, '')
        .trim();
      
      // 过滤掉太长的值和无效值
      if (key && value && value.length < 150 && value.length > 3) {
        // 避免重复的关键信息
        const commonKeys = ['中文名', '外文名', '别名', '简称', '提出者', '提出时间', '应用学科', '适用领域'];
        if (commonKeys.some(k => key.includes(k)) || key.length < 10) {
          results.push(`🔑 **${key}**: ${value}`);
          basicCount++;
        }
      }
    }
    
    // === 5. 提取详细内容段落 ===
    // 先找到主要内容的开始
    const contentStart = html.indexOf('class="main-content"') || html.indexOf('class="content"') || 0;
    const contentEnd = html.indexOf('<div class="side-content"', contentStart) || 
                      html.indexOf('<div class="lemmaWgt-sideBar"', contentStart) || 
                      html.length;
    
    if (contentEnd - contentStart > 1000) {
      const contentSection = html.substring(contentStart, contentEnd);
      
      // 提取所有段落
      const paraRegex = /<div[^>]*class="para"[^>]*>([\s\S]*?)<\/div>/g;
      let paraMatch;
      let paraCount = 0;
      let extractedTexts = new Set(); // 用于去重
      
      while ((paraMatch = paraRegex.exec(contentSection)) !== null && paraCount < 8) {
        let para = paraMatch[1]
          .replace(/<[^>]+>/g, ' ')
          .replace(/&nbsp;/g, ' ')
          .replace(/&#[0-9]+;/g, ' ')
          .replace(/\s+/g, ' ')
          .replace(/\[\d+\]/g, '')
          .trim();
        
        // 清理和格式化
        if (para.length > 60 && para.length < 500) {
          // 检查是否和已有的内容重复
          const paraStart = para.substring(0, 50);
          if (!extractedTexts.has(paraStart) && !hasTooManySpecialChars(para)) {
            // 分段处理：如果段落太长，分割成句子
            if (para.length > 150) {
              const sentences = para.split(/[。！？；\.\!\?\;]/).filter(s => s.trim().length > 30);
              sentences.slice(0, 2).forEach(sentence => {
                const trimmed = sentence.trim();
                if (trimmed && !results.some(r => r.includes(trimmed.substring(0, 30)))) {
                  results.push(`📄 ${trimmed}。`);
                  paraCount++;
                }
              });
            } else {
              results.push(`📄 ${para}`);
              paraCount++;
            }
            extractedTexts.add(paraStart);
          }
        }
      }
    }
    
    // === 6. 提取目录结构（了解内容组织）===
    const catalogMatch = html.match(/<div[^>]*class="catalog"[^>]*>([\s\S]*?)<\/div>/);
    if (catalogMatch) {
      const catalogText = catalogMatch[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      // 提取主要章节
      const sections = catalogText.match(/\d+(?:\.\d+)*\s+[^0-9\s].{2,30}/g);
      if (sections && sections.length > 0) {
        results.push(`📚 **主要内容章节**:`);
        sections.slice(0, 5).forEach((section, i) => {
          if (i < 3) { // 只显示前3个主要章节
            results.push(`   ${section}`);
          }
        });
      }
    }
    
    // === 7. 提取关键特点/特性 ===
    // 查找列表项
    const listItemRegex = /<li[^>]*>([\s\S]*?)<\/li>/g;
    let listMatch;
    let listCount = 0;
    
    while ((listMatch = listItemRegex.exec(html)) !== null && listCount < 5) {
      let item = listMatch[1]
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      if (item.length > 20 && item.length < 200 && 
          !item.includes('function') && !item.includes('baidu') &&
          !results.some(r => r.includes(item.substring(0, 30)))) {
        results.push(`✓ ${item}`);
        listCount++;
      }
    }
    
    // === 8. 如果没有提取到足够内容，使用备用解析方法 ===
    if (results.length < 6) {
      console.log('⚠️ 内容较少，使用备用解析方法...');
      
      // 备用方法：直接提取所有文本，然后筛选关键句子
      const allText = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&#[0-9]+;/g, ' ')
        .replace(/\s+/g, ' ')
        .replace(/\[\d+\]/g, '');
      
      // 寻找包含关键词的句子
      const sentences = allText.split(/[。！？；\.\!\?\;]/);
      const keyword = query.length > 2 ? query.substring(0, 3) : query;
      let keywordSentences = [];
      
      for (const sentence of sentences) {
        const trimmed = sentence.trim();
        if (trimmed.length > 40 && trimmed.length < 300) {
          if (trimmed.includes(keyword) || 
              trimmed.includes('是') || 
              trimmed.includes('包括') || 
              trimmed.includes('分为') ||
              trimmed.includes('主要')) {
            if (!keywordSentences.some(s => s.includes(trimmed.substring(0, 30)))) {
              keywordSentences.push(trimmed);
            }
          }
        }
      }
      
      // 添加关键句子
      keywordSentences.slice(0, 4).forEach(sentence => {
        if (!results.some(r => r.includes(sentence.substring(0, 30)))) {
          results.push(`💡 ${sentence}。`);
        }
      });
    }
    
    // === 9. 补充本地知识（如果在线内容不足）===
    if (results.length < 5) {
      const localKnowledge = getEnhancedLocalKnowledge(query);
      if (localKnowledge.length > 0) {
        results.push(`📚 **补充知识**:`);
        localKnowledge.slice(0, 3).forEach(item => {
          results.push(`   ${item}`);
        });
      }
    }
    
    // === 10. 添加结构化总结 ===
    if (results.length > 3) {
      results.push(`\n📊 **信息总结**:`);
      results.push(`   • 共提取 ${results.length - 1} 条关键信息`);
      results.push(`   • 包含定义、特点、应用等内容`);
    }
    
    // === 11. 添加访问链接 ===
    const encodedQuery = encodeURIComponent(query);
    results.push(`\n🔗 **完整内容**: https://baike.baidu.com/item/${encodedQuery}`);
    results.push(`📱 **移动端**: https://m.baike.baidu.com/item/${encodedQuery}`);
    
    console.log(`✅ 百度百科解析完成，提取 ${results.length} 条信息`);
    
    return {
      query: query,
      results: results.slice(0, limit + 8), // 多留一些空间
      count: results.length,
      success: true,
      source: '百度百科（增强解析）',
      baike_url: `https://baike.baidu.com/item/${encodedQuery}`,
      info_count: results.length
    };
    
  } catch (error) {
    console.error('百度百科查询失败:', error.message);
    throw error;
  }
}

// 百度图片搜索工具
async function searchImages(query, limit = 10) {console.log(`🖼️ 搜索图片: "${query}"`);
  
  try {
    const results = [];
    const imgUrls = [];
    
    // 尝试使用百度图片搜索的JSON API
    try {
      const response = await axios.get(`https://image.baidu.com/search/acjson?tn=resultjson_com&logid=&ipn=rj&ct=201326592&is=&fp=result&fr=&word=${encodeURIComponent(query)}&queryWord=${encodeURIComponent(query)}&cl=2&lm=-1&ie=utf-8&oe=utf-8&adpicid=&st=-1&z=&ic=0&hd=&latest=&copyright=&s=&se=&tab=&width=&height=&face=0&istype=2&qc=&nc=1&expermode=&nojc=&isAsync=&pn=30&rn=30&gsm=1e`, {
        timeout: 12000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Referer': 'https://image.baidu.com/'
        }
      });
      
      const data = response.data;
      console.log(`📄 收到JSON数据`);
      
      // 从百度API返回的JSON数据中提取图片URL
      if (data && data.data && Array.isArray(data.data)) {
        for (const item of data.data) {
          if (item.thumbURL && imgUrls.length < limit) {
            imgUrls.push(item.thumbURL);
          }
        }
      }
      
      console.log(`✅ 从JSON API提取到 ${imgUrls.length} 张图片`);
    } catch (jsonError) {
      console.log('JSON API调用失败:', jsonError.message);
    }
    
    // 如果JSON API没有找到足够的图片，尝试使用百度图片搜索的HTML页面
    if (imgUrls.length < limit) {
      console.log('JSON API图片不足，尝试解析HTML页面...');
      
      try {
        const htmlResponse = await axios.get(`https://image.baidu.com/search/index?tn=baiduimage&word=${encodeURIComponent(query)}`, {
          timeout: 12000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Referer': 'https://image.baidu.com/'
          }
        });
        
        const html = htmlResponse.data;
        console.log(`📄 收到HTML，长度: ${(html.length / 1024).toFixed(1)} KB`);
        
        // 尝试多种正则表达式提取图片URL
        const regexes = [
          { regex: /"objURL":"([^"]+)"/g, name: "objURL" },
          { regex: /"thumbURL":"([^"]+)"/g, name: "thumbURL" },
          { regex: /"middleURL":"([^"]+)"/g, name: "middleURL" },
          { regex: /"replaceURL":"([^"]+)"/g, name: "replaceURL" },
          { regex: /img src="([^"]+)"/g, name: "img src" }
        ];
        
        for (const { regex, name } of regexes) {
          if (imgUrls.length >= limit) break;
          
          let match;
          const initialCount = imgUrls.length;
          
          while ((match = regex.exec(html)) !== null && imgUrls.length < limit) {
            const url = match[1];
            // 确保URL是有效的HTTP/HTTPS URL，并且不在已收集的URL中
            if (url && url.startsWith('http') && !imgUrls.includes(url)) {
              // 尝试解码URL（百度图片URL可能被编码）
              try {
                const decodedUrl = decodeURIComponent(url);
                if (!imgUrls.includes(decodedUrl)) {
                  imgUrls.push(decodedUrl);
                }
              } catch (e) {
                // 如果解码失败，直接使用原始URL
                imgUrls.push(url);
              }
            }
          }
          
          const addedCount = imgUrls.length - initialCount;
          if (addedCount > 0) {
            console.log(`从 ${name} 提取到 ${addedCount} 张图片`);
          }
        }
      } catch (htmlError) {
        console.log('HTML页面解析失败:', htmlError.message);
      }
    }
    
    // 构建结果
    results.push(`🖼️ **图片搜索结果**: "${query}"`);
    results.push(`找到 ${imgUrls.length} 张相关图片:`);
    
    // 添加图片URL
    imgUrls.forEach((url, index) => {
      results.push(`![图片${index + 1}](${url})`);
    });
    
    console.log(`✅ 图片搜索完成，找到 ${imgUrls.length} 张图片`);
    
    return {
      query: query,
      results: results,
      count: imgUrls.length,
      success: true,
      source: '图片搜索',
      images: imgUrls
    };
    
  } catch (error) {
    console.error('图片搜索失败:', error.message);
    return {
      query: query,
      results: [`❌ 图片搜索失败: ${error.message}`],
      success: false,
      error: error.message
    };
  }
}

// 辅助函数：检查文本是否包含过多特殊字符
function hasTooManySpecialChars(text) {
  const specialChars = /[^\u4e00-\u9fa5a-zA-Z0-9\s，。！？；：,.!?;:]/g;
  const matches = text.match(specialChars);
  return matches && matches.length > text.length * 0.3; // 特殊字符超过30%则认为有问题
}

// 辅助函数：获取增强的本地知识
function getEnhancedLocalKnowledge(query) {
  // 简单的本地知识示例，实际应用中可以扩展为更复杂的本地知识库
  const localKnowledge = {
    '猫': [
      '猫是一种常见的家养动物，被称为人类的伴侣动物。',
      '猫具有出色的狩猎能力，擅长捕捉老鼠等小型动物。',
      '猫的平均寿命约为12-15年。'
    ],
    '狗': [
      '狗是人类最早驯化的动物之一，被称为人类最忠实的朋友。',
      '狗具有高度的智力和适应能力，可用于各种工作，如导盲、搜救等。',
      '狗的品种繁多，不同品种具有不同的特征和用途。'
    ]
  };
  
  return localKnowledge[query] || [];
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

// ===== ReAct / CoT & 自我修正支持工具 =====

// 简单的推理步骤日志（仅内存 + 控制台），用于 CoT / ReAct 风格
const reasoningLog = [];

function logReasoningStep(step, detail = '') {
  const entry = {
    time: new Date().toISOString(),
    step,
    detail
  };
  reasoningLog.push(entry);
  console.log('\n[ReAct] 推理步骤记录:', entry);
  return {
    success: true,
    entry,
    totalSteps: reasoningLog.length
  };
}

// 清空推理日志，避免对话变长后干扰
function clearReasoningLog() {
  const count = reasoningLog.length;
  reasoningLog.length = 0;
  console.log(`\n[ReAct] 已清空推理日志，清除条数: ${count}`);
  return {
    success: true,
    cleared: count
  };
}

// 错误记录与详细自我修正提示工具
function logErrorAndSuggestFix(errorMessage, context = '') {
  const lower = (errorMessage || '').toLowerCase();
  const suggestions = [];
  const errorType = [];

  // 1. 识别错误类型
  if (lower.includes('json')) {
    errorType.push('JSON解析错误');
    suggestions.push('步骤1：检查JSON格式是否完整，确保所有字符串用双引号包裹');
    suggestions.push('步骤2：检查是否缺少逗号分隔符或多了尾逗号');
    suggestions.push('步骤3：确认所有括号和引号都正确配对');
    suggestions.push('示例：正确格式 {"key": "value"}，错误格式 {key: "value"} 或 {"key": "value",}');
  }
  
  if (lower.includes('timeout')) {
    errorType.push('超时错误');
    suggestions.push('步骤1：检查网络连接是否正常');
    suggestions.push('步骤2：确认目标服务是否可用');
    suggestions.push('步骤3：考虑减小请求数据量或增加超时时间');
    suggestions.push('步骤4：对于搜索工具，尝试使用更简洁的查询关键词');
  }
  
  if (lower.includes('not found') || lower.includes('enoent')) {
    errorType.push('资源未找到错误');
    suggestions.push('步骤1：确认路径或资源名称是否正确');
    suggestions.push('步骤2：检查资源是否存在');
    suggestions.push('步骤3：对于搜索工具，尝试使用不同的关键词或更通用的术语');
    suggestions.push('步骤4：检查拼写是否正确');
  }
  
  if (lower.includes('unauthorized') || lower.includes('forbidden') || lower.includes('401') || lower.includes('403')) {
    errorType.push('权限错误');
    suggestions.push('步骤1：检查API Key是否配置正确');
    suggestions.push('步骤2：确认是否有访问该资源的权限');
    suggestions.push('步骤3：检查认证信息是否过期');
  }
  
  if (lower.includes('syntax') || lower.includes('unexpected')) {
    errorType.push('语法错误');
    suggestions.push('步骤1：检查最近修改的代码语法');
    suggestions.push('步骤2：确认括号、引号、分号等是否正确配对');
    suggestions.push('步骤3：尝试逐行缩小错误范围');
    suggestions.push('步骤4：对于计算表达式，检查运算符是否正确使用');
  }
  
  if (lower.includes('nan') || lower.includes('infinite')) {
    errorType.push('计算结果异常');
    suggestions.push('步骤1：检查计算表达式是否正确');
    suggestions.push('步骤2：确认是否有除以零的情况');
    suggestions.push('步骤3：检查输入数值是否合理');
    suggestions.push('步骤4：尝试分解复杂表达式为多个简单步骤');
  }
  
  if (lower.includes('parameter') || lower.includes('argument')) {
    errorType.push('参数错误');
    suggestions.push('步骤1：检查必填参数是否全部提供');
    suggestions.push('步骤2：确认参数类型是否正确');
    suggestions.push('步骤3：检查参数值是否在有效范围内');
    suggestions.push('步骤4：参考工具文档确认正确的参数格式');
  }
  
  if (lower.includes('tool') || lower.includes('function')) {
    errorType.push('工具调用错误');
    suggestions.push('步骤1：确认工具名称是否正确');
    suggestions.push('步骤2：检查工具参数是否符合要求');
    suggestions.push('步骤3：确认工具是否支持当前操作');
    suggestions.push('步骤4：检查工具是否已正确加载');
  }

  // 2. 针对不同工具的特定建议
  if (context.includes('calculate')) {
    suggestions.push('【计算工具特定建议】：确保表达式中包含有效的运算符和数字，避免使用特殊字符');
  }
  
  if (context.includes('searchWeb')) {
    suggestions.push('【搜索工具特定建议】：使用更简洁、更准确的关键词，避免使用过长或过于复杂的查询');
  }
  
  if (context.includes('textProcess')) {
    suggestions.push('【文本处理工具特定建议】：确认操作类型是否支持，文本内容是否有效');
  }

  // 3. 通用修正流程
  suggestions.push('\n通用修正流程：');
  suggestions.push('1. 仔细阅读错误信息，定位错误类型和位置');
  suggestions.push('2. 根据上述建议制定修正方案');
  suggestions.push('3. 执行修正操作');
  suggestions.push('4. 验证修正结果是否正确');
  suggestions.push('5. 如果问题仍然存在，尝试不同的修正方法或向用户寻求更多信息');

  // 4. 默认泛化建议（如果没有匹配到特定错误类型）
  if (errorType.length === 0) {
    errorType.push('未知错误');
    suggestions.unshift('步骤1：先精读错误信息，识别关键错误关键词');
    suggestions.unshift('步骤2：根据上下文定位可能出现问题的代码或操作');
    suggestions.unshift('步骤3：检查最近的操作是否符合预期');
    suggestions.unshift('步骤4：尝试简化操作或使用不同的方法');
  }

  const result = {
    errorMessage,
    context,
    errorType,
    suggestions,
    timestamp: new Date().toISOString(),
    detailedAnalysis: {
      errorKeywords: lower.match(/\b(?:error|failed|invalid|unexpected|missing|required)\b/gi) || [],
      contextKeywords: context.match(/\b(?:tool|function|parameter|argument|expression|query|api)\b/gi) || []
    }
  };

  console.log('\n[Self-Correct] 错误记录与详细建议:', result);
  return result;
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
      name: 'searchImages',
      description: '在网络上搜索图片。当用户需要查找图片、照片、插图等视觉内容时使用此工具。',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: '图片搜索关键词或描述'
          },
          limit: {
            type: 'integer',
            description: '返回图片的最大数量，默认为5',
            default: 5
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
  },
  {
    type: 'function',
    function: {
      name: 'logReasoningStep',
      description: '记录当前的思考/推理步骤，用于 CoT / ReAct 风格的显式推理链，便于后续自我审查与调试。',
      parameters: {
        type: 'object',
        properties: {
          step: {
            type: 'string',
            description: '当前这一步推理的简要描述，例如“分析用户需求”、“决定是否调用工具”等。'
          },
          detail: {
            type: 'string',
            description: '可选的详细推理内容或中间结论，便于后续回顾与自我修正。'
          }
        },
        required: ['step']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'clearReasoningLog',
      description: '清空当前会话中的推理步骤日志，通常在一个大任务完成或用户显式切换到全新话题时调用。',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'logErrorAndSuggestFix',
      description: '在遇到错误时记录错误信息，识别错误类型，并根据常见模式给出详细的自我修正建议和具体步骤，辅助 Agent 决定下一步修复动作。支持多种错误类型的自动识别和针对性修正建议。',
      parameters: {
        type: 'object',
        properties: {
          errorMessage: {
            type: 'string',
            description: '遇到的错误信息原文（可以来自接口、终端、日志等）。'
          },
          context: {
            type: 'string',
            description: '可选的上下文描述，例如“调用某某接口时出错”、“解析某段 JSON 时出错”等，有助于提供更精准的修正建议。'
          }
        },
        required: ['errorMessage']
      }
    }
  }
];

// 工具执行器
async function executeTool(toolName, arguments_) {
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
        result = await searchWeb(arguments_.query);
        break;
      case 'searchImages':
        result = await searchImages(arguments_.query, arguments_.limit);
        break;
      case 'textProcess':
        result = textProcess(arguments_.text, arguments_.operation);
        break;
      case 'logReasoningStep':
        result = logReasoningStep(arguments_.step, arguments_.detail);
        break;
      case 'clearReasoningLog':
        result = clearReasoningLog();
        break;
      case 'logErrorAndSuggestFix':
        result = logErrorAndSuggestFix(arguments_.errorMessage, arguments_.context);
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
import { tool } from "ai";
import { z } from "zod";
import { getPuppeteerMCPClient } from "@/lib/mcp/client-manager";
import { CHAT_DETAILS_SELECTORS } from "./constants";
import { wrapAntiDetectionScript, generateBatchProcessingScript } from "./anti-detection-utils";

/**
 * 获取聊天详情工具
 *
 * 功能：
 * - 获取候选人基本信息（姓名、职位、年龄、经验等）
 * - 获取完整的聊天记录
 * - 自动判断消息发送者（候选人/招聘者）
 * - 提取消息时间戳
 */
export const zhipinGetChatDetailsTool = () =>
  tool({
    description: `获取BOSS直聘聊天窗口的候选人信息和聊天记录
    
    功能：
    - 提取候选人基本信息（姓名、职位、年龄、经验等）
    - 获取完整的聊天历史记录
    - 自动识别消息发送者
    - 包含消息时间戳
    
    注意：
    - 需要先打开候选人聊天窗口
    - 返回结构化的候选人信息和聊天记录`,

    inputSchema: z.object({
      includeHtml: z.boolean().optional().default(false).describe("是否包含原始HTML（用于调试）"),
      maxMessages: z.number().optional().default(100).describe("返回的最大消息数量，默认100条"),
      maxDataSizeKB: z.number().optional().default(300).describe("返回数据的最大大小（KB），默认300KB"),
    }),

    execute: async ({ includeHtml = false, maxMessages = 100, maxDataSizeKB = 300 }) => {
      try {
        const client = await getPuppeteerMCPClient();
        const tools = await client.tools();

        if (!tools.puppeteer_evaluate) {
          throw new Error("MCP tool puppeteer_evaluate not available");
        }
        
        // 添加滚轮事件以模拟用户行为
        const addScrollBehavior = async () => {
          if (tools.puppeteer_evaluate) {
            const scrollScript = wrapAntiDetectionScript(`
              // 模拟轻微的滚动
              const scrollY = window.scrollY;
              const delta = 50 + Math.random() * 100;
              window.scrollTo({
                top: scrollY + delta,
                behavior: 'smooth'
              });
              return { scrolled: true, from: scrollY, to: scrollY + delta };
            `);
            await tools.puppeteer_evaluate.execute({ script: scrollScript });
            await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
          }
        };

        // 创建获取聊天详情的脚本
        const script = wrapAntiDetectionScript(`
          // 获取候选人基本信息
          const candidateInfoElement = document.querySelector('${CHAT_DETAILS_SELECTORS.candidateInfoContainer}');
          
          let candidateInfo = null;
          if (candidateInfoElement) {
            // 提取候选人姓名
            const nameElement = candidateInfoElement.querySelector('${CHAT_DETAILS_SELECTORS.candidateName}');
            const name = nameElement ? nameElement.textContent.trim() : '';
            
            // 提取年龄、经验等信息
            const infoElements = candidateInfoElement.querySelectorAll('${CHAT_DETAILS_SELECTORS.candidateInfoItem}, ${CHAT_DETAILS_SELECTORS.candidateTag}');
            const infoTexts = Array.from(infoElements).map(el => el.textContent.trim()).filter(text => text);
            
            // 提取职位信息
            const positionElement = candidateInfoElement.querySelector('${CHAT_DETAILS_SELECTORS.candidatePosition}, ${CHAT_DETAILS_SELECTORS.candidatePositionAlt}');
            const position = positionElement ? positionElement.textContent.trim() : '';
            
            // 尝试从完整文本中提取更多信息
            const fullText = candidateInfoElement.textContent.trim();
            
            // 解析年龄
            const ageMatch = fullText.match(/(\\d{2,3})岁/);
            const age = ageMatch ? ageMatch[1] : '';
            
            // 解析经验
            const experienceMatch = fullText.match(/(\\d+年|\\d+年以上|应届生|在校生)/);
            const experience = experienceMatch ? experienceMatch[1] : '';
            
            // 解析学历
            const educationMatch = fullText.match(/(初中|高中|中专|大专|本科|硕士|博士|初中及以下|高中及以下)/);
            const education = educationMatch ? educationMatch[1] : '';
            
            candidateInfo = {
              name: name || '未知',
              position: position,
              age: age,
              experience: experience,
              education: education,
              info: infoTexts,
              fullText: fullText
            };
          }
          
          // 获取聊天记录
          const chatContainer = document.querySelector('${CHAT_DETAILS_SELECTORS.chatMessageContainer}');
          
          let chatMessages = [];
          if (chatContainer) {
            // 使用多种选择器尝试获取消息
            const messageElements = Array.from(chatContainer.querySelectorAll('${CHAT_DETAILS_SELECTORS.messageItem}'));
            
            // 生成批处理代码（每批30条消息，减少rIC调用）
            ${generateBatchProcessingScript(`
              const msgEl = element;
              // 一次性获取所有文本内容和类名，减少DOM访问
              const msgText = msgEl.textContent || '';
              const classes = msgEl.className || '';
              const innerHTML = msgEl.innerHTML || '';
              
              // 从文本中提取时间（避免额外的querySelector）
              const timeMatch = msgText.match(/\\d{1,2}:\\d{2}(?::\\d{2})?|\\d{4}-\\d{2}-\\d{2}/);
              const time = timeMatch ? timeMatch[0] : '';
              
              // 基于类名快速判断消息类型
              let sender = 'unknown';
              let content = '';
              let messageType = 'text';
              
              // 使用类名判断，避免querySelector
              if (classes.includes('message-system') || innerHTML.includes('system-msg')) {
                sender = 'system';
                messageType = 'system';
                content = msgText.replace(time, '').trim();
              }
              // 候选人消息（左侧） - 通过类名判断
              else if (classes.includes('message-friend') || classes.includes('chat-friend') || innerHTML.includes('friend')) {
                sender = 'candidate';
                // 尝试提取纯文本内容，移除时间戳
                content = msgText.replace(time, '').replace('已读', '').trim();
              }
              // 招聘者消息（右侧） - 通过类名判断
              else if (classes.includes('message-myself') || classes.includes('chat-myself') || innerHTML.includes('myself')) {
                sender = 'recruiter';
                // 移除时间和已读标记
                content = msgText.replace(time, '').replace('已读', '').trim();
              }
              // 简历卡片
              else if (classes.includes('resume-card') || innerHTML.includes('resume')) {
                sender = 'system';
                messageType = 'resume';
                content = msgText.replace(time, '').trim();
              }
              // 微信交换卡片
              else if (classes.includes('message-card-top-wrap') || innerHTML.includes('message-card-top-title') || innerHTML.includes('d-top-text')) {
                sender = 'system';
                messageType = 'wechat-exchange';
                
                // 从截图中看到的结构，微信号在 d-top-text 中
                // 尝试多种方式提取微信号
                let wechatNumber = '';
                
                // 方法1: 查找连续的数字（8-15位）
                const wechatMatch = msgText.match(/\\b\\d{8,15}\\b/);
                if (wechatMatch) {
                  wechatNumber = wechatMatch[0];
                }
                
                // 方法2: 如果包含"微信"关键词，提取后面的内容
                if (!wechatNumber) {
                  const wechatTextMatch = msgText.match(/微信[：:]*\\s*([\\w\\d]+)/);
                  if (wechatTextMatch) {
                    wechatNumber = wechatTextMatch[1];
                  }
                }
                
                // 方法3: 查找引号中的内容
                if (!wechatNumber) {
                  const quotedMatch = msgText.match(/["']([^"']+)["']/);
                  if (quotedMatch && quotedMatch[1].match(/^[\\w\\d]{5,20}$/)) {
                    wechatNumber = quotedMatch[1];
                  }
                }
                
                if (wechatNumber) {
                  content = '微信交换成功 - 微信号: ' + wechatNumber;
                } else {
                  // 如果没有找到具体的微信号，返回完整文本
                  content = '微信交换: ' + msgText.replace(time, '').trim();
                }
              }
              
              if (content && content.length > 0) {
                results.push({
                  index: i,
                  sender: sender,
                  messageType: messageType,
                  content: content,
                  time: time,
                  hasTime: !!time
                });
              }
            `, 30)}
            
            // 执行批处理
            chatMessages = await processAllBatches(messageElements);
            
            // 额外查找微信交换卡片（可能不在 message-item 中）
            const wechatCards = Array.from(chatContainer.querySelectorAll('.message-card-top-wrap, [class*="d-top-text"]'));
            for (let i = 0; i < wechatCards.length; i++) {
              const card = wechatCards[i];
              const cardText = card.textContent || '';
              
              // 查找数字格式的微信号
              const wechatMatch = cardText.match(/\\b\\d{8,15}\\b/);
              if (wechatMatch) {
                // 检查这个微信号是否已经在消息列表中
                const alreadyExists = chatMessages.some(msg => 
                  msg.content && msg.content.includes(wechatMatch[0])
                );
                
                if (!alreadyExists) {
                  chatMessages.push({
                    index: chatMessages.length,
                    sender: 'system',
                    messageType: 'wechat-exchange',
                    content: '微信交换成功 - 微信号: ' + wechatMatch[0],
                    time: '',
                    hasTime: false
                  });
                }
              }
            }
          }
          
          // 限制消息数量 - 保留最新的 maxMessages 条
          const originalCount = chatMessages.length;
          if (chatMessages.length > ${maxMessages}) {
            // 保留最近的消息
            chatMessages = chatMessages.slice(-${maxMessages});
          }
          
          // 统计信息
          const stats = {
            totalMessages: originalCount,
            returnedMessages: chatMessages.length,
            candidateMessages: chatMessages.filter(m => m.sender === 'candidate').length,
            recruiterMessages: chatMessages.filter(m => m.sender === 'recruiter').length,
            systemMessages: chatMessages.filter(m => m.sender === 'system').length,
            messagesWithTime: chatMessages.filter(m => m.hasTime).length,
            truncated: originalCount > ${maxMessages}
          };
          
          // 格式化为conversation_history格式
          const formattedHistory = chatMessages
            .filter(m => m.sender === 'candidate' || m.sender === 'recruiter')
            .map(m => {
              const prefix = m.sender === 'candidate' ? '求职者' : '我';
              return \`\${prefix}: \${m.content}\`;
            });
          
          // 检查数据大小
          const resultData = {
            candidateInfo: candidateInfo,
            chatMessages: chatMessages,
            formattedHistory: formattedHistory,
            stats: stats,
            candidateInfoFound: !!candidateInfoElement,
            chatContainerFound: !!chatContainer,
            extractedAt: new Date().toISOString()
          };
          
          // 估算数据大小
          const dataSize = JSON.stringify(resultData).length / 1024; // KB
          if (dataSize > ${maxDataSizeKB}) {
            // 进一步减少消息数量
            const reductionRatio = ${maxDataSizeKB} / dataSize;
            const newMessageCount = Math.floor(chatMessages.length * reductionRatio * 0.8); // 留有余地
            
            chatMessages = chatMessages.slice(-newMessageCount);
            formattedHistory = formattedHistory.slice(-newMessageCount);
            
            resultData.chatMessages = chatMessages;
            resultData.formattedHistory = formattedHistory;
            resultData.stats.returnedMessages = chatMessages.length;
            resultData.stats.dataTruncated = true;
            resultData.stats.originalDataSizeKB = Math.round(dataSize);
          }
          
          return resultData;
        `);

        // 在执行前添加初始滚动行为
        await addScrollBehavior();
        
        // 执行脚本
        const result = await tools.puppeteer_evaluate.execute({ script });

        // 解析结果
        const mcpResult = result as { content?: Array<{ text?: string }> };
        if (mcpResult?.content?.[0]?.text) {
          const resultText = mcpResult.content[0].text;

          try {
            const executionMatch = resultText.match(
              /Execution result:\s*\n([\s\S]*?)(\n\nConsole output|$)/
            );

            if (executionMatch && executionMatch[1].trim() !== "undefined") {
              const jsonResult = executionMatch[1].trim();
              const parsedResult = JSON.parse(jsonResult);

              if (parsedResult.candidateInfoFound || parsedResult.chatContainerFound) {
                return {
                  success: true,
                  message: "成功获取聊天详情",
                  data: parsedResult,
                  summary: {
                    candidateName: parsedResult.candidateInfo?.name || "未知",
                    candidatePosition: parsedResult.candidateInfo?.position || "未知职位",
                    totalMessages: parsedResult.stats?.totalMessages || 0,
                    lastMessageTime:
                      parsedResult.chatMessages?.[parsedResult.chatMessages.length - 1]?.time ||
                      "无",
                  },
                  formattedHistory: parsedResult.formattedHistory || [],
                };
              } else {
                return {
                  success: false,
                  error: "未找到聊天窗口或候选人信息",
                  message: "请确保已打开候选人聊天窗口",
                };
              }
            }
          } catch {
            // 静默处理解析错误
          }

          return {
            success: false,
            error: "Failed to parse chat details",
            rawResult: includeHtml ? resultText : undefined,
          };
        }

        return {
          success: false,
          error: "Unexpected result format",
          message: "获取聊天详情时出现未知错误",
        };
      } catch (error) {
        // 静默处理错误

        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error occurred",
          message: "获取聊天详情时发生错误",
        };
      }
    },
  });

/**
 * 快捷创建函数
 */
export const createZhipinGetChatDetailsTool = zhipinGetChatDetailsTool;

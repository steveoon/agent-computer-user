import { tool } from "ai";
import { z } from "zod";
import { getPuppeteerMCPClient } from "@/lib/mcp/client-manager";
import { YUPAO_CHAT_DETAILS_SELECTORS } from "./constants";
import { wrapAntiDetectionScript } from "../zhipin/anti-detection-utils";

/**
 * 获取聊天详情工具
 *
 * 功能：
 * - 获取候选人基本信息（从岗位信息中提取）
 * - 获取完整的聊天记录
 * - 自动判断消息发送者（候选人/招聘者）
 * - 提取消息时间戳
 */
export const yupaoChatDetailsTool = () =>
  tool({
    description: `获取Yupao聊天窗口的候选人信息和聊天记录
    
    功能：
    - 提取候选人基本信息（从岗位信息中提取）
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
          let candidateInfo = null;
          
          // 优先从顶部候选人信息区域提取
          const candidateNameEl = document.querySelector('${YUPAO_CHAT_DETAILS_SELECTORS.candidateName}');
          const candidateName = candidateNameEl ? candidateNameEl.textContent.trim() : '候选人';
          
          // 获取活跃时间
          const statsEl = document.querySelector('${YUPAO_CHAT_DETAILS_SELECTORS.candidateStats}');
          const activeTime = statsEl ? statsEl.textContent.trim() : '';
          
          // 获取期望职位和薪资
          const occNameEl = document.querySelector('${YUPAO_CHAT_DETAILS_SELECTORS.occName}');
          const expectedPosition = occNameEl ? occNameEl.textContent.replace('期望：', '').trim() : '';
          
          const salaryEl = document.querySelector('${YUPAO_CHAT_DETAILS_SELECTORS.salary}');
          const expectedSalary = salaryEl ? salaryEl.textContent.trim() : '';
          
          // 获取简历标签（性别、年龄、期望工作地）
          const resumeTags = Array.from(document.querySelectorAll('${YUPAO_CHAT_DETAILS_SELECTORS.resumeTag}'));
          let gender = '';
          let age = '';
          let expectedLocation = '';
          
          resumeTags.forEach(tag => {
            const text = tag.textContent.trim();
            if (text === '男' || text === '女') {
              gender = text;
            } else if (text.includes('岁')) {
              age = text;
            } else if (text.includes('期望工作地')) {
              expectedLocation = text.replace('期望工作地：', '').trim();
            }
          });
          
          // 获取额外标签信息（身高、体重、健康证等）
          const extraTags = Array.from(document.querySelectorAll('${YUPAO_CHAT_DETAILS_SELECTORS.tagValue}'));
          let height = '';
          let weight = '';
          let hasHealthCertificate = false;
          const additionalInfo = [];
          
          extraTags.forEach(tag => {
            const text = tag.textContent.trim();
            if (text.includes('身高')) {
              height = text.replace('身高', '').trim();
            } else if (text.includes('体重')) {
              weight = text.replace('体重', '').trim();
            } else if (text.includes('健康证')) {
              hasHealthCertificate = true;
            }
            additionalInfo.push(text);
          });
          
          // 尝试从岗位信息框中提取补充信息（如果顶部信息不完整）
          const jobBox = document.querySelector('${YUPAO_CHAT_DETAILS_SELECTORS.messageJobBox}');
          let jobInfo = {};
          if (jobBox) {
            const jobTitle = jobBox.querySelector('${YUPAO_CHAT_DETAILS_SELECTORS.jobTitle}');
            const jobTags = Array.from(jobBox.querySelectorAll('${YUPAO_CHAT_DETAILS_SELECTORS.jobTags}'));
            const jobAddress = jobBox.querySelector('${YUPAO_CHAT_DETAILS_SELECTORS.jobAddress}');
            const jobDesc = jobBox.querySelector('${YUPAO_CHAT_DETAILS_SELECTORS.jobDescription}');
            
            const position = jobTitle ? jobTitle.textContent.trim() : '';
            const tags = jobTags.map(tag => tag.textContent.trim());
            const address = jobAddress ? jobAddress.textContent.trim() : '';
            const description = jobDesc ? jobDesc.textContent.trim() : '';
            
            // 从描述中提取经验要求（如果还没有）
            const experienceMatch = description.match(/(\\d+年|\\d+年以上|应届生|在校生|经验优先)/);
            const experience = experienceMatch ? experienceMatch[1] : '';
            
            jobInfo = {
              jobPosition: position,
              jobTags: tags,
              jobAddress: address,
              jobDescription: description,
              experience: experience
            };
          }
          
          // 组装候选人信息
          candidateInfo = {
            name: candidateName,
            position: expectedPosition || jobInfo.jobPosition || '',
            age: age,
            gender: gender,
            experience: jobInfo.experience || '',
            education: '', // Yupao通常不在这里显示学历
            expectedSalary: expectedSalary,
            expectedLocation: expectedLocation,
            height: height,
            weight: weight,
            healthCertificate: hasHealthCertificate,
            activeTime: activeTime,
            info: additionalInfo,
            fullText: jobInfo.jobDescription || ''
          };
          
          // 获取聊天记录
          const chatBody = document.querySelector('${YUPAO_CHAT_DETAILS_SELECTORS.chatRecordBody}');
          
          let chatMessages = [];
          if (chatBody) {
            // 获取所有消息包装器
            const messageWraps = Array.from(chatBody.querySelectorAll('${YUPAO_CHAT_DETAILS_SELECTORS.msgWrap}'));
            
            // 同步处理每条消息
            messageWraps.forEach((msgWrap, i) => {
              // 获取时间信息（如果有）
              const timeElement = msgWrap.querySelector('${YUPAO_CHAT_DETAILS_SELECTORS.extraTime}');
              let time = '';
              let extraInfo = '';
              
              if (timeElement) {
                const timeText = timeElement.textContent || '';
                // 提取时间部分（如 "昨天20:52" 或 "10:37"）
                const timeMatch = timeText.match(/(昨天|今天)?\\s*(\\d{1,2}:\\d{2})/);
                if (timeMatch) {
                  time = (timeMatch[1] || '') + timeMatch[2];
                } else if (timeText.match(/\\d{1,2}:\\d{2}/)) {
                  time = timeText.match(/\\d{1,2}:\\d{2}/)[0];
                }
                // 提取额外信息（如 "对方向您发起了沟通"）
                extraInfo = timeText.replace(/(昨天|今天)?\\s*\\d{1,2}:\\d{2}/, '').trim();
              }
              
              // 检查是否是系统提示消息
              const msgTip = msgWrap.querySelector('${YUPAO_CHAT_DETAILS_SELECTORS.msgTip}');
              if (msgTip) {
                chatMessages.push({
                  index: i,
                  sender: 'system',
                  messageType: 'system',
                  content: msgTip.textContent.trim(),
                  time: time,
                  hasTime: !!time
                });
                return; // 跳过后续处理
              }
              
              // 获取消息主体
              const msgInner = msgWrap.querySelector('${YUPAO_CHAT_DETAILS_SELECTORS.msgInner}');
              if (!msgInner) return;
              
              // 判断发送者
              let sender = 'unknown';
              const isSelf = msgInner.classList.contains('msg-self');
              sender = isSelf ? 'recruiter' : 'candidate';
              
              // 检查已读状态
              const readStatus = msgInner.querySelector('${YUPAO_CHAT_DETAILS_SELECTORS.statusRead}');
              const isRead = readStatus ? readStatus.textContent.includes('已读') : false;
              
              // 检查是否是岗位信息
              const jobBox = msgInner.querySelector('${YUPAO_CHAT_DETAILS_SELECTORS.messageJobBox}');
              if (jobBox) {
                const jobTitle = jobBox.querySelector('${YUPAO_CHAT_DETAILS_SELECTORS.jobTitle}');
                const position = jobTitle ? jobTitle.textContent.trim() : '';
                
                chatMessages.push({
                  index: i,
                  sender: sender,
                  messageType: 'job-info',
                  content: '岗位信息: ' + position,
                  time: time,
                  hasTime: !!time,
                  isRead: isRead,
                  extraInfo: extraInfo
                });
                return;
              }
              
              // 获取文本消息
              const textBox = msgInner.querySelector('${YUPAO_CHAT_DETAILS_SELECTORS.messageTextBox}');
              if (textBox) {
                const messageTextEl = textBox.querySelector('${YUPAO_CHAT_DETAILS_SELECTORS.messageTextContent}');
                if (messageTextEl) {
                  const content = messageTextEl.textContent.trim();
                  
                  if (content) {
                    chatMessages.push({
                      index: i,
                      sender: sender,
                      messageType: 'text',
                      content: content,
                      time: time,
                      hasTime: !!time,
                      isRead: isRead,
                      extraInfo: extraInfo
                    });
                  }
                }
              }
            });
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
            candidateInfoFound: !!candidateInfo,
            chatContainerFound: !!chatBody,
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
                    candidateGender: parsedResult.candidateInfo?.gender || "",
                    candidateAge: parsedResult.candidateInfo?.age || "",
                    candidateExpectedSalary: parsedResult.candidateInfo?.expectedSalary || "",
                    candidateExpectedLocation: parsedResult.candidateInfo?.expectedLocation || "",
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
export const createYupaoChatDetailsTool = yupaoChatDetailsTool;

// 导出工具
export const GET_CHAT_DETAILS_ACTION = "get_chat_details";
import { tool } from "ai";
import { z } from "zod";
import { getPuppeteerMCPClient } from "@/lib/mcp/client-manager";
import { wrapAntiDetectionScript } from "../zhipin/anti-detection-utils";
import { createDynamicClassSelector, generateFindElementScript } from "./dynamic-selector-utils";

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
      maxDataSizeKB: z
        .number()
        .optional()
        .default(300)
        .describe("返回数据的最大大小（KB），默认300KB"),
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
          ${generateFindElementScript()}
          
          // 定义动态选择器
          const selectors = {
            topInfo: [
              '[class*="_top-info_"]:not([class*="wrap"])',
              'div[class*="_top-info_"]',
              '[class*="_chat-conversation"] > div:first-child'
            ],
            candidateName: [
              '[class*="_base-info"] p[class*="_name"]',
              '[class*="_user-info"] p[class*="_name"]',
              'p[class*="_name_"]:not([class*="wrap"])'
            ],
            candidateStats: [
              '${createDynamicClassSelector("_stats")}',
              'p[class*="_stats_"]',
              'p[class*="_stats_"] span'
            ],
            occName: [
              '${createDynamicClassSelector("_occ-name")}',
              'p[class*="_occ-name_"]',
              'div[class*="_title-resume"] p[class*="_occ-name"]'
            ],
            salary: [
              '${createDynamicClassSelector("_salary")}',
              'p[class*="_salary_"]',
              'div[class*="_info_"] p[class*="_salary"]'
            ],
            resumeTag: [
              '${createDynamicClassSelector("_resume-tag")}',
              'span[class*="_resume-tag_"]',
              'div[class*="_title-resume"] span[class*="_resume-tag"]'
            ],
            tagValue: [
              '${createDynamicClassSelector("_it-val")}',
              'p[class*="_it-val_"]',
              'div[class*="_tag_"] p[class*="_it-val"]'
            ],
            chatRecordBody: [
              '.chat-record-body',
              'div[class*="chat-record-body"]'
            ],
            msgWrap: [
              '.msg-wrap',
              'div[class*="msg-wrap"]'
            ],
            extraTime: [
              '.extra-time',
              'div[class*="extra-time"]'
            ],
            msgTip: [
              '.msg-tip',
              'div[class*="msg-tip"]'
            ],
            msgInner: [
              '.msg-inner',
              'div[class*="msg-inner"]'
            ],
            statusRead: [
              '.status-read',
              'span[class*="status-read"]'
            ],
            messageJobBox: [
              '.message-job-box',
              'div[class*="message-job-box"]'
            ],
            jobTitle: [
              '.message-job-box .title',
              'div[class*="message-job-box"] div[class*="title"]'
            ],
            jobTags: [
              '.message-job-box .tag-item',
              'div[class*="message-job-box"] span[class*="tag-item"]'
            ],
            jobAddress: [
              '.message-job-box .address',
              'div[class*="message-job-box"] div[class*="address"]'
            ],
            jobDescription: [
              '.message-job-box .dec',
              'div[class*="message-job-box"] div[class*="dec"]'
            ],
            viewPhoneBox: [
              '.view-phone-box',
              'div[class*="view-phone-box"]'
            ],
            contactNumber: [
              '.view-phone-box .text',
              'div[class*="view-phone-box"] p[class*="text"]',
              'div[class*="view-phone-box"] span[class*="text"]'
            ],
            contactTitle: [
              '.view-phone-box .title',
              'div[class*="view-phone-box"] p[class*="title"]',
              'div[class*="view-phone-box"] div[class*="title"]'
            ],
            phoneIcon: [
              '.yp-pc.yp-shouji3',
              'i[class*="yp-shouji"]'
            ],
            wechatIcon: [
              '.yp-pc.yp-weixinlogo',
              'i[class*="yp-weixin"]'
            ],
            exchangePhoneBox: [
              '.exchange-phone-box',
              'div[class*="exchange-phone-box"]'
            ],
            messageTextBox: [
              '.message-text-box',
              'div[class*="message-text-box"]'
            ],
            messageTextContent: [
              '.message-text pre p',
              'div[class*="message-text"] pre p',
              'div[class*="message-text"] p'
            ]
          };
          
          // 获取候选人基本信息
          let candidateInfo = null;
          
          // 首先找到顶部候选人信息区域
          const topInfoArea = findElement(document, selectors.topInfo);
          
          // 在顶部信息区域内查找候选人信息
          let candidateName = '候选人';
          let activeTime = '';
          let expectedPosition = '';
          let expectedSalary = '';
          
          if (topInfoArea) {
            // 在限定的区域内查找候选人姓名
            const candidateNameEl = findElement(topInfoArea, selectors.candidateName);
            candidateName = candidateNameEl ? candidateNameEl.textContent.trim() : '候选人';
            
            // 获取活跃时间
            const statsEl = findElement(topInfoArea, selectors.candidateStats);
            activeTime = statsEl ? statsEl.textContent.trim() : '';
            
            // 获取期望职位和薪资
            const occNameEl = findElement(topInfoArea, selectors.occName);
            expectedPosition = occNameEl ? occNameEl.textContent.replace('期望：', '').trim() : '';
            
            const salaryEl = findElement(topInfoArea, selectors.salary);
            expectedSalary = salaryEl ? salaryEl.textContent.trim() : '';
          }
          
          // 获取简历标签（性别、年龄、期望工作地）
          let resumeTags = [];
          let gender = '';
          let age = '';
          let expectedLocation = '';
          
          if (topInfoArea) {
            for (const selector of selectors.resumeTag) {
              try {
                const tags = topInfoArea.querySelectorAll(selector);
                if (tags.length > 0) {
                  resumeTags = Array.from(tags);
                  break;
                }
              } catch (e) {}
            }
            
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
          }
          
          // 获取额外标签信息（身高、体重、健康证等）
          let extraTags = [];
          if (topInfoArea) {
            for (const selector of selectors.tagValue) {
              try {
                const tags = topInfoArea.querySelectorAll(selector);
                if (tags.length > 0) {
                  extraTags = Array.from(tags);
                  break;
                }
              } catch (e) {}
            }
          }
          
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
          // 注意：岗位信息框在聊天记录中，不在topInfoArea内
          const jobBox = findElement(document, selectors.messageJobBox);
          let jobInfo = {};
          if (jobBox) {
            const jobTitle = findElement(jobBox, selectors.jobTitle);
            let jobTags = [];
            for (const selector of selectors.jobTags) {
              try {
                const tags = jobBox.querySelectorAll(selector);
                if (tags.length > 0) {
                  jobTags = Array.from(tags);
                  break;
                }
              } catch (e) {}
            }
            const jobAddress = findElement(jobBox, selectors.jobAddress);
            const jobDesc = findElement(jobBox, selectors.jobDescription);
            
            const position = jobTitle ? jobTitle.textContent.trim() : '';
            const tags = jobTags.map(tag => tag.textContent.trim());
            const address = jobAddress ? jobAddress.textContent.trim() : '';
            const description = jobDesc ? jobDesc.textContent.trim() : '';
            
            // 注意：这里是岗位的经验要求，不是候选人的经验
            const jobRequirementMatch = description.match(/(\\d+年|\\d+年以上|应届生|在校生|经验优先)/);
            const jobRequirement = jobRequirementMatch ? jobRequirementMatch[1] : '';
            
            jobInfo = {
              jobPosition: position,
              jobTags: tags,
              jobAddress: address,
              jobDescription: description,
              jobRequirement: jobRequirement  // 岗位要求，不是候选人经验
            };
          }
          
          // 从候选人的标签中获取工作经验（直接使用标签内容）
          let candidateExperience = '';
          // additionalInfo 包含了所有 _tags 元素中的标签（如：超市、便利店等）
          // 这些标签本身就代表了候选人的工作经验
          if (additionalInfo.length > 0) {
            // 直接使用标签作为候选人的经验
            candidateExperience = additionalInfo.join('、');
          }
          
          // 组装候选人信息
          candidateInfo = {
            name: candidateName,
            position: expectedPosition || jobInfo.jobPosition || '',
            age: age,
            gender: gender,
            experience: candidateExperience,  // 使用候选人的实际经验
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
          const chatBody = findElement(document, selectors.chatRecordBody);
          
          let chatMessages = [];
          if (chatBody) {
            // 获取所有消息包装器
            let messageWraps = [];
            for (const selector of selectors.msgWrap) {
              try {
                const wraps = chatBody.querySelectorAll(selector);
                if (wraps.length > 0) {
                  messageWraps = Array.from(wraps);
                  break;
                }
              } catch (e) {}
            }
            
            // 同步处理每条消息
            messageWraps.forEach((msgWrap, i) => {
              // 获取时间信息（如果有）
              const timeElement = findElement(msgWrap, selectors.extraTime);
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
              const msgTip = findElement(msgWrap, selectors.msgTip);
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
              const msgInner = findElement(msgWrap, selectors.msgInner);
              if (!msgInner) return;
              
              // 判断发送者
              let sender = 'unknown';
              const isSelf = msgInner.classList.contains('msg-self');
              sender = isSelf ? 'recruiter' : 'candidate';
              
              // 检查已读状态
              const readStatus = findElement(msgInner, selectors.statusRead);
              const isRead = readStatus ? readStatus.textContent.includes('已读') : false;
              
              // 检查是否是岗位信息
              const jobBox = findElement(msgInner, selectors.messageJobBox);
              if (jobBox) {
                const jobTitle = findElement(jobBox, selectors.jobTitle);
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
              
              // 检查是否是联系方式交换消息（电话或微信）
              const viewPhoneBox = findElement(msgInner, selectors.viewPhoneBox);
              if (viewPhoneBox) {
                const contactEl = findElement(viewPhoneBox, selectors.contactNumber);
                const contactValue = contactEl ? contactEl.textContent.trim() : '';
                const titleEl = findElement(viewPhoneBox, selectors.contactTitle);
                const contactTitle = titleEl ? titleEl.textContent.trim() : '';
                
                // 判断是电话还是微信
                const hasPhoneIcon = findElement(viewPhoneBox, selectors.phoneIcon);
                const hasWechatIcon = findElement(viewPhoneBox, selectors.wechatIcon);
                const contactType = hasPhoneIcon ? 'phone' : (hasWechatIcon ? 'wechat' : 'unknown');
                
                if (contactValue) {
                  chatMessages.push({
                    index: i,
                    sender: sender,
                    messageType: contactType === 'phone' ? 'phone-exchange' : 'wechat-exchange',
                    content: contactTitle + ': ' + contactValue,
                    contactType: contactType,
                    contactValue: contactValue,
                    phoneNumber: contactType === 'phone' ? contactValue : undefined,
                    wechatId: contactType === 'wechat' ? contactValue : undefined,
                    time: time,
                    hasTime: !!time,
                    isRead: isRead,
                    extraInfo: extraInfo
                  });
                }
                return;
              }
              
              // 检查是否是交换电话/微信请求消息
              const exchangePhoneBox = findElement(msgInner, selectors.exchangePhoneBox);
              if (exchangePhoneBox) {
                const requestText = exchangePhoneBox.querySelector('.tip-ss');
                const content = requestText ? requestText.textContent.trim() : '请求交换联系方式';
                
                // 判断是电话还是微信
                const hasWechatIcon = exchangePhoneBox.querySelector('.yp-weixinlogo') !== null;
                const type = hasWechatIcon ? 'wechat-exchange-request' : 'phone-exchange-request';
                
                // 检查状态
                const agreeBtn = exchangePhoneBox.querySelector('.agree.ep-btn');
                const isHandled = !agreeBtn || window.getComputedStyle(agreeBtn).display === 'none';
                const isAccepted = exchangePhoneBox.querySelector('.disabled') !== null; // 旧的判断方式保留作为参考
                
                chatMessages.push({
                  index: i,
                  sender: sender,
                  messageType: type,
                  content: content + (agreeBtn ? ' [待处理: 可点击同意]' : ''),
                  accepted: isAccepted || isHandled,
                  hasAgreeButton: !!agreeBtn,
                  time: time,
                  hasTime: !!time,
                  isRead: isRead,
                  extraInfo: extraInfo
                });
                return;
              }
              
              // 获取文本消息
              const textBox = findElement(msgInner, selectors.messageTextBox);
              if (textBox) {
                const messageTextEl = findElement(textBox, selectors.messageTextContent);
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
          
          // 提取交换的联系方式
          const phoneExchangeMessages = chatMessages.filter(m => m.messageType === 'phone-exchange');
          const wechatExchangeMessages = chatMessages.filter(m => m.messageType === 'wechat-exchange');
          const exchangedPhoneNumbers = phoneExchangeMessages.map(m => m.phoneNumber).filter(Boolean);
          const exchangedWechatIds = wechatExchangeMessages.map(m => m.wechatId).filter(Boolean);
          
          // 统计信息
          const stats = {
            totalMessages: originalCount,
            returnedMessages: chatMessages.length,
            candidateMessages: chatMessages.filter(m => m.sender === 'candidate').length,
            recruiterMessages: chatMessages.filter(m => m.sender === 'recruiter').length,
            systemMessages: chatMessages.filter(m => m.sender === 'system').length,
            messagesWithTime: chatMessages.filter(m => m.hasTime).length,
            phoneExchangeCount: phoneExchangeMessages.length,
            wechatExchangeCount: wechatExchangeMessages.length,
            phoneNumbers: exchangedPhoneNumbers,
            wechatIds: exchangedWechatIds,
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
                    phoneNumbers: parsedResult.stats?.phoneNumbers || [],
                    wechatIds: parsedResult.stats?.wechatIds || [],
                    phoneExchangeCount: parsedResult.stats?.phoneExchangeCount || 0,
                    wechatExchangeCount: parsedResult.stats?.wechatExchangeCount || 0,
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

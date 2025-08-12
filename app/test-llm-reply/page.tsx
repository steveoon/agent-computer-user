"use client";

import { useState } from "react";
import { BrandSelector } from "@/components/brand-selector";
import { useBrand } from "@/lib/contexts/brand-context";
import {
  clearBrandStorage,
  getBrandStorageStatus,
} from "@/lib/utils/brand-storage";
import { useModelConfig } from "@/lib/stores/model-config-store";
import { useConfigDataForChat } from "@/hooks/useConfigDataForChat";
import { Settings, MessageSquare, X, Plus } from "lucide-react";
import Link from "next/link";
import { REPLY_TYPE_NAMES, type ReplyContext } from "@/types/zhipin";

export default function TestLLMReplyPage() {
  const { currentBrand } = useBrand();
  const { classifyModel, replyModel, providerConfigs } = useModelConfig();
  const {
    configData,
    replyPrompts,
    isLoading: configLoading,
    error: configError,
  } = useConfigDataForChat();
  const [message, setMessage] = useState("");
  const [reply, setReply] = useState("");
  const [replyType, setReplyType] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [currentTestMessage, setCurrentTestMessage] = useState("");
  const [clickedButton, setClickedButton] = useState<number | null>(null);
  const [brandStats, setBrandStats] = useState<{
    historyCount: number;
    currentBrand: string | null;
  } | null>(null);
  const [conversationHistory, setConversationHistory] = useState<string[]>([]);
  const [historyInput, setHistoryInput] = useState("");
  const [showHistoryEditor, setShowHistoryEditor] = useState(false);
  const [selectedRole, setSelectedRole] = useState<"我" | "求职者">("求职者");

  // 🗑️ 清除品牌偏好
  const handleClearPreferences = async () => {
    try {
      await clearBrandStorage();
      alert("品牌偏好已清除！页面将刷新以重置状态。");
      window.location.reload();
    } catch (error) {
      alert("清除失败：" + error);
    }
  };

  // 📊 加载品牌统计信息
  const loadBrandStats = async () => {
    try {
      const stats = await getBrandStorageStatus();
      setBrandStats(stats);
    } catch (error) {
      console.warn("加载品牌统计失败:", error);
    }
  };

  const testPresetMessages = [
    "你好，我想找兼职工作",
    "杨浦区有工作吗？",
    "薪资是多少？",
    "我45岁了，可以做吗？",
    "有保险吗？",
    "什么时候可以面试？",
    "五角场附近有门店吗？",
    "海底捞有工作机会吗？",
    "需要每天都上班吗？",
    "一周要上几天班？",
    "可以换班吗？",
    "支持兼职吗？",
    "时间灵活吗？",
    "排班方式是什么？",
  ];

  const handleSubmit = async (testMessage?: string) => {
    const messageToTest = testMessage || message;

    if (!messageToTest.trim()) {
      return;
    }

    // 🔧 检查配置数据是否加载完成
    if (configLoading) {
      setError("配置数据加载中，请稍候...");
      return;
    }

    if (configError) {
      setError(`配置数据加载失败: ${configError}`);
      return;
    }

    if (!configData || !replyPrompts) {
      setError("配置数据未加载，请刷新页面重试");
      return;
    }

    setLoading(true);
    setError("");
    setReply("");
    setReplyType("");
    setReasoning("");
    setCurrentTestMessage(messageToTest);

    try {
      const response = await fetch("/api/test-llm-reply", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: messageToTest,
          brand: currentBrand,
          modelConfig: {
            classifyModel,
            replyModel,
            providerConfigs,
          },
          configData, // 🔧 传递配置数据
          replyPrompts, // 🔧 传递回复指令
          conversationHistory, // 传递对话历史
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      // 确保只存储文本内容，避免渲染对象
      const replyText = typeof data.reply === 'string' ? data.reply : data.reply?.text || '';
      setReply(replyText);
      setReplyType(data.replyType || '');
      setReasoning(data.reasoningText || '');
    } catch (error) {
      console.error("测试失败:", error);
      setError(error instanceof Error ? error.message : "未知错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">智能回复测试</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">当前品牌：</span>
            <BrandSelector showHistory={true} />
          </div>
          <Link href="/agent-config">
            <button className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors">
              <Settings className="w-4 h-4" />
              模型配置
            </button>
          </Link>
        </div>
      </div>

      {/* 当前模型配置显示 */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
        <h2 className="text-lg font-semibold text-blue-800 mb-3">
          🤖 当前模型配置
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium text-blue-700">分类模型：</span>
            <span className="text-blue-600">{classifyModel}</span>
          </div>
          <div>
            <span className="font-medium text-blue-700">回复模型：</span>
            <span className="text-blue-600">{replyModel}</span>
          </div>
        </div>
        <p className="text-xs text-blue-600 mt-2">
          💡 点击右上角"模型配置"按钮可以修改使用的AI模型
        </p>
      </div>

      {/* 对话历史编辑器 */}
      <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            对话历史上下文
          </h2>
          <button
            onClick={() => setShowHistoryEditor(!showHistoryEditor)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showHistoryEditor ? "收起" : "展开编辑"}
          </button>
        </div>
        
        {conversationHistory.length > 0 && (
          <div className="mb-3 space-y-1">
            <div className="text-sm text-gray-600">当前历史记录：</div>
            {conversationHistory.map((msg, index) => {
              const [role, ...contentParts] = msg.split(': ');
              const content = contentParts.join(': ');
              const isCandidate = role === "求职者";
              
              return (
                <div key={index} className="flex items-start gap-2 text-sm">
                  <div className={`flex-1 flex items-center gap-2 p-2 rounded border ${
                    isCandidate ? "bg-blue-50 border-blue-200" : "bg-green-50 border-green-200"
                  }`}>
                    <span className={`font-medium shrink-0 ${
                      isCandidate ? "text-blue-700" : "text-green-700"
                    }`}>
                      {role}:
                    </span>
                    <span className="flex-1">{content}</span>
                  </div>
                  <button
                    onClick={() => {
                      const newHistory = conversationHistory.filter((_, i) => i !== index);
                      setConversationHistory(newHistory);
                    }}
                    className="p-1 text-red-500 hover:text-red-700 shrink-0"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
        
        {showHistoryEditor && (
          <div className="space-y-3">
            <div className="flex gap-2">
              {/* 角色选择器 */}
              <div className="flex rounded-md shadow-sm">
                <button
                  type="button"
                  onClick={() => setSelectedRole("求职者")}
                  className={`px-3 py-2 text-sm font-medium border ${
                    selectedRole === "求职者"
                      ? "bg-blue-500 text-white border-blue-500 z-10"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  } rounded-l-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                >
                  求职者
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedRole("我")}
                  className={`px-3 py-2 text-sm font-medium border ${
                    selectedRole === "我"
                      ? "bg-blue-500 text-white border-blue-500 z-10"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  } rounded-r-md -ml-px focus:outline-none focus:ring-2 focus:ring-blue-500`}
                >
                  我
                </button>
              </div>
              
              {/* 消息输入框 */}
              <input
                type="text"
                value={historyInput}
                onChange={(e) => setHistoryInput(e.target.value)}
                placeholder={`输入${selectedRole}的消息内容`}
                className="flex-1 p-2 border rounded"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && historyInput.trim()) {
                    const formattedMessage = `${selectedRole}: ${historyInput.trim()}`;
                    setConversationHistory([...conversationHistory, formattedMessage]);
                    setHistoryInput("");
                  }
                }}
              />
              <button
                onClick={() => {
                  if (historyInput.trim()) {
                    const formattedMessage = `${selectedRole}: ${historyInput.trim()}`;
                    setConversationHistory([...conversationHistory, formattedMessage]);
                    setHistoryInput("");
                  }
                }}
                className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                添加
              </button>
            </div>
            
            <div className="flex items-center justify-between text-sm text-gray-600">
              <span>预设对话历史场景：</span>
              <span className="text-xs">按 Enter 快速添加</span>
            </div>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => {
                  setConversationHistory([
                    "求职者: 你好，我想找工作",
                    "我: 您好！我们正在招聘前厅服务员，请问您在上海哪个区呢？",
                    "求职者: 我在杨浦区"
                  ]);
                }}
                className="p-2 text-left border rounded hover:bg-gray-50 text-sm"
              >
                📦 地区询问场景
              </button>
              <button
                onClick={() => {
                  setConversationHistory([
                    "求职者: 你们还招人吗？",
                    "我: 是的，我们正在招聘。请问您想找什么岗位呢？",
                    "求职者: 前厅服务员，薪资多少？"
                  ]);
                }}
                className="p-2 text-left border rounded hover:bg-gray-50 text-sm"
              >
                💰 薪资询问场景
              </button>
              <button
                onClick={() => {
                  setConversationHistory([
                    "求职者: 这个工作需要上夜班吗？",
                    "我: 我们有白班和晚班，可以根据您的情况安排。",
                    "求职者: 那排班时间是怎么安排的？"
                  ]);
                }}
                className="p-2 text-left border rounded hover:bg-gray-50 text-sm"
              >
                🕰️ 排班时间场景
              </button>
              <button
                onClick={() => {
                  setConversationHistory([
                    "求职者: 我之前没做过餐饮",
                    "我: 没关系，我们会提供带薪培训。",
                    "求职者: 培训多久？培训期间有工资吗？"
                  ]);
                }}
                className="p-2 text-left border rounded hover:bg-gray-50 text-sm"
              >
                🎓 培训相关场景
              </button>
              <button
                onClick={() => {
                  setConversationHistory([]);
                }}
                className="p-2 text-center border border-red-300 text-red-600 rounded hover:bg-red-50 text-sm"
              >
                🗑️ 清空历史
              </button>
            </div>
          </div>
        )}
        
        {!showHistoryEditor && conversationHistory.length === 0 && (
          <p className="text-sm text-gray-500">
            点击"展开编辑"添加对话历史，模拟真实的聊天场景
          </p>
        )}
      </div>

      {/* 预设测试消息 */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">快速测试</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {testPresetMessages.map((msg, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setClickedButton(index);
                setTimeout(() => setClickedButton(null), 200);
                handleSubmit(msg);
              }}
              disabled={loading}
              className={`p-2 text-left border rounded hover:bg-gray-50 disabled:opacity-50 transition-colors duration-200 ${
                clickedButton === index ? "bg-blue-200" : ""
              } active:bg-blue-100`}
            >
              {msg}
            </button>
          ))}
        </div>
      </div>

      {/* 自定义测试 */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">自定义测试</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="输入候选人消息..."
            className="flex-1 p-2 border rounded"
            disabled={loading}
          />
          <button
            onClick={() => handleSubmit()}
            disabled={loading || !message.trim()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? "生成中..." : "测试"}
          </button>
        </div>
      </div>

      {/* 配置加载状态 */}
      {configLoading && (
        <div className="p-4 bg-blue-100 border border-blue-400 text-blue-700 rounded mb-4">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
            正在加载配置数据...
          </div>
        </div>
      )}

      {/* 结果显示 */}
      {loading && (
        <div className="p-4 bg-gray-100 rounded">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
            正在生成智能回复...
          </div>
          {currentTestMessage && (
            <div className="mt-2 text-sm text-gray-600">
              测试消息：
              <span className="font-medium">"{currentTestMessage}"</span>
              <br />
              使用品牌：
              <span className="font-medium text-blue-600">{currentBrand}</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded mb-4">
          <strong>错误：</strong> {error}
        </div>
      )}

      {reply && !loading && (
        <div className="space-y-3">
          <div className="p-4 bg-green-100 border border-green-400 rounded">
            <h3 className="font-semibold text-green-800 mb-2">
              智能回复：
            </h3>
            <p className="text-green-700">{reply}</p>
          </div>
          
          {(replyType || reasoning) && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded">
              <h3 className="font-semibold text-blue-800 mb-2">
                📊 分类分析
              </h3>
              {replyType && (
                <div className="mb-2">
                  <span className="font-medium text-blue-700">分类类型：</span>
                  <span className="text-blue-600 ml-1">
                    {REPLY_TYPE_NAMES[replyType as ReplyContext] || replyType}
                    {replyType && ` (${replyType})`}
                  </span>
                </div>
              )}
              {reasoning && (
                <div>
                  <span className="font-medium text-blue-700">分类依据：</span>
                  <span className="text-blue-600 ml-1">{reasoning}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 使用说明 */}
      <div className="mt-8 p-4 bg-gray-50 rounded">
        <h3 className="font-semibold text-gray-800 mb-3">功能说明</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-700">
          <div>
            <h4 className="font-medium mb-2">基本功能</h4>
            <ul className="space-y-1">
              <li>• 智能回复生成</li>
              <li>• 支持多品牌识别和切换</li>
              <li>• 自动降级到规则引擎</li>
              <li>• 实时配置模型参数</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">测试指南</h4>
            <ul className="space-y-1">
              <li>• 使用右上角切换品牌进行对比测试</li>
              <li>• 点击"模型配置"自定义模型</li>
              <li>• 测试排班、出勤等新功能</li>
              <li>• 验证不同场景下的回复准确性</li>
            </ul>
          </div>
        </div>

        {brandStats && (
          <div className="mt-4 p-3 bg-white rounded border">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                <strong>品牌状态：</strong>
                <span className="text-blue-600 mx-1">
                  {brandStats.currentBrand || "默认"}
                </span>
                <span className="text-gray-500">
                  | 历史记录：{brandStats.historyCount}条
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={loadBrandStats}
                  className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  刷新
                </button>
                <button
                  onClick={handleClearPreferences}
                  className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                >
                  清除
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

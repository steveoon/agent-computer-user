import { useState } from "react";
import { MessageSquare, Plus, ChevronUp, ChevronDown, X, MapPin } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ConversationHistoryCardProps {
  conversationHistory: string[];
  setConversationHistory: (history: string[]) => void;
}

export function ConversationHistoryCard({
  conversationHistory,
  setConversationHistory,
}: ConversationHistoryCardProps) {
  const [showHistoryEditor, setShowHistoryEditor] = useState(false);
  const [historyInput, setHistoryInput] = useState("");
  const [selectedRole, setSelectedRole] = useState<"我" | "求职者">("求职者");

  const moveHistoryItem = (index: number, direction: "up" | "down") => {
    const newHistory = [...conversationHistory];
    const targetIndex = direction === "up" ? index - 1 : index + 1;

    if (targetIndex >= 0 && targetIndex < newHistory.length) {
      [newHistory[index], newHistory[targetIndex]] = [newHistory[targetIndex], newHistory[index]];
      setConversationHistory(newHistory);
    }
  };

  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="pb-3 bg-white/20 border-b border-white/20">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-indigo-500" />
            对话历史上下文
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistoryEditor(!showHistoryEditor)}
            className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
          >
            {showHistoryEditor ? "收起编辑" : "编辑历史"}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {conversationHistory.length === 0 && !showHistoryEditor ? (
          <div className="text-center py-6 text-muted-foreground bg-white/30 rounded-lg border border-dashed border-white/40">
            <p className="text-sm">暂无历史记录</p>
            <Button
              variant="link"
              onClick={() => setShowHistoryEditor(true)}
              className="text-indigo-500 h-auto p-0 text-sm"
            >
              点击添加模拟对话历史
            </Button>
          </div>
        ) : (
          <div className="space-y-1 mb-2">
            {conversationHistory.map((msg, index) => {
              const [role, ...contentParts] = msg.split(": ");
              const content = contentParts.join(": ");
              const isCandidate = role === "求职者";

              return (
                <div
                  key={index}
                  className="group flex items-center gap-2 text-sm animate-in fade-in slide-in-from-bottom-2 duration-300"
                >
                  <div
                    className={`flex-1 flex items-center gap-2 p-2 rounded-lg border shadow-sm ${
                      isCandidate
                        ? "bg-white border-blue-100/50"
                        : "bg-emerald-50/50 border-emerald-100/50"
                    }`}
                  >
                    <Badge
                      variant={isCandidate ? "default" : "outline"}
                      className={`shrink-0 ${isCandidate ? "bg-blue-500 hover:bg-blue-600" : "text-emerald-600 border-emerald-200"}`}
                    >
                      {role}
                    </Badge>
                    <span className="flex-1 text-gray-700 leading-relaxed break-all">
                      {content}
                    </span>
                  </div>

                  {showHistoryEditor && (
                    <div className="flex flex-row items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => moveHistoryItem(index, "up")}
                        disabled={index === 0}
                        className="h-6 w-6"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => moveHistoryItem(index, "down")}
                        disabled={index === conversationHistory.length - 1}
                        className="h-6 w-6"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const newHistory = conversationHistory.filter((_, i) => i !== index);
                          setConversationHistory(newHistory);
                        }}
                        className="h-6 w-6 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {showHistoryEditor && (
          <div className="space-y-4 pt-4 border-t border-white/20">
            <div className="flex gap-2">
              <div className="flex rounded-lg shadow-sm">
                <Button
                  variant={selectedRole === "求职者" ? "default" : "outline"}
                  onClick={() => setSelectedRole("求职者")}
                  className={`rounded-r-none ${selectedRole === "求职者" ? "bg-blue-600" : "bg-white"}`}
                >
                  求职者
                </Button>
                <Button
                  variant={selectedRole === "我" ? "default" : "outline"}
                  onClick={() => setSelectedRole("我")}
                  className={`rounded-l-none border-l-0 ${selectedRole === "我" ? "bg-emerald-600" : "bg-white"}`}
                >
                  我
                </Button>
              </div>

              <div className="flex-1 flex gap-2">
                <Input
                  value={historyInput}
                  onChange={e => setHistoryInput(e.target.value)}
                  placeholder={`输入${selectedRole}的消息内容`}
                  className="bg-white/50"
                  onKeyDown={e => {
                    if (e.key === "Enter" && historyInput.trim()) {
                      const formattedMessage = `${selectedRole}: ${historyInput.trim()}`;
                      setConversationHistory([...conversationHistory, formattedMessage]);
                      setHistoryInput("");
                    }
                  }}
                />
                <Button
                  onClick={() => {
                    if (historyInput.trim()) {
                      const formattedMessage = `${selectedRole}: ${historyInput.trim()}`;
                      setConversationHistory([...conversationHistory, formattedMessage]);
                      setHistoryInput("");
                    }
                  }}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Plus className="w-4 h-4 mr-1" />
                  添加
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">快速预设场景：</p>
              <div className="flex flex-wrap gap-2">
                {[
                  {
                    text: "📦 地区询问",
                    icon: MapPin,
                    action: () => [
                      "求职者: 你好，我想找工作",
                      "我: 您好！我们正在招聘前厅服务员，请问您在上海哪个区呢？",
                      "求职者: 我在杨浦区",
                    ],
                  },
                  {
                    text: "💰 薪资询问",
                    icon: MapPin,
                    action: () => [
                      "求职者: 你们还招人吗？",
                      "我: 是的，我们正在招聘。请问您想找什么岗位呢？",
                      "求职者: 前厅服务员，薪资多少？",
                    ],
                  },
                  {
                    text: "🕰️ 排班时间",
                    icon: MapPin,
                    action: () => [
                      "求职者: 这个工作需要上夜班吗？",
                      "我: 我们有白班和晚班，可以根据您的情况安排。",
                      "求职者: 那排班时间是怎么安排的？",
                    ],
                  },
                  {
                    text: "🎓 培训相关",
                    icon: MapPin,
                    action: () => [
                      "求职者: 我之前没做过餐饮",
                      "我: 没关系，我们会提供带薪培训。",
                      "求职者: 培训多久？培训期间有工资吗？",
                    ],
                  },
                ].map((scenario, idx) => (
                  <Button
                    key={idx}
                    variant="outline"
                    size="sm"
                    className="bg-white/40 hover:bg-white/60 text-xs"
                    onClick={() => setConversationHistory(scenario.action())}
                  >
                    {scenario.text}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  className="bg-red-50/40 hover:bg-red-100/60 text-red-600 border-red-200 text-xs ml-auto"
                  onClick={() => setConversationHistory([])}
                >
                  清空
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

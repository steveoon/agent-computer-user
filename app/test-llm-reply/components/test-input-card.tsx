import { useState } from "react";
import { Play, RotateCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface TestInputCardProps {
  message: string;
  setMessage: (value: string) => void;
  handleSubmit: (msg?: string) => void;
  loading: boolean;
}

export function TestInputCard({ message, setMessage, handleSubmit, loading }: TestInputCardProps) {
  const [clickedButton, setClickedButton] = useState<number | null>(null);

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

  return (
    <Card className="glass-card border-indigo-200 shadow-md">
      <CardHeader className="pb-3 border-b border-indigo-100/50 bg-indigo-50/30">
        <CardTitle className="flex items-center gap-2 text-indigo-900">
          <Play className="w-5 h-5 fill-indigo-500 text-indigo-600" />
          测试输入
        </CardTitle>
        <CardDescription>选择预设问题或输入自定义内容进行测试</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* 预设测试消息 */}
        <div>
          <div className="flex justify-between items-center mb-3">
            <Label className="text-sm text-indigo-800">快速提问</Label>
          </div>
          <div className="flex flex-wrap gap-2">
            {testPresetMessages.map((msg, index) => (
              <button
                key={index}
                onClick={e => {
                  e.preventDefault();
                  setClickedButton(index);
                  setTimeout(() => setClickedButton(null), 200);
                  handleSubmit(msg);
                }}
                disabled={loading}
                className={`px-3 py-1.5 text-sm rounded-full border transition-all duration-200 ${
                  clickedButton === index
                    ? "bg-indigo-500 text-white border-indigo-600 shadow-inner scale-95"
                    : "bg-white/60 hover:bg-indigo-50 text-gray-700 border-gray-200 hover:border-indigo-300 shadow-sm hover:shadow"
                } disabled:opacity-50`}
              >
                {msg}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <Input
            type="text"
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="在此输入候选人的消息..."
            className="flex-1 bg-white/70 border-indigo-200 focus:border-indigo-400 focus:ring-indigo-400 h-11"
            disabled={loading}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
          />
          <Button
            onClick={() => handleSubmit()}
            disabled={loading || !message.trim()}
            className="h-11 px-6 bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200"
          >
            {loading ? (
              <>
                <RotateCw className="w-4 h-4 mr-2 animate-spin" /> 生成中
              </>
            ) : (
              "发送测试"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

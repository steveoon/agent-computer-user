import { ArrowUpRight } from "lucide-react";
import { Button } from "./ui/button";

export interface PromptSuggestion {
  text: string;
  prompt: string;
  editable?: boolean;
  editableFields?: Array<{
    key: string;
    pattern: RegExp;
    defaultValue?: string;
  }>;
}

const suggestions: PromptSuggestion[] = [
  {
    text: "查询Duliday BI报表数据",
    prompt:
      "获取 Duliday BI 报表数据，查一下订单归属日期从2025-08-08到2025-08-15，上海必胜客的订单，归属大区是浦东新区，数据范围100条",
    editable: true,
    editableFields: [
      {
        key: "开始日期",
        pattern: /2025-08-08/g,
        defaultValue: "2025-08-08",
      },
      {
        key: "结束日期",
        pattern: /2025-08-15/g,
        defaultValue: "2025-08-15",
      },
      {
        key: "品牌门店",
        pattern: /上海必胜客/g,
        defaultValue: "上海必胜客",
      },
      {
        key: "归属大区",
        pattern: /浦东新区/g,
        defaultValue: "浦东新区",
      },
      {
        key: "数据范围",
        pattern: /100/g,
        defaultValue: "100",
      },
    ],
  },
  {
    text: "发送前厅岗位空缺通知",
    prompt: "生成前厅岗位空缺的通知消息，并用Wechat发送",
    editable: true,
    editableFields: [
      {
        key: "岗位",
        pattern: /前厅/g,
        defaultValue: "前厅",
      },
    ],
  },
  {
    text: "预约面试",
    prompt: `帮我为求职者预约面试，以下是信息：
姓名：李青，电话：13585516989，性别：男，年龄：39，
门店：奥乐齐世茂店，岗位：兼职，面试时间：2025-07-22 13:00:00

请按以下步骤操作：
1) 使用 duliday_job_list 工具查找指定门店的岗位（如指定了岗位关键词，使用 jobNickName 或 laborForm 参数过滤）
2) 从返回结果中获取 jobId
3) 使用 duliday_interview_booking 工具预约面试`,
    editable: true,
    editableFields: [
      { key: "姓名", pattern: /姓名：([^，\n]+)/g },
      { key: "电话", pattern: /电话：(\d+)/g },
      { key: "性别", pattern: /性别：([男女])/g },
      { key: "年龄", pattern: /年龄：(\d+)/g },
      { key: "门店", pattern: /门店：([^，\n]+)/g },
      { key: "岗位", pattern: /岗位：([^，\n]+)/g },
      { key: "面试时间", pattern: /面试时间：([\d\-\s:]+)/g },
    ],
  },
  {
    text: "处理直聘未读消息",
    prompt:
      "我正在BOSS直聘的消息页面，请开始处理未读消息。分析页面，找到未读对话并开始按流程沟通。",
    editable: false,
  },
  {
    text: "发送岗位通知到飞书",
    prompt:
      "生成后厨岗位空缺的通知消息，门店是静安大悦城店，并发送到飞书群，你需要先获取品牌下门店和岗位详情",
    editable: true,
    editableFields: [
      { key: "岗位", pattern: /后厨/g, defaultValue: "后厨" },
      { key: "门店", pattern: /静安大悦城店/g, defaultValue: "静安大悦城店" },
      { key: "平台", pattern: /飞书/g, defaultValue: "飞书" },
    ],
  },
];

export const PromptSuggestions = ({
  submitPrompt,
  disabled,
}: {
  submitPrompt: (suggestion: PromptSuggestion) => void;
  disabled: boolean;
}) => {
  return (
    <div className="flex flex-wrap items-center gap-3 px-4 py-3 bg-white border-t border-zinc-200">
      {suggestions.map((suggestion, index) => (
        <Button
          key={index}
          variant="pill"
          size="pill"
          onClick={() => submitPrompt(suggestion)}
          disabled={disabled}
        >
          <span>
            <span className="text-black text-sm">{suggestion.text.toLowerCase()}</span>
          </span>
          <ArrowUpRight className="ml-1 h-2 w-2 sm:h-3 sm:w-3 text-zinc-500 group-hover:opacity-70" />
        </Button>
      ))}
    </div>
  );
};

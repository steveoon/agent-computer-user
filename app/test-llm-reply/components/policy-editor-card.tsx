"use client";

import { useState, type KeyboardEvent } from "react";
import {
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sliders,
  User,
  Target,
  Megaphone,
  ShieldAlert,
  X,
  Plus,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type {
  ReplyPolicyConfig,
  FunnelStage,
  StageGoalPolicy,
  HardConstraintRule,
} from "@/types/reply-policy";

// ========== 常量 ==========

const STAGE_LABELS: Record<FunnelStage, string> = {
  trust_building: "建立信任",
  private_channel: "私域转化",
  qualify_candidate: "资质确认",
  job_consultation: "岗位咨询",
  interview_scheduling: "面试邀约",
  onboard_followup: "到岗跟进",
};

const PERSONA_FIELDS: Array<{
  key: keyof ReplyPolicyConfig["persona"];
  label: string;
  description: string;
  type: "input" | "select";
  options?: Array<{ value: string; label: string }>;
  placeholder?: string;
}> = [
  {
    key: "tone",
    label: "语气",
    description: "回复的语言风格，直接写入 LLM prompt",
    type: "select",
    options: [
      { value: "口语化", label: "口语化 — 像聊天一样自然" },
      { value: "正式", label: "正式 — 书面化、职业感" },
      { value: "亲切随和", label: "亲切随和 — 偏温暖但不过于口语" },
      { value: "简洁干练", label: "简洁干练 — 直奔主题，不废话" },
    ],
  },
  {
    key: "warmth",
    label: "亲和度",
    description: "回复中的情感温度",
    type: "select",
    options: [
      { value: "高", label: "高 — 热情关心，主动表达善意" },
      { value: "中", label: "中 — 礼貌友好，适度关心" },
      { value: "低", label: "低 — 客观中性，公事公办" },
    ],
  },
  {
    key: "humor",
    label: "幽默度",
    description: "回复中是否加入轻松元素",
    type: "select",
    options: [
      { value: "无", label: "无 — 完全严肃正经" },
      { value: "低", label: "低 — 偶尔轻松，不刻意" },
      { value: "中", label: "中 — 适度幽默，拉近距离" },
      { value: "高", label: "高 — 活泼风趣，善用比喻" },
    ],
  },
  {
    key: "length",
    label: "回复长度",
    description: "LLM 理解的长度偏好（非硬性字数限制）",
    type: "select",
    options: [
      { value: "short", label: "short — 1-2句话，简短直接" },
      { value: "medium", label: "medium — 3-5句话，适度展开" },
      { value: "long", label: "long — 详细回复，充分说明" },
    ],
  },
  {
    key: "questionStyle",
    label: "提问风格",
    description: "每轮回复中如何向候选人提问",
    type: "select",
    options: [
      { value: "单轮一个关键问题", label: "单轮一个关键问题" },
      { value: "不主动提问", label: "不主动提问 — 只回答" },
      { value: "开放式引导", label: "开放式引导 — 用开放问题引发思考" },
      { value: "二选一提问", label: "二选一提问 — 给出选项降低回答门槛" },
    ],
  },
  {
    key: "empathyStrategy",
    label: "共情策略",
    description: "面对候选人顾虑时的回应方式",
    type: "select",
    options: [
      { value: "先认可关切再给建议", label: "先认可关切再给建议" },
      { value: "直接给方案", label: "直接给方案 — 跳过情感直接解决" },
      { value: "复述对方感受后引导", label: "复述对方感受后引导" },
    ],
  },
  {
    key: "addressStyle",
    label: "称呼方式",
    description: "对候选人的人称用语",
    type: "select",
    options: [
      { value: "使用你", label: "用「你」— 亲切随意" },
      { value: "使用您", label: "用「您」— 正式尊敬" },
      { value: "称呼亲", label: "称呼「亲」— 电商/客服风格" },
    ],
  },
  {
    key: "professionalIdentity",
    label: "职业身份",
    description: "AI 以什么身份自居（写入 system prompt）",
    type: "input",
    placeholder: "如：资深招聘专员、HR顾问、门店店长",
  },
  {
    key: "companyBackground",
    label: "公司背景",
    description: "所在行业/公司类型（影响 LLM 用语风格）",
    type: "input",
    placeholder: "如：连锁餐饮招聘、物流配送平台",
  },
];

// ========== TagEditor 子组件 ==========

function TagEditor({
  tags,
  onChange,
  placeholder = "输入后回车添加",
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}): React.ReactElement {
  const [input, setInput] = useState("");

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === "Enter" && input.trim()) {
      e.preventDefault();
      if (!tags.includes(input.trim())) {
        onChange([...tags, input.trim()]);
      }
      setInput("");
    }
  };

  const handleRemove = (index: number): void => {
    onChange(tags.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map((tag, i) => (
          <Badge
            key={`${tag}-${i}`}
            variant="secondary"
            className="gap-1 pr-1 bg-indigo-50 text-indigo-700 border-indigo-200"
          >
            {tag}
            <button
              type="button"
              onClick={() => handleRemove(i)}
              className="ml-0.5 hover:bg-indigo-200 rounded-full p-0.5 transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="h-8 text-sm bg-white/70 border-indigo-200 focus:border-indigo-400"
      />
    </div>
  );
}

// ========== Tab: 人格编辑 ==========

function PersonaTab({
  persona,
  onChange,
}: {
  persona: ReplyPolicyConfig["persona"];
  onChange: (persona: ReplyPolicyConfig["persona"]) => void;
}): React.ReactElement {
  const update = (key: keyof typeof persona, value: string): void => {
    onChange({ ...persona, [key]: value });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {PERSONA_FIELDS.map((field) => (
        <div key={field.key} className="space-y-1.5">
          <Label className="text-xs font-medium text-indigo-800">{field.label}</Label>
          <p className="text-[11px] text-muted-foreground leading-tight -mt-0.5">{field.description}</p>
          {field.type === "select" && field.options ? (
            <Select
              value={persona[field.key]}
              onValueChange={(v) => update(field.key, v)}
            >
              <SelectTrigger className="h-9 text-sm bg-white/70 border-indigo-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {field.options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              value={persona[field.key]}
              onChange={(e) => update(field.key, e.target.value)}
              placeholder={field.placeholder}
              className="h-9 text-sm bg-white/70 border-indigo-200 focus:border-indigo-400"
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ========== Tab: 阶段目标编辑 ==========

function StageGoalsTab({
  stageGoals,
  onChange,
}: {
  stageGoals: ReplyPolicyConfig["stageGoals"];
  onChange: (stageGoals: ReplyPolicyConfig["stageGoals"]) => void;
}): React.ReactElement {
  const stages = Object.keys(STAGE_LABELS) as FunnelStage[];

  const updateStage = (stage: FunnelStage, updated: StageGoalPolicy): void => {
    onChange({ ...stageGoals, [stage]: updated });
  };

  return (
    <Accordion type="single" collapsible className="w-full">
      {stages.map((stage) => {
        const goal = stageGoals[stage];
        return (
          <AccordionItem key={stage} value={stage} className="border-indigo-100">
            <AccordionTrigger className="hover:no-underline py-3">
              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="font-mono text-xs bg-indigo-50 border-indigo-200">
                  {stage}
                </Badge>
                <span className="text-indigo-800 font-medium">{STAGE_LABELS[stage]}</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-2 pb-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-indigo-800">主要目标</Label>
                <Input
                  value={goal.primaryGoal}
                  onChange={(e) =>
                    updateStage(stage, { ...goal, primaryGoal: e.target.value })
                  }
                  className="text-sm bg-white/70 border-indigo-200 focus:border-indigo-400"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-indigo-800">成功标准</Label>
                <TagEditor
                  tags={goal.successCriteria}
                  onChange={(tags) =>
                    updateStage(stage, { ...goal, successCriteria: tags })
                  }
                  placeholder="输入成功标准后回车"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-indigo-800">推进策略 (CTA)</Label>
                <Input
                  value={goal.ctaStrategy}
                  onChange={(e) =>
                    updateStage(stage, { ...goal, ctaStrategy: e.target.value })
                  }
                  className="text-sm bg-white/70 border-indigo-200 focus:border-indigo-400"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-indigo-800">禁止行为</Label>
                <TagEditor
                  tags={goal.disallowedActions || []}
                  onChange={(tags) =>
                    updateStage(stage, { ...goal, disallowedActions: tags })
                  }
                  placeholder="输入禁止行为后回车"
                />
              </div>
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}

// ========== Tab: 行业语境编辑 ==========

function IndustryVoiceTab({
  policy,
  onChange,
}: {
  policy: ReplyPolicyConfig;
  onChange: (policy: ReplyPolicyConfig) => void;
}): React.ReactElement {
  const voiceId = policy.defaultIndustryVoiceId;
  const voice = policy.industryVoices[voiceId];

  if (!voice) {
    return (
      <div className="text-sm text-muted-foreground p-4 text-center">
        未找到 ID 为 &quot;{voiceId}&quot; 的行业语境配置
      </div>
    );
  }

  const updateVoice = (
    key: keyof typeof voice,
    value: string | string[]
  ): void => {
    onChange({
      ...policy,
      industryVoices: {
        ...policy.industryVoices,
        [voiceId]: { ...voice, [key]: value },
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Label className="text-xs text-muted-foreground">当前语境 ID:</Label>
        <Badge variant="outline" className="font-mono text-xs">
          {voiceId}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-indigo-800">名称</Label>
          <Input
            value={voice.name}
            onChange={(e) => updateVoice("name", e.target.value)}
            className="text-sm bg-white/70 border-indigo-200 focus:border-indigo-400"
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-xs font-medium text-indigo-800">行业背景</Label>
          <Textarea
            value={voice.industryBackground}
            onChange={(e) => updateVoice("industryBackground", e.target.value)}
            className="text-sm bg-white/70 border-indigo-200 focus:border-indigo-400 min-h-[60px]"
          />
        </div>
      </div>

      <Separator className="bg-indigo-100" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-indigo-800">行业术语 (jargon)</Label>
          <TagEditor
            tags={voice.jargon}
            onChange={(tags) => updateVoice("jargon", tags)}
            placeholder="如：排班、到岗"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-indigo-800">风格关键词</Label>
          <TagEditor
            tags={voice.styleKeywords}
            onChange={(tags) => updateVoice("styleKeywords", tags)}
            placeholder="如：直接、清晰"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-indigo-800">禁忌用语</Label>
          <TagEditor
            tags={voice.tabooPhrases}
            onChange={(tags) => updateVoice("tabooPhrases", tags)}
            placeholder="如：包过、绝对"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-medium text-indigo-800">引导原则</Label>
          <TagEditor
            tags={voice.guidance}
            onChange={(tags) => updateVoice("guidance", tags)}
            placeholder="如：先解决顾虑"
          />
        </div>
      </div>
    </div>
  );
}

// ========== Tab: 红线 & FactGate ==========

function ConstraintsTab({
  policy,
  onChange,
}: {
  policy: ReplyPolicyConfig;
  onChange: (policy: ReplyPolicyConfig) => void;
}): React.ReactElement {
  const { hardConstraints, factGate } = policy;

  const updateRule = (index: number, updated: HardConstraintRule): void => {
    const rules = [...hardConstraints.rules];
    rules[index] = updated;
    onChange({
      ...policy,
      hardConstraints: { ...hardConstraints, rules },
    });
  };

  const removeRule = (index: number): void => {
    onChange({
      ...policy,
      hardConstraints: {
        ...hardConstraints,
        rules: hardConstraints.rules.filter((_, i) => i !== index),
      },
    });
  };

  const addRule = (): void => {
    const id = `rule-${Date.now()}`;
    onChange({
      ...policy,
      hardConstraints: {
        ...hardConstraints,
        rules: [
          ...hardConstraints.rules,
          { id, rule: "", severity: "medium" as const },
        ],
      },
    });
  };

  const updateFactGate = (
    key: keyof typeof factGate,
    value: string | string[]
  ): void => {
    onChange({
      ...policy,
      factGate: { ...factGate, [key]: value },
    });
  };

  return (
    <div className="space-y-6">
      {/* Hard Constraints */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-semibold text-indigo-900">
            红线规则 ({hardConstraints.rules.length})
          </Label>
          <Button
            variant="outline"
            size="sm"
            onClick={addRule}
            className="h-7 text-xs gap-1"
          >
            <Plus className="h-3 w-3" /> 添加规则
          </Button>
        </div>

        <div className="space-y-2">
          {hardConstraints.rules.map((rule, i) => (
            <div
              key={rule.id}
              className="flex items-start gap-2 p-3 bg-white/50 rounded-lg border border-indigo-100"
            >
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="font-mono text-[10px] shrink-0"
                  >
                    {rule.id}
                  </Badge>
                  <Select
                    value={rule.severity}
                    onValueChange={(v) =>
                      updateRule(i, {
                        ...rule,
                        severity: v as "high" | "medium" | "low",
                      })
                    }
                  >
                    <SelectTrigger className="h-7 w-24 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">high</SelectItem>
                      <SelectItem value="medium">medium</SelectItem>
                      <SelectItem value="low">low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Input
                  value={rule.rule}
                  onChange={(e) => updateRule(i, { ...rule, rule: e.target.value })}
                  placeholder="规则描述"
                  className="text-sm bg-white/70 border-indigo-200 focus:border-indigo-400"
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeRule(i)}
                className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      <Separator className="bg-indigo-100" />

      {/* FactGate */}
      <div className="space-y-4">
        <Label className="text-sm font-semibold text-indigo-900">FactGate 配置</Label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-indigo-800">模式</Label>
            <Select
              value={factGate.mode}
              onValueChange={(v) => updateFactGate("mode", v)}
            >
              <SelectTrigger className="h-9 text-sm bg-white/70 border-indigo-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="strict">strict (严格)</SelectItem>
                <SelectItem value="balanced">balanced (平衡)</SelectItem>
                <SelectItem value="open">open (开放)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-indigo-800">缺事实回退策略</Label>
            <Select
              value={factGate.fallbackBehavior}
              onValueChange={(v) => updateFactGate("fallbackBehavior", v)}
            >
              <SelectTrigger className="h-9 text-sm bg-white/70 border-indigo-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="generic_answer">generic_answer (泛化回答)</SelectItem>
                <SelectItem value="ask_followup">ask_followup (追问)</SelectItem>
                <SelectItem value="handoff">handoff (转人工)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-indigo-800">可验证声明类型</Label>
            <TagEditor
              tags={factGate.verifiableClaimTypes}
              onChange={(tags) => updateFactGate("verifiableClaimTypes", tags)}
              placeholder="如：salary, location"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-indigo-800">缺事实时禁止内容</Label>
            <TagEditor
              tags={factGate.forbiddenWhenMissingFacts}
              onChange={(tags) => updateFactGate("forbiddenWhenMissingFacts", tags)}
              placeholder="如：具体数字"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ========== 主组件 ==========

interface PolicyEditorCardProps {
  policy: ReplyPolicyConfig;
  onChange: (policy: ReplyPolicyConfig) => void;
  onReset: () => void;
}

export function PolicyEditorCard({
  policy,
  onChange,
  onReset,
}: PolicyEditorCardProps): React.ReactElement {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className="glass-card">
      <CardHeader
        className="pb-3 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-indigo-900">
            <Sliders className="h-5 w-5" />
            策略配置
            <Badge variant="secondary" className="ml-2 text-xs font-normal">
              {policy.factGate.mode} mode
            </Badge>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onReset();
              }}
              className="h-8 text-xs gap-1 text-muted-foreground hover:text-indigo-600"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              重置
            </Button>
            {expanded ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          <Tabs defaultValue="persona" className="w-full">
            <TabsList className="grid w-full grid-cols-4 glass-tabs mb-4">
              <TabsTrigger value="persona" className="gap-1.5 text-xs glass-tab-active">
                <User className="h-3.5 w-3.5" />
                人格
              </TabsTrigger>
              <TabsTrigger value="stages" className="gap-1.5 text-xs glass-tab-active">
                <Target className="h-3.5 w-3.5" />
                阶段目标
              </TabsTrigger>
              <TabsTrigger value="voice" className="gap-1.5 text-xs glass-tab-active">
                <Megaphone className="h-3.5 w-3.5" />
                行业语境
              </TabsTrigger>
              <TabsTrigger value="constraints" className="gap-1.5 text-xs glass-tab-active">
                <ShieldAlert className="h-3.5 w-3.5" />
                红线
              </TabsTrigger>
            </TabsList>

            <TabsContent value="persona">
              <PersonaTab
                persona={policy.persona}
                onChange={(persona) => onChange({ ...policy, persona })}
              />
            </TabsContent>

            <TabsContent value="stages">
              <StageGoalsTab
                stageGoals={policy.stageGoals}
                onChange={(stageGoals) => onChange({ ...policy, stageGoals })}
              />
            </TabsContent>

            <TabsContent value="voice">
              <IndustryVoiceTab policy={policy} onChange={onChange} />
            </TabsContent>

            <TabsContent value="constraints">
              <ConstraintsTab policy={policy} onChange={onChange} />
            </TabsContent>
          </Tabs>
        </CardContent>
      )}
    </Card>
  );
}

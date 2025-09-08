"use client";

import { useState } from "react";
import type { ZhipinData } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit2, Save, X } from "lucide-react";
import { useBrandEditorStore } from "@/lib/stores/brand-editor-store";
import { ReplyContext } from "@/types/zhipin";

interface TemplateEditorProps {
  brandName: string;
  onDataUpdate?: (data: ZhipinData, brandName?: string) => Promise<void>;
}

const REPLY_TYPE_LABELS: Record<
  ReplyContext,
  { label: string; category: "recruitment" | "attendance" }
> = {
  initial_inquiry: { label: "初次咨询工作机会", category: "recruitment" },
  location_inquiry: { label: "询问位置但无具体指向", category: "recruitment" },
  no_location_match: { label: "提到位置但无法匹配", category: "recruitment" },
  schedule_inquiry: { label: "询问工作时间安排", category: "recruitment" },
  interview_request: { label: "表达面试意向", category: "recruitment" },
  general_chat: { label: "一般性对话", category: "recruitment" },
  salary_inquiry: { label: "询问薪资待遇（敏感）", category: "recruitment" },
  age_concern: { label: "年龄相关问题（敏感）", category: "recruitment" },
  insurance_inquiry: { label: "保险福利问题（敏感）", category: "recruitment" },
  followup_chat: { label: "需要跟进的聊天", category: "recruitment" },
  attendance_inquiry: { label: "出勤要求咨询", category: "attendance" },
  flexibility_inquiry: { label: "排班灵活性咨询", category: "attendance" },
  attendance_policy_inquiry: { label: "考勤政策咨询", category: "attendance" },
  work_hours_inquiry: { label: "工时要求咨询", category: "attendance" },
  availability_inquiry: { label: "时间段可用性咨询", category: "attendance" },
  part_time_support: { label: "兼职支持咨询", category: "attendance" },
};

const ALL_REPLY_TYPES = Object.keys(REPLY_TYPE_LABELS) as ReplyContext[];

export function TemplateEditor({ brandName, onDataUpdate }: TemplateEditorProps) {
  const { localData, updateTemplates } = useBrandEditorStore();

  const [editingTemplate, setEditingTemplate] = useState<{
    type: ReplyContext;
    index: number;
    value: string;
  } | null>(null);

  // 自动保存函数
  const autoSave = async (updatedData: ZhipinData | null) => {
    if (updatedData && onDataUpdate) {
      try {
        await onDataUpdate(updatedData, brandName);
        console.log(`✅ ${brandName}话术模板已自动保存并同步状态`);
      } catch (error) {
        console.error(`❌ ${brandName}话术模板自动保存失败:`, error);
      }
    }
  };
  const [newTemplate, setNewTemplate] = useState<{
    type: ReplyContext;
    value: string;
  } | null>(null);

  if (!localData?.brands[brandName]) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">品牌数据未找到</div>
        </CardContent>
      </Card>
    );
  }

  const templates = localData.brands[brandName].templates;

  const handleAddTemplate = (type: ReplyContext) => {
    setNewTemplate({ type, value: "" });
  };

  const handleSaveNewTemplate = async () => {
    if (!newTemplate || !newTemplate.value.trim()) return;

    // 深拷贝模板以避免修改共享引用
    const updatedTemplates = structuredClone(templates);
    updatedTemplates[newTemplate.type] = [
      ...(updatedTemplates[newTemplate.type] || []),
      newTemplate.value.trim(),
    ];

    const updatedData = updateTemplates(brandName, updatedTemplates);
    await autoSave(updatedData);
    setNewTemplate(null);
  };

  const handleEditTemplate = (type: ReplyContext, index: number) => {
    const currentValue = templates[type]?.[index] || "";
    setEditingTemplate({ type, index, value: currentValue });
  };

  const handleSaveEdit = async () => {
    if (!editingTemplate || !editingTemplate.value.trim()) return;

    // 深拷贝模板以避免修改共享引用
    const updatedTemplates = structuredClone(templates);
    if (!updatedTemplates[editingTemplate.type]) {
      updatedTemplates[editingTemplate.type] = [];
    }

    // 确保数组存在且索引有效
    const templateArray = updatedTemplates[editingTemplate.type];
    if (templateArray && editingTemplate.index >= 0) {
      templateArray[editingTemplate.index] = editingTemplate.value.trim();
    }

    const updatedData = updateTemplates(brandName, updatedTemplates);
    await autoSave(updatedData);
    setEditingTemplate(null);
  };

  const handleDeleteTemplate = async (type: ReplyContext, index: number) => {
    // 深拷贝模板以避免修改共享引用
    const updatedTemplates = structuredClone(templates);
    if (updatedTemplates[type]) {
      updatedTemplates[type] = updatedTemplates[type].filter((_, i) => i !== index);
      if (updatedTemplates[type].length === 0) {
        delete updatedTemplates[type];
      }
    }

    const updatedData = updateTemplates(brandName, updatedTemplates);
    await autoSave(updatedData);
  };

  const recruitmentTypes = ALL_REPLY_TYPES.filter(
    type => REPLY_TYPE_LABELS[type].category === "recruitment"
  );
  const attendanceTypes = ALL_REPLY_TYPES.filter(
    type => REPLY_TYPE_LABELS[type].category === "attendance"
  );

  const renderTemplateSection = (types: ReplyContext[], categoryLabel: string) => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{categoryLabel}</h3>
      <Accordion type="single" collapsible className="w-full">
        {types.map(type => {
          const typeTemplates = templates[type] || [];
          const isConfigured = typeTemplates.length > 0;

          return (
            <AccordionItem key={type} value={type}>
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center justify-between w-full pr-4">
                  <div className="flex items-center gap-3 text-left">
                    <span>{REPLY_TYPE_LABELS[type].label}</span>
                    <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono text-muted-foreground">
                      {type}
                    </code>
                  </div>
                  <Badge variant={isConfigured ? "default" : "secondary"}>
                    {isConfigured ? `${typeTemplates.length} 条话术` : "未配置"}
                  </Badge>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 pt-2">
                  {typeTemplates.map((template, index) => (
                    <div key={index} className="relative group">
                      {editingTemplate?.type === type && editingTemplate?.index === index ? (
                        <div className="space-y-2">
                          <Textarea
                            value={editingTemplate.value}
                            onChange={e =>
                              setEditingTemplate({
                                ...editingTemplate,
                                value: e.target.value,
                              })
                            }
                            className="min-h-[80px]"
                            placeholder="请输入话术内容"
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={handleSaveEdit}>
                              <Save className="h-4 w-4 mr-1" />
                              保存并应用
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingTemplate(null)}
                            >
                              <X className="h-4 w-4 mr-1" />
                              取消
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-start gap-2">
                          <div className="flex-1 p-3 bg-muted rounded-md">
                            <p className="text-sm whitespace-pre-wrap">{template}</p>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleEditTemplate(type, index)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteTemplate(type, index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}

                  {newTemplate?.type === type ? (
                    <div className="space-y-2">
                      <Textarea
                        value={newTemplate.value}
                        onChange={e =>
                          setNewTemplate({
                            ...newTemplate,
                            value: e.target.value,
                          })
                        }
                        className="min-h-[80px]"
                        placeholder="请输入新的话术内容"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button size="sm" onClick={handleSaveNewTemplate}>
                          <Save className="h-4 w-4 mr-1" />
                          保存并添加
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setNewTemplate(null)}>
                          <X className="h-4 w-4 mr-1" />
                          取消
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAddTemplate(type)}
                      className="w-full"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      添加话术
                    </Button>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>话术模板配置</CardTitle>
        <p className="text-sm text-muted-foreground">
          配置品牌专属的回复话术，支持16种不同的对话场景
        </p>
        <p className="text-xs text-green-600 mt-1">💡 提示：话术修改后会自动保存</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {renderTemplateSection(recruitmentTypes, "招聘相关话术 (1-10)")}
        {renderTemplateSection(attendanceTypes, "考勤相关话术 (11-16)")}
      </CardContent>
    </Card>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Settings,
  Bot,
  Zap,
  MessageSquare,
  Globe,
  RefreshCw,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";

import { useModelConfig } from "@/lib/stores/model-config-store";
import {
  MODEL_DICTIONARY,
  getChatModels,
  getGeneralModels,
  DEFAULT_PROVIDER_CONFIGS,
  type ProviderConfig,
} from "@/lib/config/models";

export default function AgentConfigPage() {
  const {
    chatModel,
    classifyModel,
    replyModel,
    providerConfigs,
    setChatModel,
    setClassifyModel,
    setReplyModel,
    updateProviderConfig,
    resetProviderConfig,
    resetToDefaults,
  } = useModelConfig();

  const [tempProviderConfigs, setTempProviderConfigs] =
    useState<Record<string, ProviderConfig>>(providerConfigs);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // 同步store中的配置到临时状态
  useEffect(() => {
    setTempProviderConfigs(providerConfigs);
  }, [providerConfigs]);

  // 保存Provider配置
  const saveProviderConfigs = () => {
    Object.entries(tempProviderConfigs).forEach(([provider, config]) => {
      updateProviderConfig(provider, config);
    });
    setHasUnsavedChanges(false);
    toast.success("Provider配置已保存");
  };

  // 更新临时配置
  const updateTempConfig = (provider: string, field: keyof ProviderConfig, value: string) => {
    setTempProviderConfigs(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: value,
      },
    }));
    setHasUnsavedChanges(true);
  };

  // 重置单个Provider
  const handleResetProvider = (provider: string) => {
    const defaultConfig = DEFAULT_PROVIDER_CONFIGS[provider];
    if (defaultConfig) {
      setTempProviderConfigs(prev => ({
        ...prev,
        [provider]: { ...defaultConfig },
      }));
      resetProviderConfig(provider);
      setHasUnsavedChanges(false);
      toast.success(`${provider} 配置已重置`);
    }
  };

  // 重置所有配置
  const handleResetAll = () => {
    resetToDefaults();
    setTempProviderConfigs({ ...DEFAULT_PROVIDER_CONFIGS });
    setHasUnsavedChanges(false);
    toast.success("所有配置已重置为默认值");
  };

  return (
    <div className="container max-w-6xl mx-auto p-6 space-y-6">
      {/* 页面头部 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-bold">Agent配置</h1>
            <p className="text-muted-foreground">配置AI模型和服务提供商参数</p>
          </div>
        </div>
        <div className="flex gap-2">
          {hasUnsavedChanges && (
            <Button variant="outline" onClick={saveProviderConfigs} className="gap-2">
              <CheckCircle className="h-4 w-4" />
              保存更改
            </Button>
          )}
          <Button variant="outline" onClick={handleResetAll} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            重置全部
          </Button>
        </div>
      </div>

      {hasUnsavedChanges && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="h-4 w-4 text-amber-600" />
          <span className="text-sm text-amber-800">有未保存的Provider配置更改</span>
        </div>
      )}

      {/* 模型配置区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat API 主模型 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-blue-500" />
              Chat API 主模型
            </CardTitle>
            <p className="text-sm text-muted-foreground">用于 /api/chat 接口的主要对话模型</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={chatModel} onValueChange={setChatModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getChatModels().map(modelId => {
                  const model = MODEL_DICTIONARY[modelId];
                  return (
                    <SelectItem key={modelId} value={modelId}>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{model.name}</span>
                        <span className="text-xs text-muted-foreground">{model.description}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-xs">
              当前: {MODEL_DICTIONARY[chatModel].name}
            </Badge>
          </CardContent>
        </Card>

        {/* 消息分类模型 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-green-500" />
              消息分类模型
            </CardTitle>
            <p className="text-sm text-muted-foreground">用于分析用户消息意图的模型</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={classifyModel} onValueChange={setClassifyModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getGeneralModels().map(modelId => {
                  const model = MODEL_DICTIONARY[modelId];
                  return (
                    <SelectItem key={modelId} value={modelId}>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{model.name}</span>
                        <span className="text-xs text-muted-foreground">{model.description}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-xs">
              当前: {MODEL_DICTIONARY[classifyModel].name}
            </Badge>
          </CardContent>
        </Card>

        {/* 智能回复模型 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-purple-500" />
              智能回复模型
            </CardTitle>
            <p className="text-sm text-muted-foreground">用于生成最终回复内容的模型</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Select value={replyModel} onValueChange={setReplyModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {getGeneralModels().map(modelId => {
                  const model = MODEL_DICTIONARY[modelId];
                  return (
                    <SelectItem key={modelId} value={modelId}>
                      <div className="flex flex-col items-start">
                        <span className="font-medium">{model.name}</span>
                        <span className="text-xs text-muted-foreground">{model.description}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="text-xs">
              当前: {MODEL_DICTIONARY[replyModel].name}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Provider配置区域 */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Globe className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-semibold">服务提供商配置</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Object.entries(tempProviderConfigs).map(([provider, config]) => (
            <Card key={provider}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="capitalize">{config.name}</CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleResetProvider(provider)}
                    className="gap-1"
                  >
                    <RefreshCw className="h-3 w-3" />
                    重置
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">{config.description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor={`${provider}-baseurl`}>Base URL</Label>
                  <Input
                    id={`${provider}-baseurl`}
                    value={config.baseURL}
                    onChange={e => updateTempConfig(provider, "baseURL", e.target.value)}
                    placeholder="https://api.example.com/v1"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`${provider}-desc`}>描述</Label>
                  <Input
                    id={`${provider}-desc`}
                    value={config.description}
                    onChange={e => updateTempConfig(provider, "description", e.target.value)}
                    placeholder="服务描述"
                  />
                </div>

                {/* 显示当前使用此Provider的模型 */}
                <div className="pt-2">
                  <Label className="text-xs text-muted-foreground">使用此Provider的模型:</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(MODEL_DICTIONARY)
                      .filter(([, model]) => model.provider === provider)
                      .map(([modelId, model]) => (
                        <Badge key={modelId} variant="secondary" className="text-xs">
                          {model.name}
                        </Badge>
                      ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* 配置状态信息 */}
      <Card>
        <CardHeader>
          <CardTitle>当前配置状态</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Chat模型</Label>
              <p className="font-medium">{MODEL_DICTIONARY[chatModel].name}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">分类模型</Label>
              <p className="font-medium">{MODEL_DICTIONARY[classifyModel].name}</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">回复模型</Label>
              <p className="font-medium">{MODEL_DICTIONARY[replyModel].name}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Settings, Database, MessageSquare, Cpu, RefreshCw, ArrowLeft } from "lucide-react";
import { BrandDataEditor } from "@/components/admin/brand-data-editor";
import { PromptsEditor } from "@/components/admin/prompts-editor";
import { SystemPromptsEditor } from "@/components/admin/system-prompts-editor";
import { GeneralConfigManager } from "@/components/admin/general-config-manager";
import { useConfigManager } from "@/hooks/useConfigManager";
import { useRouter } from "next/navigation";

export default function AdminSettingsPage() {
  const {
    config,
    loading,
    error,
    updateBrandData,
    updateReplyPrompts,
    updateSystemPrompts,
    updateActiveSystemPrompt,
    exportConfig,
    importConfig,
    resetConfig,
  } = useConfigManager();

  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [currentTime, setCurrentTime] = useState<string>("");

  useEffect(() => {
    setCurrentTime(new Date().toLocaleString());
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="flex items-center justify-center min-h-96">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="text-muted-foreground">正在加载配置数据...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">配置加载失败</CardTitle>
            <CardDescription>无法加载应用配置，请检查本地存储或重新初始化配置。</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">错误详情：{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
            >
              重新加载页面
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* 返回按钮 */}
      <button
        onClick={() => router.push("/")}
        className="flex items-center gap-2 mb-6 text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="text-sm">返回首页</span>
      </button>
      
      {/* 页面头部 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Settings className="h-8 w-8" />
            应用配置管理
          </h1>
          <p className="text-muted-foreground mt-2">
            管理品牌数据、系统提示词和回复指令，配置修改后立即生效
          </p>
        </div>

        {/* 全局操作按钮 */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/admin/settings/sync")}
            className="px-3 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 cursor-pointer flex items-center gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            数据同步
          </button>
          <button
            onClick={exportConfig}
            className="px-3 py-2 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 cursor-pointer"
          >
            导出配置
          </button>
          <button
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = ".json";
              input.onchange = e => {
                const file = (e.target as HTMLInputElement).files?.[0];
                if (file) {
                  importConfig(file);
                }
              };
              input.click();
            }}
            className="px-3 py-2 text-sm bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/80 cursor-pointer"
          >
            导入配置
          </button>
          <button
            onClick={() => {
              if (confirm("确定要重置所有配置到默认状态吗？此操作不可逆！")) {
                resetConfig();
              }
            }}
            className="px-3 py-2 text-sm bg-destructive text-white rounded-md hover:bg-destructive/90 cursor-pointer"
          >
            重置配置
          </button>
        </div>
      </div>

      {/* 主要内容区域 */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            总览
          </TabsTrigger>
          <TabsTrigger value="general" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            通用配置
          </TabsTrigger>
          <TabsTrigger value="brands" className="flex items-center gap-2">
            <Database className="h-4 w-4" />
            品牌数据
          </TabsTrigger>
          <TabsTrigger value="system-prompts" className="flex items-center gap-2">
            <Cpu className="h-4 w-4" />
            系统提示词
          </TabsTrigger>
          <TabsTrigger value="reply-prompts" className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            回复指令
          </TabsTrigger>
        </TabsList>

        {/* 总览页面 */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* 品牌数据统计 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">品牌数据</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {config?.brandData ? Object.keys(config.brandData.brands).length : 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  个品牌，共 {config?.brandData?.stores?.length || 0} 家门店
                </p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {config?.brandData &&
                    Object.keys(config.brandData.brands).map(brand => (
                      <Badge key={brand} variant="secondary" className="text-xs">
                        {brand}
                      </Badge>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* 系统提示词统计 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">系统提示词</CardTitle>
                <Cpu className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {config?.systemPrompts ? Object.keys(config.systemPrompts).length : 0}
                </div>
                <p className="text-xs text-muted-foreground">个系统级提示词模板</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {config?.systemPrompts &&
                    Object.keys(config.systemPrompts).map(key => (
                      <Badge key={key} variant="outline" className="text-xs">
                        {key}
                      </Badge>
                    ))}
                </div>
              </CardContent>
            </Card>

            {/* 回复指令统计 */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">回复指令</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {config?.replyPrompts ? Object.keys(config.replyPrompts).length : 0}
                </div>
                <p className="text-xs text-muted-foreground">个智能回复模板</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {config?.replyPrompts &&
                    Object.keys(config.replyPrompts)
                      .slice(0, 3)
                      .map(key => (
                        <Badge key={key} variant="outline" className="text-xs">
                          {key}
                        </Badge>
                      ))}
                  {config?.replyPrompts && Object.keys(config.replyPrompts).length > 3 && (
                    <Badge variant="secondary" className="text-xs">
                      +{Object.keys(config.replyPrompts).length - 3} 更多
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 配置状态信息 */}
          <Card>
            <CardHeader>
              <CardTitle>配置状态</CardTitle>
              <CardDescription>当前配置的详细信息和数据源状态</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-muted-foreground">数据源：</span>
                  <span className="ml-2">浏览器本地存储 (LocalForage)</span>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">最后更新：</span>
                  <span className="ml-2">{currentTime || "加载中..."}</span>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">存储大小：</span>
                  <span className="ml-2">
                    {config ? `${(JSON.stringify(config).length / 1024).toFixed(1)} KB` : "未知"}
                  </span>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">配置版本：</span>
                  <Badge variant="outline" className="ml-2">
                    v{config?.metadata?.version || "未知"}
                  </Badge>
                </div>
                <div>
                  <span className="font-medium text-muted-foreground">同步状态：</span>
                  <Badge variant="secondary" className="ml-2">
                    本地存储
                  </Badge>
                </div>
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-2">使用说明</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• 配置修改后立即保存到本地存储，无需重启应用</li>
                  <li>• 支持导出/导入配置文件，便于备份和迁移</li>
                  <li>• 品牌数据修改会影响所有相关的智能回复生成</li>
                  <li>• 系统提示词控制AI助手的整体行为模式</li>
                  <li>• 回复指令定义了具体场景下的回复模板</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 通用配置页面 */}
        <TabsContent value="general">
          <GeneralConfigManager />
        </TabsContent>

        {/* 品牌数据编辑 */}
        <TabsContent value="brands">
          <BrandDataEditor data={config?.brandData} onSave={updateBrandData} />
        </TabsContent>

        {/* 系统提示词编辑 */}
        <TabsContent value="system-prompts">
          <SystemPromptsEditor
            data={config?.systemPrompts}
            onSave={updateSystemPrompts}
            activePrompt={config?.activeSystemPrompt || "bossZhipinSystemPrompt"}
            onActivePromptChange={updateActiveSystemPrompt}
          />
        </TabsContent>

        {/* 回复指令编辑 */}
        <TabsContent value="reply-prompts">
          <PromptsEditor data={config?.replyPrompts} onSave={updateReplyPrompts} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

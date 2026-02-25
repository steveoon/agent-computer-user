"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Settings,
  Database,
  MessageSquare,
  Cpu,
  RefreshCw,
  Download,
  Upload,
  RotateCcw,
} from "lucide-react";
import { BackButton } from "@/components/ui/back-button";
import { DropZone, DropZoneHint } from "@/components/ui/drop-zone";
import { useConfigManager } from "@/hooks/useConfigManager";
import { useRouter } from "next/navigation";

// 编辑器组件骨架加载状态
function EditorSkeleton() {
  return (
    <Card className="glass-card">
      <CardHeader>
        <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="h-32 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}

// 动态导入编辑器组件 - 减少初始 bundle 大小
const GeneralConfigManager = dynamic(
  () => import("@/components/admin/general-config-manager").then(m => ({ default: m.GeneralConfigManager })),
  { loading: EditorSkeleton, ssr: false }
);

const BrandDataEditor = dynamic(
  () => import("@/components/admin/brand-data-editor").then(m => ({ default: m.BrandDataEditor })),
  { loading: EditorSkeleton, ssr: false }
);

const PromptsEditor = dynamic(
  () => import("@/components/admin/prompts-editor").then(m => ({ default: m.PromptsEditor })),
  { loading: EditorSkeleton, ssr: false }
);

const SystemPromptsEditor = dynamic(
  () => import("@/components/admin/system-prompts-editor").then(m => ({ default: m.SystemPromptsEditor })),
  { loading: EditorSkeleton, ssr: false }
);

const BrandTable = dynamic(
  () => import("@/components/admin/brand-management").then(m => ({ default: m.BrandTable })),
  { loading: EditorSkeleton, ssr: false }
);

type FilePickerOptions = {
  multiple?: boolean;
  types?: Array<{
    description?: string;
    accept: Record<string, string[]>;
  }>;
};

type FilePickerHandle = {
  getFile: () => Promise<File>;
};

type FilePickerWindow = Window & {
  showOpenFilePicker?: (options?: FilePickerOptions) => Promise<FilePickerHandle[]>;
};

const FILE_PICKER_ACCEPT = ".json,application/json";

export default function AdminSettingsPage() {
  const {
    config,
    loading,
    error,
    updateBrandData,
    updateReplyPolicy,
    updateSystemPrompts,
    updateActiveSystemPrompt,
    updateBrandPriorityStrategy,
    exportConfig,
    importConfig,
    resetConfig,
  } = useConfigManager();

  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");
  const [currentTime, setCurrentTime] = useState<string>("");

  const handleImportConfig = async () => {
    const pickerWindow: FilePickerWindow = window;

    if (typeof pickerWindow.showOpenFilePicker === "function") {
      try {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("showOpenFilePicker timeout")), 5000);
        });

        const pickerPromise = pickerWindow.showOpenFilePicker({
          multiple: false,
          types: [
            {
              description: "JSON",
              accept: {
                "application/json": [".json"],
              },
            },
          ],
        });

        const [handle] = await Promise.race([pickerPromise, timeoutPromise]);

        if (handle) {
          const file = await handle.getFile();
          await importConfig(file);
        }
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          const errorMessage = error.message || "";
          if (!errorMessage.includes("Intercepted")) {
            return;
          }
        }
      }
    }

    const input = document.createElement("input");
    input.type = "file";
    input.accept = FILE_PICKER_ACCEPT;

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      input.remove();
    };

    input.onchange = async event => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        cleanup();
        return;
      }

      const file = target.files?.[0];
      if (file) {
        await importConfig(file);
      }
      cleanup();
    };

    document.body.appendChild(input);
    window.addEventListener("focus", cleanup, { once: true });
    input.click();
  };

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
    <DropZone
      onFileDrop={importConfig}
      accept={FILE_PICKER_ACCEPT}
      hint="拖拽配置文件到此处导入"
      className="min-h-screen w-full bg-background"
    >
      {/* 背景光斑效果 - 固定定位 */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="bg-blob bg-blob-1" />
        <div className="bg-blob bg-blob-2" />
        <div className="bg-blob bg-blob-3" />
      </div>

      {/* 主内容区域 */}
      <div className="relative z-10 container mx-auto p-6 max-w-6xl">
        {/* 页面头部 */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            {/* 返回按钮 */}
            <BackButton href="/" title="返回首页" />

            <div>
              <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                <Settings className="h-6 w-6" />
                应用配置管理
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                管理品牌数据、系统提示词和回复指令
              </p>
            </div>
          </div>

          {/* 全局操作按钮 */}
          <div className="flex items-center gap-2">
            <Button onClick={() => router.push("/admin/settings/sync")} className="shadow-sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              数据同步
            </Button>
            <Button variant="outline" onClick={exportConfig} className="glass-button">
              <Download className="h-4 w-4 mr-2" />
              导出配置
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                void handleImportConfig();
              }}
              className="glass-button"
            >
              <Upload className="h-4 w-4 mr-2" />
              导入配置
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm("确定要重置所有配置到默认状态吗？此操作不可逆！")) {
                  resetConfig();
                }
              }}
              className="shadow-sm"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              重置配置
            </Button>
          </div>
        </div>

        {/* 拖拽导入提示 */}
        <DropZoneHint />

        {/* 主要内容区域 */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 glass-tabs">
            <TabsTrigger value="overview" className="flex items-center gap-2 glass-tab-active">
              <Database className="h-4 w-4" />
              总览
            </TabsTrigger>
            <TabsTrigger value="general" className="flex items-center gap-2 glass-tab-active">
              <Settings className="h-4 w-4" />
              通用配置
            </TabsTrigger>
            <TabsTrigger value="brands" className="flex items-center gap-2 glass-tab-active">
              <Database className="h-4 w-4" />
              品牌数据
            </TabsTrigger>
            <TabsTrigger
              value="system-prompts"
              className="flex items-center gap-2 glass-tab-active"
            >
              <Cpu className="h-4 w-4" />
              系统提示词
            </TabsTrigger>
            <TabsTrigger value="reply-prompts" className="flex items-center gap-2 glass-tab-active">
              <MessageSquare className="h-4 w-4" />
              回复指令
            </TabsTrigger>
          </TabsList>

          {/* 总览页面 */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 品牌数据统计 */}
              <Card className="glass-card">
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
                        <Badge
                          key={brand}
                          variant="secondary"
                          className="text-xs bg-white/50 hover:bg-white/70"
                        >
                          {brand}
                        </Badge>
                      ))}
                  </div>
                </CardContent>
              </Card>

              {/* 系统提示词统计 */}
              <Card className="glass-card">
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
                        <Badge key={key} variant="outline" className="text-xs bg-white/30">
                          {key}
                        </Badge>
                      ))}
                  </div>
                </CardContent>
              </Card>

              {/* 回复指令统计 */}
              <Card className="glass-card">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">回复指令</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {config?.replyPolicy ? Object.keys(config.replyPolicy).length : 0}
                  </div>
                  <p className="text-xs text-muted-foreground">个智能回复模板</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    {config?.replyPolicy &&
                      Object.keys(config.replyPolicy)
                        .slice(0, 3)
                        .map(key => (
                          <Badge key={key} variant="outline" className="text-xs bg-white/30">
                            {key}
                          </Badge>
                        ))}
                    {config?.replyPolicy && Object.keys(config.replyPolicy).length > 3 && (
                      <Badge variant="secondary" className="text-xs bg-white/50 hover:bg-white/70">
                        +{Object.keys(config.replyPolicy).length - 3} 更多
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* 配置状态信息 */}
            <Card className="glass-card">
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
            <GeneralConfigManager
              brandPriorityStrategy={config?.brandPriorityStrategy || "smart"}
              onStrategyChange={updateBrandPriorityStrategy}
            />
          </TabsContent>

          {/* 品牌数据编辑 */}
          <TabsContent value="brands">
            <Tabs defaultValue="config" className="space-y-6">
              <TabsList className="grid grid-cols-2 glass-tabs">
                <TabsTrigger value="config" className="glass-tab-active">
                  品牌配置
                </TabsTrigger>
                <TabsTrigger value="management" className="glass-tab-active">
                  品牌管理
                </TabsTrigger>
              </TabsList>
              <TabsContent value="config">
                <BrandDataEditor data={config?.brandData} onSave={updateBrandData} />
              </TabsContent>
              <TabsContent value="management">
                <BrandTable />
              </TabsContent>
            </Tabs>
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
            <PromptsEditor data={config?.replyPolicy} onSave={updateReplyPolicy} />
          </TabsContent>
        </Tabs>
      </div>
    </DropZone>
  );
}

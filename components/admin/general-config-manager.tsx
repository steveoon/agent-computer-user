"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Key,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  TestTube,
  MessageCircle,
  Plus,
  Trash2,
  Star,
  Edit2,
  Workflow,
  Bot,
} from "lucide-react";
import { toast } from "sonner";
import type { BrandPriorityStrategy } from "@/types";
import { useModelConfigStore } from "@/lib/stores/model-config-store";

interface TokenStatus {
  isValid: boolean;
  lastChecked: string;
  error?: string;
}

interface WechatAccount {
  id: string;
  name: string;
  wechatId: string;
  description?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface GeneralConfigManagerProps {
  brandPriorityStrategy: BrandPriorityStrategy;
  onStrategyChange: (strategy: BrandPriorityStrategy) => Promise<void>;
}

export const GeneralConfigManager = ({
  brandPriorityStrategy,
  onStrategyChange,
}: GeneralConfigManagerProps) => {
  // Agent 配置
  const { maxSteps, setMaxSteps } = useModelConfigStore();

  // Token 相关状态
  const [token, setToken] = useState("");
  const [isTokenVisible, setIsTokenVisible] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null);
  const [hasTokenChanges, setHasTokenChanges] = useState(false);

  // 微信号相关状态
  const [wechatAccounts, setWechatAccounts] = useState<WechatAccount[]>([]);
  const [isAddingWechat, setIsAddingWechat] = useState(false);
  const [editingWechat, setEditingWechat] = useState<string | null>(null);
  const [newWechat, setNewWechat] = useState({
    name: "",
    wechatId: "",
    description: "",
  });

  // 从本地存储加载token
  useEffect(() => {
    const savedToken = localStorage.getItem("duliday_token");
    const savedStatus = localStorage.getItem("duliday_token_status");
    const savedWechatAccounts = localStorage.getItem("wechat_accounts");

    if (savedToken) {
      setToken(savedToken);
    }

    if (savedStatus) {
      try {
        setTokenStatus(JSON.parse(savedStatus));
      } catch {
        // 忽略解析错误
      }
    }

    if (savedWechatAccounts) {
      try {
        const accounts = JSON.parse(savedWechatAccounts);
        setWechatAccounts(accounts);
      } catch {
        // 忽略解析错误
      }
    }
  }, []);

  // 保存token到本地存储
  const saveToken = () => {
    if (!token.trim()) {
      toast.error("Token不能为空");
      return;
    }

    localStorage.setItem("duliday_token", token.trim());
    setHasTokenChanges(false);
    toast.success("Duliday Token 已保存到本地存储");
  };

  // 验证token有效性
  const validateToken = async () => {
    if (!token.trim()) {
      toast.error("请先输入Token");
      return;
    }

    setIsValidating(true);

    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          organizationIds: [1], // 使用测试ID
          validateOnly: true, // 仅验证，不实际同步
          token: token.trim(), // 传递当前输入的token
        }),
      });

      const data = await response.json();

      const status: TokenStatus = {
        isValid: response.ok && !data.error,
        lastChecked: new Date().toLocaleString("zh-CN"),
        error: data.error || undefined,
      };

      setTokenStatus(status);
      localStorage.setItem("duliday_token_status", JSON.stringify(status));

      if (status.isValid) {
        toast.success("Token验证成功！");
      } else {
        toast.error(`Token验证失败: ${status.error || "未知错误"}`);
      }
    } catch (error) {
      const status: TokenStatus = {
        isValid: false,
        lastChecked: new Date().toLocaleString("zh-CN"),
        error: error instanceof Error ? error.message : "网络错误",
      };

      setTokenStatus(status);
      localStorage.setItem("duliday_token_status", JSON.stringify(status));
      toast.error("Token验证失败: " + status.error);
    } finally {
      setIsValidating(false);
    }
  };

  // 清除token
  const clearToken = () => {
    if (confirm("确定要清除保存的Token吗？")) {
      setToken("");
      setTokenStatus(null);
      setHasTokenChanges(false);
      localStorage.removeItem("duliday_token");
      localStorage.removeItem("duliday_token_status");
      toast.success("Token已清除");
    }
  };

  // 检测token变化
  const handleTokenChange = (value: string) => {
    setToken(value);
    setHasTokenChanges(value !== (localStorage.getItem("duliday_token") || ""));
  };

  // 添加微信号
  const addWechatAccount = () => {
    if (!newWechat.name.trim() || !newWechat.wechatId.trim()) {
      toast.error("请填写完整的微信号信息");
      return;
    }

    const newAccount: WechatAccount = {
      id: Date.now().toString(),
      name: newWechat.name.trim(),
      wechatId: newWechat.wechatId.trim(),
      description: newWechat.description.trim(),
      isDefault: wechatAccounts.length === 0, // 第一个账号自动设为默认
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedAccounts = [...wechatAccounts, newAccount];
    setWechatAccounts(updatedAccounts);
    localStorage.setItem("wechat_accounts", JSON.stringify(updatedAccounts));

    // 如果是第一个账号，同时保存为默认微信号
    if (newAccount.isDefault) {
      localStorage.setItem("default_wechat_id", newAccount.wechatId);
    }

    setNewWechat({ name: "", wechatId: "", description: "" });
    setIsAddingWechat(false);
    toast.success("微信号已添加");
  };

  // 设置默认微信号
  const setDefaultWechat = (accountId: string) => {
    const updatedAccounts = wechatAccounts.map(account => ({
      ...account,
      isDefault: account.id === accountId,
    }));

    setWechatAccounts(updatedAccounts);
    localStorage.setItem("wechat_accounts", JSON.stringify(updatedAccounts));

    const defaultAccount = updatedAccounts.find(a => a.id === accountId);
    if (defaultAccount) {
      localStorage.setItem("default_wechat_id", defaultAccount.wechatId);
      toast.success(`已将 ${defaultAccount.name} 设为默认微信号`);
    }
  };

  // 删除微信号
  const deleteWechatAccount = (accountId: string) => {
    const accountToDelete = wechatAccounts.find(a => a.id === accountId);
    if (!accountToDelete) return;

    if (confirm(`确定要删除微信号 "${accountToDelete.name}" 吗？`)) {
      const updatedAccounts = wechatAccounts.filter(a => a.id !== accountId);

      // 如果删除的是默认账号，将第一个设为默认
      if (accountToDelete.isDefault && updatedAccounts.length > 0) {
        updatedAccounts[0].isDefault = true;
        localStorage.setItem("default_wechat_id", updatedAccounts[0].wechatId);
      } else if (updatedAccounts.length === 0) {
        localStorage.removeItem("default_wechat_id");
      }

      setWechatAccounts(updatedAccounts);
      localStorage.setItem("wechat_accounts", JSON.stringify(updatedAccounts));
      toast.success("微信号已删除");
    }
  };

  // 更新微信号
  const updateWechatAccount = (accountId: string, updates: Partial<WechatAccount>) => {
    const updatedAccounts = wechatAccounts.map(account => {
      if (account.id === accountId) {
        const updatedAccount = {
          ...account,
          ...updates,
          updatedAt: new Date().toISOString(),
        };
        // 如果更新的是默认账号的微信号，同步更新默认微信号
        if (account.isDefault && updates.wechatId) {
          localStorage.setItem("default_wechat_id", updates.wechatId);
        }
        return updatedAccount;
      }
      return account;
    });

    setWechatAccounts(updatedAccounts);
    localStorage.setItem("wechat_accounts", JSON.stringify(updatedAccounts));
    setEditingWechat(null);
    toast.success("微信号已更新");
  };

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle>通用配置管理</CardTitle>
        <CardDescription>管理应用的通用配置项，包括API Token和微信号等</CardDescription>
      </CardHeader>

      <CardContent>
        <Accordion type="multiple" defaultValue={["token"]} className="w-full">
          {/* Token配置 */}
          <AccordionItem
            value="token"
            className="border-0 rounded-lg px-4 mb-2 data-[state=open]:bg-muted/30 data-[state=open]:shadow-sm transition-all"
          >
            <AccordionTrigger className="hover:no-underline py-4 [&>svg]:text-muted-foreground hover:bg-muted/50 -mx-4 px-4 rounded-lg transition-colors">
              <div className="flex items-center gap-2">
                <Key className="h-4 w-4 text-muted-foreground" />
                <span>Token配置</span>
                {token && (
                  <Badge variant={tokenStatus?.isValid ? "default" : "secondary"} className="ml-2">
                    {tokenStatus?.isValid ? "已验证" : "未验证"}
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              {/* Token状态显示 */}
              {tokenStatus && (
                <Alert
                  className={
                    tokenStatus.isValid
                      ? "border-green-200 bg-green-50"
                      : "border-red-200 bg-red-50"
                  }
                >
                  <div className="flex items-center gap-2">
                    {tokenStatus.isValid ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-600" />
                    )}
                    <AlertDescription>
                      <div className="space-y-1">
                        <div className={tokenStatus.isValid ? "text-green-800" : "text-red-800"}>
                          Token状态: {tokenStatus.isValid ? "有效" : "无效"}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          最后检查: {tokenStatus.lastChecked}
                        </div>
                        {tokenStatus.error && (
                          <div className="text-sm text-red-700">错误: {tokenStatus.error}</div>
                        )}
                      </div>
                    </AlertDescription>
                  </div>
                </Alert>
              )}

              {/* Token输入 */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label htmlFor="duliday-token">Duliday API Token</Label>
                  <div className="flex items-center gap-2">
                    {token && (
                      <Badge variant={tokenStatus?.isValid ? "default" : "secondary"}>
                        {tokenStatus?.isValid ? "已验证" : "未验证"}
                      </Badge>
                    )}
                    {hasTokenChanges && (
                      <Badge variant="outline" className="text-orange-600">
                        有未保存的更改
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      id="duliday-token"
                      type={isTokenVisible ? "text" : "password"}
                      value={token}
                      onChange={e => handleTokenChange(e.target.value)}
                      placeholder="请输入Duliday API Token"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setIsTokenVisible(!isTokenVisible)}
                    >
                      {isTokenVisible ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-3">
                <Button
                  onClick={saveToken}
                  disabled={!token.trim() || !hasTokenChanges}
                  variant="default"
                >
                  保存Token
                </Button>

                <Button
                  onClick={validateToken}
                  disabled={!token.trim() || isValidating}
                  variant="outline"
                >
                  {isValidating ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
                      验证中...
                    </>
                  ) : (
                    <>
                      <TestTube className="h-4 w-4 mr-2" />
                      验证Token
                    </>
                  )}
                </Button>

                {token && (
                  <Button onClick={clearToken} variant="destructive" size="sm">
                    清除Token
                  </Button>
                )}
              </div>

              {/* 使用说明 */}
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  使用说明
                </summary>
                <ul className="text-muted-foreground space-y-1 mt-2 ml-4">
                  <li>• Token保存在浏览器本地存储中，仅在当前设备有效</li>
                  <li>• 请定期验证Token状态，确保数据同步功能正常</li>
                  <li>• Token仅用于数据读取，不会修改Duliday平台的数据</li>
                </ul>
              </details>
            </AccordionContent>
          </AccordionItem>

          {/* 微信号配置 */}
          <AccordionItem
            value="wechat"
            className="border-0 rounded-lg px-4 mb-2 data-[state=open]:bg-muted/30 data-[state=open]:shadow-sm transition-all"
          >
            <AccordionTrigger className="hover:no-underline py-4 [&>svg]:text-muted-foreground hover:bg-muted/50 -mx-4 px-4 rounded-lg transition-colors">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                <span>微信号配置</span>
                {wechatAccounts.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {wechatAccounts.length} 个
                  </Badge>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              {/* 微信号列表 */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">微信号列表</h4>
                  <Button
                    size="sm"
                    onClick={() => setIsAddingWechat(true)}
                    disabled={isAddingWechat}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    添加微信号
                  </Button>
                </div>

                {wechatAccounts.length === 0 && !isAddingWechat ? (
                  <Alert>
                    <AlertDescription>
                      还没有配置微信号，点击上方按钮添加第一个微信号
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-3">
                    {wechatAccounts.map(account => (
                      <div
                        key={account.id}
                        className={`border rounded-lg p-4 ${
                          account.isDefault ? "border-primary bg-primary/5" : ""
                        }`}
                      >
                        {editingWechat === account.id ? (
                          // 编辑模式
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-3">
                              <Input
                                placeholder="名称"
                                defaultValue={account.name}
                                onBlur={e => {
                                  if (e.target.value.trim()) {
                                    updateWechatAccount(account.id, {
                                      name: e.target.value.trim(),
                                    });
                                  }
                                }}
                              />
                              <Input
                                placeholder="微信号"
                                defaultValue={account.wechatId}
                                onBlur={e => {
                                  if (e.target.value.trim()) {
                                    updateWechatAccount(account.id, {
                                      wechatId: e.target.value.trim(),
                                    });
                                  }
                                }}
                              />
                            </div>
                            <Input
                              placeholder="描述（选填）"
                              defaultValue={account.description}
                              onBlur={e => {
                                updateWechatAccount(account.id, {
                                  description: e.target.value.trim(),
                                });
                              }}
                            />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => setEditingWechat(null)}>
                                完成
                              </Button>
                            </div>
                          </div>
                        ) : (
                          // 显示模式
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{account.name}</span>
                                {account.isDefault && (
                                  <Badge variant="default" className="flex items-center gap-1">
                                    <Star className="h-3 w-3" />
                                    默认
                                  </Badge>
                                )}
                              </div>
                              <div className="text-sm text-muted-foreground mt-1">
                                微信号: {account.wechatId}
                                {account.description && <span> · {account.description}</span>}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                更新于: {new Date(account.updatedAt).toLocaleString("zh-CN")}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {!account.isDefault && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setDefaultWechat(account.id)}
                                >
                                  设为默认
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingWechat(account.id)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="text-destructive hover:text-destructive"
                                onClick={() => deleteWechatAccount(account.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}

                    {/* 添加新微信号表单 */}
                    {isAddingWechat && (
                      <div className="border rounded-lg p-4 bg-secondary/10">
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <Input
                              placeholder="名称（如：主账号）"
                              value={newWechat.name}
                              onChange={e => setNewWechat({ ...newWechat, name: e.target.value })}
                            />
                            <Input
                              placeholder="微信号"
                              value={newWechat.wechatId}
                              onChange={e =>
                                setNewWechat({ ...newWechat, wechatId: e.target.value })
                              }
                            />
                          </div>
                          <Input
                            placeholder="描述（选填）"
                            value={newWechat.description}
                            onChange={e =>
                              setNewWechat({ ...newWechat, description: e.target.value })
                            }
                          />
                          <div className="flex gap-2">
                            <Button size="sm" onClick={addWechatAccount}>
                              添加
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setIsAddingWechat(false);
                                setNewWechat({ name: "", wechatId: "", description: "" });
                              }}
                            >
                              取消
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 使用说明 */}
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  使用说明
                </summary>
                <ul className="text-muted-foreground space-y-1 mt-2 ml-4">
                  <li>• 默认微信号将在与候选人交换联系方式时自动使用</li>
                  <li>• 微信号信息仅保存在本地浏览器中</li>
                </ul>
              </details>
            </AccordionContent>
          </AccordionItem>

          {/* Agent配置 */}
          <AccordionItem
            value="agent"
            className="border-0 rounded-lg px-4 mb-2 data-[state=open]:bg-muted/30 data-[state=open]:shadow-sm transition-all"
          >
            <AccordionTrigger className="hover:no-underline py-4 [&>svg]:text-muted-foreground hover:bg-muted/50 -mx-4 px-4 rounded-lg transition-colors">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-muted-foreground" />
                <span>Agent配置</span>
                <Badge variant="outline" className="ml-2">
                  {maxSteps} 轮
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <div>
                <p className="text-sm text-muted-foreground mb-3">
                  设置 Agent 在一次对话中的最大工具调用轮数
                </p>
              </div>

              {/* maxSteps 配置 */}
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <Label htmlFor="max-steps">最大轮数</Label>
                  <Input
                    id="max-steps"
                    type="number"
                    min={1}
                    max={500}
                    value={maxSteps}
                    onChange={e => {
                      const value = parseInt(e.target.value, 10);
                      if (!isNaN(value)) {
                        setMaxSteps(value);
                      }
                    }}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">(1-500)</span>
                </div>

                {/* 预设快捷选项 */}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant={maxSteps === 10 ? "default" : "outline"}
                    onClick={() => setMaxSteps(10)}
                  >
                    10 轮
                  </Button>
                  <Button
                    size="sm"
                    variant={maxSteps === 30 ? "default" : "outline"}
                    onClick={() => setMaxSteps(30)}
                  >
                    30 轮
                  </Button>
                  <Button
                    size="sm"
                    variant={maxSteps === 150 ? "default" : "outline"}
                    onClick={() => setMaxSteps(150)}
                  >
                    150 轮
                  </Button>
                  <Button
                    size="sm"
                    variant={maxSteps === 300 ? "default" : "outline"}
                    onClick={() => setMaxSteps(300)}
                  >
                    300 轮
                  </Button>
                  <Button
                    size="sm"
                    variant={maxSteps === 500 ? "default" : "outline"}
                    onClick={() => setMaxSteps(500)}
                  >
                    500 轮
                  </Button>
                </div>
              </div>

              {/* 使用说明 */}
              <details className="text-sm">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  使用说明
                </summary>
                <ul className="text-muted-foreground space-y-1 mt-2 ml-4">
                  <li>• 每次工具调用计为一轮，达到限制时可点击"继续"按钮</li>
                  <li>• 处理多个候选人时，建议设置 50-100 轮</li>
                </ul>
              </details>
            </AccordionContent>
          </AccordionItem>

          {/* 品牌策略配置 */}
          <AccordionItem
            value="brand-strategy"
            className="border-0 rounded-lg px-4 data-[state=open]:bg-muted/30 data-[state=open]:shadow-sm transition-all"
          >
            <AccordionTrigger className="hover:no-underline py-4 [&>svg]:text-muted-foreground hover:bg-muted/50 -mx-4 px-4 rounded-lg transition-colors">
              <div className="flex items-center gap-2">
                <Workflow className="h-4 w-4 text-muted-foreground" />
                <span>品牌策略</span>
                <Badge variant="outline" className="ml-2">
                  {brandPriorityStrategy === "smart"
                    ? "智能"
                    : brandPriorityStrategy === "user-selected"
                      ? "用户优先"
                      : "职位优先"}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-4">
              <div className="space-y-6">
                <div>
                  <h4 className="font-medium mb-3">品牌冲突处理策略</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    当UI选择的品牌与职位详情中识别的品牌不一致时的处理方式
                  </p>
                </div>

                {/* 策略选项 */}
                <div className="space-y-3">
                  {/* 智能判断（推荐） */}
                  <div
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      brandPriorityStrategy === "smart"
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "hover:border-primary/50"
                    }`}
                    onClick={() => onStrategyChange("smart")}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                          brandPriorityStrategy === "smart"
                            ? "border-primary bg-primary"
                            : "border-gray-300"
                        }`}
                      >
                        {brandPriorityStrategy === "smart" && (
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">智能判断</span>
                          <Badge variant="default" className="text-xs">
                            推荐
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">根据品牌关系智能选择</p>
                        <ul className="text-sm text-muted-foreground mt-2 space-y-1 ml-4">
                          <li>• 优先使用职位详情中识别的品牌</li>
                          <li>• 同品牌家族（如"肯德基"/"大连肯德基"）→ 使用更具体的</li>
                          <li>• 不同品牌家族 → 优先职位详情中的品牌</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  {/* 用户选择优先 */}
                  <div
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      brandPriorityStrategy === "user-selected"
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "hover:border-primary/50"
                    }`}
                    onClick={() => onStrategyChange("user-selected")}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                          brandPriorityStrategy === "user-selected"
                            ? "border-primary bg-primary"
                            : "border-gray-300"
                        }`}
                      >
                        {brandPriorityStrategy === "user-selected" && (
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                        )}
                      </div>
                      <div className="flex-1">
                        <span className="font-medium">用户选择优先</span>
                        <p className="text-sm text-muted-foreground mt-1">
                          始终使用用户手动选择的品牌
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* 对话提取优先 */}
                  <div
                    className={`border rounded-lg p-4 cursor-pointer transition-all ${
                      brandPriorityStrategy === "conversation-extracted"
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "hover:border-primary/50"
                    }`}
                    onClick={() => onStrategyChange("conversation-extracted")}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
                          brandPriorityStrategy === "conversation-extracted"
                            ? "border-primary bg-primary"
                            : "border-gray-300"
                        }`}
                      >
                        {brandPriorityStrategy === "conversation-extracted" && (
                          <div className="w-2 h-2 rounded-full bg-white"></div>
                        )}
                      </div>
                      <div className="flex-1">
                        <span className="font-medium">职位识别优先</span>
                        <p className="text-sm text-muted-foreground mt-1">
                          始终使用从职位详情中识别的品牌
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 当前生效策略说明 */}
                <Alert className="bg-blue-50 border-blue-200">
                  <div className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <AlertDescription className="text-blue-800">
                        <div className="font-medium mb-1">当前生效策略</div>
                        <div className="text-sm">
                          {brandPriorityStrategy === "smart" && (
                            <>
                              <strong>智能判断</strong> -
                              优先使用职位详情识别的品牌，同品牌家族使用更具体的（如"大连肯德基"比"肯德基"更具体），不同品牌家族优先职位识别。
                            </>
                          )}
                          {brandPriorityStrategy === "user-selected" && (
                            <>
                              <strong>用户选择优先</strong> -
                              始终使用UI选择的品牌，忽略职位详情识别。
                            </>
                          )}
                          {brandPriorityStrategy === "conversation-extracted" && (
                            <>
                              <strong>职位识别优先</strong> -
                              始终使用从职位详情识别的品牌，覆盖UI选择。
                            </>
                          )}
                        </div>
                      </AlertDescription>
                    </div>
                  </div>
                </Alert>

                {/* 使用说明 */}
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    使用说明
                  </summary>
                  <ul className="text-muted-foreground space-y-1 mt-2 ml-4">
                    <li>• 职位详情中的品牌由AI工具自动识别</li>
                    <li>• 品牌家族：一个包含另一个即为同家族</li>
                  </ul>
                </details>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
};

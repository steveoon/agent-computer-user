"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import { toast } from "sonner";

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

export const GeneralConfigManager = () => {
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
    <Card>
      <CardHeader>
        <CardTitle>通用配置管理</CardTitle>
        <CardDescription>管理应用的通用配置项，包括API Token和微信号等</CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="token" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="token" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Token配置
            </TabsTrigger>
            <TabsTrigger value="wechat" className="flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              微信号配置
            </TabsTrigger>
          </TabsList>

          {/* Token配置Tab */}
          <TabsContent value="token" className="space-y-6 mt-6">
            {/* Token状态显示 */}
            {tokenStatus && (
              <Alert
                className={
                  tokenStatus.isValid ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"
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
                    {isTokenVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">使用说明</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Token保存在浏览器本地存储中，仅在当前设备有效</li>
                <li>• 请定期验证Token状态，确保数据同步功能正常</li>
                <li>• 如果Token过期，请联系相关人员获取新的Token</li>
                <li>• Token仅用于数据读取，不会修改Duliday平台的数据</li>
                <li>• 为确保安全，请不要在公共设备上保存Token</li>
              </ul>
            </div>
          </TabsContent>

          {/* 微信号配置Tab */}
          <TabsContent value="wechat" className="space-y-6 mt-6">
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
                  <AlertDescription>还没有配置微信号，点击上方按钮添加第一个微信号</AlertDescription>
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
                                  updateWechatAccount(account.id, { name: e.target.value.trim() });
                                }
                              }}
                            />
                            <Input
                              placeholder="微信号"
                              defaultValue={account.wechatId}
                              onBlur={e => {
                                if (e.target.value.trim()) {
                                  updateWechatAccount(account.id, { wechatId: e.target.value.trim() });
                                }
                              }}
                            />
                          </div>
                          <Input
                            placeholder="描述（选填）"
                            defaultValue={account.description}
                            onBlur={e => {
                              updateWechatAccount(account.id, { description: e.target.value.trim() });
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
                            onChange={e => setNewWechat({ ...newWechat, wechatId: e.target.value })}
                          />
                        </div>
                        <Input
                          placeholder="描述（选填）"
                          value={newWechat.description}
                          onChange={e => setNewWechat({ ...newWechat, description: e.target.value })}
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
            <div className="border-t pt-4">
              <h4 className="font-medium mb-2">使用说明</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• 可以配置多个微信号，用于不同场景的自动回复</li>
                <li>• 默认微信号将在与候选人交换联系方式时自动使用</li>
                <li>• 微信号信息仅保存在本地浏览器中，不会上传到服务器</li>
                <li>• 请确保微信号信息准确，以便候选人能够正确添加</li>
                <li>• 点击编辑按钮可以修改已添加的微信号信息</li>
              </ul>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
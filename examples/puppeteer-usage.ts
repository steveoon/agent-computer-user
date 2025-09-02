/**
 * Puppeteer MCP 连接测试示例
 *
 * 此文件仅测试 MCP 服务器和客户端管理器的连接和初始化功能
 * 不包含实际的浏览器操作测试（需手动测试）
 */

import mcpClientManager from "@/lib/mcp/client-manager";

/**
 * MCP 客户端连接测试
 */
async function mcpConnectionTest() {
  console.log("🔗 开始 MCP 客户端连接测试...");

  try {
    // 获取管理器状态
    const status = mcpClientManager.getStatus();
    console.log("📊 MCP 客户端管理器状态:", status);

    // 获取可用客户端配置
    const configs = mcpClientManager.getAvailableClients();
    console.log("⚙️ 可用客户端配置:");
    configs.forEach((config, name) => {
      console.log(`  - ${name}: ${config.description}`);
    });

    // 检查 Puppeteer 客户端连接状态
    const isConnected = mcpClientManager.isClientConnected("puppeteer");
    console.log(`🔗 Puppeteer 客户端连接状态: ${isConnected ? "已连接" : "未连接"}`);

    // 如果未连接，尝试连接
    if (!isConnected) {
      console.log("📡 尝试连接 Puppeteer MCP 客户端...");
      const client = await mcpClientManager.getMCPClient("puppeteer");
      console.log("✅ Puppeteer MCP 客户端连接成功");

      // 获取工具列表
      const tools = await client.tools();
      console.log("🔧 可用工具列表:");
      Object.keys(tools).forEach(toolName => {
        console.log(`  - ${toolName}`);
      });
    }

    console.log("✅ MCP 连接测试完成！");
  } catch (error) {
    console.error("❌ MCP 连接测试失败:", error);

    if (error instanceof Error) {
      if (error.message.includes("ENOENT") || error.message.includes("spawn")) {
        console.log(`
💡 解决建议：
1. 确保已安装 Puppeteer MCP Server
2. 检查 MCP 服务器可执行文件路径是否正确
3. 确认服务器配置文件设置正确
        `);
      }
    }
  }
}

/**
 * 快速连接测试
 */
async function quickConnectionTest() {
  console.log("⚡ 快速连接测试...");

  try {
    // 仅测试能否获取到客户端实例
    const client = await mcpClientManager.getMCPClient("puppeteer");
    console.log("✅ 客户端实例获取成功");

    // 测试工具列表获取
    const tools = await client.tools();
    const toolCount = Object.keys(tools).length;
    console.log(`🔧 工具数量: ${toolCount}`);

    // 验证预期的工具是否存在
    const expectedTools = [
      "puppeteer_connect_active_tab",
      "puppeteer_navigate",
      "puppeteer_screenshot",
      "puppeteer_click",
      "puppeteer_fill",
      "puppeteer_select",
      "puppeteer_hover",
      "puppeteer_evaluate",
    ];

    const missingTools = expectedTools.filter(tool => !tools[tool]);
    if (missingTools.length === 0) {
      console.log("✅ 所有预期工具都可用");
    } else {
      console.warn("⚠️ 缺少工具:", missingTools);
    }
  } catch (error) {
    console.error("❌ 快速连接测试失败:", error);
  }
}

/**
 * 客户端管理器功能测试
 */
async function clientManagerTest() {
  console.log("🛠️ 客户端管理器功能测试...");

  try {
    // 测试重连功能
    console.log("🔄 测试重连功能...");
    await mcpClientManager.reconnectClient("puppeteer");
    console.log("✅ 重连测试成功");

    // 测试状态获取
    const detailedStatus = mcpClientManager.getStatus();
    console.log("📈 详细状态:", {
      totalAvailable: detailedStatus.availableClients.length,
      totalConnected: detailedStatus.connectedClients.length,
      puppeteerStatus: detailedStatus.clients.find(c => c.name === "puppeteer"),
    });

    console.log("✅ 客户端管理器测试完成");
  } catch (error) {
    console.error("❌ 客户端管理器测试失败:", error);
  }
}

/**
 * 主测试函数
 */
async function main() {
  console.log("🚀 开始 Puppeteer MCP 连接测试套件...\n");

  await quickConnectionTest();
  console.log("\n" + "=".repeat(50) + "\n");

  await mcpConnectionTest();
  console.log("\n" + "=".repeat(50) + "\n");

  await clientManagerTest();
  console.log("\n" + "=".repeat(50) + "\n");

  console.log("🏁 测试套件完成");

  // 清理资源
  try {
    await mcpClientManager.closeMCPClient("puppeteer");
    console.log("🧹 资源清理完成");
  } catch (error) {
    console.warn("⚠️ 资源清理失败:", error);
  }
}

// 如果直接运行此文件，执行测试
if (require.main === module) {
  main().catch(console.error);
}

export { mcpConnectionTest, quickConnectionTest, clientManagerTest, main as runAllTests };

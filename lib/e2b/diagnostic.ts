import { getDesktop, withTimeout } from "./utils";

export const diagnoseE2BEnvironment = async (sandboxId?: string) => {
  console.log("🔍 开始 E2B 环境诊断...");

  try {
    const desktop = await getDesktop(sandboxId);

    // 测试基本功能
    console.log("✅ 桌面连接成功");

    // 测试截图
    try {
      const image = (await withTimeout(desktop.screenshot(), 10000, "Screenshot")) as Buffer;
      console.log("✅ 截图功能正常，图片大小:", image.length, "字节");
    } catch (error) {
      console.error("❌ 截图失败:", error);
    }

    // 测试鼠标移动和指针可见性
    try {
      console.log("测试鼠标移动...");
      await desktop.moveMouse(100, 100);
      console.log("✅ 鼠标移动功能正常");

      // 测试指针可见性刷新
      console.log("测试指针可见性...");
      await desktop.moveMouse(101, 100);
      await desktop.moveMouse(100, 101);
      await desktop.moveMouse(100, 100);

      // 尝试系统级鼠标移动
      try {
        await withTimeout(
          desktop.commands.run("xdotool mousemove 150 150"),
          3000,
          "xdotool mousemove"
        );
        console.log("✅ xdotool 鼠标移动可用");
      } catch (_error) {
        console.log("⚠️ xdotool 不可用，使用E2B原生移动");
      }
    } catch (error) {
      console.error("❌ 鼠标移动失败:", error);
    }

    // 测试鼠标点击
    try {
      await desktop.leftClick();
      console.log("✅ 鼠标点击功能正常");
    } catch (error) {
      console.error("❌ 鼠标点击失败:", error);
    }

    // 测试键盘输入
    try {
      await desktop.write("test");
      console.log("✅ 键盘输入功能正常");
    } catch (error) {
      console.error("❌ 键盘输入失败:", error);
    }

    // 测试命令执行
    try {
      const result = await desktop.commands.run("echo 'E2B 诊断测试'");
      console.log("✅ 命令执行功能正常:", result.stdout);
    } catch (error) {
      console.error("❌ 命令执行失败:", error);
    }

    // 检查可用的浏览器
    try {
      const browsers = ["firefox", "chromium-browser", "google-chrome", "chrome"];
      for (const browser of browsers) {
        try {
          await desktop.commands.run(`which ${browser}`);
          console.log(`✅ 发现浏览器: ${browser}`);
        } catch {
          console.log(`❌ 未找到浏览器: ${browser}`);
        }
      }
    } catch (error) {
      console.error("❌ 浏览器检查失败:", error);
    }

    // 检查桌面环境
    try {
      const result = await desktop.commands.run("echo $DESKTOP_SESSION");
      console.log("🖥️ 桌面环境:", result.stdout || "未知");

      // 检查显示信息
      const displayResult = await desktop.commands.run("echo $DISPLAY");
      console.log("🖥️ 显示服务:", displayResult.stdout || "未知");

      // 检查X11相关工具
      const x11Tools = ["xdotool", "xwininfo", "xprop"];
      for (const tool of x11Tools) {
        try {
          await desktop.commands.run(`which ${tool}`);
          console.log(`✅ X11工具可用: ${tool}`);
        } catch {
          console.log(`❌ X11工具缺失: ${tool}`);
          // 尝试安装xdotool
          if (tool === "xdotool") {
            try {
              console.log("🔧 尝试安装 xdotool...");
              await desktop.commands.run("apt-get update && apt-get install -y xdotool");
              console.log("✅ xdotool 安装成功");
            } catch (installError) {
              console.log("⚠️ xdotool 安装失败:", installError);
            }
          }
        }
      }
    } catch (error) {
      console.error("❌ 桌面环境检查失败:", error);
    }

    console.log("🔍 E2B 环境诊断完成");
  } catch (error) {
    console.error("❌ E2B 环境诊断失败:", error);
  }
};

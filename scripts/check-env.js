#!/usr/bin/env node

/**
 * 环境变量检查脚本
 * 用于诊断 Supabase 连接问题
 */

const fs = require("fs");
const path = require("path");
const https = require("https");
const { URL } = require("url");

// 手动加载 .env 文件
function loadEnvFile(filename) {
  const envPath = path.join(process.cwd(), filename);
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    const lines = envContent.split("\n");

    lines.forEach(line => {
      // 跳过空行和注释
      if (line.trim() && !line.trim().startsWith("#")) {
        const [key, ...valueParts] = line.split("=");
        if (key && valueParts.length > 0) {
          const value = valueParts.join("=").trim();
          // 移除引号
          const cleanValue = value.replace(/^["']|["']$/g, "");
          // 只设置未定义的环境变量（优先级：已存在 > .env.local > .env）
          if (!process.env[key.trim()]) {
            process.env[key.trim()] = cleanValue;
          }
        }
      }
    });
    return true;
  }
  return false;
}

console.log("🔍 Environment Variables Check\n");

// 按优先级加载环境文件
const loaded = [];
if (loadEnvFile(".env.local")) loaded.push(".env.local");
if (loadEnvFile(".env")) loaded.push(".env");

if (loaded.length > 0) {
  console.log(`📥 Loaded environment from: ${loaded.join(", ")}\n`);
}

// 检查环境文件
const envFiles = [".env", ".env.local", ".env.production"];
const existingEnvFiles = [];

envFiles.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (fs.existsSync(filePath)) {
    existingEnvFiles.push(file);
  }
});

console.log(`📁 Found environment files: ${existingEnvFiles.join(", ") || "None"}\n`);

// 检查必要的环境变量
const requiredVars = {
  NEXT_PUBLIC_SUPABASE_URL: "🌐 Supabase URL",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "🔑 Supabase Anon Key",
};

const optionalVars = {
  E2B_API_KEY: "💻 E2B Desktop Key",
  ANTHROPIC_API_KEY: "🤖 Anthropic API Key",
  DEEPSEEK_API_KEY: "🧠 DeepSeek API Key",
  DASHSCOPE_API_KEY: "🎯 DashScope API Key",
};

console.log("🔒 Required Environment Variables:");
let hasAllRequired = true;

Object.entries(requiredVars).forEach(([key, name]) => {
  const value = process.env[key];
  if (value) {
    console.log(`✅ ${name}: Set (${value.substring(0, 20)}...)`);
  } else {
    console.log(`❌ ${name}: Not set`);
    hasAllRequired = false;
  }
});

console.log("\n📦 Optional Environment Variables:");
Object.entries(optionalVars).forEach(([key, name]) => {
  const value = process.env[key];
  if (value) {
    console.log(`✅ ${name}: Set`);
  } else {
    console.log(`⚠️  ${name}: Not set`);
  }
});

// 测试 Supabase 连接
console.log("\n🧪 Testing Supabase Connection...");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (supabaseUrl) {
  try {
    const url = new URL(supabaseUrl);
    const healthCheckUrl = `${url.origin}/health`;

    console.log(`📡 Checking: ${healthCheckUrl}`);

    const req = https.get(healthCheckUrl, res => {
      let responseData = "";

      res.on("data", chunk => {
        responseData += chunk;
      });

      res.on("end", () => {
        if (res.statusCode === 200) {
          console.log("✅ Supabase is reachable");
        } else if (res.statusCode === 401) {
          console.log("✅ Supabase is reachable (401 is expected for health endpoint)");
        } else {
          console.log(`⚠️  Supabase responded with status: ${res.statusCode}`);
        }

        // 额外的诊断信息
        console.log(`\n📊 Node.js Version: ${process.version}`);
        console.log(`🖥️  Platform: ${process.platform}`);
        console.log(`🏗️  Environment: ${process.env.NODE_ENV || "development"}`);

        if (!hasAllRequired) {
          console.log("\n❗ Action Required:");
          console.log("1. Copy .env.example to .env or .env.local");
          console.log("2. Fill in the required environment variables");
          console.log("3. Restart your development server");
        }

        // 正常退出
        process.exit(0);
      });
    });

    req.on("error", err => {
      console.error("❌ Failed to connect to Supabase:", err.message);

      if (err.code === "ENOTFOUND") {
        console.log("\n🔍 Possible causes:");
        console.log("- Invalid Supabase URL");
        console.log("- DNS resolution issues");
        console.log("- Network connectivity problems");
      } else if (err.code === "ECONNREFUSED") {
        console.log("\n🔍 Possible causes:");
        console.log("- Supabase project might be paused");
        console.log("- Firewall blocking the connection");
      }

      // 错误退出
      process.exit(1);
    });

    // 设置超时
    req.setTimeout(5000, () => {
      console.error("❌ Connection timeout after 5 seconds");
      req.destroy();
      process.exit(1);
    });
  } catch (error) {
    console.error("❌ Invalid Supabase URL:", error.message);
    process.exit(1);
  }
} else {
  console.log("⏭️  Skipping connection test (NEXT_PUBLIC_SUPABASE_URL not set)");

  // 显示诊断信息后退出
  console.log(`\n📊 Node.js Version: ${process.version}`);
  console.log(`🖥️  Platform: ${process.platform}`);
  console.log(`🏗️  Environment: ${process.env.NODE_ENV || "development"}`);

  process.exit(hasAllRequired ? 0 : 1);
}

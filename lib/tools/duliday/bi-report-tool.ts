import { tool } from "ai";
import { z } from "zod";

// ==================== 常量配置 ====================
const API_CONFIG = {
  BASE_URL: "https://bi.duliday.com/public-api",
  LOGIN_ENDPOINT: "/sign-in",
  DATA_ENDPOINT: "/card",
  CARD_ID: "d88707004062545199330960",
  DOMAIN: "guanbi",
} as const;

const CREDENTIALS = {
  LOGIN_ID: "rensiwen@duliday.com",
  PASSWORD: "UmVuMTIz", // Base64编码的密码
} as const;

const LIMITS = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 500,
  MAX_DETAILED_DISPLAY: 100,
  MAX_NOTIFICATION_PENDING: 5,
} as const;

const FIELD_NAMES = {
  ORDER_DATE: "订单归属日期",
  ORDER_STATUS: "订单状态",
  STORE_NAME: "订单所属门店",
  BIG_REGION: "大区归属",
  ORDER_REGION: "订单所属地区",
  SERVICE_DATE: "订单计划时间",
  SERVICE_CONTENT: "服务内容",
  EXPECTED_REVENUE: "预计收入",
  SHARE_LINK: "分享链接",
  SHARE_TEXT: "分享文案",
} as const;

const FILTER_TYPES = {
  GREATER_THAN: "GT", // 大于
  GREATER_EQUAL: "GE", // 大于等于
  LESS_THAN: "LT", // 小于
  LESS_EQUAL: "LE", // 小于等于
  BETWEEN: "BT", // 介于
  EQUAL: "EQ", // 等于
  NOT_EQUAL: "NE", // 不等于
  IN: "IN", // 包含在列表中
  NOT_IN: "NI", // 不包含在列表中
  STARTS_WITH: "STARTSWITH", // 开始于
  NOT_STARTS_WITH: "NOT_STARTSWITH", // 不开始于
  ENDS_WITH: "ENDSWITH", // 结束于
  NOT_ENDS_WITH: "NOT_ENDSWITH", // 不结束于
  CONTAINS: "CONTAINS", // 包含
  NOT_CONTAINS: "NOT_CONTAINS", // 不包含
  IS_NULL: "IS_NULL", // 为空
  NOT_NULL: "NOT_NULL", // 不为空
} as const;

// ==================== 类型定义 ====================
type Order = Record<string, unknown>;

// 更严格的类型定义
interface LoginResponse {
  result: string;
  response?: {
    token: string;
  };
  message?: string;
}

type FilterCondition = {
  name: string;
  filterType: string;
  filterValue: string[];
};

type StoreStats = {
  count: number;
  revenue: number;
};

// BI API 响应类型
type BIApiResponse = {
  result: string;
  message?: string;
  response?: {
    chartMain?: {
      offset?: number;
      data?: Array<Array<{ v: unknown } | null>>;
      column?: {
        values?: Array<Array<{ title: string }>>;
      };
      count?: number;
      meta?: Record<string, unknown>;
      hitCache?: boolean;
      extra?: Record<string, unknown>;
      limit?: number;
      hasMoreData?: boolean;
      limitInfo?: Record<string, unknown>;
      row?: Record<string, unknown>;
      config?: null;
      view?: string;
      rawDataNotChanged?: boolean;
      chartType?: string;
      cardType?: string;
    };
  };
};

// ==================== 辅助函数 ====================
/**
 * 解析金额字符串，处理中文货币符号、千分位等
 */
function parseMoney(input: unknown): number {
  if (input == null) return 0;

  // 转换为字符串并移除货币符号、千分位、空格等
  const normalized = String(input)
    .replace(/[,\s¥￥]/g, "")
    .replace(/，/g, "") // 中文逗号
    .trim();

  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

/**
 * 从订单中提取收入值
 */
function extractRevenue(order: Order): number {
  const revenue = order[FIELD_NAMES.EXPECTED_REVENUE];
  return parseMoney(revenue);
}

/**
 * 计算订单总收入
 */
function calculateTotalRevenue(orders: Order[]): number {
  return orders.reduce((sum, order) => sum + extractRevenue(order), 0);
}

/**
 * 统计门店数据
 */
function calculateStoreStats(orders: Order[]): Record<string, StoreStats> {
  const stats: Record<string, StoreStats> = {};

  orders.forEach(order => {
    const store = order[FIELD_NAMES.STORE_NAME];
    if (typeof store === "string") {
      if (!stats[store]) {
        stats[store] = { count: 0, revenue: 0 };
      }
      stats[store].count++;
      stats[store].revenue += extractRevenue(order);
    }
  });

  return stats;
}

/**
 * 构建API过滤条件
 */
function buildFilters(params: {
  startDate?: string;
  endDate?: string;
  orderStatus?: string;
  storeName?: string;
  regionName?: string;
  orderRegionName?: string;
}): FilterCondition[] {
  const filters: FilterCondition[] = [];

  if (params.startDate) {
    filters.push({
      name: FIELD_NAMES.ORDER_DATE,
      filterType: FILTER_TYPES.GREATER_EQUAL,
      filterValue: [params.startDate],
    });
  }

  if (params.endDate) {
    filters.push({
      name: FIELD_NAMES.ORDER_DATE,
      filterType: FILTER_TYPES.LESS_EQUAL,
      filterValue: [params.endDate],
    });
  }

  if (params.orderStatus) {
    filters.push({
      name: FIELD_NAMES.ORDER_STATUS,
      filterType: FILTER_TYPES.EQUAL,
      filterValue: [params.orderStatus],
    });
  }

  if (params.regionName) {
    filters.push({
      name: FIELD_NAMES.BIG_REGION,
      filterType: FILTER_TYPES.CONTAINS,
      filterValue: [params.regionName],
    });
  }

  if (params.orderRegionName) {
    filters.push({
      name: FIELD_NAMES.ORDER_REGION,
      filterType: FILTER_TYPES.CONTAINS,
      filterValue: [params.orderRegionName],
    });
  }

  if (params.storeName) {
    filters.push({
      name: FIELD_NAMES.STORE_NAME,
      filterType: FILTER_TYPES.CONTAINS,
      filterValue: [params.storeName],
    });
  }

  return filters;
}

/**
 * 带超时和重试的fetch请求
 */
async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  options: { timeout?: number; retries?: number; retryDelay?: number } = {}
): Promise<Response> {
  const { timeout = 10000, retries = 3, retryDelay = 1000 } = options;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch(input, {
        ...init,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 如果是5xx错误，重试
      if (response.status >= 500 && attempt < retries - 1) {
        console.log(`⚠️ 服务器错误 ${response.status}，${retryDelay}ms 后重试...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue;
      }

      return response;
    } catch (error) {
      if (attempt === retries - 1) throw error;

      console.log(`⚠️ 请求失败，${retryDelay}ms 后重试 (${attempt + 1}/${retries})...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  throw new Error("请求失败，已达最大重试次数");
}

/**
 * 登录获取Token
 */
async function login(): Promise<string> {
  console.log("🔐 正在登录获取Token...");

  const response = await fetchWithRetry(
    `${API_CONFIG.BASE_URL}${API_CONFIG.LOGIN_ENDPOINT}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain: API_CONFIG.DOMAIN,
        loginId: CREDENTIALS.LOGIN_ID,
        password: CREDENTIALS.PASSWORD,
      }),
    },
    { timeout: 15000, retries: 3 }
  );

  if (!response.ok) {
    throw new Error(`登录失败: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as LoginResponse;
  if (data.result !== "ok" || !data.response?.token) {
    throw new Error(`登录失败: ${data.message || "未知错误"}`);
  }

  console.log("✅ 成功获取Token");
  return data.response.token;
}

/**
 * 获取BI数据
 */
async function fetchBIData(
  token: string,
  queryPayload: Record<string, unknown>
): Promise<BIApiResponse> {
  console.log("📤 正在请求BI数据...");
  console.log("请求参数:", JSON.stringify(queryPayload, null, 2));

  const response = await fetchWithRetry(
    `${API_CONFIG.BASE_URL}${API_CONFIG.DATA_ENDPOINT}/${API_CONFIG.CARD_ID}/data`,
    {
      method: "POST",
      headers: {
        "X-Auth-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(queryPayload),
    },
    { timeout: 20000, retries: 3 }
  );

  if (!response.ok) {
    throw new Error(`获取数据失败: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as BIApiResponse;
  if (data.result !== "ok") {
    throw new Error(`API返回错误: ${data.message || "未知错误"}`);
  }

  return data;
}

/**
 * 获取所有分页数据
 */
async function fetchAllPages(
  token: string,
  basePayload: Record<string, unknown>,
  maxPages: number = 10
): Promise<Order[]> {
  const allOrders: Order[] = [];
  let offset = Number(basePayload.offset) || 0; // 继承传入的offset
  const limit = Math.min((basePayload.limit as number) || LIMITS.DEFAULT_LIMIT, LIMITS.MAX_LIMIT);

  for (let page = 0; page < maxPages; page++) {
    const payload = {
      ...basePayload,
      offset,
      limit,
    };

    console.log(`📄 获取第 ${page + 1} 页数据 (offset: ${offset})...`);
    const data = await fetchBIData(token, payload);
    const chartMain = data.response?.chartMain;

    if (!chartMain) break;

    const orders = parseOrders(chartMain);
    if (orders.length === 0) break;

    allOrders.push(...orders);

    // 检查是否还有更多数据
    if (!chartMain.hasMoreData) {
      console.log(`✅ 已获取所有数据，共 ${allOrders.length} 条`);
      break;
    }

    offset += orders.length;

    // 为避免请求过快，添加短暂延迟
    if (page < maxPages - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return allOrders;
}

/**
 * 解析API返回的数据
 */
type ChartMain = NonNullable<BIApiResponse["response"]>["chartMain"];
function parseOrders(chartMain: ChartMain | undefined): Order[] {
  if (!chartMain || !chartMain.data || chartMain.data.length === 0) {
    return [];
  }

  // 提取列名
  const columnValues = chartMain.column?.values || [];
  const columns = columnValues.map((col: Array<{ title: string }>) => {
    return col && col[0]?.title ? col[0].title : "未知字段";
  });

  // 解析数据行
  const orders: Order[] = [];

  try {
    chartMain.data.forEach((row: Array<{ v: unknown } | null>) => {
      const order: Order = {};
      if (Array.isArray(row)) {
        row.forEach((cell: { v: unknown } | null, index: number) => {
          if (index < columns.length) {
            order[columns[index]] = cell?.v ?? null;
          }
        });
      }
      orders.push(order);
    });
  } catch (error) {
    console.error("解析数据时出错:", error);
    throw new Error(`数据解析失败: ${error instanceof Error ? error.message : "未知错误"}`);
  }

  return orders;
}

/**
 * 本地数据过滤（API过滤的后备方案）
 */
function applyLocalFilters(
  orders: Order[],
  params: {
    storeName?: string;
    regionName?: string;
    orderRegionName?: string;
  }
): { filtered: Order[]; wasFiltered: boolean } {
  let filtered = orders;
  const originalCount = orders.length;

  // 门店过滤
  if (params.storeName) {
    const key = String(params.storeName).trim().toLowerCase();
    filtered = filtered.filter(o => {
      const store = o[FIELD_NAMES.STORE_NAME];
      return typeof store === "string" && store.toLowerCase().includes(key);
    });
  }

  // 大区过滤
  if (params.regionName) {
    const key = String(params.regionName).trim().toLowerCase();
    filtered = filtered.filter(o => {
      const region = o[FIELD_NAMES.BIG_REGION];
      return typeof region === "string" && region.toLowerCase().includes(key);
    });
  }

  // 订单地区过滤
  if (params.orderRegionName) {
    const key = String(params.orderRegionName).trim().toLowerCase();
    filtered = filtered.filter(o => {
      const region = o[FIELD_NAMES.ORDER_REGION];
      return typeof region === "string" && region.toLowerCase().includes(key);
    });
  }

  const wasFiltered = filtered.length < originalCount;
  if (wasFiltered) {
    console.log(`⚠️ 本地过滤: ${originalCount} → ${filtered.length} 条`);
  }

  return { filtered, wasFiltered };
}

/**
 * 本地排序函数
 */
function sortOrders(orders: Order[], sortBy: string, sortOrder: "ASC" | "DESC" = "DESC"): Order[] {
  return [...orders].sort((a, b) => {
    let aValue = a[sortBy];
    let bValue = b[sortBy];

    // 处理金额排序
    if (sortBy === FIELD_NAMES.EXPECTED_REVENUE) {
      aValue = parseMoney(aValue);
      bValue = parseMoney(bValue);
    }

    // 处理日期排序（包括所有日期相关字段）
    const dateFields = [
      FIELD_NAMES.ORDER_DATE,
      FIELD_NAMES.SERVICE_DATE,
      "派发时间",
      "剩余开始时间",
    ];
    if (dateFields.includes(sortBy)) {
      aValue = new Date(String(aValue || "")).getTime();
      bValue = new Date(String(bValue || "")).getTime();
    }

    // 字符串比较
    if (typeof aValue === "string" && typeof bValue === "string") {
      return sortOrder === "ASC" ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    }

    // 数字比较
    const numA = Number(aValue) || 0;
    const numB = Number(bValue) || 0;
    return sortOrder === "ASC" ? numA - numB : numB - numA;
  });
}

/**
 * Duliday BI报表数据获取工具
 *
 * @description 调用Duliday BI API获取报表数据，支持多维度筛选和格式化输出
 * @returns AI SDK tool instance
 */
export const dulidayBiReportTool = () =>
  tool({
    description:
      "获取Duliday BI报表数据。支持按日期范围、订单状态、门店、地区等多维度筛选订单数据。返回的数据包含订单详情、服务时间、预计收入等信息，适合生成报表和通知。",
    inputSchema: z.object({
      startDate: z
        .string()
        .optional()
        .describe("开始日期，格式：YYYY-MM-DD，用于筛选订单归属日期的下限"),
      endDate: z
        .string()
        .optional()
        .describe("结束日期，格式：YYYY-MM-DD，用于筛选订单归属日期的上限"),
      limit: z
        .number()
        .optional()
        .default(LIMITS.DEFAULT_LIMIT)
        .describe(`返回记录数量，默认${LIMITS.DEFAULT_LIMIT}条，最大${LIMITS.MAX_LIMIT}条`),
      offset: z.number().optional().default(0).describe("分页偏移量，默认0"),
      orderStatus: z
        .enum(["待接受", "待验收", "进行中", "已拒绝", "已取消", "已验收"])
        .optional()
        .describe("订单状态筛选"),
      storeName: z.string().optional().describe("门店名称关键词，用于筛选特定门店"),
      regionName: z.string().optional().describe("大区归属，如：浦东新区、崇明区、静安区等"),
      orderRegionName: z
        .string()
        .optional()
        .describe("订单所属地区（细分区域），如：长兴、外高桥、金桥等"),
      sortBy: z
        .enum(["派发时间", "订单归属日期", "预计收入", "剩余开始时间"])
        .optional()
        .describe("排序字段"),
      sortOrder: z
        .enum(["ASC", "DESC"])
        .optional()
        .default("DESC")
        .describe("排序方向：ASC升序，DESC降序"),
      includeRawData: z
        .boolean()
        .optional()
        .default(false)
        .describe("是否返回原始API数据（用于调试）"),
      formatType: z
        .enum(["summary", "detailed", "notification"])
        .optional()
        .default("summary")
        .describe("输出格式类型：summary摘要、detailed详细、notification通知格式"),
    }),
    execute: async params => {
      const {
        startDate,
        endDate,
        limit = LIMITS.DEFAULT_LIMIT,
        offset = 0,
        orderStatus,
        storeName,
        regionName,
        orderRegionName,
        sortBy,
        sortOrder = "DESC",
        includeRawData = false,
        formatType = "summary",
      } = params;

      console.log("📊 duliday_bi_report tool called with:", params);

      try {
        // Step 1: 登录获取Token
        const token = await login();

        // Step 2: 构建查询参数
        const filters = buildFilters({
          startDate,
          endDate,
          orderStatus,
          storeName,
          regionName,
          orderRegionName,
        });

        // 构建排序参数（API暂不支持，保留接口）
        let headerSortings: Array<{ name: string; order: string }> | undefined;
        if (sortBy) {
          headerSortings = [{ name: sortBy, order: sortOrder }];
        }

        const queryPayload = {
          offset,
          limit: Math.min(limit, LIMITS.MAX_LIMIT),
          view: "GRAPH",
          filters,
          dynamicParams: [],
          ...(headerSortings && { headerSortings }),
        };

        // Step 3: 获取数据（支持分页）
        let orders: Order[] = [];
        let totalCount = 0;
        let hasMoreData = false;

        // 判断是否需要获取全部数据
        const needAllData = limit > LIMITS.MAX_LIMIT || formatType === "notification";

        if (needAllData) {
          // 获取所有分页数据
          orders = await fetchAllPages(token, queryPayload);
          totalCount = orders.length;
        } else {
          // 只获取第一页
          const rawData = await fetchBIData(token, queryPayload);
          const chartMain = rawData.response?.chartMain;
          orders = parseOrders(chartMain);
          totalCount = chartMain?.count || orders.length;
          hasMoreData = chartMain?.hasMoreData || false;

          if (hasMoreData) {
            console.log(`ℹ️ 数据未完全加载，共有 ${totalCount} 条，当前显示 ${orders.length} 条`);
          }
        }

        if (orders.length === 0) {
          return {
            type: "text" as const,
            text: "未找到符合条件的订单数据",
          };
        }

        // Step 4: 应用本地过滤（如果需要）
        const { filtered, wasFiltered } = applyLocalFilters(orders, {
          storeName,
          regionName,
          orderRegionName,
        });
        orders = filtered;

        // Step 5: 本地排序（如果需要）
        if (sortBy && orders.length > 0) {
          orders = sortOrders(orders, sortBy, sortOrder);
        }

        // 如果本地过滤了数据，使用过滤后的数量作为总数
        const displayCount = wasFiltered ? orders.length : totalCount;

        // 如果需要返回原始数据
        if (includeRawData) {
          return {
            type: "text" as const,
            text: JSON.stringify(
              {
                totalCount: displayCount,
                originalCount: totalCount,
                currentCount: orders.length,
                hasMoreData,
                wasFiltered,
                data: orders,
              },
              null,
              2
            ),
          };
        }

        // Step 6: 格式化输出
        const message = formatOutput(orders, displayCount, formatType, params);

        return {
          type: "text" as const,
          text: message,
        };
      } catch (error) {
        console.error("获取BI报表数据失败:", error);
        return {
          type: "text" as const,
          text: `❌ 获取BI报表数据失败: ${error instanceof Error ? error.message : "未知错误"}`,
        };
      }
    },
  });

// ==================== 格式化输出函数 ====================
/**
 * 根据格式类型生成输出消息
 */
function formatOutput(
  orders: Order[],
  totalCount: number,
  formatType: string,
  params: {
    startDate?: string;
    endDate?: string;
    orderStatus?: string;
    storeName?: string;
    regionName?: string;
    orderRegionName?: string;
  }
): string {
  switch (formatType) {
    case "summary":
      return formatSummary(orders, totalCount, params);
    case "detailed":
      return formatDetailed(orders, totalCount);
    case "notification":
      return formatNotification(orders);
    default:
      return formatSummary(orders, totalCount, params);
  }
}

/**
 * 生成摘要格式
 */
function formatSummary(
  orders: Order[],
  totalCount: number,
  params: {
    startDate?: string;
    endDate?: string;
    orderStatus?: string;
    storeName?: string;
    regionName?: string;
    orderRegionName?: string;
  }
): string {
  let message = `📊 BI报表数据摘要\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  // 查询条件
  message += `📅 查询条件：\n`;
  if (params.startDate || params.endDate) {
    message += `   日期范围：${params.startDate || "开始"} ~ ${params.endDate || "至今"}\n`;
  }
  if (params.orderStatus) message += `   订单状态：${params.orderStatus}\n`;
  if (params.storeName) message += `   门店：${params.storeName}\n`;
  if (params.regionName) message += `   大区归属：${params.regionName}\n`;
  if (params.orderRegionName) message += `   所属地区：${params.orderRegionName}\n`;

  message += `\n📈 数据统计：\n`;
  message += `   总记录数：${totalCount} 条\n`;
  if (totalCount !== orders.length) {
    message += `   筛选后：${orders.length} 条\n`;
  }

  // 计算汇总数据
  const totalRevenue = calculateTotalRevenue(orders);
  message += `   预计总收入：¥${totalRevenue.toFixed(2)}\n`;

  // 按门店统计
  const storeStats = calculateStoreStats(orders);
  message += `\n📍 门店分布：\n`;
  Object.entries(storeStats)
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5)
    .forEach(([store, stats]) => {
      message += `   ${store}：${stats.count}单，¥${stats.revenue.toFixed(2)}\n`;
    });

  return message;
}

/**
 * 生成详细格式
 */
function formatDetailed(orders: Order[], totalCount: number): string {
  let message = `📊 BI报表详细数据\n`;
  message += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  // 限制详细显示的条数
  const ordersToDisplay = orders.slice(0, LIMITS.MAX_DETAILED_DISPLAY);
  message += `共 ${totalCount} 条记录，显示前 ${ordersToDisplay.length} 条\n\n`;

  ordersToDisplay.forEach((order, index) => {
    message += `【订单 ${index + 1}】\n`;
    message += `📍 门店：${order[FIELD_NAMES.STORE_NAME]}\n`;
    message += `📍 位置：${order[FIELD_NAMES.BIG_REGION]} - ${order[FIELD_NAMES.ORDER_REGION]}\n`;
    message += `📅 归属日期：${order[FIELD_NAMES.ORDER_DATE]}\n`;
    message += `⏰ 服务时间：${order[FIELD_NAMES.SERVICE_DATE]}\n`;
    message += `💼 服务内容：${order[FIELD_NAMES.SERVICE_CONTENT]}\n`;
    const revenue = parseMoney(order[FIELD_NAMES.EXPECTED_REVENUE]);
    message += `💰 预计收入：¥${revenue.toFixed(2)}\n`;
    message += `📌 订单状态：${order[FIELD_NAMES.ORDER_STATUS]}\n`;
    message += `🔗 详情链接：${order[FIELD_NAMES.SHARE_LINK]}\n`;
    message += `─────────────────────\n`;
  });

  // 如果数据超过限制，添加提示
  if (orders.length > LIMITS.MAX_DETAILED_DISPLAY) {
    message += `\n⚠️ 数据量较大，仅显示前 ${LIMITS.MAX_DETAILED_DISPLAY} 条详细信息\n`;
    message += `📊 剩余 ${orders.length - LIMITS.MAX_DETAILED_DISPLAY} 条记录未显示\n`;
  }

  return message;
}

/**
 * 生成通知格式
 */
function formatNotification(orders: Order[]): string {
  let message = `【Duliday BI报表通知】\n\n`;

  const today = new Date().toISOString().split("T")[0];
  // 统一使用SERVICE_DATE判断今日订单，与显示保持一致
  const todayOrders = orders.filter(o => {
    const serviceDate = String(o[FIELD_NAMES.SERVICE_DATE] || "");
    return serviceDate.startsWith(today);
  });
  const pendingOrders = orders.filter(o => o[FIELD_NAMES.ORDER_STATUS] === "待接受");

  if (todayOrders.length > 0) {
    message += `📅 今日服务订单（${today}）：\n`;
    todayOrders.forEach(order => {
      message += `• ${order[FIELD_NAMES.STORE_NAME]} - ${order[FIELD_NAMES.SERVICE_DATE]}\n`;
      message += `  ${order[FIELD_NAMES.SERVICE_CONTENT]}\n`;
      const revenue = parseMoney(order[FIELD_NAMES.EXPECTED_REVENUE]);
      message += `  预计收入：¥${revenue.toFixed(2)}\n\n`;
    });
  }

  if (pendingOrders.length > 0) {
    message += `⚠️ 待接受订单（${pendingOrders.length}个）：\n`;
    pendingOrders.slice(0, LIMITS.MAX_NOTIFICATION_PENDING).forEach(order => {
      message += `• ${order[FIELD_NAMES.STORE_NAME]} - ${order[FIELD_NAMES.SERVICE_DATE]}\n`;
      message += `  ${order[FIELD_NAMES.SHARE_TEXT] || order[FIELD_NAMES.SERVICE_CONTENT]}\n\n`;
    });
  }

  // 统计信息
  const totalRevenue = calculateTotalRevenue(orders);
  message += `📊 统计汇总：\n`;
  message += `• 总订单数：${orders.length}\n`;
  message += `• 预计总收入：¥${totalRevenue.toFixed(2)}\n`;
  message += `• 待接受：${pendingOrders.length}个\n`;

  return message;
}

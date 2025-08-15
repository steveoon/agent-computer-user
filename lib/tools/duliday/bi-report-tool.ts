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
 * 从订单中提取收入值
 */
function extractRevenue(order: Order): number {
  const revenue = order[FIELD_NAMES.EXPECTED_REVENUE];
  const value =
    typeof revenue === "string" || typeof revenue === "number" ? parseFloat(String(revenue)) : 0;
  return isNaN(value) ? 0 : value;
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
 * 登录获取Token
 */
async function login(): Promise<string> {
  console.log("🔐 正在登录获取Token...");

  const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.LOGIN_ENDPOINT}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      domain: API_CONFIG.DOMAIN,
      loginId: CREDENTIALS.LOGIN_ID,
      password: CREDENTIALS.PASSWORD,
    }),
  });

  if (!response.ok) {
    throw new Error(`登录失败: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (data.result !== "ok") {
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

  const response = await fetch(
    `${API_CONFIG.BASE_URL}${API_CONFIG.DATA_ENDPOINT}/${API_CONFIG.CARD_ID}/data`,
    {
      method: "POST",
      headers: {
        "X-Auth-Token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(queryPayload),
    }
  );

  if (!response.ok) {
    throw new Error(`获取数据失败: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  if (data.result !== "ok") {
    throw new Error(`API返回错误: ${data.message || "未知错误"}`);
  }

  return data;
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
  let wasFiltered = false;

  // 检查并应用门店过滤
  if (params.storeName) {
    const storeName = params.storeName;
    const needsFilter = filtered.some(o => {
      const store = o[FIELD_NAMES.STORE_NAME];
      return typeof store === "string" && !store.includes(storeName);
    });

    if (needsFilter) {
      wasFiltered = true;
      filtered = filtered.filter(o => {
        const store = o[FIELD_NAMES.STORE_NAME];
        return typeof store === "string" && store.includes(storeName);
      });
    }
  }

  // 检查并应用大区过滤
  if (params.regionName) {
    const regionName = params.regionName;
    const needsFilter = filtered.some(o => {
      const region = o[FIELD_NAMES.BIG_REGION];
      return !(typeof region === "string" && region.includes(regionName));
    });

    if (needsFilter) {
      wasFiltered = true;
      filtered = filtered.filter(o => {
        const region = o[FIELD_NAMES.BIG_REGION];
        return typeof region === "string" && region.includes(regionName);
      });
    }
  }

  // 检查并应用订单地区过滤
  if (params.orderRegionName) {
    const orderRegionName = params.orderRegionName;
    const needsFilter = filtered.some(o => {
      const region = o[FIELD_NAMES.ORDER_REGION];
      return !(typeof region === "string" && region.includes(orderRegionName));
    });

    if (needsFilter) {
      wasFiltered = true;
      filtered = filtered.filter(o => {
        const region = o[FIELD_NAMES.ORDER_REGION];
        return typeof region === "string" && region.includes(orderRegionName);
      });
    }
  }

  if (wasFiltered) {
    console.log("⚠️ API筛选未生效，已应用本地筛选");
  }

  return { filtered, wasFiltered };
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
        .enum(["待接受", "进行中", "已完成", "已取消"])
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

        // Step 3: 获取BI数据
        const rawData = await fetchBIData(token, queryPayload);

        // Step 4: 解析数据
        const chartMain = rawData.response?.chartMain;
        let orders = parseOrders(chartMain);

        if (orders.length === 0) {
          return {
            type: "text" as const,
            text: "未找到符合条件的订单数据",
          };
        }

        // Step 5: 应用本地过滤（如果需要）
        const { filtered } = applyLocalFilters(orders, {
          storeName,
          regionName,
          orderRegionName,
        });
        orders = filtered;

        const totalCount = chartMain?.count || orders.length;

        // 如果需要返回原始数据
        if (includeRawData) {
          return {
            type: "text" as const,
            text: JSON.stringify(
              {
                totalCount,
                currentCount: orders.length,
                hasMoreData: chartMain?.hasMoreData || false,
                data: orders,
                raw: rawData.response,
              },
              null,
              2
            ),
          };
        }

        // Step 6: 格式化输出
        const message = formatOutput(orders, totalCount, formatType, params);

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
  message += `   当前显示：${orders.length} 条\n`;

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
  message += `共 ${totalCount} 条记录，显示前 ${orders.length} 条\n\n`;

  // 限制详细显示的条数
  const ordersToDisplay = orders.slice(0, LIMITS.MAX_DETAILED_DISPLAY);

  ordersToDisplay.forEach((order, index) => {
    message += `【订单 ${index + 1}】\n`;
    message += `📍 门店：${order[FIELD_NAMES.STORE_NAME]}\n`;
    message += `📍 位置：${order[FIELD_NAMES.BIG_REGION]} - ${order[FIELD_NAMES.ORDER_REGION]}\n`;
    message += `📅 服务日期：${order[FIELD_NAMES.ORDER_DATE]}\n`;
    message += `⏰ 服务时间：${order[FIELD_NAMES.SERVICE_DATE]}\n`;
    message += `💼 服务内容：${order[FIELD_NAMES.SERVICE_CONTENT]}\n`;
    message += `💰 预计收入：¥${order[FIELD_NAMES.EXPECTED_REVENUE]}\n`;
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
  const todayOrders = orders.filter(o => o[FIELD_NAMES.ORDER_DATE] === today);
  const pendingOrders = orders.filter(o => o[FIELD_NAMES.ORDER_STATUS] === "待接受");

  if (todayOrders.length > 0) {
    message += `📅 今日订单（${today}）：\n`;
    todayOrders.forEach(order => {
      message += `• ${order[FIELD_NAMES.STORE_NAME]} - ${order[FIELD_NAMES.SERVICE_DATE]}\n`;
      message += `  ${order[FIELD_NAMES.SERVICE_CONTENT]}\n`;
      message += `  预计收入：¥${order[FIELD_NAMES.EXPECTED_REVENUE]}\n\n`;
    });
  }

  if (pendingOrders.length > 0) {
    message += `⚠️ 待接受订单（${pendingOrders.length}个）：\n`;
    pendingOrders.slice(0, LIMITS.MAX_NOTIFICATION_PENDING).forEach(order => {
      message += `• ${order[FIELD_NAMES.STORE_NAME]} - ${order[FIELD_NAMES.ORDER_DATE]}\n`;
      message += `  ${order[FIELD_NAMES.SHARE_TEXT]}\n\n`;
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

import { DashboardClient } from "./dashboard-client";

/**
 * 招聘统计 Dashboard 页面
 *
 * Server Component 入口，渲染客户端 Dashboard 容器
 */
export default function DashboardPage() {
  return <DashboardClient />;
}

export const metadata = {
  title: "招聘统计 Dashboard",
  description: "查看招聘数据统计和转化漏斗",
};

/**
 * 地理编码相关类型定义
 *
 * 集中管理所有与位置、坐标、高德地图 MCP 相关的类型
 */

import { z } from "zod";
import type { Store } from "./zhipin";

// ============ 坐标类型 ============

/**
 * 坐标 Schema
 * 用于门店位置和用户位置的经纬度表示
 */
export const CoordinatesSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});

export type Coordinates = z.infer<typeof CoordinatesSchema>;

// ============ 带距离的门店 ============

/**
 * 带距离信息的门店
 * 用于位置匹配后的门店排序和展示
 */
export interface StoreWithDistance {
  store: Store;
  distance?: number; // 距离（米），undefined 表示无法计算
}

// ============ 批量地理编码结果 ============

/**
 * 批量地理编码统计信息
 */
export interface BatchGeocodingStats {
  total: number; // 总门店数
  needsGeocoding: number; // 需要编码的数量
  success: number; // 成功数
  failed: number; // 失败数
  skipped: number; // 跳过数（已有坐标）
  failedStores: string[]; // 失败的门店名称列表
}

/**
 * 批量地理编码结果
 */
export interface BatchGeocodingResult {
  stores: Store[];
  stats: BatchGeocodingStats;
}

// ============ 高德 MCP 工具类型 ============

/**
 * 高德 MCP 工具通用返回结构
 */
export interface AmapMCPResponse {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

// ------------ maps_geo (地址转坐标) ------------

/**
 * maps_geo 输入参数
 */
export interface MapsGeoParams {
  address: string;
  city?: string;
}

/**
 * maps_geo 返回数据结构
 */
export interface MapsGeoResult {
  return: Array<{
    location: string; // 格式: "经度,纬度"
    city?: string;
    district?: string;
  }>;
}

// ------------ maps_text_search (关键词搜索 POI) ------------

/**
 * maps_text_search 输入参数
 */
export interface MapsTextSearchParams {
  keywords: string;
  city?: string;
  types?: string;
}

/**
 * maps_text_search 返回数据结构
 */
export interface MapsTextSearchResult {
  pois?: Array<{
    id: string;
    name: string;
    address?: string;
  }>;
}

// ------------ maps_search_detail (获取 POI 详情) ------------

/**
 * maps_search_detail 输入参数
 */
export interface MapsSearchDetailParams {
  id: string;
}

/**
 * maps_search_detail 返回数据结构
 */
export interface MapsSearchDetailResult {
  id?: string;
  name?: string;
  location?: string; // 格式: "经度,纬度"
  address?: string;
}

// ------------ 类型化的高德 MCP 工具集 ------------

/**
 * 类型化的高德 MCP 工具集
 * 用于 geocodingService 中的类型安全调用
 */
export interface AmapMCPTools {
  maps_geo?: {
    execute: (params: MapsGeoParams) => Promise<AmapMCPResponse>;
  };
  maps_text_search?: {
    execute: (params: MapsTextSearchParams) => Promise<AmapMCPResponse>;
  };
  maps_search_detail?: {
    execute: (params: MapsSearchDetailParams) => Promise<AmapMCPResponse>;
  };
}

// ============ 中国大陆坐标范围 ============

/**
 * 中国大陆坐标边界（用于验证）
 */
export const CHINA_BOUNDS = {
  minLat: 3.86,
  maxLat: 53.55,
  minLng: 73.66,
  maxLng: 135.05,
} as const;

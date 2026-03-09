/**
 * 检查坐标是否为有效的非零数值坐标
 *
 * 用于判断门店是否已有坐标（不需要地理编码）。
 * 不检查地理范围（与 geocoding.service 的 isValidCoordinates 不同）。
 */
export const hasNumericCoordinates = (
  coords?: { lat?: unknown; lng?: unknown } | null
): boolean =>
  typeof coords?.lat === "number" &&
  Number.isFinite(coords.lat) &&
  typeof coords?.lng === "number" &&
  Number.isFinite(coords.lng) &&
  !(coords.lat === 0 && coords.lng === 0);

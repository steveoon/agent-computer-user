"use client";

import { useEffect, useRef } from "react";
import { useSpring, motion, MotionValue } from "motion/react";

/**
 * AnimatedNumber 组件属性
 */
interface AnimatedNumberProps {
  /** 要显示的数值 */
  value: number;
  /** 动画持续时间（秒） */
  duration?: number;
  /** 小数位数 */
  decimals?: number;
  /** 千分位分隔符 */
  separator?: string;
  /** 前缀（如 ¥） */
  prefix?: string;
  /** 后缀（如 %） */
  suffix?: string;
  /** 自定义类名 */
  className?: string;
  /** 是否显示变化方向指示器 */
  showDirection?: boolean;
  /** 变化方向的颜色（上涨/下跌） */
  directionColors?: {
    up: string;
    down: string;
  };
}

/**
 * 格式化数字（添加千分位分隔符）
 */
function formatNumber(
  value: number,
  decimals: number,
  separator: string
): string {
  const fixed = value.toFixed(decimals);
  const [intPart, decPart] = fixed.split(".");

  // 添加千分位分隔符
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator);

  return decPart ? `${formattedInt}.${decPart}` : formattedInt;
}

/**
 * 内部组件：动画数字显示
 */
function AnimatedValue({
  motionValue,
  decimals,
  separator,
  initialValue,
}: {
  motionValue: MotionValue<number>;
  decimals: number;
  separator: string;
  initialValue: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const hasInitialized = useRef(false);

  // 监听值变化 + 设置初始值
  useEffect(() => {
    // 首次挂载时设置初始值
    if (!hasInitialized.current && ref.current) {
      ref.current.textContent = formatNumber(motionValue.get(), decimals, separator);
      hasInitialized.current = true;
    }

    const unsubscribe = motionValue.on("change", (latest) => {
      if (ref.current) {
        ref.current.textContent = formatNumber(latest, decimals, separator);
      }
    });
    return unsubscribe;
  }, [motionValue, decimals, separator]);

  // 渲染时直接设置初始文本，避免闪烁
  return <span ref={ref}>{formatNumber(initialValue, decimals, separator)}</span>;
}

/**
 * 数字滚动动画组件
 *
 * 使用 framer-motion 的 spring 动画实现平滑的数字变化效果
 *
 * @example
 * ```tsx
 * // 基础用法
 * <AnimatedNumber value={1234} />
 *
 * // 带百分比后缀
 * <AnimatedNumber value={85.5} suffix="%" decimals={1} />
 *
 * // 带货币前缀和千分位
 * <AnimatedNumber value={12345.67} prefix="¥" decimals={2} />
 * ```
 */
export function AnimatedNumber({
  value,
  duration = 0.8,
  decimals = 0,
  separator = ",",
  prefix = "",
  suffix = "",
  className = "",
  showDirection = false,
  directionColors = { up: "text-green-500", down: "text-red-500" },
}: AnimatedNumberProps) {
  const prevValueRef = useRef(value);
  const directionRef = useRef<"up" | "down" | "none">("none");

  // 计算变化方向
  useEffect(() => {
    if (value > prevValueRef.current) {
      directionRef.current = "up";
    } else if (value < prevValueRef.current) {
      directionRef.current = "down";
    }
    prevValueRef.current = value;
  }, [value]);

  // 使用 spring 动画
  const spring = useSpring(value, {
    mass: 1,
    stiffness: 75,
    damping: 15,
    duration: duration * 1000,
  });

  // 当 value 改变时更新 spring
  useEffect(() => {
    spring.set(value);
  }, [spring, value]);

  const direction = directionRef.current;
  const directionIndicator =
    showDirection && direction !== "none" ? (
      <motion.span
        initial={{ opacity: 0, y: direction === "up" ? 5 : -5 }}
        animate={{ opacity: 1, y: 0 }}
        className={`ml-1 text-xs ${direction === "up" ? directionColors.up : directionColors.down}`}
      >
        {direction === "up" ? "↑" : "↓"}
      </motion.span>
    ) : null;

  return (
    <span className={className}>
      {prefix}
      <AnimatedValue
        motionValue={spring}
        decimals={decimals}
        separator={separator}
        initialValue={value}
      />
      {suffix}
      {directionIndicator}
    </span>
  );
}

/**
 * 百分比动画数字（预设配置）
 */
export function AnimatedPercentage({
  value,
  className,
  ...props
}: Omit<AnimatedNumberProps, "suffix" | "decimals"> & {
  value: number;
  className?: string;
}) {
  return (
    <AnimatedNumber
      value={value}
      suffix="%"
      decimals={1}
      className={className}
      {...props}
    />
  );
}

/**
 * 整数动画数字（预设配置）
 */
export function AnimatedInteger({
  value,
  className,
  ...props
}: Omit<AnimatedNumberProps, "decimals"> & {
  value: number;
  className?: string;
}) {
  return (
    <AnimatedNumber
      value={value}
      decimals={0}
      className={className}
      {...props}
    />
  );
}

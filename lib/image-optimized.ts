"use server";

import sharp from "sharp";
import {
  CompressionConfig,
  CompressionResult,
  ImageAnalysis,
  CompressionParams,
  BestCompressionResult,
  OptimalDimensions,
} from "../types";

/**
 * 🧠 智能图像压缩引擎 v2.0
 * 专为LLM截图优化，平衡token效率与视觉质量
 */
export async function compressImageServerV2(
  base64Data: string,
  config: Partial<CompressionConfig> = {}
): Promise<string> {
  const startTime = Date.now();

  // 🎛️ 智能配置系统
  const finalConfig: CompressionConfig = {
    targetSizeKB: config.targetSizeKB || 150, // 提高目标大小，保证质量
    maxSizeKB: config.maxSizeKB || 200,
    minQuality: config.minQuality || 45,
    maxQuality: config.maxQuality || 85,
    enableAdaptive: config.enableAdaptive ?? true,
    preserveText: config.preserveText ?? true,
    ...config,
  };

  try {
    const result = await processImageWithStrategy(base64Data, finalConfig, startTime);

    console.log(
      `🚀 压缩完成: ${result.originalSizeKB.toFixed(2)}KB → ${result.finalSizeKB.toFixed(
        2
      )}KB (${result.compressionRatio.toFixed(1)}% 压缩) 质量: ${
        result.quality
      } 耗时: ${result.processingTime}ms`
    );

    return result.base64;
  } catch (error) {
    console.error("🚨 压缩失败，使用备用策略:", error);
    return await fallbackCompression(base64Data);
  }
}

/**
 * 🎯 核心处理策略：二分查找 + 自适应优化
 */
async function processImageWithStrategy(
  base64Data: string,
  config: CompressionConfig,
  startTime: number
): Promise<CompressionResult> {
  const buffer = Buffer.from(base64Data, "base64");
  const originalSizeKB = (base64Data.length * 3) / 4 / 1024;

  // 📊 图像分析
  const metadata = await sharp(buffer).metadata();
  const imageAnalysis = analyzeImageCharacteristics(metadata, originalSizeKB);

  // 🎯 策略选择
  if (originalSizeKB <= config.targetSizeKB) {
    return await lightOptimization(buffer, originalSizeKB, config, startTime);
  }

  if (config.enableAdaptive) {
    return await adaptiveCompression(buffer, originalSizeKB, config, imageAnalysis, startTime);
  } else {
    return await standardCompression(buffer, originalSizeKB, config, startTime);
  }
}

/**
 * 🔬 图像特征分析器
 */
function analyzeImageCharacteristics(metadata: sharp.Metadata, sizeKB: number) {
  const width = metadata.width || 1024;
  const height = metadata.height || 768;
  const pixelDensity = (width * height) / 1000000; // MP

  return {
    isHighRes: pixelDensity > 2.0,
    isWidescreen: width / height > 1.5,
    likelyScreenshot: width > 1200 && height > 600,
    density: pixelDensity,
    aspectRatio: width / height,
    originalSize: sizeKB,
    width,
    height,
  };
}

/**
 * 🧠 自适应压缩：智能二分查找最优质量
 */
async function adaptiveCompression(
  buffer: Buffer,
  originalSizeKB: number,
  config: CompressionConfig,
  analysis: ImageAnalysis,
  startTime: number
): Promise<CompressionResult> {
  // 🎛️ 动态参数调整
  const optimalDimensions = calculateOptimalDimensions(analysis, config);

  let lowQuality = config.minQuality;
  let highQuality = config.maxQuality;
  let bestResult: BestCompressionResult | null = null;
  let iterations = 0;
  const maxIterations = 6; // 限制迭代次数

  // 🔍 二分查找最优质量点
  while (lowQuality <= highQuality && iterations < maxIterations) {
    const midQuality = Math.round((lowQuality + highQuality) / 2);
    iterations++;

    const result = await compressWithParams(buffer, {
      ...optimalDimensions,
      quality: midQuality,
      preserveText: config.preserveText,
    });

    const resultSizeKB = (result.length * 3) / 4 / 1024;

    console.log(`🔍 迭代 ${iterations}: 质量=${midQuality}, 大小=${resultSizeKB.toFixed(2)}KB`);

    if (resultSizeKB <= config.targetSizeKB) {
      bestResult = {
        base64: result,
        quality: midQuality,
        sizeKB: resultSizeKB,
      };
      lowQuality = midQuality + 1; // 尝试更高质量
    } else if (resultSizeKB <= config.maxSizeKB) {
      if (!bestResult || resultSizeKB < bestResult.sizeKB) {
        bestResult = {
          base64: result,
          quality: midQuality,
          sizeKB: resultSizeKB,
        };
      }
      highQuality = midQuality - 1;
    } else {
      highQuality = midQuality - 1;
    }
  }

  // 📊 返回最佳结果
  if (bestResult) {
    return {
      base64: bestResult.base64,
      originalSizeKB,
      finalSizeKB: bestResult.sizeKB,
      compressionRatio: ((originalSizeKB - bestResult.sizeKB) / originalSizeKB) * 100,
      quality: bestResult.quality,
      processingTime: Date.now() - startTime,
    };
  }

  // 兜底策略
  return await standardCompression(buffer, originalSizeKB, config, startTime);
}

/**
 * 📐 智能尺寸计算器
 */
function calculateOptimalDimensions(
  analysis: ImageAnalysis,
  config: CompressionConfig
): OptimalDimensions {
  let scaleFactor = 1.0;

  // 🎯 基于图像特征的缩放策略
  if (analysis.likelyScreenshot) {
    // 截图优化：保持文本清晰度
    if (analysis.originalSize > 300) {
      scaleFactor = 0.8; // 大截图适度缩放
    } else if (analysis.originalSize > 200) {
      scaleFactor = 0.9; // 中等大小轻微缩放
    }
  } else if (analysis.isHighRes) {
    scaleFactor = 0.75; // 高分辨率图像可以更多压缩
  }

  // 📏 确保最小可读性
  const minWidth = config.preserveText ? 800 : 600; // 根据文本保留需求调整最小宽度
  const targetWidth = Math.max(minWidth, Math.round(analysis.width * scaleFactor));

  return {
    width: targetWidth,
    height: Math.round((targetWidth / analysis.width) * analysis.height),
  };
}

/**
 * ⚙️ 参数化压缩执行器
 */
async function compressWithParams(buffer: Buffer, params: CompressionParams): Promise<string> {
  const sharpInstance = sharp(buffer);

  // 🎨 智能预处理
  if (params.preserveText) {
    // 针对文本优化的预处理
    sharpInstance
      .gamma(1.1) // 轻微增强对比度，提升文本清晰度
      .modulate({
        brightness: 1.05, // 轻微提亮
        saturation: 0.8, // 降低饱和度，利于压缩
      });
  } else {
    sharpInstance.grayscale(); // 非文本内容转灰度
  }

  // 🔧 核心压缩处理
  const processedBuffer = await sharpInstance
    .resize({
      width: params.width,
      height: params.height,
      fit: "inside",
      withoutEnlargement: true,
      kernel: "lanczos3", // 高质量缩放算法
    })
    .jpeg({
      quality: Math.max(1, Math.min(100, params.quality)), // 确保质量参数在1-100范围内
      progressive: true,
      mozjpeg: true, // 启用更好的压缩算法
      optimiseCoding: true,
      quantisationTable: 2, // 优化量化表
      force: true,
    })
    .toBuffer();

  return processedBuffer.toString("base64");
}

/**
 * 🪶 轻量级优化（小文件）
 */
async function lightOptimization(
  buffer: Buffer,
  originalSizeKB: number,
  config: CompressionConfig,
  startTime: number
): Promise<CompressionResult> {
  console.log(`📦 文件已小于目标大小，执行轻量级优化`);

  // 使用配置的质量参数进行轻量级优化，确保在有效范围内
  const quality = Math.max(1, Math.min(100, Math.min(config.maxQuality, 90)));

  const optimizedBuffer = await sharp(buffer)
    .jpeg({
      quality,
      progressive: true,
      mozjpeg: true,
      optimiseCoding: true,
      force: true,
    })
    .toBuffer();

  const finalSizeKB = (optimizedBuffer.length * 3) / 4 / 1024;

  return {
    base64: optimizedBuffer.toString("base64"),
    originalSizeKB,
    finalSizeKB,
    compressionRatio: ((originalSizeKB - finalSizeKB) / originalSizeKB) * 100,
    quality,
    processingTime: Date.now() - startTime,
  };
}

/**
 * 🛡️ 标准压缩（兜底策略）
 */
async function standardCompression(
  buffer: Buffer,
  originalSizeKB: number,
  config: CompressionConfig,
  startTime: number
): Promise<CompressionResult> {
  const metadata = await sharp(buffer).metadata();
  const scaleFactor = originalSizeKB > 250 ? 0.8 : 0.9;

  // 使用配置参数计算质量，确保在JPEG有效范围内 (1-100)
  const quality = Math.max(
    1, // 最小值1
    Math.min(
      100, // 最大值100
      Math.max(
        Math.min(100, config.minQuality), // 确保minQuality不超过100
        Math.min(Math.min(100, config.maxQuality), originalSizeKB > 300 ? 60 : 65)
      )
    )
  );

  const compressedBuffer = await sharp(buffer)
    .resize({
      width: Math.round((metadata.width || 1024) * scaleFactor),
      height: Math.round((metadata.height || 768) * scaleFactor),
      fit: "inside",
    })
    .jpeg({
      quality,
      progressive: true,
      force: true,
    })
    .toBuffer();

  const finalSizeKB = (compressedBuffer.length * 3) / 4 / 1024;

  return {
    base64: compressedBuffer.toString("base64"),
    originalSizeKB,
    finalSizeKB,
    compressionRatio: ((originalSizeKB - finalSizeKB) / originalSizeKB) * 100,
    quality,
    processingTime: Date.now() - startTime,
  };
}

/**
 * 🚨 终极兜底策略
 */
async function fallbackCompression(base64Data: string): Promise<string> {
  try {
    const buffer = Buffer.from(base64Data, "base64");
    const fallbackBuffer = await sharp(buffer).jpeg({ quality: 60, force: true }).toBuffer();
    return fallbackBuffer.toString("base64");
  } catch {
    console.error("🆘 所有压缩策略失败，返回原图");
    return base64Data;
  }
}

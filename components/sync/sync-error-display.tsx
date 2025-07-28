import React from 'react';

interface SyncErrorDisplayProps {
  /**
   * 错误消息字符串，可能包含换行符
   */
  error: string;
  /**
   * 额外的 className
   */
  className?: string;
  /**
   * 是否显示为紧凑模式（减少间距）
   */
  compact?: boolean;
}

/**
 * 同步错误展示组件
 * 负责格式化和展示 Duliday 同步过程中的错误信息
 */
export function SyncErrorDisplay({ error, className = '', compact = false }: SyncErrorDisplayProps) {
  return (
    <div className={className}>
      {error.split('\n').map((line, index) => {
        // 跳过空行
        if (!line.trim()) return null;
        
        // 判断行的类型
        const isIndented = line.startsWith('  ');
        const isHeader = line.includes('同步失败：') || line.includes('数据格式验证失败：');
        const isBulletPoint = line.trim().startsWith('•');
        
        return (
          <div 
            key={index} 
            className={`
              text-sm
              ${isIndented ? 'ml-6 text-red-600' : 'text-red-700'}
              ${isHeader ? 'font-semibold' : ''}
              ${isHeader && !compact ? 'mb-2' : ''}
              ${index > 0 && !isIndented && !isHeader && isBulletPoint && !compact ? 'mt-3' : ''}
              ${index > 0 && !isIndented && !isHeader && !isBulletPoint && !compact ? 'mt-1' : ''}
            `}
          >
            {line}
          </div>
        );
      })}
    </div>
  );
}

/**
 * 同步错误列表展示组件
 * 用于展示多个错误信息
 */
interface SyncErrorListProps {
  errors: string[];
  className?: string;
}

export function SyncErrorList({ errors, className = '' }: SyncErrorListProps) {
  return (
    <div className={className}>
      {errors.map((error, errorIndex) => (
        <div key={errorIndex} className={errorIndex > 0 ? 'mt-3' : ''}>
          <SyncErrorDisplay error={error} />
        </div>
      ))}
    </div>
  );
}
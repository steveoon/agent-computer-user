/**
 * 测试候选人信息提取功能
 * 验证从更新后的HTML结构中正确提取候选人姓名和其他信息
 */

import { describe, it, expect } from 'vitest';
import { YUPAO_CHAT_DETAILS_SELECTORS } from '../constants';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';

describe('候选人信息提取测试', () => {
  it('应该从HTML中正确提取候选人的完整信息', () => {
    // 读取测试HTML文件
    const htmlPath = path.join(process.cwd(), 'docs/sample-data/yupao-chat-details.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    // 创建DOM环境
    const dom = new JSDOM(htmlContent);
    const document = dom.window.document;
    
    // 使用实际的选择器提取信息
    const candidateNameEl = document.querySelector(YUPAO_CHAT_DETAILS_SELECTORS.candidateName);
    const candidateName = candidateNameEl ? candidateNameEl.textContent?.trim() : '候选人';
    
    // 获取活跃时间
    const statsEl = document.querySelector(YUPAO_CHAT_DETAILS_SELECTORS.candidateStats);
    const activeTime = statsEl ? statsEl.textContent?.trim() : '';
    
    // 获取期望职位和薪资
    const occNameEl = document.querySelector(YUPAO_CHAT_DETAILS_SELECTORS.occName);
    const expectedPosition = occNameEl ? occNameEl.textContent?.replace('期望：', '').trim() : '';
    
    const salaryEl = document.querySelector(YUPAO_CHAT_DETAILS_SELECTORS.salary);
    const expectedSalary = salaryEl ? salaryEl.textContent?.trim() : '';
    
    // 获取简历标签（性别、年龄、期望工作地）
    const resumeTags = Array.from(document.querySelectorAll(YUPAO_CHAT_DETAILS_SELECTORS.resumeTag));
    let gender = '';
    let age = '';
    let expectedLocation = '';
    
    resumeTags.forEach(tag => {
      const text = tag.textContent?.trim() || '';
      if (text === '男' || text === '女') {
        gender = text;
      } else if (text.includes('岁')) {
        age = text;
      } else if (text.includes('期望工作地')) {
        expectedLocation = text.replace('期望工作地：', '').trim();
      }
    });
    
    // 获取额外标签信息（身高、体重、健康证等）
    const extraTags = Array.from(document.querySelectorAll(YUPAO_CHAT_DETAILS_SELECTORS.tagValue));
    let height = '';
    let weight = '';
    let hasHealthCertificate = false;
    const additionalInfo: string[] = [];
    
    extraTags.forEach(tag => {
      const text = tag.textContent?.trim() || '';
      if (text.includes('身高')) {
        height = text.replace('身高', '').trim();
      } else if (text.includes('体重')) {
        weight = text.replace('体重', '').trim();
      } else if (text.includes('健康证')) {
        hasHealthCertificate = true;
      }
      additionalInfo.push(text);
    });
    
    // 组装候选人信息
    const candidateInfo = {
      name: candidateName,
      position: expectedPosition,
      age: age,
      gender: gender,
      expectedSalary: expectedSalary,
      expectedLocation: expectedLocation,
      height: height,
      weight: weight,
      healthCertificate: hasHealthCertificate,
      activeTime: activeTime,
      info: additionalInfo,
    };
    
    // 验证提取的信息
    expect(candidateInfo.name).toBe('杨辉');
    expect(candidateInfo.gender).toBe('男');
    expect(candidateInfo.age).toBe('24岁');
    expect(candidateInfo.expectedLocation).toBe('上海');
    expect(candidateInfo.expectedSalary).toBe('6000-7000元');
    expect(candidateInfo.position).toBe('店员/营业员');
    expect(candidateInfo.height).toBe('170cm');
    expect(candidateInfo.weight).toBe('120kg');
    expect(candidateInfo.healthCertificate).toBe(true);
    expect(candidateInfo.activeTime).toContain('1小时前活跃');
    expect(candidateInfo.info).toContain('便利店');
    
    console.log('提取的候选人信息:', candidateInfo);
  });
  
  it('应该正确处理选择器在HTML中不存在的情况', () => {
    // 创建一个空的DOM
    const dom = new JSDOM('<div></div>');
    const document = dom.window.document;
    
    // 尝试提取信息
    const candidateNameEl = document.querySelector(YUPAO_CHAT_DETAILS_SELECTORS.candidateName);
    const candidateName = candidateNameEl ? candidateNameEl.textContent?.trim() : '候选人';
    
    // 应该返回默认值
    expect(candidateName).toBe('候选人');
  });
  
  it('应该正确解析活跃时间格式', () => {
    const testCases = [
      '1小时前活跃',
      '昨天活跃',
      '3天前活跃',
      '刚刚活跃'
    ];
    
    testCases.forEach(testCase => {
      // 创建测试DOM
      const dom = new JSDOM(`<span class="_stats_1qq7t_379">${testCase}</span>`);
      const document = dom.window.document;
      
      const statsEl = document.querySelector('._stats_1qq7t_379');
      const activeTime = statsEl ? statsEl.textContent?.trim() : '';
      
      expect(activeTime).toBe(testCase);
    });
  });
});
import { SampleData } from "../../types/zhipin";

/**
 * 🏪 Boss直聘门店招聘数据
 *
 * 这里存放所有门店、岗位、品牌等相关数据
 * 修改此文件后，LLM会自动适配新的数据结构
 */
export const sampleData: SampleData = {
  zhipin: {
    city: "上海",
    defaultBrand: "大米先生",
    stores: [
      {
        id: "store_xujiahui_001",
        name: "上海太平洋森活天地店",
        location: "淞沪路199号B1层太平洋森活天地A-2",
        district: "杨浦区",
        subarea: "五角场",
        coordinates: { lat: 31.1956, lng: 121.4349 },
        transportation: "地铁站4号口出",
        brand: "成都你六姐",
        positions: [
          {
            id: "pos_001",
            name: "前厅岗位",
            timeSlots: ["11:30~14:00"],
            baseSalary: 24,
            levelSalary:
              "每月做满40小时之后，时薪是26元/时，每月做满80小时后，时薪是28元/时",
            workHours: "2.5",
            benefits: "无",
            requirements: ["18-45岁", "有服务经验优先"],
            urgent: true,
          },
          {
            id: "pos_002",
            name: "后厨岗位",
            timeSlots: ["11:00~14:00"],
            baseSalary: 24,
            levelSalary:
              "每月做满40小时之后，时薪是26元/时，每月做满80小时后，时薪是28元/时",
            workHours: "3",
            benefits: "无",
            requirements: ["18-45岁", "有服务经验优先"],
            urgent: false,
          },
        ],
      },
      {
        id: "store_jangan_001",
        name: "上海宝龙旭辉店",
        location: "周家嘴路3608号宝龙旭辉广场B1层",
        district: "杨浦区",
        subarea: "五角场",
        coordinates: { lat: 31.242, lng: 121.4467 },
        transportation: "地铁站10号口出",
        brand: "成都你六姐",
        positions: [
          {
            id: "pos_003",
            name: "前厅岗位",
            timeSlots: ["11:30~14:00", "17:30~20:30"],
            baseSalary: 24,
            levelSalary:
              "每月做满40小时之后，时薪是26元/时，每月做满80小时后，时薪是28元/时",
            workHours: "3",
            benefits: "无",
            requirements: ["18-45岁", "有服务经验优先"],
            urgent: true,
          },
        ],
      },
      {
        id: "store_pudong_001",
        name: "上海七巧国店",
        location: "大桥街道长阳路1750号1楼04号商铺",
        district: "杨浦区",
        subarea: "大桥街道",
        coordinates: { lat: 31.2354, lng: 121.5055 },
        transportation: "地铁站12号口出",
        brand: "成都你六姐",
        positions: [
          {
            id: "pos_004",
            name: "前厅岗位",
            timeSlots: ["11:00~14:00"],
            baseSalary: 24,
            levelSalary:
              "每月做满40小时之后，时薪是26元/时，每月做满80小时后，时薪是28元/时",
            workHours: "3",
            benefits: "无",
            requirements: ["18-45岁", "有服务经验优先"],
            urgent: false,
          },
        ],
      },
      {
        id: "store_damixiansheng_001",
        name: "大米先生-上海天盛广场店",
        location: "政立路天盛广场C101单元",
        district: "杨浦区",
        subarea: "天盛广场",
        coordinates: { lat: 31.2965, lng: 121.5089 },
        transportation: "地铁站附近",
        brand: "大米先生",
        positions: [
          {
            id: "pos_005",
            name: "通岗",
            timeSlots: ["10:00~14:00"],
            baseSalary: 23,
            levelSalary: "基础时薪23-28元，具体工作内容听店长安排",
            workHours: "4",
            benefits: "面议",
            requirements: ["18-45岁", "服从店长安排"],
            urgent: true,
          },
        ],
      },
      {
        id: "store_damixiansheng_002",
        name: "大米先生-上海彩虹湾店",
        location: "虹湾路99弄2号1层137-1、177、178、179室",
        district: "虹口区",
        subarea: "彩虹湾",
        coordinates: { lat: 31.2384, lng: 121.4759 },
        transportation: "地铁站附近",
        brand: "大米先生",
        positions: [
          {
            id: "pos_006",
            name: "通岗",
            timeSlots: ["17:30~20:30"],
            baseSalary: 23,
            levelSalary: "基础时薪23-28元，具体工作内容听店长安排",
            workHours: "3",
            benefits: "面议",
            requirements: ["18-45岁", "服从店长安排"],
            urgent: true,
          },
        ],
      },
    ],
    brands: {
      成都你六姐: {
        templates: {
          proactive: [
            "你好，{brand}在上海各区有兼职，排班{hours}小时，时薪{salary}元，{level_salary}。",
            "在{location}的{position}岗位有空缺，班次{schedule}，时薪{salary}元，有兴趣吗？",
          ],
          inquiry: [
            "你好，{city}各区都有门店，你在什么位置？我帮你查下附近。",
            "你好，我们{brand}在{city}多个区都有门店，你想在哪个区工作？",
          ],
          location_match: [
            "离你比较近在 {location}，空缺 {schedule} 班次。",
            "好的，{district}这边有{store_name}，{position}岗位空缺，时间是{schedule}，离你应该比较方便。",
          ],
          no_match: [
            "你附近暂时没岗位，{alternative_location}的门店考虑吗？{transport_info}",
            "你附近暂时没有空缺，不过{alternative_area}有合适的，{distance_info}，可以考虑吗？",
          ],
          interview: [
            "可以帮你和店长约面试，加我微信吧，需要几个简单的个人信息。",
            "好的，我可以安排你和{store_name}店长面谈，方便加微信沟通具体时间和准备材料吗？",
          ],
          salary_inquiry: [
            "基本薪资是{salary}元/小时，{level_salary}。",
            "时薪{salary}元起，根据每月工时有阶梯，最高能到28元。",
          ],
          schedule_inquiry: [
            "排班比较灵活，一般是2-4小时，具体可以和店长商量。",
            "门店除了{time1}空缺，还有{time2}也空缺呢，时间有要求可以和店长商量。",
          ],
          followup: [
            "门店除了{position1}岗位还有{position2}岗位也空缺的，如果{position1}觉得不合适，可以和店长商量。",
            "门店除了{shift1}空缺，还有{shift2}也空缺呢，如果对排班时间有要求，可以和店长商量。",
            "这家门店不合适也没关系，以后还有其他店空缺的，到时候可以再报名。",
            "{brand}你愿意做吗？我同时还负责其他品牌的招募，你有兴趣的话，可以看看。",
          ],
        },
        screening: {
          age: { min: 18, max: 50, preferred: [20, 30, 40] },
          blacklistKeywords: ["骗子", "不靠谱", "假的"],
          preferredKeywords: ["经验", "稳定", "长期"],
        },
      },
      大米先生: {
        templates: {
          proactive: [
            "你好，大米先生{location}店在招{position}，{schedule}班次，时薪{salary}元起。",
            "Hi，大米先生{district}店{position}岗位在招人，薪资{salary}-28元/时，有兴趣吗？",
          ],
          inquiry: [
            "你好，大米先生在上海多个区都有招聘，你期望在哪个区工作？我帮你查下附近门店。",
            "你好，我是大米先生招聘的，目前{city}各区都有岗位，方便说下你的位置吗？",
          ],
          location_match: [
            "嗯，{district}{store_name}正在招{position}，{schedule}班次，离你很近。",
            "找到了，{location}这边的大米先生，{position}岗位{schedule}班次，薪资{salary}元/时起。",
          ],
          no_match: [
            "你附近暂无空缺，但{alternative_location}大米先生在招聘，{transport_info}，可以考虑吗？",
            "目前你周边没有合适岗位，{alternative_area}店有空缺，愿意了解下吗？",
          ],
          interview: [
            "可以，我可以安排你和{store_name}店长面试，方便加微信详细沟通吗？",
            "好的，我帮你约店长面谈，需要你的基本信息，可以加下微信吗？",
          ],
          salary_inquiry: [
            "基本时薪是{salary}元，最高可以到28元，具体看店长安排。",
          ],
          schedule_inquiry: [
            "排班时间比较灵活，具体可以和店长沟通，一般是3-4小时的班。",
          ],
          followup: [
            "大米先生除了{position1}还有其他岗位，如果{position1}不合适，可以和店长商量。",
            "这个时间段不合适的话，还有{alternative_time}班次，排班比较灵活的。",
            "这家店不合适也没关系，以后还有其他店空缺的，到时候可以再报名。",
            "大米先生你考虑吗？我同时还负责其他品牌的招募，你有兴趣的话，可以看看。",
          ],
        },
        screening: {
          age: { min: 18, max: 45, preferred: [20, 25, 30, 35] },
          blacklistKeywords: ["骗子", "不靠谱", "假的"],
          preferredKeywords: ["经验", "稳定", "长期", "听话"],
        },
      },
    },
    templates: {
      proactive: [
        "你好，上海各区有门店岗位空缺，兼职排班 {hours} 小时。基本薪资：{salary}元/小时。{level_salary}",
      ],
      inquiry: [
        "你好，上海目前各区有门店岗位空缺，你在什么位置？我帮你查下附近",
      ],
      salary_inquiry: [
        "基本时薪是{salary}元，最高可以到28元，具体看店长安排。",
      ],
      schedule_inquiry: ["排班比较灵活，一般是2-4小时，具体可以和店长商量。"],
      location_match: ["离你比较近在 {location}，空缺 {schedule}"],
      no_match: ["你附近暂时没岗位，{alternative_location}的门店考虑吗？"],
      interview: ["可以帮你和店长约面试，加我微信吧，需要几项简单的个人信息"],
      followup: [
        "门店除了{position1}岗位还有{position2}岗位也空缺的，如果{position1}觉得不合适，可以和店长商量",
      ],
    },
    screening: {
      age: { min: 18, max: 50, preferred: [20, 30, 40] },
      blacklistKeywords: ["骗子", "不靠谱", "假的"],
      preferredKeywords: ["经验", "稳定", "长期"],
    },
  },
};

/**
 * 🎯 便捷访问Boss直聘数据
 */
export const zhipinData = sampleData.zhipin;

/**
 * 📊 数据统计信息
 */
export const dataStats = {
  storeCount: sampleData.zhipin.stores.length,
  brandCount: Object.keys(sampleData.zhipin.brands).length,
  positionCount: sampleData.zhipin.stores.reduce(
    (sum, store) => sum + store.positions.length,
    0
  ),
  districts: [
    ...new Set(sampleData.zhipin.stores.map((store) => store.district)),
  ],
  brands: Object.keys(sampleData.zhipin.brands),
};

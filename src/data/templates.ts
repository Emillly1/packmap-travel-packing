import { EMPTY_TRIP_DRAFT, type TemplateId, type TripDraft } from "../models/trip";

export interface TripTemplate {
  id: TemplateId;
  name: string;
  description: string;
  durationHint: string;
  tone: "green" | "coral" | "blue" | "amber" | "ink";
  defaults: TripDraft;
}

export const TRIP_TEMPLATES: TripTemplate[] = [
  {
    id: "city",
    name: "城市短途",
    description: "步行、拍照与轻装换乘",
    durationHint: "3–10 天",
    tone: "coral",
    defaults: {
      ...EMPTY_TRIP_DRAFT,
      name: "城市短途旅行",
      laundryFrequency: "often",
      transportModes: ["plane", "train"],
      specialNeeds: "城市步行、拍照",
      bagSetup: "随身登机箱：主仓、前袋\n随身小包：主仓\n待放入：准备购买、尚未归位",
    },
  },
  {
    id: "study",
    name: "长期留学",
    description: "多季节、学生生活与阶段收纳",
    durationHint: "1–12 个月",
    tone: "green",
    defaults: {
      ...EMPTY_TRIP_DRAFT,
      name: "多城市学习旅行",
      tripType: "study",
      transportModes: ["plane", "train"],
      specialNeeds: "多季节、学生通勤、拍照、正式活动",
      bagSetup: "托运行李 A：开放面、拉链面\n托运行李 B：开放面、拉链面\n随身双肩包：主仓、前袋\n待放入：准备购买、尚未归位",
    },
  },
  {
    id: "business",
    name: "商务差旅",
    description: "正式穿搭、办公设备与快速取用",
    durationHint: "2–7 天",
    tone: "blue",
    defaults: {
      ...EMPTY_TRIP_DRAFT,
      name: "商务差旅",
      tripType: "business",
      laundryFrequency: "often",
      transportModes: ["plane", "car"],
      specialNeeds: "正式会议、电脑办公、晚宴",
      bagSetup: "登机箱：衣物区、文件区\n电脑包：主仓、前袋",
    },
  },
  {
    id: "family",
    name: "家庭度假",
    description: "多人用品、共享消耗品与途中照顾",
    durationHint: "5–14 天",
    tone: "amber",
    defaults: {
      ...EMPTY_TRIP_DRAFT,
      name: "家庭度假",
      travelers: 3,
      transportModes: ["plane", "car"],
      specialNeeds: "儿童用品、共享洗护、海边活动",
      bagSetup: "家庭托运行李：成人衣物区、儿童衣物区、洗护区\n随身背包：证件区、途中用品\n待放入：准备购买、尚未归位",
    },
  },
  {
    id: "blank",
    name: "空白地图",
    description: "只建立你需要的旅行与箱包结构",
    durationHint: "完全自定义",
    tone: "ink",
    defaults: { ...EMPTY_TRIP_DRAFT },
  },
];

export function getTripTemplate(id: TemplateId): TripTemplate {
  const template = TRIP_TEMPLATES.find((entry) => entry.id === id);
  if (!template) throw new Error(`Unknown PackMap template: ${id}`);
  return template;
}

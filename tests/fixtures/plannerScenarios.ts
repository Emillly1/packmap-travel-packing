import { getTripTemplate } from "../../src/data/templates";
import type { TripDraft } from "../../src/models/trip";

function draft(template: "city" | "study" | "business" | "family", patch: Partial<TripDraft>): TripDraft {
  return { ...getTripTemplate(template).defaults, ...patch };
}

export const PLANNER_SCENARIOS = {
  weeklyCity: draft("city", {
    origin: "上海",
    destinationsText: "罗马、佛罗伦萨、米兰",
    startDate: "2026-09-10",
    endDate: "2026-09-20",
    laundryFrequency: "weekly",
    specialNeeds: "城市步行、拍照、敏感肌、不徒步",
    transportModes: ["plane", "train", "ferry"],
  }),
  longStudy: draft("study", {
    origin: "香港",
    destinationsText: "里昂、米兰、爱丁堡、冰岛",
    startDate: "2026-07-01",
    endDate: "2026-12-22",
    specialNeeds: "多季节、学生通勤、拍照、正式活动、短途徒步、干皮",
  }),
  familyBeach: draft("family", {
    origin: "广州",
    destinationsText: "巴塞罗那、马略卡",
    startDate: "2026-08-01",
    endDate: "2026-08-10",
    travelers: 3,
    specialNeeds: "两个成人和一个儿童、海边、游泳",
  }),
  winterBusiness: draft("business", {
    origin: "北京",
    destinationsText: "赫尔辛基",
    startDate: "2026-12-02",
    endDate: "2026-12-06",
    specialNeeds: "冬季、正式会议、晚宴",
  }),
  soloOutdoor: draft("city", {
    name: "单人户外公路旅行",
    origin: "成都",
    destinationsText: "康定、稻城、亚丁",
    startDate: "2026-10-03",
    endDate: "2026-10-12",
    travelers: 1,
    tripType: "outdoor",
    laundryFrequency: "rare",
    transportModes: ["plane", "car", "ferry"],
    specialNeeds: "高海拔、寒冷、徒步、露营、摄影",
    bagSetup: "户外托运行李：衣物区、装备区\n随身徒步包：主仓、快取袋\n待放入：尚未归位",
  }),
} as const;

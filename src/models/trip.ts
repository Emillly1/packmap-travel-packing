export type TripType = "leisure" | "study" | "business" | "outdoor";
export type LaundryFrequency = "often" | "weekly" | "rare";
export type TransportMode = "plane" | "train" | "car" | "ferry";
export type TemplateId = "blank" | "city" | "study" | "business" | "family";

export interface TripStage {
  id: string;
  name: string;
  destinations: string[];
  startDate: string;
  endDate: string;
  climate: string[];
  activities: string[];
}

export interface TripDraft {
  name: string;
  origin: string;
  destinationsText: string;
  startDate: string;
  endDate: string;
  travelers: number;
  tripType: TripType;
  laundryFrequency: LaundryFrequency;
  transportModes: TransportMode[];
  transportNotes: string;
  specialNeeds: string;
  bagSetup: string;
}

export interface Trip extends Omit<TripDraft, "destinationsText" | "bagSetup"> {
  destinations: string[];
  stages: TripStage[];
  bagSetup: string;
}

export const EMPTY_TRIP_DRAFT: TripDraft = {
  name: "我的旅行",
  origin: "",
  destinationsText: "",
  startDate: "",
  endDate: "",
  travelers: 1,
  tripType: "leisure",
  laundryFrequency: "weekly",
  transportModes: [],
  transportNotes: "",
  specialNeeds: "",
  bagSetup: "行李箱：主区域\n随身包：主仓",
};

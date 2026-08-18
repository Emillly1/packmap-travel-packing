export const LEGACY_PACKMAP = {
  schema_version: "1.0",
  id: "legacy-europe-trip",
  created_at: "2026-06-28T12:00:00.000Z",
  trip: {
    trip_name: "六个月欧洲交换",
    origin: "上海",
    destinations: ["里昂", "米兰", "爱丁堡"],
    start_date: "2026-07-01",
    end_date: "2026-12-22",
    people: 1,
    trip_type: "study",
    laundry_frequency: "weekly",
    transport_modes: ["plane", "train"],
    bag_setup: "新秀丽 28寸：开放面\n25L双肩包：主仓",
  },
  containers: [
    {
      id: "legacy-luggage",
      name: "25L双肩包",
      transport_rule: "carry_on",
      compartments: [
        {
          id: "legacy-main",
          name: "主仓",
          items: [
            {
              id: "legacy-passport",
              name: "护照",
              quantity: "1 本",
              category: "documents",
              packed: true,
              transport_rule: "carry_on",
              access: "airport",
              recommendation: "bring",
            },
          ],
        },
      ],
    },
  ],
  custom_note: "应保留的旧版未知字段",
} as const;

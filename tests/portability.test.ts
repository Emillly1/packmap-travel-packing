import { describe, expect, it } from "vitest";

import { syncPackingMap } from "../src/engine/packingMap";
import {
  PackMapImportError,
  importPackMapText,
  importPrototypeLocationText,
  serializeDocumentJson,
  serializeDocumentText,
} from "../src/engine/portability";
import { generatePackingSuggestions } from "../src/engine/planning";
import { refreshSafetyData, toggleDepartureCheck } from "../src/engine/safety";
import { createPackMapDocument } from "../src/engine/trip";
import type { PackMapDocument } from "../src/models/schema";
import { LEGACY_PACKMAP } from "./fixtures/legacyPackMap";
import { PLANNER_SCENARIOS } from "./fixtures/plannerScenarios";

function completeDocument(): PackMapDocument {
  const draft = { ...PLANNER_SCENARIOS.weeklyCity, bagSetup: "托运行李：主区\n随身背包：主仓" };
  const mapped = syncPackingMap(createPackMapDocument(draft, new Date("2026-08-18T00:00:00.000Z")), draft, generatePackingSuggestions(draft));
  return toggleDepartureCheck(refreshSafetyData(mapped), "documents-passport");
}

describe("PackMap portability", () => {
  it("round-trips version 2 JSON without data loss", () => {
    const document = completeDocument();
    const imported = importPackMapText(serializeDocumentJson(document));
    expect(imported.migrated).toBe(false);
    expect(imported.document).toEqual(document);
  });

  it("round-trips human-readable TXT through its recovery payload", () => {
    const document = completeDocument();
    const text = serializeDocumentText(document);
    expect(text).toContain("箱包：托运行李 [checked]");
    expect(text).toContain("出发清单：");
    expect(importPackMapText(text).document).toEqual(document);
  });

  it("migrates legacy 1.0 snake_case data and preserves unknown fields", () => {
    const imported = importPackMapText(JSON.stringify(LEGACY_PACKMAP));
    expect(imported.migrated).toBe(true);
    expect(imported.document.schemaVersion).toBe("2.0.0");
    expect(imported.document.trip.name).toBe("六个月欧洲交换");
    expect(imported.document.containers[0].transport).toBe("carry-on");
    const passport = imported.document.containers[0].children[0].children[0];
    expect(passport.type).toBe("item");
    if (passport.type !== "item") throw new Error("legacy passport was not migrated as an item");
    expect(passport.quantity).toBe("1 本");
    expect(passport.packed).toBe(true);
    expect(imported.document.metadata?.legacyUnknown).toEqual({ custom_note: "应保留的旧版未知字段" });
  });

  it("rejects malformed and unsupported input before returning a document", () => {
    expect(() => importPackMapText("not-json")).toThrow(PackMapImportError);
    expect(() => importPackMapText(JSON.stringify({ schemaVersion: "9.0.0" }))).toThrow("不支持的 PackMap 版本");

    const duplicate = completeDocument();
    duplicate.containers[0].children[0].id = duplicate.containers[0].id;
    expect(() => importPackMapText(JSON.stringify(duplicate))).toThrow("节点 ID 重复");
  });

  it("rejects TXT whose exact recovery payload is missing", () => {
    expect(() => importPackMapText("PACKMAP 2.0.0\n旅行：损坏文件")).toThrow("缺少可恢复的数据段");
  });

  it("imports the indented text exported by the original organizer", () => {
    const text = `欧洲行李位置地图
导出时间：2026/8/12 15:33:59

新秀丽 28寸
  开放面
    夏季衣物包1
      [已装] 短袖 5件
      [未装] 干发帽
  袋子面
    [已装] 吹风机
25L双肩包
  主仓
    证件包
      [已装] 护照（必须随身）
待放入
  尚未归位
    [未装] 拖鞋`;
    const document = importPrototypeLocationText(text);
    expect(document.containers).toHaveLength(3);
    expect(document.containers[0].transport).toBe("checked");
    expect(document.containers[1].transport).toBe("carry-on");
    expect(document.containers[0].children[1].name).toBe("拉链面");
    const shirt = document.containers[0].children[0].children[0];
    expect(shirt.type).toBe("bag");
    if (shirt.type !== "bag" || shirt.children[0].type !== "item" || shirt.children[1].type !== "item") throw new Error("prototype hierarchy was not imported");
    expect(shirt.children[0].quantity).toBe("5件");
    expect(shirt.children[1].packed).toBe(false);
    expect(importPackMapText(text).sourceVersion).toBe("prototype-text");
    expect(document.metadata?.migratedFrom).toBe("prototype-text");
  });
});

export type NodeType = "luggage" | "compartment" | "bag" | "item";
export type ContainerTransport = "carry-on" | "checked" | "none";
export type TransportRule = ContainerTransport;
export type ItemAccess = "airport" | "daily" | "first-night" | "later" | "any";
export type Recommendation = "bring" | "buy-local" | "optional" | "skip";

interface BaseNode {
  id: string;
  type: NodeType;
  name: string;
}

export interface ItemNode extends BaseNode {
  type: "item";
  quantity: string;
  category: string;
  packed: boolean;
  transportRule: TransportRule;
  access: ItemAccess;
  recommendation: Recommendation;
  stageIds: string[];
  risk?: string;
  reason?: string;
  notes?: string;
}

export interface BagNode extends BaseNode {
  type: "bag";
  children: Array<BagNode | ItemNode>;
}

export interface CompartmentNode extends BaseNode {
  type: "compartment";
  children: Array<BagNode | ItemNode>;
}

export interface LuggageNode extends BaseNode {
  type: "luggage";
  transport: ContainerTransport;
  children: CompartmentNode[];
}

export type PackingNode = LuggageNode | CompartmentNode | BagNode | ItemNode;
export type PackingContainerNode = CompartmentNode | BagNode;

export interface DepartureCheck {
  id: string;
  name: string;
  checked: boolean;
  group?: "carry" | "documents" | "transport" | "arrival" | "home";
}

export interface PackingWarning {
  id: string;
  itemId?: string;
  itemName?: string;
  issue: string;
  suggestedAction?: string;
  severity: "low" | "medium" | "high";
  acknowledged: boolean;
}

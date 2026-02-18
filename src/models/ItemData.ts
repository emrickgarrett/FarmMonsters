import { ToolType } from '../utils/Constants';

export type ItemCategory = 'tool' | 'seed' | 'crop' | 'material' | 'food' | 'misc';

export interface ItemDefinition {
  id: string;
  name: string;
  category: ItemCategory;
  toolType?: ToolType;
  cropId?: string;
  stackable: boolean;
  maxStack?: number;
  textureKey: string;
  sellPrice?: number;
  description: string;
}

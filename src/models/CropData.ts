import { Season } from '../utils/Constants';

export interface CropDefinition {
  id: string;
  name: string;
  seedId: string;
  seasons: Season[];
  growthStages: number;
  daysPerStage: number;
  totalGrowDays: number;
  sellPrice: number;
  harvestYield: { min: number; max: number };
  xpOnHarvest: number;
  regrows: boolean;
  regrowDays?: number;
  textureKey: string;
}

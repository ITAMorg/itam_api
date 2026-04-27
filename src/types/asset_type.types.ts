export interface CreateAssetTypeDto {
  name: string;
  iconKey?: string;
  colorKey?: string;
}

export interface UpdateAssetTypeDto {
  name?: string;
  iconKey?: string;
  colorKey?: string;
}
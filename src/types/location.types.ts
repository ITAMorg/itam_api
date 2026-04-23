export interface CreateLocationDto {
  name: string;
  building: string;
  floor: number;
}

export interface UpdateLocationDto {
  name?: string;
  building?: string;
  floor?: number;
}
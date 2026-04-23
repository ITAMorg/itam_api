export interface CreateSupplierDto {
  name: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
}

export interface UpdateSupplierDto {
  name?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
}
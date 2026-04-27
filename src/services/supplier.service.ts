import prisma from '../config/prisma';
import { CreateSupplierDto, UpdateSupplierDto } from '../types/supplier.types';

export const getSuppliers = async () => {
  return prisma.supplier.findMany({
    orderBy: { name: 'asc' },
  });
};

export const createSupplier = async (dto: CreateSupplierDto) => {
  return prisma.supplier.create({ data: dto });
};

export const updateSupplier = async (id: number, dto: UpdateSupplierDto) => {
  return prisma.supplier.update({
    where: { id },
    data: dto,
  });
};

export const deleteSupplier = async (id: number) => {
  return prisma.supplier.delete({
    where: { id },
  });
};
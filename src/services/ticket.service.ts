import prisma from '../config/prisma';
import { $Enums } from '@prisma/client';
import { CreateTicketDto, UpdateTicketDto, TicketFilters, CreateTicketActionDto } from '../types/ticket.types';

const ticketInclude = {
  requester: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  assignee: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  asset: {
    select: { id: true, name: true, brand: true, model: true, serialNumber: true },
  },
  comments: {
    include: {
      author: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'asc' as const },
  },
  attachments: {
    include: {
      uploadedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  },
};

function generateReference(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 90000) + 10000;
  return `TKT-${year}-${random}`;
}

export const getTickets = async (filters: TicketFilters) => {
  const { status, priority, type, assigneeId, requesterId, assetId } = filters;

  return prisma.ticket.findMany({
    where: {
      ...(status && { status }),
      ...(priority && { priority }),
      ...(type && { type }),
      ...(assigneeId && { assigneeId }),
      ...(requesterId && { requesterId }),
      ...(assetId && { assetId }),
    },
    include: ticketInclude,
    orderBy: { createdAt: 'desc' },
  });
};

export const getTicketById = async (id: number) => {
  return prisma.ticket.findUnique({
    where: { id },
    include: ticketInclude,
  });
};

export const createTicket = async (dto: CreateTicketDto, requesterId: number) => {
  return prisma.ticket.create({
    data: {
      reference: generateReference(),
      title: dto.title,
      description: dto.description,
      type: dto.type ?? $Enums.TicketType.INCIDENT,
      priority: dto.priority ?? $Enums.TicketPriority.MEDIUM,
      requesterId,
      assetId: dto.assetId ?? null,
      assigneeId: dto.assigneeId ?? null,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
    },
    include: ticketInclude,
  });
};

export const updateTicket = async (id: number, dto: UpdateTicketDto) => {
  const previous = await prisma.ticket.findUnique({ where: { id } });
  if (!previous) return null;

  const resolvedAt =
    dto.status === $Enums.TicketStatus.RESOLVED && previous.status !== $Enums.TicketStatus.RESOLVED
      ? new Date()
      : dto.status && dto.status !== $Enums.TicketStatus.RESOLVED
        ? null
        : undefined;

  return prisma.ticket.update({
    where: { id },
    data: {
      ...(dto.title && { title: dto.title }),
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.status && { status: dto.status }),
      ...(dto.priority && { priority: dto.priority }),
      ...(dto.assigneeId !== undefined && { assigneeId: dto.assigneeId ?? null }),
      ...(dto.dueDate !== undefined && {
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      }),
      ...(resolvedAt !== undefined && { resolvedAt }),
    },
    include: ticketInclude,
  });
};

export const deleteTicket = async (id: number) => {
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return null;
  return prisma.ticket.delete({ where: { id } });
};

export const getTicketActions = async (ticketId: number) => {
  return prisma.ticketComment.findMany({
    where: { ticketId },
    include: {
      author: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { createdAt: 'asc' },
  });
};

export const addTicketAction = async (
  ticketId: number,
  authorId: number,
  dto: CreateTicketActionDto,
) => {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) return null;

  return prisma.ticketComment.create({
    data: {
      ticketId,
      authorId,
      content: dto.content,
    },
    include: {
      author: { select: { id: true, firstName: true, lastName: true } },
    },
  });
};
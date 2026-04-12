import { $Enums } from '@prisma/client';

export interface CreateTicketDto {
  title: string;
  description?: string;
  type: $Enums.TicketType;
  priority: $Enums.TicketPriority;
  assetId?: number;
  assigneeId?: number;
  dueDate?: string;
}

export interface UpdateTicketDto {
  title?: string;
  description?: string;
  status?: $Enums.TicketStatus;
  priority?: $Enums.TicketPriority;
  assigneeId?: number | null;
  dueDate?: string | null;
}

export interface TicketFilters {
  status?: $Enums.TicketStatus;
  priority?: $Enums.TicketPriority;
  type?: $Enums.TicketType;
  assigneeId?: number;
  requesterId?: number;
  assetId?: number;
}

export interface CreateTicketActionDto {
  content: string;
}
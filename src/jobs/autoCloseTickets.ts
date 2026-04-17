import prisma from '../config/prisma';
import { $Enums } from '@prisma/client';

export const autoCloseResolvedTickets = async (): Promise<void> => {
  const fifteenDaysAgo = new Date();
  fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

  const tickets = await prisma.ticket.findMany({
    where: {
      status: $Enums.TicketStatus.RESOLVED,
      resolvedAt: { lte: fifteenDaysAgo },
    },
    select: { id: true, assetId: true },
  });

  if (tickets.length === 0) return;

  const ids = tickets.map((t) => t.id);

  await prisma.ticket.updateMany({
    where: { id: { in: ids } },
    data: { status: $Enums.TicketStatus.CLOSED },
  });

  console.log(`[autoClose] ${tickets.length} ticket(s) passé(s) en CLOSED`);
};
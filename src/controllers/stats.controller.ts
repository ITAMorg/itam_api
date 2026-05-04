import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { $Enums } from '@prisma/client';

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const [totalAssets, brokenAssets, openTickets, highOpenTickets] = await Promise.all([
      prisma.asset.count(),

      prisma.asset.count({
        where: { status: $Enums.AssetStatus.BROKEN },
      }),

      prisma.ticket.count({
        where: {
          status: { in: [$Enums.TicketStatus.OPEN, $Enums.TicketStatus.IN_PROGRESS] },
        },
      }),

      prisma.ticket.count({
        where: {
          status: { in: [$Enums.TicketStatus.OPEN, $Enums.TicketStatus.IN_PROGRESS] },
          priority: $Enums.TicketPriority.HIGH,
        },
      }),
    ]);

    res.json({
      totalAssets,
      brokenAssets,
      openTickets,
      highOpenTickets,
    });
  } catch (error) {
    console.error('getDashboardStats error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const getAssetStats = async (req: Request, res: Response) => {
  try {
    const [byStatus, byType] = await Promise.all([
      prisma.asset.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      prisma.asset.groupBy({
        by: ['typeId'],
        _count: { typeId: true },
      }),
    ]);

    const typeIds = byType.map((t) => t.typeId);
    const types = await prisma.assetType.findMany({
      where: { id: { in: typeIds } },
    });

    res.json({
      byStatus: byStatus.map((s) => ({
        status: s.status,
        count: s._count.status,
      })),
      byType: byType.map((t) => ({
        typeId: t.typeId,
        typeName: types.find((type) => type.id === t.typeId)?.name ?? 'Inconnu',
        count: t._count.typeId,
      })),
    });
  } catch (error) {
    console.error('getAssetStats error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const getTicketStats = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [
      openThisMonth,
      resolvedThisMonth,
      unassigned,
      byPriority,
      highOpenTickets,
    ] = await Promise.all([
      prisma.ticket.count({
        where: {
          status: { in: [$Enums.TicketStatus.OPEN, $Enums.TicketStatus.IN_PROGRESS] },
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
      }),

      prisma.ticket.count({
        where: {
          status: { in: [$Enums.TicketStatus.RESOLVED, $Enums.TicketStatus.CLOSED] },
          resolvedAt: { gte: startOfMonth, lte: endOfMonth },
        },
      }),

      prisma.ticket.count({
        where: {
          assigneeId: null,
          status: { in: [$Enums.TicketStatus.OPEN, $Enums.TicketStatus.IN_PROGRESS] },
        },
      }),

      prisma.ticket.groupBy({
        by: ['priority'],
        _count: { priority: true },
        where: {
          createdAt: { gte: startOfMonth, lte: endOfMonth },
        },
      }),

      prisma.ticket.findMany({
        where: {
          priority: $Enums.TicketPriority.HIGH,
          status: { in: [$Enums.TicketStatus.OPEN, $Enums.TicketStatus.IN_PROGRESS] },
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          reference: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
          assignee: {
            select: { id: true, firstName: true, lastName: true },
          },
          asset: {
            select: { id: true, name: true },
          },
        },
      }),
    ]);

    res.json({
      openThisMonth,
      resolvedThisMonth,
      unassigned,
      byPriority: byPriority.map((p) => ({
        priority: p.priority,
        count: p._count.priority,
      })),
      highOpenTickets,
    });
  } catch (error) {
    console.error('getTicketStats error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

export const getTechnicianStats = async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const technicians = await prisma.user.findMany({
      where: { role: $Enums.Role.TECHNICIAN, isActive: true },
      select: { id: true, firstName: true, lastName: true },
    });

    const stats = await Promise.all(
      technicians.map(async (tech) => {
        const [assigned, resolved] = await Promise.all([
          prisma.ticket.count({
            where: {
              assigneeId: tech.id,
              createdAt: { gte: startOfMonth, lte: endOfMonth },
            },
          }),
          prisma.ticket.count({
            where: {
              assigneeId: tech.id,
              status: { in: [$Enums.TicketStatus.RESOLVED, $Enums.TicketStatus.CLOSED] },
              resolvedAt: { gte: startOfMonth, lte: endOfMonth },
            },
          }),
        ]);

        return {
          id: tech.id,
          firstName: tech.firstName,
          lastName: tech.lastName,
          assignedThisMonth: assigned,
          resolvedThisMonth: resolved,
        };
      })
    );

    res.json(stats);
  } catch (error) {
    console.error('getTechnicianStats error:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};
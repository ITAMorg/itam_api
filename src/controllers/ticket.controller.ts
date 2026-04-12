import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import * as ticketService from '../services/ticket.service';
import { $Enums } from '@prisma/client';

export const getTickets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, priority, type, assigneeId, requesterId, assetId } = req.query;

    const tickets = await ticketService.getTickets({
      status: status as $Enums.TicketStatus | undefined,
      priority: priority as $Enums.TicketPriority | undefined,
      type: type as $Enums.TicketType | undefined,
      assigneeId: assigneeId ? Number(assigneeId) : undefined,
      requesterId: requesterId ? Number(requesterId) : undefined,
      assetId: assetId ? Number(assetId) : undefined,
    });

    res.json(tickets);
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const getTicketById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ message: 'ID invalide' });
      return;
    }

    const ticket = await ticketService.getTicketById(id);
    if (!ticket) {
      res.status(404).json({ message: 'Ticket non trouvé' });
      return;
    }

    res.json(ticket);
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const createTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const requesterId = req.user!.userId;
    const ticket = await ticketService.createTicket(req.body, requesterId);
    res.status(201).json(ticket);
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const updateTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ message: 'ID invalide' });
      return;
    }

    const ticket = await ticketService.updateTicket(id, req.body);
    if (!ticket) {
      res.status(404).json({ message: 'Ticket non trouvé' });
      return;
    }

    res.json(ticket);
  } catch (error) {
    console.error('updateTicket error:', error);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const deleteTicket = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ message: 'ID invalide' });
      return;
    }

    const ticket = await ticketService.deleteTicket(id);
    if (!ticket) {
      res.status(404).json({ message: 'Ticket non trouvé' });
      return;
    }

    res.status(204).send();
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const getTicketActions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ message: 'ID invalide' });
      return;
    }

    const actions = await ticketService.getTicketActions(id);
    res.json(actions);
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

export const addTicketAction = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const id = Number(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ message: 'ID invalide' });
      return;
    }

    const authorId = req.user!.userId;
    const action = await ticketService.addTicketAction(id, authorId, req.body);
    if (!action) {
      res.status(404).json({ message: 'Ticket non trouvé' });
      return;
    }

    res.status(201).json(action);
  } catch {
    res.status(500).json({ message: 'Erreur serveur' });
  }
};
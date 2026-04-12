import { Router } from 'express';
import * as ticketController from '../controllers/ticket.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

const ADMIN = 'ADMIN';
const TECHNICIAN = 'TECHNICIAN';

// Lecture — tous les rôles authentifiés
router.get('/', authenticate, ticketController.getTickets);
router.get('/:id', authenticate, ticketController.getTicketById);

// Création — tous les rôles authentifiés (un USER peut ouvrir un ticket)
router.post('/', authenticate, ticketController.createTicket);

// Modification — Technicien et Admin uniquement
router.patch('/:id', authenticate, authorize(ADMIN, TECHNICIAN), ticketController.updateTicket);

// Suppression — Admin uniquement
router.delete('/:id', authenticate, authorize(ADMIN), ticketController.deleteTicket);

// Actions technicien — Technicien et Admin uniquement
router.get('/:id/actions', authenticate, ticketController.getTicketActions);
router.post('/:id/actions', authenticate, authorize(ADMIN, TECHNICIAN), ticketController.addTicketAction);

export default router;
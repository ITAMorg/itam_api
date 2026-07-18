import bcrypt from 'bcryptjs';
import { prismaTest } from './prisma';
import { $Enums } from '.prisma/client';

/**
 * Factories pour créer des entités de test rapidement.
 *
 * Chaque factory :
 *  - Insère l'entité en base via prismaTest
 *  - Retourne l'objet créé (avec son id)
 *  - Accepte des overrides pour personnaliser certains champs
 *  - Utilise des valeurs par défaut cohérentes et uniques (via compteurs)
 *
 * Pattern : `{ ...defaults, ...overrides }` permet de surcharger n'importe
 * quel champ tout en gardant les autres valeurs par défaut.
 */

// Compteurs internes pour garantir l'unicité des champs @unique (email, serialNumber…)
// Remis à zéro à chaque suite car les instances Node meurent entre `npm test`
let userCounter = 0;
let assetCounter = 0;
let ticketCounter = 0;

// ─── User ────────────────────────────────────────────────────────────────────

interface CreateUserOptions {
  email?: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  role?: $Enums.Role;
  isActive?: boolean;
  locationId?: number | null;
}

/**
 * Crée un utilisateur de test avec un mot de passe hashé bcrypt.
 * Le mot de passe en clair est disponible via `plainPassword` sur le retour
 * pour les tests d'authentification.
 */
export async function createTestUser(options: CreateUserOptions = {}) {
  userCounter++;
  const plainPassword = options.password ?? 'Test1234!';
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  const user = await prismaTest.user.create({
    data: {
      email: options.email ?? `user${userCounter}@test.local`,
      password: hashedPassword,
      firstName: options.firstName ?? 'Test',
      lastName: options.lastName ?? `User${userCounter}`,
      role: options.role ?? $Enums.Role.USER,
      isActive: options.isActive ?? true,
      locationId: options.locationId ?? null,
    },
  });

  return { ...user, plainPassword };
}

// ─── Location ────────────────────────────────────────────────────────────────

interface CreateLocationOptions {
  name?: string;
  building?: string;
  floor?: number;
}

export async function createTestLocation(options: CreateLocationOptions = {}) {
  return prismaTest.location.create({
    data: {
      name: options.name ?? 'Bureau Paris',
      building: options.building ?? 'Bâtiment A',
      floor: options.floor ?? 1,
    },
  });
}

// ─── AssetType ───────────────────────────────────────────────────────────────

interface CreateAssetTypeOptions {
  name?: string;
  iconKey?: string;
  colorKey?: string;
}

export async function createTestAssetType(options: CreateAssetTypeOptions = {}) {
  assetCounter++;
  return prismaTest.assetType.create({
    data: {
      name: options.name ?? `Type-${assetCounter}`,
      iconKey: options.iconKey ?? 'devices',
      colorKey: options.colorKey ?? '1D4ED8',
    },
  });
}

// ─── Supplier ────────────────────────────────────────────────────────────────

interface CreateSupplierOptions {
  name?: string;
  contactEmail?: string;
}

export async function createTestSupplier(options: CreateSupplierOptions = {}) {
  return prismaTest.supplier.create({
    data: {
      name: options.name ?? 'Fournisseur Test',
      contactEmail: options.contactEmail ?? 'contact@fournisseur.test',
    },
  });
}

// ─── Asset ───────────────────────────────────────────────────────────────────

interface CreateAssetOptions {
  name?: string;
  serialNumber?: string;
  status?: $Enums.AssetStatus;
  typeId?: number;
  locationId?: number | null;
  supplierId?: number | null;
}

/**
 * Crée un asset de test. Si typeId n'est pas fourni, crée automatiquement
 * un AssetType parent — ainsi le test reste simple à écrire.
 */
export async function createTestAsset(options: CreateAssetOptions = {}) {
  assetCounter++;

  const typeId = options.typeId ?? (await createTestAssetType()).id;

  return prismaTest.asset.create({
    data: {
      name: options.name ?? `Asset-${assetCounter}`,
      serialNumber: options.serialNumber ?? `SN-${Date.now()}-${assetCounter}`,
      status: options.status ?? $Enums.AssetStatus.IN_STOCK,
      typeId,
      locationId: options.locationId ?? null,
      supplierId: options.supplierId ?? null,
    },
  });
}

// ─── Ticket ──────────────────────────────────────────────────────────────────

interface CreateTicketOptions {
  title?: string;
  description?: string;
  type?: $Enums.TicketType;
  status?: $Enums.TicketStatus;
  priority?: $Enums.TicketPriority;
  requesterId?: number;
  assigneeId?: number | null;
  assetId?: number | null;
}

/**
 * Crée un ticket de test. Si requesterId n'est pas fourni, crée
 * automatiquement un user demandeur.
 */
export async function createTestTicket(options: CreateTicketOptions = {}) {
  ticketCounter++;

  const requesterId = options.requesterId ?? (await createTestUser()).id;

  return prismaTest.ticket.create({
    data: {
      reference: `TCK-${Date.now()}-${ticketCounter}`,
      title: options.title ?? `Ticket de test #${ticketCounter}`,
      description: options.description ?? 'Description du ticket de test',
      type: options.type ?? $Enums.TicketType.INCIDENT,
      status: options.status ?? $Enums.TicketStatus.OPEN,
      priority: options.priority ?? $Enums.TicketPriority.MEDIUM,
      requesterId,
      assigneeId: options.assigneeId ?? null,
      assetId: options.assetId ?? null,
    },
  });
}

/**
 * Remet les compteurs de la factory à zéro.
 * À appeler dans beforeEach de chaque fichier de test pour garantir
 * la reproductibilité (mêmes emails/serials/refs entre exécutions).
 */
export function resetFactoryCounters(): void {
  userCounter = 0;
  assetCounter = 0;
  ticketCounter = 0;
}
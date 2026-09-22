import { Prisma } from "@/generated/prisma/client";
import { DomainError } from "@/lib/domain-error";
import { prisma } from "@/lib/prisma";

type PrismaClientOrTx = typeof prisma | Prisma.TransactionClient;

interface AvailabilityInput {
  locationId: string;
  equipmentId: string;
  startAt: Date;
  endAt: Date;
}

interface AvailabilityCheckInput extends AvailabilityInput {
  requestedQuantity: number;
}

export async function getAvailableQuantity(
  input: AvailabilityInput,
  client: PrismaClientOrTx = prisma,
): Promise<number> {
  if (input.endAt <= input.startAt) {
    throw new DomainError("End time must be after start time.", 400, "INVALID_INTERVAL");
  }

  const equipment = await client.equipment.findFirst({
    where: { id: input.equipmentId, locationId: input.locationId },
    select: { totalQuantity: true, name: true },
  });

  if (!equipment) {
    throw new DomainError(
      "Equipment was not found at the selected location.",
      404,
      "EQUIPMENT_NOT_FOUND",
    );
  }

  const reservations = await client.reservation.findMany({
    where: {
      locationId: input.locationId,
      status: "CONFIRMED",
      startAt: { lt: input.endAt },
      endAt: { gt: input.startAt },
      items: { some: { equipmentId: input.equipmentId } },
    },
    select: {
      items: {
        where: { equipmentId: input.equipmentId },
        select: { quantity: true },
      },
    },
  });

  const reservedQuantity = reservations.reduce(
    (sum, reservation) => sum + reservation.items.reduce((itemSum, item) => itemSum + item.quantity, 0),
    0,
  );

  return Math.max(0, equipment.totalQuantity - reservedQuantity);
}

export async function checkAvailability(
  input: AvailabilityCheckInput,
  client: PrismaClientOrTx = prisma,
): Promise<{ available: boolean; availableQuantity: number }> {
  if (!Number.isInteger(input.requestedQuantity) || input.requestedQuantity <= 0) {
    throw new DomainError("Quantity must be a positive whole number.", 400, "INVALID_QUANTITY");
  }

  const availableQuantity = await getAvailableQuantity(input, client);
  return {
    available: input.requestedQuantity <= availableQuantity,
    availableQuantity,
  };
}

interface BatchAvailabilityInput {
  locationId: string;
  startAt: Date;
  endAt: Date;
  equipmentIds: string[];
}

/**
 * Same result as calling getAvailableQuantity per equipment id, but resolved
 * with 2 queries total instead of one pair of queries per item (avoids N+1
 * when a reservation has several equipment items).
 */
export async function getAvailableQuantitiesByEquipment(
  input: BatchAvailabilityInput,
  client: PrismaClientOrTx = prisma,
): Promise<Map<string, number>> {
  if (input.endAt <= input.startAt) {
    throw new DomainError("End time must be after start time.", 400, "INVALID_INTERVAL");
  }

  const equipmentList = await client.equipment.findMany({
    where: { id: { in: input.equipmentIds }, locationId: input.locationId },
    select: { id: true, totalQuantity: true },
  });

  const reservations = await client.reservation.findMany({
    where: {
      locationId: input.locationId,
      status: "CONFIRMED",
      startAt: { lt: input.endAt },
      endAt: { gt: input.startAt },
      items: { some: { equipmentId: { in: input.equipmentIds } } },
    },
    select: {
      items: {
        where: { equipmentId: { in: input.equipmentIds } },
        select: { equipmentId: true, quantity: true },
      },
    },
  });

  const reservedQuantityByEquipmentId = new Map<string, number>();
  for (const reservation of reservations) {
    for (const item of reservation.items) {
      reservedQuantityByEquipmentId.set(
        item.equipmentId,
        (reservedQuantityByEquipmentId.get(item.equipmentId) ?? 0) + item.quantity,
      );
    }
  }

  return new Map(
    equipmentList.map((equipment) => [
      equipment.id,
      Math.max(0, equipment.totalQuantity - (reservedQuantityByEquipmentId.get(equipment.id) ?? 0)),
    ]),
  );
}

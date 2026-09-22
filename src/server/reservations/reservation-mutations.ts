import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/domain-error";
import type { CreateReservationInput } from "@/schemas/create-reservation";
import { getAvailableQuantitiesByEquipment } from "./availability";

interface ValidatedReservationInput {
  locationId: string;
  startAt: Date;
  endAt: Date;
  status: "DRAFT" | "CONFIRMED";
  items: Array<{ equipmentId: string; quantity: number }>;
}

/**
 * Shared by create and update: confirms the location and equipment exist and
 * belong together, and — for CONFIRMED reservations — that availability
 * covers every requested item. excludeReservationId lets an edit ignore its
 * own existing items when checking availability against itself.
 */
async function assertReservationIsValid(
  input: ValidatedReservationInput,
  tx: Prisma.TransactionClient,
  excludeReservationId?: string,
): Promise<void> {
  const location = await tx.location.findUnique({
    where: { id: input.locationId },
    select: { id: true },
  });

  if (!location) {
    throw new DomainError("Location was not found.", 404, "LOCATION_NOT_FOUND");
  }

  const equipmentIds = input.items.map((item) => item.equipmentId);
  const equipment = await tx.equipment.findMany({
    where: { id: { in: equipmentIds }, locationId: input.locationId },
    select: { id: true, name: true },
  });

  if (equipment.length !== equipmentIds.length) {
    throw new DomainError(
      "One or more equipment items do not belong to the selected location.",
      400,
      "EQUIPMENT_LOCATION_MISMATCH",
    );
  }

  if (input.status !== "CONFIRMED") return;

  const equipmentNameById = new Map(equipment.map((item) => [item.id, item.name]));
  const availableQuantityByEquipmentId = await getAvailableQuantitiesByEquipment(
    { locationId: input.locationId, startAt: input.startAt, endAt: input.endAt, equipmentIds, excludeReservationId },
    tx,
  );

  for (const item of input.items) {
    const availableQuantity = availableQuantityByEquipmentId.get(item.equipmentId) ?? 0;

    if (item.quantity > availableQuantity) {
      const equipmentName = equipmentNameById.get(item.equipmentId) ?? "This equipment";
      throw new DomainError(
        `Only ${availableQuantity} ${equipmentName} available for the selected period.`,
        409,
        "AVAILABILITY_EXCEEDED",
      );
    }
  }
}

export async function createReservation(
  input: CreateReservationInput,
): Promise<{ id: string }> {
  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);

  return prisma.$transaction(async (tx) => {
    await assertReservationIsValid({ ...input, startAt, endAt }, tx);

    return tx.reservation.create({
      data: {
        locationId: input.locationId,
        startAt,
        endAt,
        status: input.status,
        items: {
          create: input.items.map((item) => ({
            equipmentId: item.equipmentId,
            quantity: item.quantity,
          })),
        },
      },
      select: { id: true },
    });
  });
}

export async function updateReservation(
  reservationId: string,
  input: CreateReservationInput,
): Promise<{ id: string }> {
  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.reservation.findUnique({
      where: { id: reservationId },
      select: { id: true },
    });

    if (!existing) {
      throw new DomainError("Reservation not found.", 404, "RESERVATION_NOT_FOUND");
    }

    await assertReservationIsValid({ ...input, startAt, endAt }, tx, reservationId);

    await tx.reservationItem.deleteMany({ where: { reservationId } });

    return tx.reservation.update({
      where: { id: reservationId },
      data: {
        locationId: input.locationId,
        startAt,
        endAt,
        status: input.status,
        items: {
          create: input.items.map((item) => ({
            equipmentId: item.equipmentId,
            quantity: item.quantity,
          })),
        },
      },
      select: { id: true },
    });
  });
}

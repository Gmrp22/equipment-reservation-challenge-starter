import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/domain-error";
import type { CreateReservationInput } from "@/schemas/create-reservation";
import { getAvailableQuantitiesByEquipment } from "./availability";

export async function createReservation(
  input: CreateReservationInput,
): Promise<{ id: string }> {
  const startAt = new Date(input.startAt);
  const endAt = new Date(input.endAt);

  const location = await prisma.location.findUnique({
    where: { id: input.locationId },
    select: { id: true },
  });

  if (!location) {
    throw new DomainError("Location was not found.", 404, "LOCATION_NOT_FOUND");
  }

  const equipmentIds = input.items.map((item) => item.equipmentId);
  const equipment = await prisma.equipment.findMany({
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

  const equipmentNameById = new Map(equipment.map((item) => [item.id, item.name]));

  const reservation = await prisma.$transaction(async (tx) => {
    if (input.status === "CONFIRMED") {
      const availableQuantityByEquipmentId = await getAvailableQuantitiesByEquipment(
        { locationId: input.locationId, startAt, endAt, equipmentIds },
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

  return reservation;
}

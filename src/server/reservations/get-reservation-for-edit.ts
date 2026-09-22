import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/domain-error";
import type { ReservationStatusValue } from "@/types/reservation";

export interface ReservationForEdit {
  id: string;
  locationId: string;
  startAt: string;
  endAt: string;
  status: ReservationStatusValue;
  items: Array<{ equipmentId: string; quantity: number }>;
}

export async function getReservationForEdit(reservationId: string): Promise<ReservationForEdit> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: {
      id: true,
      locationId: true,
      startAt: true,
      endAt: true,
      status: true,
      items: { select: { equipmentId: true, quantity: true } },
    },
  });

  if (!reservation) {
    throw new DomainError("Reservation not found.", 404, "RESERVATION_NOT_FOUND");
  }

  return {
    id: reservation.id,
    locationId: reservation.locationId,
    startAt: reservation.startAt.toISOString(),
    endAt: reservation.endAt.toISOString(),
    status: reservation.status,
    items: reservation.items,
  };
}

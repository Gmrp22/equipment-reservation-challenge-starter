import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DomainError } from "@/lib/domain-error";
import { checkAvailabilityQuerySchema } from "@/schemas/check-availability";
import { getAvailableQuantitiesByEquipment } from "@/server/reservations/availability";

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const parsed = checkAvailabilityQuerySchema.safeParse({
      locationId: searchParams.get("locationId"),
      startAt: searchParams.get("startAt"),
      endAt: searchParams.get("endAt"),
    });

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: parsed.error.issues[0]?.message ?? "Invalid request.",
          code: "VALIDATION_ERROR",
        },
        { status: 400 },
      );
    }

    const { locationId, startAt, endAt } = parsed.data;

    const equipment = await prisma.equipment.findMany({
      where: { locationId },
      select: { id: true },
    });

    const availableQuantityByEquipmentId = await getAvailableQuantitiesByEquipment({
      locationId,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      equipmentIds: equipment.map((item) => item.id),
    });

    return NextResponse.json({
      availability: Object.fromEntries(availableQuantityByEquipmentId),
    });
  } catch (error: unknown) {
    if (error instanceof DomainError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }

    console.error("Unexpected availability check error", error);
    return NextResponse.json(
      { error: "Availability could not be checked. Please try again.", code: "INTERNAL_ERROR" },
      { status: 500 },
    );
  }
}

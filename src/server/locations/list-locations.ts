import { prisma } from "@/lib/prisma";

export interface LocationWithEquipment {
  id: string;
  name: string;
  equipment: Array<{
    id: string;
    name: string;
    totalQuantity: number;
  }>;
}

export async function listLocationsWithEquipment(): Promise<LocationWithEquipment[]> {
  const locations = await prisma.location.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      equipment: {
        orderBy: { name: "asc" },
        select: { id: true, name: true, totalQuantity: true },
      },
    },
  });

  return locations;
}

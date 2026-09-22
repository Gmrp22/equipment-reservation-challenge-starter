import { z } from "zod";

export const checkAvailabilityQuerySchema = z
  .object({
    locationId: z.string().min(1),
    startAt: z.string().min(1),
    endAt: z.string().min(1),
    excludeReservationId: z.string().optional(),
  })
  .refine((data) => new Date(data.endAt) > new Date(data.startAt), {
    message: "End must be after start.",
    path: ["endAt"],
  });

export type CheckAvailabilityQuery = z.infer<typeof checkAvailabilityQuerySchema>;

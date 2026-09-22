import { z } from "zod";

export const reservationItemSchema = z.object({
  equipmentId: z.string().min(1, "Select equipment."),
  quantity: z
    .number({ error: "Enter a quantity." })
    .int("Quantity must be a whole number.")
    .positive("Quantity must be greater than zero."),
});

const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export const createReservationSchema = z
  .object({
    locationId: z.string().min(1, "Select a location."),
    startAt: z.string().min(1, "Enter a start date/time."),
    endAt: z.string().min(1, "Enter an end date/time."),
    status: z.enum(["DRAFT", "CONFIRMED"]),
    items: z.array(reservationItemSchema).min(1, "Add at least one equipment item."),
  })
  .refine((data) => new Date(data.endAt) > new Date(data.startAt), {
    message: "End must be after start.",
    path: ["endAt"],
  })
  .refine((data) => new Date(data.startAt).getTime() >= Date.now(), {
    message: "Start must be in the future.",
    path: ["startAt"],
  })
  .refine((data) => new Date(data.startAt).getTime() <= Date.now() + ONE_YEAR_MS, {
    message: "Start must be within one year from now.",
    path: ["startAt"],
  })
  .refine(
    (data) => new Set(data.items.map((item) => item.equipmentId)).size === data.items.length,
    {
      message: "Each equipment type can only be added once.",
      path: ["items"],
    },
  );

export type CreateReservationInput = z.infer<typeof createReservationSchema>;

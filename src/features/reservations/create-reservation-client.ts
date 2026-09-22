import type { CreateReservationInput } from "@/schemas/create-reservation";

interface ApiErrorBody {
  error?: string;
}

export interface CreateReservationResult {
  success: boolean;
  error?: string;
}

export async function submitCreateReservation(
  input: CreateReservationInput,
): Promise<CreateReservationResult> {
  try {
    const response = await fetch("/api/reservations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = (await response.json()) as ApiErrorBody;

    if (!response.ok) {
      return { success: false, error: body.error ?? "The reservation could not be created." };
    }

    return { success: true };
  } catch {
    return { success: false, error: "The server could not be reached. Please try again." };
  }
}

export async function submitUpdateReservation(
  reservationId: string,
  input: CreateReservationInput,
): Promise<CreateReservationResult> {
  try {
    const response = await fetch(`/api/reservations/${reservationId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = (await response.json()) as ApiErrorBody;

    if (!response.ok) {
      return { success: false, error: body.error ?? "The reservation could not be updated." };
    }

    return { success: true };
  } catch {
    return { success: false, error: "The server could not be reached. Please try again." };
  }
}

export async function fetchAvailability(
  params: { locationId: string; startAt: string; endAt: string; excludeReservationId?: string },
  signal: AbortSignal,
): Promise<Record<string, number> | null> {
  const searchParams = new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined)) as Record<
      string,
      string
    >,
  );
  const response = await fetch(`/api/availability?${searchParams.toString()}`, { signal });

  if (!response.ok) return null;

  const body = (await response.json()) as { availability?: Record<string, number> };
  return body.availability ?? null;
}

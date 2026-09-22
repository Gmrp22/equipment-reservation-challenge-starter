import { useEffect, useState } from "react";
import { fetchAvailability } from "./create-reservation-client";

const DEBOUNCE_MS = 400;

const EMPTY_AVAILABILITY: Record<string, number> = {};

export function useAvailabilityPreview(
  locationId: string | undefined,
  startAt: string | undefined,
  endAt: string | undefined,
): Record<string, number> {
  const [availabilityByEquipmentId, setAvailabilityByEquipmentId] =
    useState<Record<string, number>>(EMPTY_AVAILABILITY);

  const isValidRange = Boolean(locationId && startAt && endAt && new Date(endAt) > new Date(startAt));

  useEffect(() => {
    if (!isValidRange || !locationId || !startAt || !endAt) return;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      fetchAvailability({ locationId, startAt, endAt }, controller.signal)
        .then((availability) => {
          if (availability) setAvailabilityByEquipmentId(availability);
        })
        .catch(() => {
          // Best-effort preview only; the server re-validates on submit regardless.
        });
    }, DEBOUNCE_MS);

    return () => {
      controller.abort();
      clearTimeout(timeoutId);
    };
  }, [isValidRange, locationId, startAt, endAt]);

  return isValidRange ? availabilityByEquipmentId : EMPTY_AVAILABILITY;
}

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Box, Button, Stack, Typography } from "@mui/material";
import { notFound } from "next/navigation";
import { CreateReservationForm } from "@/features/reservations/create-reservation-form";
import { listLocationsWithEquipment } from "@/server/locations/list-locations";
import { getReservationForEdit } from "@/server/reservations/get-reservation-for-edit";

export const dynamic = "force-dynamic";

export default async function EditReservationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [locations, reservation] = await Promise.all([
    listLocationsWithEquipment(),
    getReservationForEdit(id).catch(() => null),
  ]);

  if (!reservation) {
    notFound();
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Button href="/" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
          Back to reservations
        </Button>
        <Typography component="h1" variant="h1" gutterBottom>
          Edit Reservation
        </Typography>
        <Typography color="text.secondary">
          Update the location, time period, or equipment for this reservation.
        </Typography>
      </Box>

      <CreateReservationForm locations={locations} reservation={reservation} />
    </Stack>
  );
}

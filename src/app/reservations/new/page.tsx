import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Box, Button, Stack, Typography } from "@mui/material";
import { CreateReservationForm } from "@/features/reservations/create-reservation-form";
import { listLocationsWithEquipment } from "@/server/locations/list-locations";

export const dynamic = "force-dynamic";

export default async function NewReservationPage() {
  const locations = await listLocationsWithEquipment();

  return (
    <Stack spacing={3}>
      <Box>
        <Button href="/" startIcon={<ArrowBackIcon />} sx={{ mb: 2 }}>
          Back to reservations
        </Button>
        <Typography component="h1" variant="h1" gutterBottom>
          New Reservation
        </Typography>
        <Typography color="text.secondary">
          Reserve equipment for a location and time period.
        </Typography>
      </Box>

      <CreateReservationForm locations={locations} />
    </Stack>
  );
}

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Box, Button, Stack, Typography } from "@mui/material";
import { CreateReservationForm } from "@/features/reservations/create-reservation-form";

export default function NewReservationPage() {
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

      <CreateReservationForm />
    </Stack>
  );
}

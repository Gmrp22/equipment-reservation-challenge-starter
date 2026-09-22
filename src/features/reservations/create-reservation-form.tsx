"use client";

import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlineOutlined";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Divider,
  FormControl,
  FormControlLabel,
  FormLabel,
  IconButton,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useRef } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { createReservationSchema, type CreateReservationInput } from "@/schemas/create-reservation";

// Placeholder data — will be replaced by real Location/Equipment data from the server.
const MOCK_LOCATIONS = [
  {
    id: "loc-austin",
    name: "Austin Warehouse",
    equipment: [
      { id: "eq-generator-austin", name: "Generator" },
      { id: "eq-concrete-saw-austin", name: "Concrete Saw" },
    ],
  },
  {
    id: "loc-dallas",
    name: "Dallas Warehouse",
    equipment: [
      { id: "eq-generator-dallas", name: "Generator" },
      { id: "eq-plate-compactor-dallas", name: "Plate Compactor" },
    ],
  },
];

export function CreateReservationForm() {
  const {
    register,
    control,
    watch,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateReservationInput>({
    resolver: zodResolver(createReservationSchema),
    defaultValues: {
      locationId: "",
      startAt: "",
      endAt: "",
      status: "DRAFT",
      items: [{ equipmentId: "", quantity: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  const selectedLocationId = watch("locationId");
  const selectedLocation = MOCK_LOCATIONS.find((location) => location.id === selectedLocationId);
  const equipmentOptions = selectedLocation?.equipment ?? [];

  const previousLocationId = useRef(selectedLocationId);
  useEffect(() => {
    if (previousLocationId.current !== selectedLocationId) {
      fields.forEach((_, index) => {
        setValue(`items.${index}.equipmentId`, "");
      });
      previousLocationId.current = selectedLocationId;
    }
  }, [selectedLocationId, fields, setValue]);

  function onSubmit(input: CreateReservationInput) {
    // UI-only for now — no API call yet.
    console.log("Create reservation submit", input);
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <Stack spacing={3}>
            <TextField
              {...register("locationId")}
              value={selectedLocationId ?? ""}
              select
              label="Location"
              required
              fullWidth
              disabled={isSubmitting}
              error={Boolean(errors.locationId)}
              helperText={errors.locationId?.message}
            >
              <MenuItem value="" disabled>
                Select a location
              </MenuItem>
              {MOCK_LOCATIONS.map((location) => (
                <MenuItem key={location.id} value={location.id}>
                  {location.name}
                </MenuItem>
              ))}
            </TextField>

            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                {...register("startAt")}
                type="datetime-local"
                label="Start"
                required
                fullWidth
                disabled={isSubmitting}
                slotProps={{ inputLabel: { shrink: true } }}
                error={Boolean(errors.startAt)}
                helperText={errors.startAt?.message}
              />
              <TextField
                {...register("endAt")}
                type="datetime-local"
                label="End"
                required
                fullWidth
                disabled={isSubmitting}
                slotProps={{ inputLabel: { shrink: true } }}
                error={Boolean(errors.endAt)}
                helperText={errors.endAt?.message}
              />
            </Stack>

            <Divider />

            <Stack spacing={1.5}>
              <Typography component="h2" variant="h2">
                Equipment
              </Typography>

              {!selectedLocationId ? (
                <Alert severity="info">Select a location above to see its available equipment.</Alert>
              ) : null}

              {fields.map((field, index) => (
                <Stack
                  key={field.id}
                  direction={{ xs: "column", sm: "row" }}
                  spacing={2}
                  sx={{ alignItems: { sm: "flex-start" } }}
                >
                  <TextField
                    {...register(`items.${index}.equipmentId`)}
                    value={watch(`items.${index}.equipmentId`) ?? ""}
                    select
                    label="Equipment"
                    required
                    fullWidth
                    disabled={isSubmitting || !selectedLocationId}
                    error={Boolean(errors.items?.[index]?.equipmentId)}
                    helperText={
                      errors.items?.[index]?.equipmentId?.message ??
                      (!selectedLocationId ? "Select a location first" : undefined)
                    }
                  >
                    <MenuItem value="" disabled>
                      Select equipment
                    </MenuItem>
                    {equipmentOptions.map((equipment) => (
                      <MenuItem key={equipment.id} value={equipment.id}>
                        {equipment.name}
                      </MenuItem>
                    ))}
                  </TextField>

                  <TextField
                    {...register(`items.${index}.quantity`, { valueAsNumber: true })}
                    type="number"
                    label="Quantity"
                    required
                    disabled={isSubmitting}
                    slotProps={{ htmlInput: { min: 1, step: 1 } }}
                    sx={{ minWidth: { sm: 140 } }}
                    error={Boolean(errors.items?.[index]?.quantity)}
                    helperText={errors.items?.[index]?.quantity?.message}
                  />

                  <IconButton
                    aria-label="Remove equipment item"
                    onClick={() => remove(index)}
                    disabled={isSubmitting || fields.length === 1}
                    sx={{ mt: { sm: 1 } }}
                  >
                    <DeleteOutlineIcon />
                  </IconButton>
                </Stack>
              ))}

              {errors.items?.message ? <Alert severity="error">{errors.items.message}</Alert> : null}

              <Button
                startIcon={<AddIcon />}
                onClick={() => append({ equipmentId: "", quantity: 1 })}
                disabled={isSubmitting}
                sx={{ alignSelf: "flex-start" }}
              >
                Add equipment
              </Button>
            </Stack>

            <Divider />

            <FormControl disabled={isSubmitting}>
              <FormLabel id="status-label">Status</FormLabel>
              <RadioGroup row aria-labelledby="status-label" defaultValue="DRAFT">
                <FormControlLabel value="DRAFT" control={<Radio {...register("status")} />} label="Draft" />
                <FormControlLabel
                  value="CONFIRMED"
                  control={<Radio {...register("status")} />}
                  label="Confirmed"
                />
              </RadioGroup>
            </FormControl>

            <Stack direction="row" spacing={2} sx={{ justifyContent: "flex-end" }}>
              <Button href="/" disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={isSubmitting}>
                {isSubmitting ? "Creating…" : "Create reservation"}
              </Button>
            </Stack>
          </Stack>
        </form>
      </CardContent>
    </Card>
  );
}

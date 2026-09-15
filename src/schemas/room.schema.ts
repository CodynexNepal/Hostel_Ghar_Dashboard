import * as yup from "yup";

export const roomSchema = yup.object({
  roomNumber: yup.string().trim().required("Room number is required."),
  floor: yup
    .number()
    .typeError("Enter a valid floor.")
    .min(0, "Floor is invalid.")
    .required("Floor is required."),
  type: yup
    .string()
    .oneOf(["SINGLE", "DOUBLE", "TRIPLE", "DORM"])
    .required("Room type is required."),
  capacity: yup
    .number()
    .typeError("Enter a valid capacity.")
    .min(1, "Capacity must be at least 1.")
    .max(12, "Capacity can be at most 12.")
    .required("Capacity is required."),
  monthlyRent: yup
    .number()
    .typeError("Enter a valid amount.")
    .positive("Rent must be greater than 0.")
    .required("Rent is required."),
  status: yup
    .string()
    .oneOf(["AVAILABLE", "OCCUPIED", "FULL", "MAINTENANCE"])
    .required("Status is required."),
  amenities: yup.string().optional(),
});

export type RoomFormValues = yup.InferType<typeof roomSchema>;

export const paymentSchema = yup.object({
  residentId: yup.string().required("Resident is required."),
  amount: yup
    .number()
    .typeError("Enter a valid amount.")
    .positive()
    .required("Amount is required."),
  method: yup.string().oneOf(["CASH", "ESEWA", "KHALTI", "BANK"]).required("Method is required."),
  month: yup.string().required("Month is required."),
});

export type PaymentFormValues = yup.InferType<typeof paymentSchema>;

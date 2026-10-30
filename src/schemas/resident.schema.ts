import * as yup from "yup";

export const residentSchema = yup.object({
  hostelId: yup.string().trim().required("Hostel ID is required."),
  name: yup.string().min(2, "Enter the resident's full name.").required("Name is required."),
  email: yup.string().email("Enter a valid email address.").required("Email is required."),
  phone: yup
    .string()
    .matches(/^[0-9+\-\s]{7,15}$/, "Enter a valid phone number.")
    .required("Phone is required."),
  roomNumber: yup.string().required("Room is required."),
  bedNumber: yup.string().required("Bed is required."),
  monthlyRent: yup
    .number()
    .transform((value, original) =>
      original === "" || original === null || original === undefined ? undefined : value
    )
    .typeError("Enter a valid amount.")
    .positive("Rent must be greater than 0.")
    .optional(),
});

export type ResidentFormValues = yup.InferType<typeof residentSchema>;

export const editResidentSchema = yup.object({
  name: yup.string().min(2, "Enter the resident's full name.").required("Name is required."),
  email: yup.string().email("Enter a valid email address.").required("Email is required."),
  phone: yup
    .string()
    .matches(/^[0-9+\-\s]{7,15}$/, "Enter a valid phone number.")
    .required("Phone is required."),
  roomNumber: yup.string().required("Room is required."),
  bedNumber: yup.string().required("Bed is required."),
  monthlyRent: yup
    .number()
    .transform((value, original) =>
      original === "" || original === null || original === undefined ? undefined : value
    )
    .typeError("Enter a valid amount.")
    .positive("Rent must be greater than 0.")
    .optional(),
  status: yup
    .string()
    .oneOf(["ACTIVE", "INACTIVE", "PENDING", "VACATED"], "Select a valid status.")
    .required("Status is required."),
  paymentStatus: yup
    .string()
    .oneOf(["PAID", "PENDING", "OVERDUE", "PARTIAL"], "Select a valid payment status.")
    .required("Payment status is required."),
});

export type EditResidentFormValues = yup.InferType<typeof editResidentSchema>;

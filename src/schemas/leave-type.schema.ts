import * as yup from "yup";

export const leaveTypeSchema = yup.object({
  hostelId: yup.string().trim().required("Hostel is required."),
  name: yup
    .string()
    .trim()
    .min(2, "Enter a leave type name (min 2 characters).")
    .max(60, "Keep the name under 60 characters.")
    .required("Leave type name is required."),
  maxDays: yup
    .number()
    .transform((value, original) =>
      original === "" || original === null || original === undefined ? undefined : value
    )
    .typeError("Enter a valid number of days.")
    .integer("Max days must be a whole number.")
    .min(1, "Max days must be at least 1.")
    .max(365, "Max days can be at most 365.")
    .optional(),
});

export type LeaveTypeFormValues = yup.InferType<typeof leaveTypeSchema>;

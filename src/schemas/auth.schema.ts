import * as yup from "yup";

export const loginSchema = yup.object({
  email: yup.string().email("Enter a valid email address.").required("Email is required."),
  password: yup
    .string()
    .min(6, "Password must be at least 6 characters.")
    .required("Password is required."),
});

export type LoginFormValues = yup.InferType<typeof loginSchema>;

export const registerSchema = yup.object({
  name: yup.string().min(2, "Enter your full name.").required("Name is required."),
  email: yup.string().email("Enter a valid email address.").required("Email is required."),
  phone: yup
    .string()
    .matches(/^[0-9+\-\s]{7,15}$/, "Enter a valid phone number.")
    .required("Phone is required."),
  hostelName: yup.string().min(2, "Enter your hostel name.").required("Hostel name is required."),
  password: yup
    .string()
    .min(6, "Password must be at least 6 characters.")
    .required("Password is required."),
});

export type RegisterFormValues = yup.InferType<typeof registerSchema>;

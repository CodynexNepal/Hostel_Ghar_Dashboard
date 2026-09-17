import * as yup from "yup";

/** Backend enum — PUT/POST reject anything else with 400 Validation error. */
export const FACILITY_TAGS = ["Included", "Excluded", "Extra Charge"] as const;

export type FacilityTag = (typeof FACILITY_TAGS)[number];

export const facilitySchema = yup.object({
  title: yup
    .string()
    .trim()
    .min(2, "Enter a facility name (min 2 characters).")
    .max(60, "Keep the name under 60 characters.")
    .required("Facility name is required."),
  description: yup
    .string()
    .trim()
    .min(2, "Enter a short description.")
    .max(120, "Keep the description under 120 characters.")
    .required("Description is required."),
  tag: yup.string().oneOf([...FACILITY_TAGS], "Pick a valid tag.").required("Tag is required."),
});

export type FacilityFormValues = yup.InferType<typeof facilitySchema>;

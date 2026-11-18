/** The text fields of a submitted form, so a form can show them again after a validation error. */
export function formValues(formData: FormData): Record<string, string> {
  const values: Record<string, string> = {}
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") values[key] = value
  }
  return values
}

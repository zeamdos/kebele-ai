import templates from "@/lib/forms/templates.json";
import type { FormTemplate, FormTemplateId } from "@/lib/types";
import { notFound } from "@/lib/errors";

const ALL = templates as FormTemplate[];

export function listFormTemplates(): FormTemplate[] {
  return ALL;
}

export function getFormTemplate(id: FormTemplateId | string): FormTemplate {
  const found = ALL.find((t) => t.id === id);
  if (!found) throw notFound(`Form template ${id} not found`);
  return found;
}

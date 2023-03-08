import { GroupSavingsPlan } from "../types";

export function validateSavingPlan(planBody: GroupSavingsPlan): string[] {
  const {
    title,
    numberOfPeople,
    hasTarget,
    targetAmount,
    howToSave,
    savingFrequency,
    startDate,
    endDate,
  } = planBody;

  const missingFields: string[] = [];

  if (!title) {
    missingFields.push("title");
  }

  if (!numberOfPeople) {
    missingFields.push("numberOfPeople");
  }

  if (hasTarget === undefined || hasTarget === null) {
    missingFields.push("hasTarget");
  } else if (hasTarget && !targetAmount) {
    missingFields.push("targetAmount");
  }

  if (!howToSave) {
    missingFields.push("howToSave");
  }

  if (!savingFrequency) {
    missingFields.push("savingFrequency");
  }

  if (!startDate) {
    missingFields.push("startDate");
  }

  if (!endDate) {
    missingFields.push("endDate");
  }

  return missingFields;
}

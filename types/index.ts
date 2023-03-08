export interface GroupSavingsPlan {
  title: string;
  numberOfPeople: number;
  hasTarget: boolean;
  targetAmount?: number;
  howToSave: string;
  savingFrequency: string;
  startDate: Date;
  endDate: Date;
  ownerId: number;
}

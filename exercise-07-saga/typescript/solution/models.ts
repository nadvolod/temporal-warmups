export interface WellnessIntake {
  patientId: string;
  productName: string;
  dosage: string;
  prescribingCondition: string;
}

export interface ApprovalDecision {
  approved: boolean;
  providerId: string;
  notes?: string;
}

export interface PurchaseResult {
  status: 'completed' | 'rejected' | 'expired' | 'payment-failed';
  intakeId?: string;
  prescriptionId?: string;
  message: string;
}

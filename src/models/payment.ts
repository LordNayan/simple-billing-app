export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  paymentMethod: string; // e.g., 'credit_card', 'paypal', etc.
  paymentDate: Date;
}

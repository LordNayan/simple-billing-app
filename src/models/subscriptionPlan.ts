export interface SubscriptionPlan {
  id: string;
  name: string;
  billingCycle: "monthly" | "yearly";
  price: number;
  status: "active" | "inactive";
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  currentSubscriptionPlanId: string;
  subscriptionChanges: SubscriptionChange[];
  currentSubscriptionStatus: "active" | "cancelled";
}

export interface SubscriptionChange {
  subscriptionPlanId: string;
  changeDate: Date;
  billingCycle: "monthly" | "yearly";
}
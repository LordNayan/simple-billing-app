import { v4 as uuidv4 } from "uuid";
import { Invoice } from "../models/invoice";
import { SubscriptionPlanService } from "../services/subscriptionPlanService";
import { SubscriptionPlan } from "../models/subscriptionPlan";
import { Customer } from "../models/customer";

const subscriptionPlanService = new SubscriptionPlanService();
const kvNamespace = BILLING_KV;

export async function generateInvoiceForCustomer(
  customer: Customer
): Promise<Invoice> {
  if (!customer) throw new Error("Customer not found");

  const currentSubscriptionPlan = await subscriptionPlanService.getPlan(
    customer.subscriptionPlanId
  );
  if (!currentSubscriptionPlan) throw new Error("Subscription plan not found");
  const currentBillingCycle = currentSubscriptionPlan?.billingCycle;

  const amount = await calculateProratedAmount(
    customer,
    currentSubscriptionPlan
  );
  const newInvoice: Invoice = {
    id: uuidv4(),
    customerId: customer.id,
    amount: amount,
    dueDate: calculateDueDate(
      customer.subscriptionChangeDate,
      currentBillingCycle
    ),
    paymentStatus: "pending",
  };

  await kvNamespace.put(`invoice:${newInvoice.id}`, JSON.stringify(newInvoice));
  return newInvoice;
}

async function calculateProratedAmount(
  customer: Customer,
  currentSubscriptionPlan: SubscriptionPlan
): Promise<number> {
  if (
    !customer.previousSubscriptionPlanId ||
    !customer.previousSubscriptionChangeDate
  ) {
    return currentSubscriptionPlan.price;
  }

  const previousPlan = await subscriptionPlanService.getPlan(
    customer.previousSubscriptionPlanId
  );
  if (!previousPlan) throw new Error("Previous subscription plan not found");

  const currentDate = new Date();
  const changeDate = new Date(customer.subscriptionChangeDate);
  const daysInCycle = getDaysInCycle(
    currentSubscriptionPlan.billingCycle,
    changeDate
  );

  const daysUsedInCurrentPlan = Math.floor(
    (currentDate.getTime() - changeDate.getTime()) / (1000 * 3600 * 24)
  );
  const proratedCurrentPlan =
    (currentSubscriptionPlan.price / daysInCycle) * daysUsedInCurrentPlan;

  const daysNotUsedInPreviousPlan = daysInCycle - daysUsedInCurrentPlan;
  const proratedPreviousPlan =
    (previousPlan.price / daysInCycle) * daysNotUsedInPreviousPlan;

  return proratedCurrentPlan + proratedPreviousPlan;
}

function calculateDueDate(
  changeDate: Date,
  billingCycle: "monthly" | "yearly"
): Date {
  const dueDate = new Date(changeDate);
  if (billingCycle === "monthly") {
    dueDate.setMonth(dueDate.getMonth() + 1);
  } else {
    dueDate.setFullYear(dueDate.getFullYear() + 1);
  }
  return dueDate;
}

function getDaysInCycle(
  billingCycle: "monthly" | "yearly",
  date: Date
): number {
  const cycleDate = new Date(date);
  if (billingCycle === "monthly") {
    cycleDate.setMonth(cycleDate.getMonth() + 1);
  } else {
    cycleDate.setFullYear(cycleDate.getFullYear() + 1);
  }
  return Math.floor(
    (cycleDate.getTime() - date.getTime()) / (1000 * 3600 * 24)
  );
}

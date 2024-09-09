import { v4 as uuidv4 } from "uuid";
import { Invoice } from "../models/invoice";
import { SubscriptionPlanService } from "../services/subscriptionPlanService";
import { SubscriptionPlan } from "../models/subscriptionPlan";
import { Customer } from "../models/customer";

const subscriptionPlanService = new SubscriptionPlanService();
const kvNamespace = BILLING_KV;

export async function generateInvoiceForCustomer(
  customerId: string
): Promise<Invoice> {
  const customer = await kvNamespace.get(`customer:${customerId}`);

  if (!customer) throw new Error("Customer not found");

  const customerData = JSON.parse(customer);

  const totalAmount = await calculateProratedCharges(customerData);

  const currentSubscriptionPlan = await subscriptionPlanService.getPlan(
    customerData.currentSubscriptionPlanId
  );
  if (!currentSubscriptionPlan) throw new Error("Subscription plan not found");

  const currentBillingCycle = currentSubscriptionPlan.billingCycle;
  const newInvoice: Invoice = {
    id: uuidv4(),
    customerId: customerData.id,
    amount: totalAmount,
    dueDate: calculateDueDate(
      new Date(customerData.subscriptionChanges[0].changeDate),
      customerData.subscriptionChanges[0].billingCycle
    ),
    paymentStatus: "pending",
  };

  // Create new invoice
  await kvNamespace.put(`invoice:${newInvoice.id}`, JSON.stringify(newInvoice));

  // Save new invoice against a customer
  const previousInvoices =
    (await kvNamespace.get(`customer_invoices:${customerId}`)) || "[]";
  await kvNamespace.put(
    `customer_invoices:${customerId}`,
    JSON.stringify(JSON.parse(previousInvoices).push(newInvoice))
  );

  // Clear old subscription changes and keep the current active one with the new billing cycle
  const changeDate = new Date();
  changeDate.setDate(changeDate.getDate() + 1);
  customerData.subscriptionChanges = [
    {
      subscriptionPlanId: customerData.currentSubscriptionPlanId,
      changeDate: changeDate,
      billingCycle: currentBillingCycle,
    },
  ];
  await kvNamespace.put(
    `customer:${customerData.id}`,
    JSON.stringify(customer)
  );

  // Store the invoice generation date and customer active bill date
  await storeInvoiceGenerationDate(
    customerId,
    changeDate,
    currentSubscriptionPlan
  );

  return newInvoice;
}

export async function storeInvoiceGenerationDate(
  customerId: string,
  subscriptionChangeDate: Date,
  plan: SubscriptionPlan
): Promise<void> {
  const planEndDate = calculateDueDate(
    subscriptionChangeDate,
    plan.billingCycle
  ).toLocaleDateString("en-US");

  // Prepare a customer array to store all customers with same active bill date
  const invoiceGenerationDateCustomerArray = await kvNamespace.get(
    `invoiceGenerationDate:${planEndDate}`
  );
  if (!invoiceGenerationDateCustomerArray) {
    await kvNamespace.put(
      `invoiceGenerationDate:${planEndDate}`,
      JSON.stringify([customerId])
    );
  } else {
    const customerIdArray = JSON.parse(invoiceGenerationDateCustomerArray);
    customerIdArray.push(customerId);
    await kvNamespace.put(
      `invoiceGenerationDate:${planEndDate}`,
      JSON.stringify(customerIdArray)
    );
  }

  // Save current active bill date for a single customer
  await kvNamespace.put(`customerActiveBillDate:${customerId}`, planEndDate);
}

export async function changeInvoiceGenerationDate(
  customerId: string,
  subscriptionChangeDate: Date,
  plan: SubscriptionPlan
): Promise<void> {
  // remove the user from the yearly cycle
  const currentBillDate = await kvNamespace.get(
    `customerActiveBillDate:${customerId}`
  );

  const previousInvoiceGenerationDateCustomerArray = await kvNamespace.get(
    `invoiceGenerationDate:${currentBillDate}`
  );
  const updatedCustomerArray = JSON.parse(
    previousInvoiceGenerationDateCustomerArray!
  )?.filter((customerId: string) => customerId != customerId);
  await kvNamespace.put(
    `invoiceGenerationDate:${currentBillDate}`,
    JSON.stringify(updatedCustomerArray)
  );

  // Add it to the monthly cycle
  return await storeInvoiceGenerationDate(
    customerId,
    subscriptionChangeDate,
    plan
  );
}

async function calculateProratedCharges(customer: Customer): Promise<number> {
  let totalProratedAmount = 0;
  const currentCycleStart = new Date(
    customer.subscriptionChanges[0].changeDate
  );
  const billingCycleEndDate = new Date(currentCycleStart);
  billingCycleEndDate.setMonth(billingCycleEndDate.getMonth() + 1); // Assume monthly cycle

  for (let i = 0; i < customer.subscriptionChanges.length; i++) {
    const change = customer.subscriptionChanges[i];
    const nextChangeDate =
      i < customer.subscriptionChanges.length - 1
        ? new Date(customer.subscriptionChanges[i + 1].changeDate)
        : billingCycleEndDate;

    const daysUsed = Math.floor(
      (nextChangeDate.getTime() - new Date(change.changeDate).getTime()) /
        (1000 * 3600 * 24)
    );
    const currentPlan = await subscriptionPlanService.getPlan(
      change.subscriptionPlanId
    );
    const daysInCycle = getDaysInCycle(currentPlan!.billingCycle);

    totalProratedAmount += (currentPlan!.price / daysInCycle) * daysUsed;
  }

  return totalProratedAmount;
}

export function calculateDueDate(
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

function getDaysInCycle(billingCycle: "monthly" | "yearly"): number {
  return billingCycle === "monthly" ? 30 : 365;
}

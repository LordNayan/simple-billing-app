import { v4 as uuidv4 } from "uuid";
import { Invoice } from "../models/invoice";
import { SubscriptionPlanService } from "../services/subscriptionPlanService";
import { SubscriptionPlan } from "../models/subscriptionPlan";
import { Customer } from "../models/customer";
import { sendEmailNotification } from "./email";

const subscriptionPlanService = new SubscriptionPlanService();
const kvNamespace = BILLING_KV;

export async function generateInvoiceForCustomer(
  customerId: string
): Promise<Invoice> {
  const customer = await kvNamespace.get(`customer:${customerId}`);

  if (!customer) throw new Error("Customer not found");

  const customerData: Customer = JSON.parse(customer);

  const totalAmount = await calculateProratedCharges(customerData);

  const currentSubscriptionPlan = await subscriptionPlanService.getPlan(
    customerData.currentSubscriptionPlanId
  );
  if (!currentSubscriptionPlan) throw new Error("Subscription plan not found");

  const currentBillingCycle = currentSubscriptionPlan.billingCycle;
  const newChangeDate = new Date();
  const newInvoice: Invoice = {
    id: uuidv4(),
    customerId: customerData.id,
    amount: totalAmount,
    dueDate: newChangeDate,
    paymentStatus: "pending",
  };

  // Create new invoice
  await kvNamespace.put(`invoice:${newInvoice.id}`, JSON.stringify(newInvoice));

  // Send email notification - We can replicate the same everywhere. Commenting for now.
  const emailPayload = {
    to: customerData.email,
    subject: `Invoice: ${newInvoice.id} created succesfully`,
    text: "Please do not reply to this mail. In case of support required, please contact at nayan@simplebillingaspp.com",
  };
  // await sendEmailNotification(emailPayload);

  // Update customer invoices list
  const updatedInvoices = JSON.parse(
    (await kvNamespace.get(`customer_invoices:${customerId}`)) || "[]"
  );

  // Add the new invoice to the array
  updatedInvoices.push(newInvoice);

  // Save the updated invoices array back to kvNamespace
  await kvNamespace.put(
    `customer_invoices:${customerId}`,
    JSON.stringify(updatedInvoices)
  );

  // Clear old subscription changes and keep the current active one with the new billing cycle
  newChangeDate.setDate(newChangeDate.getDate() + 1);
  customerData.subscriptionChanges = [
    {
      subscriptionPlanId: customerData.currentSubscriptionPlanId,
      changeDate: newChangeDate,
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
    newChangeDate,
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

  const previousInvoiceGenerationDateCustomerArray = JSON.parse(
    (await kvNamespace.get(`invoiceGenerationDate:${currentBillDate}`)) || "[]"
  );

  const updatedCustomerArray =
    previousInvoiceGenerationDateCustomerArray.filter(
      (id: string) => id != customerId
    );

  // Update or delete the previous invoice generation date array
  updatedCustomerArray.length
    ? await kvNamespace.put(
        `invoiceGenerationDate:${currentBillDate}`,
        JSON.stringify(updatedCustomerArray)
      )
    : await kvNamespace.delete(`invoiceGenerationDate:${currentBillDate}`);

  // Add it to the monthly cycle
  return await storeInvoiceGenerationDate(
    customerId,
    subscriptionChangeDate,
    plan
  );
}

function calculateDaysUsed(startDate: Date, endDate: Date): number {
  const startUTC = new Date(
    Date.UTC(
      startDate.getUTCFullYear(),
      startDate.getUTCMonth(),
      startDate.getUTCDate()
    )
  );
  const endUTC = new Date(
    Date.UTC(
      endDate.getUTCFullYear(),
      endDate.getUTCMonth(),
      endDate.getUTCDate()
    )
  );

  return (endUTC.getTime() - startUTC.getTime()) / (1000 * 3600 * 24);
}

async function calculateProratedCharges(customer: Customer): Promise<number> {
  let totalProratedAmount = 0;
  const currentCycleStart = new Date(
    customer.subscriptionChanges[0].changeDate
  );

  let billingCycleEndDate = new Date(currentCycleStart);
  if (customer.subscriptionChanges[0].billingCycle === "monthly") {
    billingCycleEndDate.setMonth(billingCycleEndDate.getMonth() + 1);
  } else {
    billingCycleEndDate.setFullYear(billingCycleEndDate.getFullYear() + 1);
  }

  for (let i = 0; i < customer.subscriptionChanges.length; i++) {
    const change = customer.subscriptionChanges[i];
    let nextChangeDate = billingCycleEndDate;
    if (customer.subscriptionChanges.length != 1) {
      nextChangeDate =
        i < customer.subscriptionChanges.length - 1
          ? new Date(customer.subscriptionChanges[i + 1].changeDate)
          : customer.subscriptionChanges[i - 1].billingCycle === "yearly" &&
            customer.subscriptionChanges[i].billingCycle === "monthly"
          ? calculateDueDate(
              customer.subscriptionChanges[i].changeDate,
              "monthly"
            )
          : billingCycleEndDate;
    }
    const daysUsed = calculateDaysUsed(
      new Date(change.changeDate),
      nextChangeDate
    );

    const currentPlan = await subscriptionPlanService.getPlan(
      change.subscriptionPlanId
    );

    if (currentPlan) {
      const daysInCycle = getDaysInCycle(currentPlan.billingCycle);

      totalProratedAmount += (currentPlan.price / daysInCycle) * daysUsed;
    }
  }
  // Rounding off for simplicity
  return Math.round(totalProratedAmount);
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

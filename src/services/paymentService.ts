import { v4 as uuidv4 } from "uuid";
import { createHttpError, HttpError } from "../utils/httpError";
import { Invoice } from "../models/invoice";
import { Payment } from "../models/payment";

export class PaymentService {
  private kvNamespace: KVNamespace;

  constructor() {
    this.kvNamespace = BILLING_KV;
  }

  async processPayment(
    paymentObject: Omit<Payment, "id" | "paymentDate">
  ): Promise<Payment | HttpError> {
    const { invoiceId, amount, paymentMethod } = paymentObject;
    const invoiceKey = `invoice:${invoiceId}`;
    const invoiceData = await this.kvNamespace.get(invoiceKey);
    if (!invoiceData) {
      return createHttpError("Invoice not found", 404);
    }

    const invoice = JSON.parse(invoiceData) as Invoice;
    if (invoice.paymentStatus === "paid") {
      return createHttpError("Invoice already paid", 400);
    }

    if (invoice.amount !== amount) {
      return createHttpError("Incorrect payment amount", 400);
    }

    // Generate a unique payment ID
    const paymentId = uuidv4();

    // Create a new payment object
    const payment: Payment = {
      id: paymentId,
      invoiceId,
      amount,
      paymentMethod,
      paymentDate: new Date(),
    };

    // Record the payment in KV Store
    await this.kvNamespace.put(`payment:${paymentId}`, JSON.stringify(payment));

    // Update the invoice status based on payment
    invoice.paymentStatus = "paid";
    invoice.paymentDate = new Date();
    await this.kvNamespace.put(invoiceKey, JSON.stringify(invoice));

    // Update the customer invoices
    const invoicesArray = JSON.parse(
      (await this.kvNamespace.get(`customer_invoices:${invoice.customerId}`)) ||
        "[]"
    );

    const updatedInvoices = invoicesArray.map((inv: Invoice) =>
      inv.id === invoice.id ? invoice : inv
    );

    await this.kvNamespace.put(
      `customer_invoices:${invoice.customerId}`,
      JSON.stringify(updatedInvoices)
    );
    return payment;
  }

  async retryFailedPayments(): Promise<void> {
    const allInvoices = await this.kvNamespace.list({ prefix: "invoice:" });
    for (const key of allInvoices.keys) {
      const invoiceData = await this.kvNamespace.get(key.name);
      if (invoiceData) {
        const invoice = JSON.parse(invoiceData) as Invoice;

        if (invoice.paymentStatus === "failed") {
          // Retry logic here - for now, we'll simply attempt it again and update status
          // In real scenarios, this could involve calling payment gateways, etc.

          // Also we can add a retry counter in which case a payment will be retried only for x amount of times,
          // after which it can be writtn to the KV as failedRequests:xTimes
          // to be processed later differently
          try {
            console.log(`Retrying payment for Invoice ID: ${invoice.id}`);

            // Update payment status and date to retry
            invoice.paymentStatus = "pending";
            await this.kvNamespace.put(key.name, JSON.stringify(invoice));

            // We can put some kind of 3rd party api call to payment service here.
            // As of now I am simulating it.
            const success = true;

            if (success) {
              invoice.paymentStatus = "paid";
              invoice.paymentDate = new Date();
              await this.kvNamespace.put(key.name, JSON.stringify(invoice));

              // Optionally, update the customer.currentSubscriptionStatus = "active";
              // related customer status if needed
              // const customerKey = `customer:${invoice.customerId}`;
              // const customerData = await this.kvNamespace.get(customerKey);
            }
          } catch (error) {
            console.error(
              `Failed to retry payment for Invoice ID: ${invoice.id}`,
              error
            );
          }
        }
      }
    }
  }
}

import { generateInvoiceForCustomer } from "../utils/invoiceGenerator";

export async function handleScheduled(event: ScheduledEvent): Promise<void> {
  const currentDate = new Date().toLocaleDateString("en-US");

  const { keys } = await BILLING_KV.list({
    prefix: `invoiceGenerationDate:${currentDate}`,
  });

  if (keys.length > 0) {
    const customerIds = JSON.parse(
      (await BILLING_KV.get(`invoiceGenerationDate:${currentDate}`)) ?? "[]"
    );
    for (const customerId of customerIds) {
      await generateInvoiceForCustomer(customerId);
    }

    // Delete the old invoice generation date key from KV
    await BILLING_KV.delete(`invoiceGenerationDate:${currentDate}`);
  }
}

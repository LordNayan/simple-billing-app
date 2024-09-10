import { CustomerService } from "../services/customerService";
import { createErrorResponse } from "../utils/responses";
import { generateInvoiceForCustomer } from "../utils/invoiceGenerator";
import { createSuccessResponse } from "../utils/responses";
import { Invoice } from "../models/invoice";

const customerService = new CustomerService();

export async function handleGetCurrentBillDate(
  request: Request
): Promise<Response> {
  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();
  if (!id) return createErrorResponse("Customer not found", 400);
  const currentBillDate = await customerService.getCurrentBillDate(id);
  return createSuccessResponse(currentBillDate, 200);
}

export async function generateInvoice(request: Request): Promise<Response> {
  const {
    invoiceGenerationDate,
    customerId,
  }: { invoiceGenerationDate: string; customerId: string } =
    await request.json();

  // get all customer ids whose generation date is the one that is provided
  const customerIds = JSON.parse(
    (await BILLING_KV.get(`invoiceGenerationDate:${invoiceGenerationDate}`)) ??
      "[]"
  );

  // Go over a particular customer to generate his invoice to test
  let invoice: Invoice;
  for (const id of customerIds) {
    if (id === customerId) {
      invoice = await generateInvoiceForCustomer(customerId);
      await BILLING_KV.delete(`invoiceGenerationDate:${invoiceGenerationDate}`);
      return createSuccessResponse(invoice, 201);
    }
  }
  return createSuccessResponse("", 201);
}

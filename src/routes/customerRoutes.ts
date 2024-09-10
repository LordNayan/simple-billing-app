import { createSuccessResponse } from "../utils/responses";
import { createErrorResponse } from "../utils/responses";
import { Customer } from "../models/customer";
import { CustomerService } from "../services/customerService";
import { isHttpError } from "../utils/httpError";

const customerService = new CustomerService();

export async function handleCreateCustomer(
  request: Request
): Promise<Response> {
  const customerData: Omit<Customer, "id" | "subscriptionStatus"> =
    await request.json();
  const newCustomer = await customerService.createCustomer(customerData);
  if (isHttpError(newCustomer)) {
    return createErrorResponse(
      newCustomer.message,
      newCustomer.statusCode ?? 400
    );
  }
  return createSuccessResponse(newCustomer, 201);
}

export async function handleGetCustomer(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();
  const customer = await customerService.getCustomer(id!);
  if (customer) {
    return createSuccessResponse(customer, 200);
  }
  return createErrorResponse("Customer not found", 400);
}

export async function handleAssignSubscriptionPlan(
  request: Request
): Promise<Response> {
  const {
    customerId,
    subscriptionPlanId,
  }: { customerId: string; subscriptionPlanId: string } = await request.json();
  const assigned = await customerService.assignSubscriptionPlan(
    customerId,
    subscriptionPlanId
  );
  if (isHttpError(assigned)) {
    return createErrorResponse(assigned.message, assigned.statusCode ?? 400);
  }
  return createSuccessResponse(assigned, 200);
}

export async function handleListInvoices(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();
  if (id) {
    const invoices = await customerService.listInvoices(id);
    if (isHttpError(invoices)) {
      return createErrorResponse(invoices.message, invoices.statusCode ?? 400);
    }
    return createSuccessResponse(invoices, 200);
  }
  return createErrorResponse("Bad Request", 400);
}

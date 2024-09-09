import { SubscriptionPlanService } from "./services/subscriptionPlanService";
import { SubscriptionPlan } from "./models/subscriptionPlan";
import { createErrorResponse } from "./utils/errors";
import { createSuccessResponse } from "./utils/responses";
import { CustomerService } from "./services/customerService";
import { Customer } from "./models/customer";
import { emptyKVStore } from "./utils/kvStore";
import {
  calculateDueDate,
  generateInvoiceForCustomer,
} from "./utils/invoiceGenerator";
import { PaymentService } from "./services/paymentService";
import { Payment } from "./models/payment";
import { isHttpError } from "./utils/httpError";

const subscriptionPlanService = new SubscriptionPlanService();
const customerService = new CustomerService();
const paymentService = new PaymentService();

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
});

addEventListener("scheduled", (event) => {
  event.waitUntil(handleScheduled(event));
});

async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  if (url.pathname === "/") {
    switch (request.method) {
      case "GET":
        return new Response("Welcome to Nayan's simple billing app", {
          status: 200,
        });
      default:
        return createErrorResponse("Method not allowed", 405);
    }
  }

  if (url.pathname.startsWith("/plans")) {
    switch (request.method) {
      case "POST":
        return handleCreatePlan(request);
      case "GET":
        return handleGetPlan(request);
      case "PUT":
        return handleUpdatePlan(request);
      case "DELETE":
        return handleDeletePlan(request);
      default:
        return createErrorResponse("Method not allowed", 405);
    }
  }

  if (url.pathname.startsWith("/customer/invoices")) {
    switch (request.method) {
      case "GET":
        return handleListInvoices(request);
      default:
        return createErrorResponse("Method not allowed", 405);
    }
  }

  if (url.pathname.startsWith("/customers")) {
    switch (request.method) {
      case "POST":
        return handleCreateCustomer(request);
      case "GET":
        return handleGetCustomer(request);
      case "PUT":
        return handleAssignSubscriptionPlan(request);
      default:
        return createErrorResponse("Method not allowed", 405);
    }
  }

  if (url.pathname.startsWith("/payments")) {
    switch (request.method) {
      case "POST":
        return handleProcessPayment(request);
      // Add any other payment-related methods here if needed
      default:
        return createErrorResponse("Method not allowed", 405);
    }
  }

  // Additional admin endpoint to empty the KV store
  if (url.pathname === "/admin/empty-kv" && request.method === "POST") {
    return handleEmptyKV();
  }

  // Remove in last commit
  if (url.pathname === "/test" && request.method === "GET") {
    await customerService.exampleAPI("cb62df09-ad00-425e-81b1-48d068347331");
  }

  // Remove in last commit
  if (url.pathname === "/test1" && request.method === "GET") {
    await testScheduled();
  }

  return new Response("Not found", { status: 404 });
}

async function handleEmptyKV(): Promise<Response> {
  await emptyKVStore(BILLING_KV);
  return createSuccessResponse("KV store emptied successfully", 200);
}

async function handleCreatePlan(request: Request): Promise<Response> {
  const plan: Omit<SubscriptionPlan, "id"> = await request.json();
  const newPlan = await subscriptionPlanService.createPlan(plan);

  if (newPlan) {
    return createSuccessResponse(newPlan, 201);
  } else {
    return createErrorResponse("Plan with the same name already exists", 409);
  }
}

async function handleGetPlan(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();
  const plan = await subscriptionPlanService.getPlan(id!);
  if (plan) {
    return createSuccessResponse(plan, 200);
  }
  return createErrorResponse("Plan not found", 400);
}

async function handleUpdatePlan(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();
  if (id) {
    const plan: Omit<SubscriptionPlan, "id"> = await request.json();
    await subscriptionPlanService.updatePlan(id, plan);
    return createSuccessResponse(plan, 200);
  }
  return createErrorResponse("Bad Request", 400);
}

async function handleDeletePlan(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();
  await subscriptionPlanService.deletePlan(id!);
  return createSuccessResponse(null, 204);
}

async function handleCreateCustomer(request: Request): Promise<Response> {
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

async function handleGetCustomer(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();
  const customer = await customerService.getCustomer(id!);
  if (customer) {
    return createSuccessResponse(customer, 200);
  }
  return createErrorResponse("Customer not found", 400);
}

async function handleAssignSubscriptionPlan(
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

async function handleProcessPayment(request: Request): Promise<Response> {
  const paymentData: Omit<Payment, "id" | "paymentDate"> = await request.json();
  const payment = await paymentService.processPayment(paymentData);
  if (isHttpError(payment)) {
    return createErrorResponse(payment.message, payment.statusCode ?? 400);
  }
  return createSuccessResponse(payment, 200);
}

async function handleListInvoices(request: Request): Promise<Response> {
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

// Remove in last commit
export async function testScheduled(): Promise<void> {
  let currentDate = new Date();
  currentDate.setMonth(currentDate.getMonth() + 6);
  // currentDate = calculateDueDate(new Date(), "yearly").toLocaleDateString(
  //   "en-US"
  // );
  const currDate = currentDate.toLocaleDateString("en-US");
  const { keys } = await BILLING_KV.list({
    prefix: `invoiceGenerationDate:`,
  });

  // const { keys } = await BILLING_KV.list({
  //   prefix: `invoiceGenerationDate:${currentDate}`,
  // });

  if (keys.length > 0) {
    const customerIds = JSON.parse(
      (await BILLING_KV.get(`invoiceGenerationDate:4/10/2025`)) ?? "[]"
    );

    for (const customerId of customerIds) {
      if (customerId === "9b27473d-e505-43f3-a7d1-6a047127c961") {
        await generateInvoiceForCustomer(customerId);
      }
    }

    // Delete the old invoice generation date key from KV
    await BILLING_KV.delete(`invoiceGenerationDate:${currDate}`);
  }
}
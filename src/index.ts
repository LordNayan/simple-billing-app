import { SubscriptionPlanService } from "./services/subscriptionPlanService";
import { SubscriptionPlan } from "./models/subscriptionPlan";
import { createErrorResponse } from "./utils/errors";
import { createSuccessResponse } from "./utils/responses";
import { CustomerService } from "./services/customerService";
import { Customer } from "./models/customer";
import { emptyKVStore } from "./utils/kvStore";

const subscriptionPlanService = new SubscriptionPlanService();
const customerService = new CustomerService();

addEventListener("fetch", (event) => {
  event.respondWith(handleRequest(event.request));
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

  // Additional admin endpoint to empty the KV store
  if (url.pathname === "/admin/empty-kv" && request.method === "POST") {
    return handleEmptyKV();
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
  if (!newCustomer) {
    return createErrorResponse("Customer already exists", 409);
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
  return createErrorResponse("Plan not found", 400);
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
  if ("error" in assigned) {
    return createErrorResponse(assigned.error, 400);
  }
  return createSuccessResponse(assigned, 200);
}
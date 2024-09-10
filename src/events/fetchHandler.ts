import {
  handleCreatePlan,
  handleGetPlan,
  handleUpdatePlan,
  handleDeletePlan,
} from "../routes/planRoutes";
import {
  handleCreateCustomer,
  handleGetCustomer,
  handleAssignSubscriptionPlan,
  handleListInvoices,
} from "../routes/customerRoutes";
import { handleProcessPayment } from "../routes/paymentRoutes";
import { handleEmptyKV } from "../routes/adminRoutes";
import { createErrorResponse } from "../utils/responses";
import {
  generateInvoice,
  handleGetCurrentBillDate,
} from "../routes/testRoutes";

const routeHandlers: Record<
  string,
  Record<string, (req: Request) => Promise<Response>>
> = {
  "/": {
    GET: async () =>
      new Response("Welcome to Nayan's simple billing app", { status: 200 }),
  },
  "/plans": {
    POST: handleCreatePlan,
    GET: handleGetPlan,
    PUT: handleUpdatePlan,
    DELETE: handleDeletePlan,
  },
  "/customers": {
    POST: handleCreateCustomer,
    GET: handleGetCustomer,
    PUT: handleAssignSubscriptionPlan,
  },
  "/payments": {
    POST: handleProcessPayment,
  },
  "/customer/invoices": {
    GET: handleListInvoices,
  },
  "/admin/empty-kv": {
    POST: handleEmptyKV,
  },
  "/test/getCurrentBillDate": {
    GET: handleGetCurrentBillDate,
  },
  "/test/generateInvoice": {
    POST: generateInvoice,
  },
};

export async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Find the route and method
  const route = Object.keys(routeHandlers).find((r) => path.startsWith(r));

  if (route) {
    const methodHandler = routeHandlers[route][request.method];
    if (methodHandler) {
      return methodHandler(request);
    } else {
      return createErrorResponse("Method not allowed", 405);
    }
  }

  return new Response("Not found", { status: 404 });
}

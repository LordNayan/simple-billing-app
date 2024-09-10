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

// Define route handlers using regular expressions for dynamic IDs
const routeHandlers: Array<{
  pattern: RegExp;
  methods: Record<
    string,
    (req: Request, params?: Record<string, string>) => Promise<Response>
  >;
}> = [
  {
    pattern: /^\/$/, // Root path
    methods: {
      GET: async () =>
        new Response("Welcome to Nayan's simple billing app", { status: 200 }),
    },
  },
  {
    pattern: /^\/plans$/, // Customers without ID (for POST)
    methods: {
      POST: handleCreatePlan,
    },
  },
  {
    pattern: /^\/plans\/([a-zA-Z0-9-]+)$/, // Plans with dynamic ID
    methods: {
      GET: handleGetPlan,
      PUT: handleUpdatePlan,
      DELETE: handleDeletePlan,
    },
  },
  {
    pattern: /^\/customers$/, // Customers without ID (for POST)
    methods: {
      POST: handleCreateCustomer,
    },
  },
  {
    pattern: /^\/customers\/([a-zA-Z0-9-]+)$/, // Customers with dynamic ID
    methods: {
      GET: handleGetCustomer,
      PUT: handleAssignSubscriptionPlan,
    },
  },
  {
    pattern: /^\/payments$/, // Payments
    methods: {
      POST: handleProcessPayment,
    },
  },
  {
    pattern: /^\/customer\/([a-zA-Z0-9-]+)\/invoices$/, // Customer invoices with dynamic ID
    methods: {
      GET: handleListInvoices,
    },
  },
  {
    pattern: /^\/admin\/empty-kv$/, // Admin empty KV
    methods: {
      POST: handleEmptyKV,
    },
  },
  {
    pattern: /^\/test\/getCurrentBillDate\/([a-zA-Z0-9-]+)$/, // Test getCurrentBillDate with dynamic ID
    methods: {
      GET: handleGetCurrentBillDate,
    },
  },
  {
    pattern: /^\/test\/generateInvoice$/, // Test generateInvoice
    methods: {
      POST: generateInvoice,
    },
  },
];

// Handle requests based on the matching route pattern
export async function handleRequest(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;

  // Loop through all the route handlers to find a matching route
  for (const route of routeHandlers) {
    const match = path.match(route.pattern);
    if (match) {
      const methodHandler = route.methods[request.method];
      if (methodHandler) {
        // Extract the path parameters (like ID) from the regex match
        const params = { id: match[1] }; // Assuming the first capture group is the ID
        return methodHandler(request, params);
      } else {
        return createErrorResponse("Method not allowed", 405);
      }
    }
  }

  return new Response("Not found", { status: 404 });
}
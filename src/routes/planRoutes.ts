import { SubscriptionPlanService } from "../services/subscriptionPlanService";
import { createSuccessResponse } from "../utils/responses";
import { createErrorResponse } from "../utils/responses";
import { SubscriptionPlan } from "../models/subscriptionPlan";

const subscriptionPlanService = new SubscriptionPlanService();

export async function handleCreatePlan(request: Request): Promise<Response> {
  const plan: Omit<SubscriptionPlan, "id"> = await request.json();
  const newPlan = await subscriptionPlanService.createPlan(plan);

  if (newPlan) {
    return createSuccessResponse(newPlan, 201);
  } else {
    return createErrorResponse("Plan with the same name already exists", 409);
  }
}

export async function handleGetPlan(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();
  const plan = await subscriptionPlanService.getPlan(id!);
  if (plan) {
    return createSuccessResponse(plan, 200);
  }
  return createErrorResponse("Plan not found", 400);
}

export async function handleUpdatePlan(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();
  if (id) {
    const plan: Omit<SubscriptionPlan, "id"> = await request.json();
    await subscriptionPlanService.updatePlan(id, plan);
    return createSuccessResponse(plan, 200);
  }
  return createErrorResponse("Bad Request", 400);
}

export async function handleDeletePlan(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const id = url.pathname.split("/").pop();
  await subscriptionPlanService.deletePlan(id!);
  return createSuccessResponse(null, 204);
}

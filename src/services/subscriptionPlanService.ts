import { SubscriptionPlan } from "../models/subscriptionPlan";
import { v4 as uuidv4 } from "uuid";

export class SubscriptionPlanService {
  private kvNamespace: KVNamespace;

  constructor() {
    this.kvNamespace = BILLING_KV;
  }

  async createPlan(
    plan: Omit<SubscriptionPlan, "id">
  ): Promise<SubscriptionPlan | null> {
    if (await this.kvNamespace.get(`plan_name:${plan.name}`)) {
      return null; // Plan with the same name already exists
    }
    const id = uuidv4();
    const newPlan = { ...plan, id };
    await this.kvNamespace.put(`plan:${id}`, JSON.stringify(newPlan));
    await this.kvNamespace.put(`plan_name:${plan.name}`, "1");
    return newPlan;
  }

  async getPlan(id: string): Promise<SubscriptionPlan | null> {
    const plan = await this.kvNamespace.get(`plan:${id}`);
    return plan ? JSON.parse(plan) : null;
  }

  async updatePlan(
    id: string,
    plan: Omit<SubscriptionPlan, "id">
  ): Promise<void> {
    await this.kvNamespace.put(`plan:${id}`, JSON.stringify(plan));
  }

  async deletePlan(id: string): Promise<void> {
    await this.kvNamespace.delete(`plan:${id}`);
  }
}

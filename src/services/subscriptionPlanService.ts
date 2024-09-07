import { SubscriptionPlan } from "../models/subscriptionPlan";
import { v4 as uuidv4 } from "uuid";

export class SubscriptionPlanService {
  private kvNamespace: KVNamespace;

  constructor() {
    this.kvNamespace = BILLING_KV;
  }

  async doesPlanNameExist(name: string): Promise<boolean> {
    const { keys } = await this.kvNamespace.list();
    for (const key of keys) {
      const planData = await this.kvNamespace.get(key.name);
      const plan = planData ? JSON.parse(planData) : null;
      if (plan?.name === name) {
        return true;
      }
    }
    return false;
  }

  async createPlan(
    plan: Omit<SubscriptionPlan, "id">
  ): Promise<SubscriptionPlan | null> {
    if (await this.doesPlanNameExist(plan.name)) {
      return null; // Plan with the same name already exists
    }
    const id = uuidv4();
    const newPlan = { ...plan, id };
    await this.kvNamespace.put(`plan:${id}`, JSON.stringify(newPlan));
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
    try {
      await this.kvNamespace.delete(`plan:${id}`);
    } catch (e) {
      console.log(e);
    }
  }
}

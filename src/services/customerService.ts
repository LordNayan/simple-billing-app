import { v4 as uuidv4 } from "uuid";
import { Customer, SubscriptionChange } from "../models/customer";
import { SubscriptionPlanService } from "./subscriptionPlanService";
import {
  changeInvoiceGenerationDate,
  storeInvoiceGenerationDate,
} from "../utils/invoiceGenerator";
import { CreateCustomerRequest } from "../schema/customer";
import { createHttpError, HttpError } from "../utils/httpError";

export class CustomerService {
  private kvNamespace: KVNamespace;
  private supscriptionPlanService: SubscriptionPlanService;

  constructor() {
    this.kvNamespace = BILLING_KV;
    this.supscriptionPlanService = new SubscriptionPlanService();
  }

  async createCustomer(
    customerData: CreateCustomerRequest
  ): Promise<Customer | HttpError> {
    const customer = await this.kvNamespace.get(
      `customer_email:${customerData.email}`
    );
    if (customer) {
      return createHttpError("Customer already exists", 409);
    }
    const plan = await this.supscriptionPlanService.getPlan(
      customerData.currentSubscriptionPlanId
    );
    if (!plan) {
      return createHttpError("Plan dosent exist", 400);
    }

    const customerId = uuidv4();
    const subscriptionChangeDate = new Date();

    // Add subscription change to track changes
    const subscriptionChange: SubscriptionChange = {
      subscriptionPlanId: customerData.currentSubscriptionPlanId,
      changeDate: subscriptionChangeDate,
      billingCycle: plan.billingCycle,
    };

    const newCustomer: Customer = {
      ...customerData,
      id: customerId,
      currentSubscriptionStatus: "active",
      subscriptionChanges: [subscriptionChange],
    };

    await this.kvNamespace.put(
      `customer:${customerId}`,
      JSON.stringify(newCustomer)
    );

    // for tracking duplicate emails
    await this.kvNamespace.put(`customer_email:${customerData.email}`, "1");

    await storeInvoiceGenerationDate(customerId, subscriptionChangeDate, plan);
    return newCustomer;
  }

  async getCustomer(id: string): Promise<Customer | null> {
    const customerData = await this.kvNamespace.get(`customer:${id}`);
    return customerData ? JSON.parse(customerData) : null;
  }

  async updateCustomer(customer: Customer): Promise<void> {
    await this.kvNamespace.put(
      `customer:${customer.id}`,
      JSON.stringify(customer)
    );
  }

  async deleteCustomer(id: string): Promise<void> {
    await this.kvNamespace.delete(`customer:${id}`);
  }

  async assignSubscriptionPlan(
    customerId: string,
    subscriptionPlanId: string
  ): Promise<Customer | HttpError> {
    const customer = await this.getCustomer(customerId);
    const newPlan = await this.supscriptionPlanService.getPlan(
      subscriptionPlanId
    );
    if (!customer || !newPlan) {
      return createHttpError("Incorrect data provided", 400);
    }

    // Dont assign plan, if same plan is already active
    if (customer.currentSubscriptionPlanId == subscriptionPlanId) {
      return createHttpError("Subscription plan already active", 400);
    }

    const oldPlan = await this.supscriptionPlanService.getPlan(
      customer.currentSubscriptionPlanId
    );

    const subscriptionChangeDate = new Date();

    // Remove in last commit
    // subscriptionChangeDate.setDate(subscriptionChangeDate.getDate() + 25);

    // Edge case where customers bill date will become earlier than the present bill date
    if (
      oldPlan?.billingCycle === "yearly" &&
      newPlan.billingCycle === "monthly"
    ) {
      await changeInvoiceGenerationDate(
        customerId,
        subscriptionChangeDate,
        newPlan
      );
    }

    // Add subscription change to track changes
    const subscriptionChange: SubscriptionChange = {
      subscriptionPlanId: subscriptionPlanId,
      changeDate: subscriptionChangeDate,
      billingCycle: newPlan.billingCycle,
    };
    customer.subscriptionChanges.push(subscriptionChange);

    // Update current subscription to new plan
    customer.currentSubscriptionPlanId = subscriptionPlanId;
    await this.updateCustomer(customer);

    return customer;
  }

  // Remove in last commit
  async exampleAPI(customerId: string): Promise<void> {
    const currentBillDate = await this.kvNamespace.get(
      `customerActiveBillDate:${customerId}`
    );

    console.log("currentBillDate ====> ", currentBillDate);

    const previousInvoiceGenerationDateCustomerArray =
      await this.kvNamespace.get(`invoiceGenerationDate:${currentBillDate}`);

    console.log(
      "previousInvoiceGenerationDateCustomerArray ====> ",
      previousInvoiceGenerationDateCustomerArray
    );
  }
}


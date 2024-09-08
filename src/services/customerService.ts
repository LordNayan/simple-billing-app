import { v4 as uuidv4 } from "uuid";
import { Customer } from "../models/customer";
import { SubscriptionPlanService } from "./subscriptionPlanService";
import { generateInvoiceForCustomer } from "../utils/invoiceGenerator";
import {
  CreateCustomerRequest,
  CreateCustomerResponse,
  UpdateCustomerResponseSchema,
} from "../schema/customer";
import { ErrorSchema } from "../schema/error";

export class CustomerService {
  private kvNamespace: KVNamespace;
  private supscriptionPlanService: SubscriptionPlanService;

  constructor() {
    // Use the KV namespace binding defined in wrangler.toml
    this.kvNamespace = BILLING_KV;
    this.supscriptionPlanService = new SubscriptionPlanService();
  }

  async createCustomer(
    customerData: CreateCustomerRequest
  ): Promise<CreateCustomerResponse | null> {
    if (await this.kvNamespace.get(`customer_email:${customerData.email}`)) {
      return null; // Customer with the same email already exists
    }
    const id = uuidv4();
    const newCustomer: Customer = {
      ...customerData,
      id,
      subscriptionStatus: "active",
      subscriptionChangeDate: new Date(), // Initialize subscription change date to current date
      // Initialize previous subscription fields as undefined since this is the first plan
    };
    await this.kvNamespace.put(`customer:${id}`, JSON.stringify(newCustomer));
    await this.kvNamespace.put(`customer_email:${customerData.email}`, "1");

    // Generate the initial invoice for the new customer
    const invoice = await generateInvoiceForCustomer(newCustomer);
    return { customer: newCustomer, invoice: invoice };
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
  ): Promise<UpdateCustomerResponseSchema | ErrorSchema> {
    try {
      const customer = await this.getCustomer(customerId);
      const plan = await this.supscriptionPlanService.getPlan(
        subscriptionPlanId
      );
      if (!customer || !plan) {
        throw new Error("Incorrect data provided");
      }

      // Dont assign plan, if same plan is already active
      if (customer.subscriptionPlanId == subscriptionPlanId) {
        throw new Error("Subscription plan already active");
      }

      // Update previous subscription id and set new current supscription
      customer.previousSubscriptionPlanId = customer.subscriptionPlanId;
      customer.previousSubscriptionChangeDate = customer.subscriptionChangeDate;
      customer.subscriptionPlanId = subscriptionPlanId;
      customer.subscriptionChangeDate = new Date();
      await this.updateCustomer(customer);

      // Generate a new invoice after assigning the new subscription plan
      const newInvoice = await generateInvoiceForCustomer(customer);

      return { customer: customer, invoice: newInvoice };
    } catch (e: any) {
      return { error: e.message };
    }
  }
}

import { Customer } from "../models/customer";
import { Invoice } from "../models/invoice";

export interface CreateCustomerRequest {
  name: string;
  email: string;
  subscriptionPlanId: string;
}

export interface CreateCustomerResponse {
  customer: Customer;
  invoice: Invoice;
}

export interface UpdateCustomerResponseSchema {
  customer: Customer;
  invoice: Invoice;
}

export interface UpdateCustomerErrorSchema {
  error: string;
}

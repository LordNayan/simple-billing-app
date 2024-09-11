# Simple Billing App for SaaS Platform

This repository implements a simple billing app for a SaaS platform using Cloudflare Workers. The app supports multiple subscription tiers, handles recurring billing, and provides core functionalities such as subscription management, invoice generation, payment processing, and notifications.

## Table of Contents
- [Getting Started](#getting-started)
- [APIs](#apis)
- [Design Decisions](#design-decisions)

## Getting Started

### Prerequisites
- Node.js (v14 or above)
- npm (v6 or above)
- Cloudflare Account
- Wrangler CLI

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-repo/simple-billing-app.git
   cd simple-billing-app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   npm install -g wrangler
   ```

3. **Create and configure a KV Namespace:**

   Create a new KV namespace:
   ```bash
   wrangler kv:namespace create BILLING_KV
   ```

   Update the `wrangler.toml` with the new KV namespace binding:
   ```toml
   [[kv_namespaces]]
   binding = "BILLING_KV"
   id = "YOUR_NAMESPACE_ID"
   ```

## Running the Project

1. **Start the development server:**
   ```bash
   npm run dev
   ```

## APIs

Import the provided [Postman collection](postman_collection.json) to interact with the APIs. Here are the endpoints:

### Subscription Plans

- **Create Plan**
  - **Endpoint:** `POST /plans`
  - **Description:** Creates a new subscription plan.
  - **Body:**
    ```json
    {
      "name": "Pro Plan",
      "billingCycle": "monthly",
      "price": 200,
      "status": "active"
    }
    ```

- **Update Plan**
  - **Endpoint:** `PUT /plans/:planId`
  - **Description:** Updates a subscription plan with the given ID.
  - **Body:**
    ```json
    {
      "name": "Basic Plan",
      "billingCycle": "monthly",
      "price": 9.99,
      "status": "active"
    }
    ```

- **Get Plan**
  - **Endpoint:** `GET /plans/:planId`
  - **Description:** Retrieves the details of a subscription plan with the given ID.

- **Delete Plan**
  - **Endpoint:** `DELETE /plans/:planId`
  - **Description:** Deletes the subscription plan with the given ID.

### Customers

- **Create Customer**
  - **Endpoint:** `POST /customers`
  - **Description:** Creates a new customer.
  - **Body:**
    ```json
    {
      "name": "John Doe",
      "email": "john.doe@example.com",
      "currentSubscriptionPlanId": "planId"
    }
    ```

- **Assign Plan**
  - **Endpoint:** `PUT /customers/:customerId`
  - **Description:** Assigns a subscription plan to the customer with the given ID.
  - **Body:**
    ```json
    {
      "subscriptionPlanId": "newPlanId"
    }
    ```

- **Get Customer**
  - **Endpoint:** `GET /customers/:customerId`
  - **Description:** Retrieves the details of a customer with the given ID.

- **List Invoices**
  - **Endpoint:** `GET /customer/:customerId/invoices`
  - **Description:** Lists all invoices associated with the customer with the given ID.

### Payments

- **Process Payment**
  - **Endpoint:** `POST /payments`
  - **Description:** Processes a payment for an invoice.
  - **Body:**
    ```json
    {
      "invoiceId": "invoiceId",
      "amount": 100.00,
      "paymentMethod": "paypal"
    }
    ```

### Admin

- **Empty KV**
  - **Endpoint:** `POST /admin/empty-kv`
  - **Description:** Empties the KV namespace for administrative purposes.

### Test
 These routes are just for testing the project so that we dont have to wait for the billing cycle to generate invoice.
- **Get Current Bill Date**
  - **Endpoint:** `GET /test/getCurrentBillDate/:customerId`
  - **Description:** Retrieves the current billing date for the customer with the given ID.

- **Generate Invoice**
  - **Endpoint:** `POST /test/generateInvoice`
  - **Description:** Generates an invoice for the given customer and date.
  - **Body:**
    ```json
    {
      "invoiceGenerationDate": "MM/DD/YYYY",
      "customerId": "customerId"
    }
    ```

## Design Decisions

### Constraints

#### Unique Email ID for Customers
One of the key constraints in the design of this billing app is that each customer must have a unique email ID. This ensures that there are no duplicates and each customer can be uniquely identified by their email.

#### Unique Plan Name
The name of each subscription plan is also required to be unique. This prevents confusion and ensures that each plan can be easily identified and managed.

#### Plan Updates
When a subscription plan is updated, the changes will only affect future customers who subscribe to the plan. Existing customers on that plan will continue to observe the same billing cycle and price as when they first subscribed. This ensures stability and predictability for existing subscribers.

#### Rounding off Prorated Amount
Rounding off the prorated amount for simplicity 

### Cron Jobs for Invoice Generation

#### Daily Invoice Cycle Check
A cron job is scheduled to run every day to check for customers whose billing cycle ends on that day. For these customers, the job will aggregate all plan changes and generate a single invoice that includes prorated charges. After generating the invoice, the system will update the customer’s subscription to only include the active plan, removing any intermediate plans for which charges have already been prorated. While this app does not save historical plan changes, such data could be saved in a real-world application for audit and historical analysis purposes.

### Plan Assignments

#### Active Plan Restrictions
An active subscription plan cannot be reassigned to a customer who is already on that plan. This constraint ensures that customers do not encounter redundant subscriptions and maintain a clear billing cycle.

### Role-Based Access Control (RBAC)

#### Open Endpoints
This application does not implement Role-Based Access Control (RBAC) since there is no login or signup functionality. Consequently, all endpoints are open and accessible without authentication. In a real-world application, RBAC would be essential to secure access and actions based on user roles.

### Invoice Generation Assumptions and Proration Logic

#### Scenarios for Mid-Cycle Plan Changes
The application assumes four main scenarios for mid-cycle subscription plan changes:
1. **Monthly to Monthly Plan**: No change in billing date, proration applied in the same invoice.
2. **Monthly to Yearly Plan**: No change in billing date, proration applied in the same invoice.
3. **Yearly to Yearly Plan**: No change in billing date, proration applied in the same invoice.
4. **Yearly to Monthly Plan**: The billing date will shift to an earlier date. The current billing date needs to be updated to the new plan's billing date before applying proration. This scenario is specifically handled in the plan assignment logic.

### Payment Service

#### Invoice Payment Processing
The payment service marks invoices as paid upon receiving the payment. Currently, payment processing is assumed to be infallible; however, in a real-world scenario, payments might fail due to issues like payment provider timeouts. Such failures would necessitate retries, which can be managed by storing payment attempts in a KV store with a retry counter.

### Notification Service

#### Email Notifications with SendGrid
The notification service, which is configured to use SendGrid, is currently a skeleton implementation. In a fully-featured application, this service would send emails to customers upon invoice generation, successful payments, and failed payments. The email addresses would also need to be verified at the time of customer registration to ensure successful email delivery.

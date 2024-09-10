import { Payment } from "../models/payment";
import { PaymentService } from "../services/paymentService";
import { createErrorResponse } from "../utils/responses";
import { isHttpError } from "../utils/httpError";
import { createSuccessResponse } from "../utils/responses";

const paymentService = new PaymentService();

export async function handleProcessPayment(
  request: Request
): Promise<Response> {
  const paymentData: Omit<Payment, "id" | "paymentDate"> = await request.json();
  const payment = await paymentService.processPayment(paymentData);
  if (isHttpError(payment)) {
    return createErrorResponse(payment.message, payment.statusCode ?? 400);
  }
  return createSuccessResponse(payment, 200);
}

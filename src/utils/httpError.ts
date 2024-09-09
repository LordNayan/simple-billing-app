export interface HttpError extends Error {
  statusCode: number;
}

export function createHttpError(
  message: string,
  statusCode: number,
  name = "HttpError"
): HttpError {
  const error = new Error(message) as HttpError;
  error.name = name;
  error.statusCode = statusCode;
  return error;
}

export function isHttpError(object: any): object is HttpError {
  return (
    object && "statusCode" in object && typeof object.statusCode === "number"
  );
}
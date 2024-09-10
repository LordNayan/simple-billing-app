const NO_BODY_STATUSES = new Set([101, 204, 205, 304]);

export function createSuccessResponse(
  data: any,
  status: number = 200
): Response {
  let options = {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  };

  if (NO_BODY_STATUSES.has(status)) {
    return new Response(null, options);
  } else {
    return new Response(
      JSON.stringify({
        success: true,
        data,
      }),
      options
    );
  }
}

export function createErrorResponse(message: string, status: number): Response {
  return new Response(
    JSON.stringify({
      error: true,
      message,
    }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
}
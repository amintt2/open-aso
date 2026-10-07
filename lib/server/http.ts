import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { runRequest } from "./request-context";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function route<Ctx = unknown>(
  handler: (req: Request, ctx: Ctx) => Promise<Response> | Response,
) {
  return async (req: Request, ctx: Ctx) => {
    try {
      return await runRequest(() => handler(req, ctx));
    } catch (error) {
      if (error instanceof HttpError)
        return NextResponse.json({ error: error.message }, { status: error.status });
      if (error instanceof ZodError)
        return NextResponse.json(
          { error: "Invalid request", issues: error.issues },
          { status: 400 },
        );
      console.error(error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unexpected error" },
        { status: 500 },
      );
    }
  };
}

export async function body<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const raw = await req.json().catch(() => {
    throw new HttpError(400, "Body must be JSON");
  });
  return schema.parse(raw);
}

export async function idParam(params: Promise<Record<string, string>>, name = "id") {
  const value = Number((await params)[name]);
  if (!Number.isInteger(value) || value <= 0) throw new HttpError(400, `Invalid ${name}`);
  return value;
}

import { NextResponse } from "next/server";
import { requireMcpToken } from "@/lib/auth";
import {
  parseCareActionText,
  runCareAction,
  type CareAction,
} from "@/lib/alexa-care";
import { getDoorSensePending } from "@/lib/doorsense-server";

export const dynamic = "force-dynamic";

const noStore = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, authorization, mcp-session-id",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

/**
 * Minimal MCP (JSON-RPC) surface for Alexa+ MCP Toolkit / Inspector.
 * Tools map to the same CareSignal actions as the Alexa Skill.
 *
 * Hackathon note: Alexa+ production needs OAuth + Private Preview.
 * This endpoint is callable over HTTPS tunnel for demo/introspection.
 */

const TOOLS = [
  {
    name: "caresignal_im_okay",
    description:
      "Care receiver check-in: Mom says she is okay. Family sees it on CareSignal.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "caresignal_log_medicine",
    description: "Log that the care receiver took their medicine.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "caresignal_log_walk",
    description: "Log that the care receiver went for a walk.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "caresignal_door_status",
    description: "Check if DoorSense has a pending doorbell / visitor prompt.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "caresignal_door_respond",
    description:
      "Respond to DoorSense: expecting, tell_caregiver, need_help, or dismiss. Use when the resident answers the door by voice on Alexa.",
    inputSchema: {
      type: "object",
      properties: {
        choice: {
          type: "string",
          enum: ["expecting", "tell_caregiver", "need_help", "dismiss"],
          description: "DoorSense choice",
        },
        utterance: {
          type: "string",
          description: "Optional free text to parse if choice omitted",
        },
      },
      additionalProperties: false,
    },
  },
] as const;

type JsonRpc = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

function rpcResult(id: string | number | null | undefined, result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function rpcError(
  id: string | number | null | undefined,
  code: number,
  message: string,
) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

function toolText(text: string, structured?: unknown) {
  return {
    content: [{ type: "text", text }],
    structuredContent: structured,
  };
}

function runTool(
  name: string,
  args: Record<string, unknown>,
): ReturnType<typeof toolText> {
  const map: Record<string, CareAction> = {
    caresignal_im_okay: "im_okay",
    caresignal_log_medicine: "medicine",
    caresignal_log_walk: "walk",
    caresignal_door_status: "door_status",
  };

  if (name === "caresignal_door_respond") {
    let choice = args.choice as CareAction | undefined;
    if (
      choice !== "expecting" &&
      choice !== "tell_caregiver" &&
      choice !== "need_help" &&
      choice !== "dismiss"
    ) {
      const uttered = String(args.utterance ?? "");
      const parsed = parseCareActionText(uttered);
      if (
        parsed === "expecting" ||
        parsed === "tell_caregiver" ||
        parsed === "need_help" ||
        parsed === "dismiss"
      ) {
        choice = parsed;
      }
    }
    if (!choice) {
      return toolText(
        "Need a DoorSense choice: expecting, tell_caregiver, need_help, or dismiss.",
      );
    }
    const result = runCareAction(choice, "MCP");
    return toolText(result.speech, result);
  }

  const action = map[name];
  if (!action) {
    return toolText(`Unknown tool: ${name}`);
  }
  const result = runCareAction(action, "MCP");
  return toolText(result.speech, result);
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: noStore });
}

export async function GET(req: Request) {
  const authError = requireMcpToken(req);
  if (authError) return authError;
  return NextResponse.json(
    {
      name: "CareSignal MCP",
      transport: "streamable-http",
      tools: TOOLS.map((t) => t.name),
      doorPending: getDoorSensePending(),
      note: "POST JSON-RPC (initialize | tools/list | tools/call). Alexa+ add-on points here after tunnel HTTPS.",
    },
    { headers: noStore },
  );
}

export async function POST(req: Request) {
  const authError = requireMcpToken(req);
  if (authError) return authError;
  let body: JsonRpc = {};
  try {
    body = (await req.json()) as JsonRpc;
  } catch {
    return NextResponse.json(
      rpcError(null, -32700, "Parse error"),
      { status: 400, headers: noStore },
    );
  }

  const id = body.id;
  const method = body.method ?? "";

  if (method === "initialize") {
    return NextResponse.json(
      rpcResult(id, {
        protocolVersion: "2025-03-26",
        capabilities: { tools: {} },
        serverInfo: { name: "caresignal", version: "0.1.0" },
      }),
      { headers: noStore },
    );
  }

  if (method === "notifications/initialized" || method === "ping") {
    return NextResponse.json(rpcResult(id, {}), { headers: noStore });
  }

  if (method === "tools/list") {
    return NextResponse.json(
      rpcResult(id, { tools: TOOLS }),
      { headers: noStore },
    );
  }

  if (method === "tools/call") {
    const params = (body.params ?? {}) as {
      name?: string;
      arguments?: Record<string, unknown>;
    };
    const name = params.name ?? "";
    const args = params.arguments ?? {};
    if (!TOOLS.some((t) => t.name === name)) {
      return NextResponse.json(
        rpcError(id, -32602, `Unknown tool: ${name}`),
        { headers: noStore },
      );
    }
    return NextResponse.json(
      rpcResult(id, runTool(name, args)),
      { headers: noStore },
    );
  }

  return NextResponse.json(
    rpcError(id, -32601, `Method not found: ${method}`),
    { headers: noStore },
  );
}

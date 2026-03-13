import { verifyKey } from "discord-interactions";
import { waitUntil } from "@vercel/functions";
import { InteractionType, InteractionResponseType, MessageFlags } from "../lib/constants.js";
import {
  handleLatest,
  handleMovieSelect,
  handlePing,
  handleSearch,
  handleSetChannel,
  handleStatus,
} from "../lib/commands.js";
import { jsonError, methodNotAllowed, serverMisconfigured, unauthorized } from "../lib/apiResponses.js";
import { logApiError, logApiHit, logApiOk } from "../lib/requestLog.js";

export const config = { api: { bodyParser: false } };

const commandHandlers = {
  ping: (payload, options, res) => handlePing(res),
  setchannel: (payload, options, res) => handleSetChannel(payload, options, res),
  status: (payload, options, res) => handleStatus(payload, res),
  search: (payload, options, res) => handleSearch(payload, options, res, waitUntil),
  latest: (payload, options, res) => handleLatest(payload, res, waitUntil),
};

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function parseJsonBody(rawBody) {
  try {
    return JSON.parse(rawBody);
  } catch {
    return null;
  }
}

function componentErrorResponse(message) {
  return {
    type: InteractionResponseType.UPDATE_MESSAGE,
    data: {
      flags: MessageFlags.EPHEMERAL,
      content: message,
      components: [],
    },
  };
}

export default async function handler(req, res) {
  const reqLogger = logApiHit("interactive", req);

  if (req.method !== "POST") {
    return methodNotAllowed(reqLogger, res, logApiOk, "POST");
  }

  if (!process.env.DISCORD_PUBLIC_KEY) {
    return serverMisconfigured(reqLogger, res, logApiError);
  }

  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch (error) {
    logApiError(reqLogger, error, { status: 400, reason: "body_read_failed" });
    return jsonError(res, 400, "invalid_body");
  }

  const isValid = await verifyKey(
    rawBody,
    req.headers["x-signature-ed25519"],
    req.headers["x-signature-timestamp"],
    process.env.DISCORD_PUBLIC_KEY,
  );

  if (!isValid) {
    return unauthorized(reqLogger, res, logApiOk, "invalid_signature");
  }

  const payload = parseJsonBody(rawBody);
  if (!payload) {
    logApiOk(reqLogger, { status: 400, reason: "invalid_json" });
    return jsonError(res, 400, "invalid_json");
  }

  if (payload.type === InteractionType.PING) {
    logApiOk(reqLogger, { status: 200, interactionType: payload.type });
    return res.json({ type: InteractionResponseType.PONG });
  }

  if (payload.type === InteractionType.MESSAGE_COMPONENT) {
    if (payload.data?.custom_id !== "movie_select") {
      logApiOk(reqLogger, { status: 400, reason: "unknown_component" });
      return jsonError(res, 400, "Unknown component");
    }

    try {
      logApiOk(reqLogger, { status: 200, event: "movie_select" });
      return await handleMovieSelect(payload, res);
    } catch (error) {
      logApiError(reqLogger, error, { status: 200, event: "movie_select_error" });
      return res.json(componentErrorResponse(`Gagal buka detail film: ${error.message}`));
    }
  }

  if (payload.type !== InteractionType.APPLICATION_COMMAND) {
    logApiOk(reqLogger, { status: 400, reason: "unsupported_interaction_type" });
    return jsonError(res, 400, "Unsupported interaction type");
  }

  const command = payload.data?.name;
  const options = payload.data?.options ?? [];
  const handlerFn = commandHandlers[command];

  if (!handlerFn) {
    logApiOk(reqLogger, { status: 400, reason: "unknown_command", command });
    return jsonError(res, 400, "Unknown command");
  }

  logApiOk(reqLogger, { status: 200, command });
  return handlerFn(payload, options, res);
}

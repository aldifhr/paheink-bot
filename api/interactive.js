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
import { logApiError, logApiHit, logApiOk } from "../lib/requestLog.js";

export const config = { api: { bodyParser: false } };

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

export default async function handler(req, res) {
  const reqLogger = logApiHit("interactive", req);

  if (req.method !== "POST") {
    logApiOk(reqLogger, { status: 405 });
    return res.status(405).end();
  }

  if (!process.env.DISCORD_PUBLIC_KEY) {
    logApiError(reqLogger, new Error("Missing DISCORD_PUBLIC_KEY"), { status: 500 });
    return res.status(500).json({ error: "misconfigured_server" });
  }

  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch (error) {
    logApiError(reqLogger, error, { status: 400, reason: "body_read_failed" });
    return res.status(400).json({ error: "invalid_body" });
  }

  const isValid = await verifyKey(
    rawBody,
    req.headers["x-signature-ed25519"],
    req.headers["x-signature-timestamp"],
    process.env.DISCORD_PUBLIC_KEY,
  );

  if (!isValid) {
    logApiOk(reqLogger, { status: 401, reason: "invalid_signature" });
    return res.status(401).end("invalid request signature");
  }

  const payload = parseJsonBody(rawBody);
  if (!payload) {
    logApiOk(reqLogger, { status: 400, reason: "invalid_json" });
    return res.status(400).json({ error: "invalid_json" });
  }

  if (payload.type === InteractionType.PING) {
    logApiOk(reqLogger, { status: 200, interactionType: payload.type });
    return res.json({ type: InteractionResponseType.PONG });
  }

  if (payload.type === InteractionType.MESSAGE_COMPONENT) {
    if (payload.data?.custom_id === "movie_select") {
      try {
        logApiOk(reqLogger, { status: 200, event: "movie_select" });
        return await handleMovieSelect(payload, res);
      } catch (error) {
        logApiError(reqLogger, error, { status: 200, event: "movie_select_error" });
        return res.json({
          type: InteractionResponseType.UPDATE_MESSAGE,
          data: {
            flags: MessageFlags.EPHEMERAL,
            content: `Gagal buka detail film: ${error.message}`,
            components: [],
          },
        });
      }
    }

    logApiOk(reqLogger, { status: 400, reason: "unknown_component" });
    return res.status(400).json({ error: "Unknown component" });
  }

  if (payload.type !== InteractionType.APPLICATION_COMMAND) {
    logApiOk(reqLogger, { status: 400, reason: "unsupported_interaction_type" });
    return res.status(400).json({ error: "Unsupported interaction type" });
  }

  const command = payload.data?.name;
  const options = payload.data?.options ?? [];

  if (command === "ping") {
    logApiOk(reqLogger, { status: 200, command });
    return handlePing(res);
  }

  if (command === "setchannel") {
    logApiOk(reqLogger, { status: 200, command });
    return handleSetChannel(payload, options, res);
  }

  if (command === "status") {
    logApiOk(reqLogger, { status: 200, command });
    return handleStatus(payload, res);
  }

  if (command === "search") {
    logApiOk(reqLogger, { status: 200, command });
    return handleSearch(payload, options, res, waitUntil);
  }

  if (command === "latest") {
    logApiOk(reqLogger, { status: 200, command });
    return handleLatest(payload, res, waitUntil);
  }

  logApiOk(reqLogger, { status: 400, reason: "unknown_command", command });
  return res.status(400).json({ error: "Unknown command" });
}

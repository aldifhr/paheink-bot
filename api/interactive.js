import { waitUntil } from "@vercel/functions";
import { InteractionType, InteractionResponseType, MessageFlags } from "../lib/constants.js";
import { verifyDiscordRequest } from "../lib/verifyDiscord.js";
import {
  handleLatest,
  handleMovieSelect,
  handlePing,
  handleSearch,
  handleSetChannel,
  handleStatus,
} from "../lib/commands.js";

export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).end();
  }

  const rawBody = await getRawBody(req);
  const isValid = verifyDiscordRequest({
    body: rawBody,
    signature: req.headers["x-signature-ed25519"],
    timestamp: req.headers["x-signature-timestamp"],
    publicKey: process.env.DISCORD_PUBLIC_KEY,
  });

  if (!isValid) {
    return res.status(401).end("invalid request signature");
  }

  const payload = JSON.parse(rawBody);

  if (payload.type === InteractionType.PING) {
    return res.json({ type: InteractionResponseType.PONG });
  }

  if (payload.type === InteractionType.MESSAGE_COMPONENT) {
    if (payload.data?.custom_id === "movie_select") {
      try {
        return await handleMovieSelect(payload, res);
      } catch (error) {
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

    return res.status(400).json({ error: "Unknown component" });
  }

  if (payload.type !== InteractionType.APPLICATION_COMMAND) {
    return res.status(400).json({ error: "Unsupported interaction type" });
  }

  const command = payload.data?.name;
  const options = payload.data?.options ?? [];

  if (command === "ping") {
    return handlePing(res);
  }

  if (command === "setchannel") {
    return handleSetChannel(payload, options, res);
  }

  if (command === "status") {
    return handleStatus(payload, res);
  }

  if (command === "search") {
    return handleSearch(payload, options, res, waitUntil);
  }

  if (command === "latest") {
    return handleLatest(payload, res, waitUntil);
  }

  return res.status(400).json({ error: "Unknown command" });
}

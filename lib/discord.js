import process from "node:process";
import { fetchWithRetry } from "./httpClient.js";

export async function editInteractionResponse(token, data) {
  const appId = process.env.DISCORD_APPLICATION_ID;
  const botToken = process.env.DISCORD_BOT_TOKEN;

  if (!appId || !botToken) {
    throw new Error("Missing Discord environment variables");
  }

  await fetchWithRetry(
    `https://discord.com/api/v10/webhooks/${appId}/${token}/messages/@original`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    },
    { retries: 3, baseDelayMs: 300, maxDelayMs: 4000 },
  );
}

export async function sendChannelMessage(channelId, data) {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    throw new Error("Missing DISCORD_BOT_TOKEN");
  }

  const response = await fetchWithRetry(
    `https://discord.com/api/v10/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    },
    { retries: 3, baseDelayMs: 350, maxDelayMs: 5000 },
  );

  return response.json();
}

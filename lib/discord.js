import process from "node:process";
import { fetchWithRetry } from "./httpClient.js";

function requireDiscordEnv(...names) {
  const values = {};

  for (const name of names) {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Missing ${name}`);
    }
    values[name] = value;
  }

  return values;
}

async function discordRequest(pathname, { method, body, retries, baseDelayMs, maxDelayMs }) {
  const { DISCORD_BOT_TOKEN: botToken } = requireDiscordEnv("DISCORD_BOT_TOKEN");

  return fetchWithRetry(
    `https://discord.com/api/v10${pathname}`,
    {
      method,
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
    { retries, baseDelayMs, maxDelayMs },
  );
}

export async function editInteractionResponse(token, data) {
  const { DISCORD_APPLICATION_ID: appId } = requireDiscordEnv("DISCORD_APPLICATION_ID");

  await discordRequest(`/webhooks/${appId}/${token}/messages/@original`, {
    method: "PATCH",
    body: data,
    retries: 3,
    baseDelayMs: 300,
    maxDelayMs: 4000,
  });
}

export async function sendChannelMessage(channelId, data) {
  const response = await discordRequest(`/channels/${channelId}/messages`, {
    method: "POST",
    body: data,
    retries: 3,
    baseDelayMs: 350,
    maxDelayMs: 5000,
  });

  return response.json();
}

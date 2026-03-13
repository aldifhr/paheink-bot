import "dotenv/config";
import process from "node:process";

const APPLICATION_COMMAND_OPTION_TYPE = {
  STRING: 3,
  CHANNEL: 7,
};

const GUILD_TEXT_CHANNEL = 0;
const DISCORD_API_BASE = "https://discord.com/api/v10";

function buildCommands() {
  return [
    {
      name: "ping",
      description: "Cek status bot",
    },
    {
      name: "setchannel",
      description: "Set channel notifikasi film terbaru",
      options: [
        {
          name: "channel",
          description: "Channel tujuan notifikasi",
          type: APPLICATION_COMMAND_OPTION_TYPE.CHANNEL,
          required: true,
          channel_types: [GUILD_TEXT_CHANNEL],
        },
      ],
    },
    {
      name: "search",
      description: "Cari film dari pahe.ink",
      options: [
        {
          name: "query",
          description: "Judul film",
          type: APPLICATION_COMMAND_OPTION_TYPE.STRING,
          required: true,
        },
      ],
    },
    {
      name: "latest",
      description: "Ambil film terbaru dari pahe.ink",
    },
    {
      name: "status",
      description: "Lihat status notifikasi channel saat ini",
    },
  ];
}

function requireEnv(...names) {
  const values = {};

  for (const name of names) {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Missing environment variable: ${name}`);
    }
    values[name] = value;
  }

  return values;
}

async function discordRequest(pathname, init) {
  const response = await fetch(`${DISCORD_API_BASE}${pathname}`, init);
  if (response.ok) {
    return response.json();
  }

  const text = await response.text();
  throw new Error(text || `Discord API request failed: ${response.status}`);
}

async function registerCommands(commands) {
  const { DISCORD_APPLICATION_ID: appId, DISCORD_BOT_TOKEN: botToken } = requireEnv(
    "DISCORD_APPLICATION_ID",
    "DISCORD_BOT_TOKEN",
  );

  return discordRequest(`/applications/${appId}/commands`, {
    method: "PUT",
    headers: {
      Authorization: `Bot ${botToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });
}

async function main() {
  const commands = buildCommands();
  const data = await registerCommands(commands);

  console.log(`Registered ${data.length} commands`);
  for (const command of data) {
    console.log(`/${command.name}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

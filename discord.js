import process from "node:process";
import { loadEnvFile } from "./lib/env.js";

loadEnvFile();

const commands = [
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
        type: 7,
        required: true,
        channel_types: [0],
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
        type: 3,
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

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

async function main() {
  const appId = requireEnv("DISCORD_APPLICATION_ID");
  const botToken = requireEnv("DISCORD_BOT_TOKEN");

  const response = await fetch(
    `https://discord.com/api/v10/applications/${appId}/commands`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bot ${botToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
    },
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = await response.json();
  console.log(`Registered ${data.length} commands`);
  for (const command of data) {
    console.log(`/${command.name}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});

const { Client, GatewayIntentBits } = require("discord.js");
const config = require("./config.js");
const fs = require("fs");
const path = require("path");
const { initializePlayer } = require("./player");
const { connectToDatabase } = require("./mongodb");
const colors = require("./UI/colors/colors");
require("dotenv").config();

const client = new Client({
  intents: Object.keys(GatewayIntentBits).map((a) => GatewayIntentBits[a]),
});

client.config = config;
initializePlayer(client);

client.on("ready", () => {
  console.log(`${colors.cyan}[ SYSTEM ]${colors.reset} ${colors.green}Client logged as ${colors.yellow}${client.user.tag}${colors.reset}`);
  console.log(`${colors.cyan}[ MUSIC ]${colors.reset} ${colors.green}Riffy Music System Ready 🎵${colors.reset}`);
  console.log(`${colors.cyan}[ TIME ]${colors.reset} ${colors.gray}${new Date().toISOString().replace("T", " ").split(".")[0]}${colors.reset}`);
  client.riffy.init(client.user.id);
});

fs.readdir("./events", (_err, files) => {
  files.forEach((file) => {
    if (!file.endsWith(".js")) return;
    const event = require(`./events/${file}`);
    const eventName = file.split(".")[0];
    client.on(eventName, event.bind(null, client));
    delete require.cache[require.resolve(`./events/${file}`)];
  });
});

client.commands = [];
fs.readdir(config.commandsDir, (err, files) => {
  if (err) throw err;
  files.forEach(async (f) => {
    try {
      if (f.endsWith(".js")) {
        const props = require(`${config.commandsDir}/${f}`);
        client.commands.push({
          name: props.name,
          description: props.description,
          options: props.options,
        });
      }
    } catch (err) {
      console.log(err);
    }
  });
});

client.on("raw", (d) => {
  const { GatewayDispatchEvents } = require("discord.js");
  if (![GatewayDispatchEvents.VoiceStateUpdate, GatewayDispatchEvents.VoiceServerUpdate].includes(d.t)) return;
  client.riffy.updateVoiceState(d);
});

// ✅ Safe login with retry to avoid Discord rate limits
const MAX_RETRIES = 10;
let retries = 0;

async function safeLogin() {
  try {
    await client.login(config.TOKEN || process.env.TOKEN);
    console.log('\n' + '─'.repeat(40));
    console.log(`${colors.magenta}${colors.bright}🔐 TOKEN VERIFICATION${colors.reset}`);
    console.log('─'.repeat(40));
    console.log(`${colors.cyan}[ TOKEN ]${colors.reset} ${colors.green}Authenticated as ${colors.yellow}${client.user?.tag}${colors.reset}`);
  } catch (e) {
    retries++;
    const delay = Math.min(retries * 10000, 60000); // 10s, 20s... up to 60s max
    console.log('\n' + '─'.repeat(40));
    console.log(`${colors.magenta}${colors.bright}🔐 TOKEN VERIFICATION${colors.reset}`);
    console.log('─'.repeat(40));
    console.log(`${colors.cyan}[ TOKEN ]${colors.reset} ${colors.red}Authentication Failed ❌ (Retry in ${delay / 1000}s)${colors.reset}`);
    console.log(`${colors.gray}Error: ${e.message}${colors.reset}`);

    if (retries < MAX_RETRIES) {
      setTimeout(safeLogin, delay);
    } else {
      console.log(`${colors.red}❌ Too many failed login attempts. Giving up.${colors.reset}`);
    }
  }
}

safeLogin(); // 🔑 Start login with retry logic

// MongoDB Connection
connectToDatabase()
  .then(() => {
    console.log('\n' + '─'.repeat(40));
    console.log(`${colors.magenta}${colors.bright}🕸️  DATABASE STATUS${colors.reset}`);
    console.log('─'.repeat(40));
    console.log(`${colors.cyan}[ DATABASE ]${colors.reset} ${colors.green}MongoDB Online ✅${colors.reset}`);
  })
  .catch((err) => {
    console.log('\n' + '─'.repeat(40));
    console.log(`${colors.magenta}${colors.bright}🕸️  DATABASE STATUS${colors.reset}`);
    console.log('─'.repeat(40));
    console.log(`${colors.cyan}[ DATABASE ]${colors.reset} ${colors.red}Connection Failed ❌${colors.reset}`);
    console.log(`${colors.gray}Error: ${err.message}${colors.reset}`);
  });

// Optional web server (for keep-alive or status monitoring)
const express = require("express");
const app = express();
const port = 3000;

app.get("/", (req, res) => {
  const imagePath = path.join(__dirname, "index.html");
  res.sendFile(imagePath);
});

app.listen(port, () => {
  console.log('\n' + '─'.repeat(40));
  console.log(`${colors.magenta}${colors.bright}🌐 SERVER STATUS${colors.reset}`);
  console.log('─'.repeat(40));
  console.log(`${colors.cyan}[ SERVER ]${colors.reset} ${colors.green}Online ✅${colors.reset}`);
  console.log(`${colors.cyan}[ PORT ]${colors.reset} ${colors.yellow}http://localhost:${port}${colors.reset}`);
  console.log(`${colors.cyan}[ TIME ]${colors.reset} ${colors.gray}${new Date().toISOString().replace("T", " ").split(".")[0]}${colors.reset}`);
  console.log(`${colors.cyan}[ USER ]${colors.reset} ${colors.yellow}GlaceYT${colors.reset}`);
});

const { Client, GatewayIntentBits } = require("discord.js");
const config = require("./config.js");
const fs = require("fs");
const path = require('path');
const { initializePlayer } = require('./player');
const { connectToDatabase } = require('./mongodb');
const colors = require('./UI/colors/colors');
require('dotenv').config();
const axios = require('axios');

// Validate environment variables for Shapes API
if (!process.env.SHAPESINC_API_KEY) {
  throw new Error('SHAPESINC_API_KEY is not defined in .env file');
}
if (!process.env.DISCORD_TOKEN) {
  throw new Error('DISCORD_TOKEN is not defined in .env file');
}
if (!process.env.SHAPESINC_SHAPE_USERNAME) {
  throw new Error('SHAPESINC_SHAPE_USERNAME is not defined in .env file');
}

// Configuration
const token = process.env.DISCORD_TOKEN;
const apiKey = process.env.SHAPESINC_API_KEY;
const SHAPES_USERNAME = process.env.SHAPESINC_SHAPE_USERNAME;

// Set up the Shapes API client using Axios
const shapesAPI = axios.create({
  baseURL: 'https://api.shapes.inc/v1',
  headers: {
    'Authorization': `Bearer ${apiKey}`
  }
});

const client = new Client({
  intents: Object.keys(GatewayIntentBits).map((a) => {
    return GatewayIntentBits[a];
  }),
});

client.config = config;
initializePlayer(client);

client.on("ready", () => {
    console.log(`${colors.cyan}[ SYSTEM ]${colors.reset} ${colors.green}Client logged as ${colors.yellow}${client.user.tag}${colors.reset}`);
    console.log(`${colors.cyan}[ MUSIC ]${colors.reset} ${colors.green}Riffy Music System Ready 🎵${colors.reset}`);
    console.log(`${colors.cyan}[ TIME ]${colors.reset} ${colors.gray}${new Date().toISOString().replace('T', ' ').split('.')[0]}${colors.reset}`);
    client.riffy.init(client.user.id);
});

fs.readdir("./events", (_err, files) => {
  files.forEach((file) => {
    if (!file.endsWith(".js")) return;
    const event = require(`./events/${file}`);
    let eventName = file.split(".")[0]; 
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
        let props = require(`${config.commandsDir}/${f}`);
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

client.login(config.TOKEN || process.env.TOKEN).catch((e) => {
  console.log('\n' + '─'.repeat(40));
  console.log(`${colors.magenta}${colors.bright}🔐 TOKEN VERIFICATION${colors.reset}`);
  console.log('─'.repeat(40));
  console.log(`${colors.cyan}[ TOKEN ]${colors.reset} ${colors.red}Authentication Failed ❌${colors.reset}`);
  console.log(`${colors.gray}Error: Turn On Intents or Reset New Token${colors.reset}`);
});

connectToDatabase().then(() => {
  console.log('\n' + '─'.repeat(40));
  console.log(`${colors.magenta}${colors.bright}🕸️  DATABASE STATUS${colors.reset}`);
  console.log('─'.repeat(40));
  console.log(`${colors.cyan}[ DATABASE ]${colors.reset} ${colors.green}MongoDB Online ✅${colors.reset}`);
}).catch((err) => {
  console.log('\n' + '─'.repeat(40));
  console.log(`${colors.magenta}${colors.bright}🕸️  DATABASE STATUS${colors.reset}`);
  console.log('─'.repeat(40));
  console.log(`${colors.cyan}[ DATABASE ]${colors.reset} ${colors.red}Connection Failed ❌${colors.reset}`);
  console.log(`${colors.gray}Error: ${err.message}${colors.reset}`);
});

// Express Server
const express = require("express");
const app = express();
const port = 3000;
app.get('/', (req, res) => {
    const imagePath = path.join(__dirname, 'index.html');
    res.sendFile(imagePath);
});

app.listen(port, () => {
    console.log('\n' + '─'.repeat(40));
    console.log(`${colors.magenta}${colors.bright}🌐 SERVER STATUS${colors.reset}`);
    console.log('─'.repeat(40));
    console.log(`${colors.cyan}[ SERVER ]${colors.reset} ${colors.green}Online ✅${colors.reset}`);
    console.log(`${colors.cyan}[ PORT ]${colors.reset} ${colors.yellow}http://localhost:${port}${colors.reset}`);
    console.log(`${colors.cyan}[ TIME ]${colors.reset} ${colors.gray}${new Date().toISOString().replace('T', ' ').split('.')[0]}${colors.reset}`);
    console.log(`${colors.cyan}[ USER ]${colors.reset} ${colors.yellow}GlaceYT${colors.reset}`);
});

// Helper function to send a message to a channel
async function sendMessage(channel, content) {
  try {
    const MAX_LENGTH = 1900; // Discord's message length limit with buffer
    if (content.length <= MAX_LENGTH) {
      await channel.send(content);
    } else {
      const chunks = [];
      let currentChunk = '';
      const paragraphs = content.split('\n\n'); 

      for (const paragraph of paragraphs) {
        if (currentChunk.length + paragraph.length + 2 <= MAX_LENGTH) {
          currentChunk += (currentChunk ? '\n\n' : '') + paragraph;
        } else {
          if (currentChunk) chunks.push(currentChunk);
          currentChunk = paragraph;
          while (currentChunk.length > MAX_LENGTH) {
            let splitPoint = currentChunk.lastIndexOf(' ', MAX_LENGTH);
            if (splitPoint === -1) splitPoint = MAX_LENGTH;
            chunks.push(currentChunk.slice(0, splitPoint));
            currentChunk = currentChunk.slice(splitPoint).trim();
          }
        }
      }
      if (currentChunk) chunks.push(currentChunk);

      for (const chunk of chunks) {
        await channel.send(chunk);
      }
    }
  } catch (error) {
    console.error('Error sending message:', error.message);
  }
}

// Main bot function for chat interactions
client.on('messageCreate', async (message) => {
  try {
    // Ignore bot's own messages
    if (message.author.bot) return;

    console.log('Message received:', message.content);

    const isMentioned = message.content.includes(`<@${client.user.id}>`);
    const isDM = message.channel.type === 'DM';

    if (isMentioned || isDM) {
      console.log(isDM ? 'Message is in DM' : 'Bot was mentioned!');

      let content = message.content;
      if (isMentioned) {
        content = content.replace(new RegExp(`<@${client.user.id}>`, 'g'), '').trim();
      }

      let apiMessages = [{ role: "user", content }];
      const response = await shapesAPI.post('/chat/completions', {
        model: `shapesinc/${SHAPES_USERNAME}`,
        messages: apiMessages,
        temperature: 0.7,
        max_tokens: 1000
      });

      const aiResponse = response.data.choices[0].message.content;
      console.log('AI Response:', aiResponse);

      await sendMessage(message.channel, aiResponse);
    }
  } catch (error) {
    console.error('Error processing message:', error.message);
    await sendMessage(message.channel, "Sorry, I encountered an error while processing your request.");
  }
});

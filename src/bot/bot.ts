import dotenv from 'dotenv';
import { Client, Collection, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { db } from './database/db';
import { scanMessageForCodes } from './handlers/codeScanner';
import { codeManager } from './database/codeManager';
import { userManager } from './database/userManager';
import IdleChampionsApi from './api/idleChampionsApi';
import { initDebugLogger } from './utils/debugLogger';
import logger from './utils/logger';
import { apiRequestLogger } from './utils/apiRequestLogger';
import fs from 'fs';
import path from 'path';

// CRITICAL: Disable certificate validation for Idle Champions API
// Their server has an expired certificate - this must be set BEFORE any HTTPS requests
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

dotenv.config();

const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.DISCORD_GUILD_ID;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

if (!TOKEN) {
  logger.error('DISCORD_TOKEN environment variable is not set');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

// Initialize command collection
(client as any).commands = new Collection();

// Load commands
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js') || file.endsWith('.ts'));

for (const file of commandFiles) {
  const filePath = path.join(commandsPath, file);
  delete require.cache[require.resolve(filePath)];
  const command = require(filePath);

  if (command.data && command.execute) {
    (client as any).commands.set(command.data.name, command);
    logger.debug(`Loaded command: ${command.data.name}`);
  }
}

// Event: Ready
client.on(Events.ClientReady, async () => {
  logger.info(`Logged in as ${client.user?.tag}`);

  // Initialize debug logging
  initDebugLogger();

  // Initialize API request logging
  apiRequestLogger.initialize();

  try {
    // Initialize database
    logger.info('Initializing database...');
    await db.initialize();
    logger.info('Database initialized');

    // Register slash commands
    logger.debug(`GUILD_ID from env: ${GUILD_ID}`);
    if (GUILD_ID) {
      logger.debug(`Fetching guild ${GUILD_ID}...`);
      const guild = await client.guilds.fetch(GUILD_ID);
      const commands = (client as any).commands.map((cmd: any) => cmd.data);
      logger.debug(`Setting ${commands.length} commands in guild...`);
      await guild.commands.set(commands);
      logger.info(`Registered ${commands.length} commands in guild ${GUILD_ID}`);
    } else {
      logger.debug('Setting global commands...');
      const commands = (client as any).commands.map((cmd: any) => cmd.data);
      await client.application?.commands.set(commands);
      logger.info(`Registered ${commands.length} global commands`);
    }
  } catch (error) {
    logger.error('Error on ready:', error);
  }
});

// Event: Interaction (slash commands)
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = (client as any).commands.get(interaction.commandName);
  if (!command) return;

  try {
    logger.debug(`Executing command: ${interaction.commandName} by ${interaction.user.tag}`);
    await command.execute(interaction);
  } catch (error) {
    logger.error(`Error executing command ${interaction.commandName}:`, error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: '❌ There was an error while executing this command!',
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await interaction.reply({
        content: '❌ There was an error while executing this command!',
        flags: MessageFlags.Ephemeral,
      });
    }
  }
});

// Event: Message (code scanning)
client.on(Events.MessageCreate, async (message) => {
  // Only scan in the specified channel if configured
  if (CHANNEL_ID && message.channelId !== CHANNEL_ID) {
    return;
  }

  try {
    const foundCodes = await scanMessageForCodes(message);

    if (foundCodes.length > 0) {
      logger.info(`Found ${foundCodes.length} codes in message from ${message.author.tag}`);

      for (const code of foundCodes) {
        // Try to redeem automatically if user is known
        const author = message.author;
        const hasCredentials = await userManager.hasCredentials(author.id);

        if (hasCredentials) {
          try {
            const credentials = await userManager.getCredentials(author.id);
            if (credentials) {
              let server = credentials.server;
              if (!server) {
                server = await IdleChampionsApi.getServer();
                if (!server) {
                  logger.error('Could not determine game server');
                  return;
                }
                await userManager.updateServer(author.id, server);
              }

              const response = await IdleChampionsApi.submitCode({
                server,
                code,
                user_id: credentials.userId,
                hash: credentials.userHash,
                instanceId: credentials.instanceId || '',
              });

              // Type guard: check if response has codeStatus (CodeSubmitResponse)
              if (response instanceof Object && 'codeStatus' in response) {
                const codeResponse = response as any;
                await codeManager.addRedeemedCode(
                  code,
                  author.id,
                  codeResponse.codeStatus.toString(),
                  codeResponse.lootDetail,
                );

                logger.info(`Auto-redeemed code ${code} for ${author.tag}`);

                // Send DM notification
                if (codeResponse.codeStatus === 0) {
                  // Success
                  await author.send(`✅ Code \`${code}\` redeemed successfully!`).catch(() => {});
                }
              }
            }
          } catch (error) {
            logger.error(`Error auto-redeeming code ${code}:`, error);
            await codeManager.addPendingCode(code);
          }
        } else {
          // Store as pending code
          await codeManager.addPendingCode(code);
          logger.debug(`Stored pending code: ${code}`);
        }
      }
    }
  } catch (error) {
    logger.error('Error processing message:', error);
  }
});

// Login
client.login(TOKEN);

// Graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Shutting down...');
  apiRequestLogger.shutdown();
  await db.close();
  client.destroy();
  process.exit(0);
});

export default client;

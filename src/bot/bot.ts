import { Client, Collection, Events, GatewayIntentBits, MessageFlags } from 'discord.js';
import { initializeDatabase, closeDatabase } from './database/db';
import { scanMessageForCodes } from './handlers/codeScanner';
import { backfillChannelHistory } from './handlers/backfillHandler';
import { enqueueAutoRedeem, setDiscordClient } from './handlers/autoRedeemer';
import { codeManager } from './database/codeManager';
import { backfillManager } from './database/backfillManager';
import { userManager } from './database/userManager';
import { initDebugLogger } from './utils/debugLogger';
import logger from './utils/logger';
import { apiRequestLogger } from './utils/apiRequestLogger';
import * as backfillCommand from './commands/backfill';
import * as blacksmithCommand from './commands/blacksmith';
import * as deleteaccountCommand from './commands/deleteaccount';
import * as catchupCommand from './commands/catchup';
import * as codesCommand from './commands/codes';
import { buildCodesPage } from './commands/codes';
import * as autoredeemCommand from './commands/autoredeem';
import * as helpCommand from './commands/help';
import * as inventoryCommand from './commands/inventory';
import * as makepublicCommand from './commands/makepublic';
import * as notificationsCommand from './commands/notifications';
import * as openCommand from './commands/open';
import * as redeemCommand from './commands/redeem';
import * as setupCommand from './commands/setup';

// CRITICAL: Disable certificate validation for Idle Champions API
// Their server has an expired certificate - this must be set BEFORE any HTTPS requests
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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
setDiscordClient(client);

// Initialize command collection
(client as any).commands = new Collection();

// Load commands statically (required for bundled production builds)
const commands = [
  autoredeemCommand,
  backfillCommand,
  blacksmithCommand,
  catchupCommand,
  codesCommand,
  deleteaccountCommand,
  helpCommand,
  inventoryCommand,
  makepublicCommand,
  notificationsCommand,
  openCommand,
  redeemCommand,
  setupCommand,
];

for (const command of commands) {
  (client as any).commands.set(command.data.name, command);
  logger.debug(`Loaded command: ${command.data.name}`);
}

// Event: Ready
client.on(Events.ClientReady, async () => {
  logger.info(`Logged in as ${client.user?.tag}`);

  // Initialize debug logging
  initDebugLogger();

  // Initialize API request logging
  apiRequestLogger.initialize();

  try {
    initializeDatabase();
    await userManager.migratePlaintextCredentials();

    // Check if startup backfill should run
    const shouldBackfill = await backfillManager.shouldRunStartupBackfill();
    if (shouldBackfill && CHANNEL_ID) {
      logger.info('Running startup backfill...');
      try {
        const channel = await client.channels.fetch(CHANNEL_ID);
        if (channel) {
          const operationId = await backfillManager.startBackfill(client.user?.id || 'system');

          const stats = await backfillChannelHistory(channel, (message) => {
            logger.info(`[STARTUP BACKFILL] ${message}`);
          });

          await backfillManager.updateBackfill(
            operationId,
            stats.codesFound,
            stats.codesRedeemed,
            stats.errors.length === 0 ? 'completed' : 'failed'
          );

          logger.info(
            `Startup backfill completed: found=${stats.codesFound}, redeemed=${stats.codesRedeemed}`
          );
        } else {
          logger.warn('Startup backfill: Could not fetch channel');
        }
      } catch (backfillError) {
        logger.error('Error during startup backfill:', backfillError);
      }
    } else if (!shouldBackfill) {
      const lastBackfill = await backfillManager.getLastBackfill();
      logger.info(
        `Skipping startup backfill - last run was less than 6 hours ago at ${lastBackfill?.completedAt}`
      );
    } else {
      logger.info('Skipping startup backfill - DISCORD_CHANNEL_ID not configured');
    }

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
    const options = interaction.options.data
      .map((opt: any) => `${opt.name}=${opt.value}`)
      .join(' ');
    const cmdMsg = `[COMMAND] ${interaction.commandName} ${options || '(no args)'} from ${interaction.user.tag}`;

    logger.info(cmdMsg);

    const startTime = Date.now();
    await command.execute(interaction);
    const duration = Date.now() - startTime;

    const resultMsg = `[COMMAND] ${interaction.commandName} completed successfully in ${duration}ms`;
    logger.info(resultMsg);
  } catch (error) {
    const errorMsg = `[COMMAND] Error executing command ${interaction.commandName} from ${interaction.user.tag}`;
    logger.error(errorMsg, error);
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

// Event: Button interactions (e.g. /codes pagination)
client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;

  if (interaction.customId.startsWith('codes:')) {
    const parts = interaction.customId.split(':');
    const ownerId = parts[1];
    const page = parseInt(parts[2] ?? '0', 10);

    // Only the user who ran /codes can page through their results
    if (interaction.user.id !== ownerId) {
      await interaction.reply({
        content: '❌ These buttons are not for you.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      await interaction.deferUpdate();
      const { embeds, components } = await buildCodesPage(ownerId, page);
      await interaction.editReply({ embeds, components });
    } catch (error) {
      logger.error('[CODES] Button pagination error:', error);
      await interaction.editReply({
        content: '❌ Failed to load page.',
        embeds: [],
        components: [],
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

      // React to the message to signal the bot detected a code (fire-and-forget
      // so API latency / rate-limiting does not delay the redemption path).
      message.react('🎁').catch((err) => {
        logger.warn('Could not react to message (missing permissions?):', err);
      });

      // Deduplicate in case the same code appears multiple times in one message.
      const uniqueCodes = [...new Set(foundCodes)];

      // Persist all found codes to pending_codes in a single batch INSERT.
      // onConflictDoNothing gives at-most-once insert semantics and eliminates
      // the TOCTOU race of a pre-read snapshot under concurrent MessageCreate events.
      // Only newly inserted codes trigger DM notifications.
      const newCodes = await codeManager.addNewPendingCodes(uniqueCodes);

      // DM users who opted in for code-detection notifications (independent of autoredeem).
      // A single bulk query resolves per-recipient redeemed status, then a short delay
      // between sends avoids bursting Discord DM rate limits. The message author is
      // excluded since they can already see the code in the channel.
      // Note: users who have both dmOnCode and dmOnSuccess enabled will receive two
      // DMs per code — one here and one from autoRedeemer on successful redemption.
      if (newCodes.length > 0) {
        const dmIds = await userManager.getDiscordIdsWithDmOnCode();
        const recipientIds = dmIds.filter((id) => id !== message.author.id);
        if (recipientIds.length > 0) {
          void (async () => {
            try {
              const redeemedMap = await codeManager.getRedeemedCodesByUsers(newCodes, recipientIds);
              for (let i = 0; i < recipientIds.length; i++) {
                const id = recipientIds[i]!;
                try {
                  const alreadyRedeemed = redeemedMap.get(id) ?? new Set<string>();
                  const unredeemedCodes = newCodes.filter((c) => !alreadyRedeemed.has(c));
                  if (unredeemedCodes.length === 0) continue;
                  const codeList = unredeemedCodes.map((c) => `\`${c}\``).join(', ');
                  const label = `New code${unredeemedCodes.length > 1 ? 's' : ''} detected: ${codeList}`;
                  const u = await client.users.fetch(id);
                  await u.send(`🔔 ${label}`);
                } catch { /* DM delivery failure is non-critical */ }
                finally {
                  if (i < recipientIds.length - 1) {
                    await new Promise<void>((resolve) => setTimeout(resolve, 500));
                  }
                }
              }
            } catch (err) {
              logger.error('Unexpected error in code-detection DM fan-out:', err);
            }
          })();
        }
      }

      // Enqueue auto-redeem — serialized so overlapping MessageCreate events
      // never start concurrent redemption runs or bypass the throttle delay.
      enqueueAutoRedeem(uniqueCodes);
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
  await closeDatabase();
  client.destroy();
  process.exit(0);
});

export default client;

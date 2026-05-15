import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Display help information about the bot');

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('📖 Idle Code Redeemer Bot - Help')
      .setDescription('Automated code detection and redemption for Idle Champions')
      .addFields(
        {
          name: '⚙️ Setup',
          value:
            '`/setup user_id:<id> user_hash:<hash>`\nSave your Idle Champions credentials securely.',
          inline: false,
        },
        {
          name: '🎁 Redeem Code',
          value: '`/redeem code:<code>`\nManually redeem a code.',
          inline: false,
        },
        {
          name: '🔄 Catch Up',
          value: '`/catchup`\nRedeem all known valid codes you have not yet claimed (e.g. after joining the server).',
          inline: false,
        },
        {
          name: '🤖 Auto-Redeem',
          value: '`/autoredeem enabled:<on|off>`\nToggle automatic redemption of new codes when they appear in the channel.',
          inline: false,
        },
        {
          name: '📋 Code History',
          value: '`/codes [count:<count>]`\nView your redeemed codes history (last 10 by default).',
          inline: false,
        },
        {
          name: '💎 Share Code',
          value: '`/makepublic code:<code>`\nShare one of your redeemed codes with other users.',
          inline: false,
        },
        {
          name: '📦 Check Inventory',
          value: '`/inventory`\nView your chests, hero unlocks, and contracts.',
          inline: false,
        },
        {
          name: '🎲 Open Chests',
          value: '`/open chest_type:<type> count:<count>`\nOpen chests in bulk.',
          inline: false,
        },
        {
          name: '⚒️ Blacksmith',
          value:
            '`/blacksmith contract_type:<type> hero_id:<id> count:<count>`\nUpgrade your heroes using contracts.',
          inline: false,
        },
        {
          name: '🔔 Notifications',
          value:
            '`/notifications [dm_on_code:<true|false>] [dm_on_success:<true|false>] [dm_on_failure:<true|false>]`\nConfigure DM notifications: get alerted when codes are detected, redeemed, or fail.',
          inline: false,
        },
        {
          name: '⏮️ Backfill',
          value: '`/backfill [channel:<channel>]`\nRecover missed codes from message history (admin only).',
          inline: false,
        },
        {
          name: '🗑️ Delete Account',
          value:
            '`/deleteaccount`\nPermanently delete all your stored data (credentials, code history, audit log). Requires confirmation.',
          inline: false,
        }
      )
      .addFields(
        {
          name: '🤖 Automatic Code Detection',
          value:
            'The bot automatically scans the #combinations channel for new codes and redeems them for you (if you have set up credentials and auto-redeem is enabled).',
          inline: false,
        },
        {
          name: '🔐 Privacy & Security',
          value:
            'Your credentials are stored securely in a local database and are never shared or transmitted except to the official Idle Champions API.',
          inline: false,
        },
        {
          name: '📚 Getting Started',
          value:
            '1. Use `/setup` to save your credentials\n2. The bot will automatically redeem codes found in the channel\n3. Use `/catchup` to claim any codes you missed\n4. Use other commands to manage your inventory',
          inline: false,
        }
      )
      .setFooter({
        text: 'For more help, visit https://discord.gg/idlechampions',
      })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('[HELP COMMAND] Error:', error);
    await interaction.editReply({
      content: '❌ An error occurred while displaying help.',
    });
  }
}

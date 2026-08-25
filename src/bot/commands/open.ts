import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { userManager } from '../database/userManager';
import { auditManager } from '../database/auditManager';
import IdleChampionsApi, { ResponseStatus } from '../api/idleChampionsApi';
import { resolveGameSession } from './gameSession';
import { replyWithError } from '../utils/interactionReply';
import logger from '../utils/logger';


export const data = new SlashCommandBuilder()
  .setName('open')
  .setDescription('Open chests in Idle Champions')
  .addStringOption((option) =>
    option
      .setName('chest_type')
      .setDescription('Type of chest to open')
      .setRequired(true)
      .addChoices(
        { name: 'Copper', value: '1' },
        { name: 'Iron', value: '2' },
        { name: 'Steel', value: '3' },
        { name: 'Gold', value: '4' },
        { name: 'Sapphire', value: '5' },
        { name: 'Emerald', value: '6' },
        { name: 'Ruby', value: '7' },
        { name: 'Diamond', value: '8' },
        { name: 'Platinum', value: '9' }
      )
  )
  .addIntegerOption((option) =>
    option
      .setName('count')
      .setDescription('Number of chests to open (1-1000)')
      .setRequired(true)
      .setMinValue(1)
      .setMaxValue(1000)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  try {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Check if user has credentials
    const credentials = await userManager.getCredentials(interaction.user.id);
    if (!credentials) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ No Credentials Found')
        .setDescription('Please set up your Idle Champions credentials first using `/setup`');

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const chestTypeId = parseInt(interaction.options.getString('chest_type', true));
    const count = interaction.options.getInteger('count', true);

    const session = await resolveGameSession(interaction.user.id, credentials);
    if (!session.ok) {
      await replyWithError(interaction, session.title, session.description);
      return;
    }
    const { server, instanceId } = session;

    const chestName = getChestName(chestTypeId);

    // Show processing message
    const processingEmbed = new EmbedBuilder()
      .setColor(0xffaa00)
      .setTitle('⏳ Opening Chests...')
      .setDescription(`Opening ${count} ${chestName}(s)...`);

    await interaction.editReply({ embeds: [processingEmbed] });

    // Open chests
    const response = await IdleChampionsApi.openChests({
      server,
      user_id: credentials.userId,
      hash: credentials.userHash,
      chestTypeId: chestTypeId as any,
      count,
      instanceId,
    });

    // The API returns GenericResponse for network errors, non-2xx responses,
    // unparseable bodies and stale sessions. Check before claiming success:
    // reporting "Chests Opened Successfully" on a failure both misleads the user and writes an audit
    // entry for an operation that never happened.
    if (IdleChampionsApi.isGenericResponse(response)) {
      const reason =
        response.status === ResponseStatus.OutdatedInstanceId
          ? 'Your game session has expired. Open the game and try again.'
          : response.status === ResponseStatus.SwitchServer
            ? 'The game moved your account to another server. Please retry.'
            : response.status === ResponseStatus.InsuficcientCurrency
              ? 'You do not have enough currency for this action.'
              : 'The game server rejected the request. Please try again later.';

      logger.error(`[OPEN] openChests failed with status ${response.status}`);

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('❌ Could Not Open Chests')
            .setDescription(reason),
        ],
      });
      return;
    }

    // Log action (only after confirming the API actually did the work)
    await auditManager.logAction(interaction.user.id, 'CHESTS_OPENED', {
      chestType: chestName,
      count,
    });

    // Build response embed
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Chests Opened Successfully')
      .addFields({
        name: 'Chest Type',
        value: chestName,
        inline: true,
      })
      .addFields({
        name: 'Opened',
        value: count.toString(),
        inline: true,
      });

    // Add response data if available
    if (response instanceof Object && 'chests_remaining' in response) {
      const responseData = response as any;
      if (responseData.chests_remaining !== undefined) {
        embed.addFields({
          name: 'Remaining',
          value: responseData.chests_remaining.toString(),
          inline: true,
        });
      }
    }

    if (response instanceof Object && 'lootDetail' in response) {
      const openResponse = response as any;
      if (
        openResponse.lootDetail &&
        Array.isArray(openResponse.lootDetail) &&
        openResponse.lootDetail.length > 0
      ) {
        // Group loot by type for summary
        const lootSummary: { [key: string]: number } = {};
        for (const loot of openResponse.lootDetail) {
          const description = loot.description || JSON.stringify(loot);
          lootSummary[description] = (lootSummary[description] || 0) + 1;
        }

        const lootLines = Object.entries(lootSummary)
          .map(([item, amount]) => `• ${item}${amount > 1 ? ` x${amount}` : ''}`)
          .join('\n')
          .substring(0, 1024);

        embed.addFields({
          name: 'Equipment Found',
          value: lootLines || 'Unknown loot',
          inline: false,
        });
      } else {
        embed.addFields({
          name: '📦 Loot',
          value: 'No equipment found in these chests.',
          inline: false,
        });
      }
    } else {
      embed.addFields({
        name: '📦 Loot',
        value: 'No equipment found in these chests.',
        inline: false,
      });
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('[OPEN COMMAND] Error:', error);
    await interaction.editReply({
      content: '❌ An error occurred while opening chests.',
    });
  }
}

function getChestName(chestId: number): string {
  const chests: { [key: number]: string } = {
    1: 'Copper Chest',
    2: 'Iron Chest',
    3: 'Steel Chest',
    4: 'Gold Chest',
    5: 'Sapphire Chest',
    6: 'Emerald Chest',
    7: 'Ruby Chest',
    8: 'Diamond Chest',
    9: 'Platinum Chest',
  };
  return chests[chestId] || `Chest ${chestId}`;
}

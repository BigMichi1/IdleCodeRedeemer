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
  .setName('blacksmith')
  .setDescription('Use blacksmith contracts to upgrade your heroes')
  .addStringOption((option) =>
    option
      .setName('contract_type')
      .setDescription('Type of contract to use')
      .setRequired(true)
      .addChoices(
        { name: 'Tiny', value: '31' },
        { name: 'Small', value: '32' },
        { name: 'Medium', value: '33' },
        { name: 'Large', value: '34' }
      )
  )
  .addStringOption((option) =>
    option.setName('hero_id').setDescription('Hero ID to upgrade').setRequired(true)
  )
  .addIntegerOption((option) =>
    option
      .setName('count')
      .setDescription('Number of contracts to use (1-1000)')
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

    const contractTypeId = parseInt(interaction.options.getString('contract_type', true));
    const heroId = interaction.options.getString('hero_id', true);
    const count = interaction.options.getInteger('count', true);

    const session = await resolveGameSession(interaction.user.id, credentials);
    if (!session.ok) {
      await replyWithError(interaction, session.title, session.description);
      return;
    }
    const { server, instanceId } = session;

    const contractName = getContractName(contractTypeId);

    // Show processing message
    const processingEmbed = new EmbedBuilder()
      .setColor(0xffaa00)
      .setTitle('⏳ Using Contracts...')
      .setDescription(`Using ${count} ${contractName}(s) on hero ${heroId}...`);

    await interaction.editReply({ embeds: [processingEmbed] });

    // Use blacksmith
    const response = await IdleChampionsApi.useBlacksmith({
      server,
      user_id: credentials.userId,
      hash: credentials.userHash,
      contractType: contractTypeId as any,
      heroId,
      count,
      instanceId,
    });

    // The API returns GenericResponse for network errors, non-2xx responses,
    // unparseable bodies and stale sessions. Check before claiming success:
    // reporting "Blacksmith Upgrades Applied" on a failure both misleads the user and writes an audit
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

      logger.error(`[BLACKSMITH] useBlacksmith failed with status ${response.status}`);

      await interaction.editReply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xff0000)
            .setTitle('❌ Could Not Apply Upgrades')
            .setDescription(reason),
        ],
      });
      return;
    }

    // Log action (only after confirming the API actually did the work)
    await auditManager.logAction(interaction.user.id, 'BLACKSMITH_USED', {
      contractType: contractName,
      heroId,
      count,
    });

    // Build response embed
    const embed = new EmbedBuilder()
      .setColor(0x00ff00)
      .setTitle('✅ Blacksmith Upgrades Applied')
      .addFields({
        name: 'Contract Type',
        value: contractName,
        inline: true,
      })
      .addFields({
        name: 'Hero',
        value: heroId,
        inline: true,
      })
      .addFields({
        name: 'Count',
        value: count.toString(),
        inline: true,
      });

    // Type guard: check if response has actions (UseBlacksmithResponse)
    if (response instanceof Object && 'actions' in response) {
      const blacksmithResponse = response as any;
      if (
        blacksmithResponse.actions &&
        Array.isArray(blacksmithResponse.actions) &&
        blacksmithResponse.actions.length > 0
      ) {
        const actionSummary = blacksmithResponse.actions
          // BlacksmithAction has no `description` field, so the previous
          // `action.description || JSON.stringify(action)` always rendered raw JSON.
          .map((action: any) => {
            if (!action?.action) return `• ${JSON.stringify(action)}`;
            const amount = action.amount ? ` (${action.amount})` : '';
            return `• ${action.action}${amount}`;
          })
          .join('\n')
          .substring(0, 1024);

        embed.addFields({
          name: 'Results',
          value: actionSummary || 'Unknown',
          inline: false,
        });
      }
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('[BLACKSMITH COMMAND] Error:', error);
    await interaction.editReply({
      content: '❌ An error occurred while using blacksmith contracts.',
    });
  }
}

function getContractName(contractId: number): string {
  const contracts: { [key: number]: string } = {
    31: 'Tiny Contract',
    32: 'Small Contract',
    33: 'Medium Contract',
    34: 'Large Contract',
  };
  return contracts[contractId] || `Contract ${contractId}`;
}

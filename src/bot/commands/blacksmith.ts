import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { userManager } from '../database/userManager';
import { auditManager } from '../database/auditManager';
import IdleChampionsApi from '../api/idleChampionsApi';

enum ContractType {
  Tiny = 31,
  Small = 32,
  Medium = 33,
  Large = 34,
}

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

    // Get server
    let server = credentials.server;
    if (!server) {
      server = await IdleChampionsApi.getServer();
      if (!server) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Error')
          .setDescription('Could not determine game server.');

        await interaction.editReply({ embeds: [embed] });
        return;
      }
      await userManager.updateServer(interaction.user.id, server);
    }

    // Get fresh user details to get current instance ID
    let userResult = await IdleChampionsApi.getUserDetails({
      server,
      user_id: credentials.userId,
      hash: credentials.userHash,
    });

    // Handle server switch
    if (
      userResult instanceof Object &&
      'status' in userResult &&
      (userResult as any).status === 4
    ) {
      server = (userResult as any).newServer;
      if (!server) {
        const embed = new EmbedBuilder()
          .setColor(0xff0000)
          .setTitle('❌ Error')
          .setDescription('Server switch failed.');

        await interaction.editReply({ embeds: [embed] });
        return;
      }
      await userManager.updateServer(interaction.user.id, server);

      userResult = await IdleChampionsApi.getUserDetails({
        server,
        user_id: credentials.userId,
        hash: credentials.userHash,
      });
    }

    const userData = userResult as any;
    if (!userData || !userData.details) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error')
        .setDescription('Could not retrieve user data.');

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    // Get instance ID from user details
    const instanceId = userData.details.instance_id || '0';
    if (!instanceId || instanceId === '0') {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error')
        .setDescription('Could not retrieve valid instance ID from server.');

      await interaction.editReply({ embeds: [embed] });
      return;
    }

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

    // Log action
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
          .map((action: any) => `• ${action.description || JSON.stringify(action)}`)
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
    console.error('[BLACKSMITH COMMAND] Error:', error);
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

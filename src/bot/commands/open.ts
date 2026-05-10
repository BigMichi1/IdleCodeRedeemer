import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { userManager } from '../database/userManager';
import { auditManager } from '../database/auditManager';
import IdleChampionsApi from '../api/idleChampionsApi';

enum ChestType {
  Copper = 1,
  Iron = 2,
  Steel = 3,
  Gold = 4,
  Sapphire = 5,
  Emerald = 6,
  Ruby = 7,
  Diamond = 8,
  Platinum = 9,
}

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

    // Get instance ID from user details (not from game_instances)
    const instanceId = userData.details.instance_id || '0';
    if (!instanceId || instanceId === '0') {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error')
        .setDescription('Could not retrieve valid instance ID from server.');

      await interaction.editReply({ embeds: [embed] });
      return;
    }

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

    // Log action
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
    console.error('[OPEN COMMAND] Error:', error);
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

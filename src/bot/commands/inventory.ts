import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { userManager } from '../database/userManager';
import IdleChampionsApi from '../api/idleChampionsApi';

export const data = new SlashCommandBuilder()
  .setName('inventory')
  .setDescription('Check your Idle Champions inventory and resources');

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

    // Get server
    const server = await IdleChampionsApi.getServer();
    if (!server) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error')
        .setDescription('Could not connect to Idle Champions servers.');

      await interaction.editReply({ embeds: [embed] });
      return;
    }
    await userManager.updateServer(interaction.user.id, server);

    // Get user details
    let result = await IdleChampionsApi.getUserDetails({
      server,
      user_id: credentials.userId,
      hash: credentials.userHash,
    });

    // Handle server switch
    if (result instanceof Object && 'status' in result && (result as any).status === 4) {
      // ResponseStatus.SwitchServer
      await userManager.updateServer(interaction.user.id, (result as any).newServer);

      // Retry with new server
      result = await IdleChampionsApi.getUserDetails({
        server: (result as any).newServer,
        user_id: credentials.userId,
        hash: credentials.userHash,
      });
    }

    // Check if it's a GenericResponse error
    if (result instanceof Object && 'status' in result && !('game_log' in result)) {
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error')
        .setDescription(`API Error: Status ${(result as any).status}`);

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const playerData = result as any;

    if (!playerData || !playerData.details) {
      console.error('[INVENTORY] Invalid player data structure.');
      const embed = new EmbedBuilder()
        .setColor(0xff0000)
        .setTitle('❌ Error')
        .setDescription('Could not retrieve inventory data. Please check your credentials.');

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    const details = playerData.details;

    // Build inventory embed
    const embed = new EmbedBuilder()
      .setColor(0x0099ff)
      .setTitle('📦 Your Inventory')
      .setTimestamp();

    // Add gold and resources
    if (details.gold !== undefined) {
      const goldNum = parseFloat(details.gold);
      let goldDisplay: string;

      // Display in scientific notation if very large, otherwise format nicely
      if (goldNum >= 1e10) {
        goldDisplay = goldNum.toExponential(2);
      } else if (goldNum >= 1e6) {
        goldDisplay = (goldNum / 1e6).toFixed(1) + 'M';
      } else if (goldNum >= 1e3) {
        goldDisplay = (goldNum / 1e3).toFixed(1) + 'K';
      } else {
        goldDisplay = Math.floor(goldNum).toLocaleString();
      }

      embed.addFields({
        name: 'Total Gold (All Instances)',
        value: goldDisplay,
        inline: true,
      });
    }

    // Add gold per instance if available
    if (
      details.game_instances &&
      Array.isArray(details.game_instances) &&
      details.game_instances.length > 0
    ) {
      const goldPerInstance = details.game_instances
        .map((instance: any, idx: number) => {
          const goldNum = parseFloat(instance.gold);
          let goldDisplay: string;

          if (goldNum >= 1e10) {
            goldDisplay = goldNum.toExponential(2);
          } else if (goldNum >= 1e6) {
            goldDisplay = (goldNum / 1e6).toFixed(1) + 'M';
          } else if (goldNum >= 1e3) {
            goldDisplay = (goldNum / 1e3).toFixed(1) + 'K';
          } else {
            goldDisplay = Math.floor(goldNum).toLocaleString();
          }

          return `• Instance ${idx + 1}: ${goldDisplay}`;
        })
        .join('\n');

      if (goldPerInstance) {
        embed.addFields({
          name: 'Gold Per Instance',
          value: goldPerInstance,
          inline: false,
        });
      }
    }

    if (details.red_rubies !== undefined) {
      embed.addFields({
        name: 'Red Rubies',
        value: `${details.red_rubies}`,
        inline: true,
      });
    }

    // Add hero information
    if (details.heroes) {
      const heroCount = Object.keys(details.heroes).length;
      embed.addFields({
        name: 'Heroes Unlocked',
        value: `${heroCount}`,
        inline: true,
      });
    }

    // Add area progress for each game instance
    if (details.game_instances && Array.isArray(details.game_instances)) {
      const areaLines = details.game_instances.map(
        (instance: any, idx: number) =>
          `• Instance ${idx + 1} (Adventure ${instance.current_adventure_id}): Area ${instance.current_area}/${instance.highest_area}`
      );

      if (areaLines.length > 0) {
        embed.addFields({
          name: 'Adventure Progress',
          value: areaLines.join('\n'),
          inline: false,
        });
      }
    }

    // Add equipment quality summary
    if (details.loot && Array.isArray(details.loot)) {
      const rarityCount: { [key: number]: number } = {};
      for (const item of details.loot) {
        const rarity = item.rarity || 0;
        rarityCount[rarity] = (rarityCount[rarity] || 0) + 1;
      }

      const rarityNames: { [key: number]: string } = {
        0: 'Common',
        1: 'Uncommon',
        2: 'Rare',
        3: 'Epic',
        4: 'Legendary',
      };

      const rarityLines = Object.entries(rarityCount)
        .sort(([a], [b]) => parseInt(b) - parseInt(a))
        .map(([rarity, count]) => `• ${rarityNames[parseInt(rarity)]}: ${count}`);

      if (rarityLines.length > 0) {
        embed.addFields({
          name: 'Equipment Quality',
          value: rarityLines.join('\n'),
          inline: false,
        });
      }
    }

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    console.error('[INVENTORY COMMAND] Error:', error);
    await interaction.editReply({
      content: '❌ An error occurred while retrieving your inventory.',
    });
  }
}

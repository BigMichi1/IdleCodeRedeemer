import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
} from 'discord.js';
import { userManager } from '../database/userManager';
import { auditManager } from '../database/auditManager';
import { resolvePlayerData } from '../api/gameSession';
import { replyWithError } from '../utils/interactionReply';
import logger from '../utils/logger';

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

    const result = await resolvePlayerData(interaction.user.id, credentials);
    if (!result.ok) {
      logger.warn(`[INVENTORY] ${result.description} (user ${interaction.user.id})`);
      await replyWithError(interaction, '❌ Error', result.description);
      return;
    }

    const details = result.player.details;

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

    // Log action
    await auditManager.logAction(interaction.user.id, 'VIEWED_INVENTORY', {});

    await interaction.editReply({ embeds: [embed] });
  } catch (error) {
    logger.error('[INVENTORY COMMAND] Error:', error);
    await replyWithError(
      interaction,
      '❌ Error',
      'An error occurred while retrieving your inventory.'
    );
  }
}

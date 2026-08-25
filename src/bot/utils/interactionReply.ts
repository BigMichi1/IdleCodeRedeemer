import { EmbedBuilder, MessageFlags } from 'discord.js';
import type { RepliableInteraction } from 'discord.js';
import logger from './logger';
import { errorMessage } from './async';

/**
 * Report an error to the user from inside a catch block.
 *
 * Most commands called `interaction.editReply(...)` directly in their catch. If
 * the original failure *was* the `deferReply()` — an expired interaction token,
 * a Discord outage — then `editReply` rejects too, the catch block throws a
 * second time, and the user is left with "The application did not respond" while
 * an unhandled rejection propagates out of an async listener.
 *
 * This picks the right method for the interaction's current state and never
 * throws: a failure to deliver the error report is logged, not raised.
 */
export async function replyWithError(
  interaction: RepliableInteraction,
  title: string,
  description: string
): Promise<void> {
  const embed = new EmbedBuilder().setColor(0xff0000).setTitle(title).setDescription(description);

  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
  } catch (err) {
    // The interaction is already gone (expired token, deleted message, or the
    // deferral itself failed). Nothing further can be delivered to the user.
    logger.warn(
      `[REPLY] Could not deliver error response for /${interaction.isChatInputCommand() ? interaction.commandName : 'interaction'}: ${errorMessage(err)}`
    );
  }
}

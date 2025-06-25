const { SlashCommandBuilder, EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } = require('discord.js');
const config = require('../config.json');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('dm')
    .setDescription('Отправить сообщение в ЛС от лица бота (только для админов)'),
  async execute(interaction, db, auditWebhook) {
    console.log(`/dm executed by ${interaction.user.id} in guild ${interaction.guild?.id || 'DM'}`);

    if (!interaction.guild) {
      return interaction.reply({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Команда доступна только на сервере',
          timestamp: new Date().toISOString(),
        }],
        flags: ['Ephemeral'],
      });
    }

    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
    if (!member || !member.roles.cache.has(config.adminRoleId)) {
      return interaction.reply({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'У вас нет прав для выполнения этой команды',
          timestamp: new Date().toISOString(),
        }],
        flags: ['Ephemeral'],
      });
    }

    const modal = new ModalBuilder()
      .setCustomId('dm_modal')
      .setTitle('Отправка сообщения в ЛС');

    const userIdInput = new TextInputBuilder()
      .setCustomId('userId')
      .setLabel('ID участника')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Введите ID пользователя')
      .setRequired(true);

    const messageInput = new TextInputBuilder()
      .setCustomId('message')
      .setLabel('Текст сообщения')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Введите текст сообщения')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(userIdInput),
      new ActionRowBuilder().addComponents(messageInput)
    );

    await interaction.showModal(modal);

    const modalFilter = mi => mi.user.id === interaction.user.id && mi.customId === 'dm_modal';
    try {
      const modalInteraction = await interaction.awaitModalSubmit({ filter: modalFilter, time: 60000 });
      await modalInteraction.deferReply({ flags: ['Ephemeral'] });

      const userId = modalInteraction.fields.getTextInputValue('userId').trim();
      const messageText = modalInteraction.fields.getTextInputValue('message').trim();

      if (!/^\d{17,19}$/.test(userId)) {
        return modalInteraction.editReply({
          embeds: [{
            color: 0xff0000,
            title: 'Ошибка',
            description: 'Неверный формат ID участника',
            timestamp: new Date().toISOString(),
          }],
          flags: ['Ephemeral'],
        });
      }

      const targetUser = await interaction.client.users.fetch(userId).catch(() => null);
      if (!targetUser) {
        return modalInteraction.editReply({
          embeds: [{
            color: 0xff0000,
            title: 'Ошибка',
            description: 'Пользователь не найден',
            timestamp: new Date().toISOString(),
          }],
          flags: ['Ephemeral'],
        });
      }

      await targetUser.send({
        embeds: [{
          color: 0x9b909e,
          title: 'Сообщение от администрации',
          description: messageText,
          footer: { text: `Отправлено через ${interaction.client.user.username}` },
          timestamp: new Date().toISOString(),
        }],
      }).catch((err) => {
        console.error(`Error sending DM to ${userId}:`, err);
        return modalInteraction.editReply({
          embeds: [{
            color: 0xff0000,
            title: 'Ошибка',
            description: 'Не удалось отправить сообщение пользователю (возможно, ЛС закрыты)',
            timestamp: new Date().toISOString(),
          }],
          flags: ['Ephemeral'],
        });
      });

      await modalInteraction.editReply({
        embeds: [{
          color: 0x9b909e,
          title: 'Успех',
          description: `Сообщение успешно отправлено пользователю <@${userId}>`,
          timestamp: new Date().toISOString(),
        }],
        flags: ['Ephemeral'],
      });

      auditWebhook.send({
        embeds: [{
          color: 0x9b909e,
          title: 'Сообщение в ЛС отправлено',
          fields: [
            { name: 'Администратор', value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
            { name: 'Получатель', value: `${targetUser.tag} (${userId})`, inline: true },
            { name: 'Сообщение', value: messageText.slice(0, 1000), inline: false },
          ],
          timestamp: new Date().toISOString(),
        }],
      }).catch(err => console.error('Webhook error:', err));

    } catch (err) {
      console.error('Modal submission error:', err);
      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          embeds: [{
            color: 0xff0000,
            title: 'Ошибка',
            description: 'Время для ввода истекло или произошла ошибка.',
            timestamp: new Date().toISOString(),
          }],
          flags: ['Ephemeral'],
        });
      }
    }
  },
};
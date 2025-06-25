const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const config = require('../config.json');
const { v4: uuidv4 } = require('uuid');

module.exports = {
  name: 'invest',
  description: 'Инвестировать в государство или территорию',
  async execute(message, args, db, auditWebhook) {
    console.log(`!invest executed by ${message.author.id}`);

    if (message.channel.isDMBased()) {
      return message.reply({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Команда доступна только на сервере',
          timestamp: new Date().toISOString(),
        }],
        flags: ['Ephemeral'],
      });
    }

    const userId = message.author.id;
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder().setCustomId('invest_country').setLabel('Вся страна').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('invest_territory').setLabel('Территория').setStyle(ButtonStyle.Secondary)
      );

    await message.reply({
      embeds: [{
        color: 0x9b909e,
        title: 'Инвестиции',
        description: 'Выберите куда инвестировать:',
        footer: { text: message.author.username },
        timestamp: new Date().toISOString(),
      }],
      components: [row],
      flags: ['Ephemeral'],
    });

    const filter = i => i.user.id === userId && ['invest_country', 'invest_territory'].includes(i.customId);
    const collector = message.channel.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async (i) => {
      console.log(`Button ${i.customId} clicked by ${i.user.id}`);

      const type = i.customId === 'invest_country' ? 'country' : 'territory';
      const modal = new ModalBuilder()
        .setCustomId(`invest_modal_${type}`)
        .setTitle(`Инвестиция в ${type === 'country' ? 'страну' : 'территорию'}`);

      const purposeInput = new TextInputBuilder()
        .setCustomId('purpose')
        .setLabel('Что инвестировать?')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Например, дороги')
        .setRequired(true);

      const amountInput = new TextInputBuilder()
        .setCustomId('amount')
        .setLabel('Сумма')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Введите сумму')
        .setRequired(true);

      const durationInput = new TextInputBuilder()
        .setCustomId('duration')
        .setLabel('Срок (дни)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Например, 30')
        .setRequired(true);

      const inputs = [purposeInput, amountInput, durationInput];
      if (type === 'territory') {
        const territoryInput = new TextInputBuilder()
          .setCustomId('territory')
          .setLabel('Территория')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Например, Республика Коми')
          .setRequired(true);
        inputs.unshift(territoryInput);
      }

      modal.addComponents(...inputs.map(input => new ActionRowBuilder().addComponents(input)));
      await i.showModal(modal);

      const modalFilter = mi => mi.user.id === userId && mi.customId === `invest_modal_${type}`;
      try {
        const modalInteraction = await i.awaitModalSubmit({ filter: modalFilter, time: 60000 });
        await modalInteraction.deferReply({ flags: ['Ephemeral'] });

        const purpose = modalInteraction.fields.getTextInputValue('purpose').trim();
        const amount = parseInt(modalInteraction.fields.getTextInputValue('amount'));
        const durationDays = parseInt(modalInteraction.fields.getTextInputValue('duration'));
        const target = type === 'territory' ? modalInteraction.fields.getTextInputValue('territory').trim() : 'Country';

        if (isNaN(amount) || amount <= 0 || isNaN(durationDays) || durationDays <= 0) {
          return modalInteraction.editReply({
            embeds: [{
              color: 0xff0000,
              title: 'Ошибка',
              description: 'Неверный формат суммы или срока',
              timestamp: new Date().toISOString(),
            }],
            flags: ['Ephemeral'],
          });
        }

        db.get('SELECT balance FROM users WHERE userId = ?', [userId], async (err, user) => {
          if (err || !user || user.balance < amount) {
            console.error('Balance check failed:', err || 'Insufficient funds');
            return modalInteraction.editReply({
              embeds: [{
                color: 0xff0000,
                title: 'Ошибка',
                description: 'Недостаточно средств',
                timestamp: new Date().toISOString(),
              }],
              flags: ['Ephemeral'],
            });
          }

          const investmentId = uuidv4();
          db.run('UPDATE users SET balance = balance - ? WHERE userId = ?', [amount, userId], (err) => {
            if (err) {
              console.error('Error updating balance:', err);
              return modalInteraction.editReply({
                embeds: [{
                  color: 0xff0000,
                  title: 'Ошибка',
                  description: 'Ошибка при списании средств',
                  timestamp: new Date().toISOString(),
                }],
                flags: ['Ephemeral'],
              });
            }

            db.run('INSERT INTO investments (investmentId, userId, type, target, purpose, amount, durationDays, startDate, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [investmentId, userId, type, target, purpose, amount, durationDays, Date.now(), 'pending'], (err) => {
                if (err) {
                  console.error('Error inserting investment:', err);
                  return modalInteraction.editReply({
                    embeds: [{
                      color: 0xff0000,
                      title: 'Ошибка',
                      description: 'Ошибка при сохранении инвестиции',
                      timestamp: new Date().toISOString(),
                    }],
                    flags: ['Ephemeral'],
                  });
                }

                modalInteraction.editReply({
                  embeds: [{
                    color: 0x9b909e,
                    title: 'Инвестиция зарегистрирована',
                    description: `Инвестиция в ${type === 'country' ? 'страну' : `территорию ${target}`} (${purpose}) на ${amount} ${config.cur} на ${durationDays} дней отправлена на рассмотрение.`,
                    timestamp: new Date().toISOString(),
                  }],
                  flags: ['Ephemeral'],
                });

                auditWebhook.send({
                  embeds: [{
                    color: 0x9b909e,
                    title: 'Новая инвестиция',
                    fields: [
                      { name: 'Пользователь', value: `${message.author.tag} (${userId})`, inline: true },
                      { name: 'Тип', value: type === 'country' ? 'Страна' : 'Территория', inline: true },
                      { name: 'Цель', value: purpose, inline: true },
                      { name: 'Сумма', value: `${amount} ${config.cur}`, inline: true },
                      { name: 'Срок', value: `${durationDays} дней`, inline: true },
                      { name: 'Территория', value: type === 'territory' ? target : 'N/A', inline: true },
                    ],
                    timestamp: new Date().toISOString(),
                  }],
                }).catch(err => console.error('Webhook error:', err));
                auditWebhook.send('<@789872651027742740>')
              });
          });
        });
      } catch (err) {
        console.error('Modal submission error:', err);
        await i.followUp({
          embeds: [{
            color: 0xff0000,
            title: 'Ошибка',
            description: 'Время для ввода истекло или произошла ошибка.',
            timestamp: new Date().toISOString(),
          }],
          flags: ['Ephemeral'],
        });
      }
    });

    collector.on('end', () => {
      console.log(`Collector ended for !invest by ${userId}`);
    });
  },
};
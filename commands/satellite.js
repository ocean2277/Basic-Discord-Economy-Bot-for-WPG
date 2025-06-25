const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const { v4: uuidv4 } = require('uuid');
const config = require('../config.json');

module.exports = {
  name: 'satellite',
  description: 'Запуск спутника на орбиту',
  async execute(message, args, db, auditWebhook) {
    console.log(`!satellite executed by ${message.author.id}`);

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
        new ButtonBuilder().setCustomId('sat_recon').setLabel('Разведывательный').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('sat_comm').setLabel('Связи').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('sat_nav').setLabel('Навигационный').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('sat_early').setLabel('Раннего предупреждения').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('sat_monitor').setLabel('Мониторинга').setStyle(ButtonStyle.Secondary)
      );

    await message.reply({
      embeds: [{
        color: 0x9b909e,
        title: 'Запуск спутника',
        description: 'Выберите тип спутника:',
        footer: { text: message.author.username },
        timestamp: new Date().toISOString(),
      }],
      components: [row],
      flags: ['Ephemeral'],
    });

    const filter = i => i.user.id === userId && ['sat_recon', 'sat_comm', 'sat_nav', 'sat_early', 'sat_monitor'].includes(i.customId);
    const collector = message.channel.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async (i) => {
      console.log(`Button ${i.customId} clicked by ${i.user.id}`);
      const typeMap = {
        sat_recon: 'recon',
        sat_comm: 'communication',
        sat_nav: 'navigation',
        sat_early: 'early_warning',
        sat_monitor: 'monitoring',
      };
      const type = typeMap[i.customId];

      const modal = new ModalBuilder()
        .setCustomId(`satellite_modal_${type}`)
        .setTitle(`Запуск ${type} спутника`);

      const massInput = new TextInputBuilder()
        .setCustomId('mass')
        .setLabel('Масса спутника (кг)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Например, 1000')
        .setRequired(true);

      const techLevelInput = new TextInputBuilder()
        .setCustomId('techLevel')
        .setLabel('Технологический прогресс (III, IV-V, VI)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Например, VI')
        .setRequired(true);

      const durationInput = new TextInputBuilder()
        .setCustomId('duration')
        .setLabel('Срок миссии (дни)')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder('Например, 30')
        .setRequired(true);

      modal.addComponents(
        new ActionRowBuilder().addComponents(massInput),
        new ActionRowBuilder().addComponents(techLevelInput),
        new ActionRowBuilder().addComponents(durationInput)
      );

      await i.showModal(modal);

      const modalFilter = mi => mi.user.id === userId && mi.customId === `satellite_modal_${type}`;
      try {
        const modalInteraction = await i.awaitModalSubmit({ filter: modalFilter, time: 60000 });
        await modalInteraction.deferReply({ flags: ['Ephemeral'] });

        const mass = parseInt(modalInteraction.fields.getTextInputValue('mass'));
        const techLevel = modalInteraction.fields.getTextInputValue('techLevel').trim().toUpperCase();
        const durationDays = parseInt(modalInteraction.fields.getTextInputValue('duration'));

        if (isNaN(mass) || mass < 50 || mass > 22800 || !['III', 'IV-V', 'VI'].includes(techLevel) || isNaN(durationDays) || durationDays <= 0) {
          return modalInteraction.editReply({
            embeds: [{
              color: 0xff0000,
              title: 'Ошибка',
              description: 'Неверный формат: масса (50–22800 кг), тех. прогресс (III, IV-V, VI), срок (>0 дней)',
              timestamp: new Date().toISOString(),
            }],
            flags: ['Ephemeral'],
          });
        }

        const massRanges = {
          'III': { min: 2000, max: 5000 },
          'IV-V': { min: 500, max: 2000 },
          'VI': { min: 50, max: 500 },
        };

        if (mass < massRanges[techLevel].min || mass > massRanges[techLevel].max) {
          return modalInteraction.editReply({
            embeds: [{
              color: 0xff0000,
              title: 'Ошибка',
              description: `Масса для тех. прогресса ${techLevel} должна быть ${massRanges[techLevel].min}–${massRanges[techLevel].max} кг`,
              timestamp: new Date().toISOString(),
            }],
            flags: ['Ephemeral'],
          });
        }

        const baseCost = 10000000; 
        const costPerKg = 7000;
        const launchCost = 35000000; 
        const lighteningCost = techLevel === 'VI' ? 300 * mass : 0; 
        const satelliteCost = baseCost + (mass * costPerKg) + lighteningCost;
        const totalCost = satelliteCost + launchCost;

        db.get('SELECT balance FROM users WHERE userId = ?', [userId], async (err, user) => {
          if (err || !user || user.balance < totalCost) {
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

          const satelliteId = uuidv4();
          db.run('UPDATE users SET balance = balance - ? WHERE userId = ?', [totalCost, userId], (err) => {
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

            db.run('INSERT INTO satellites (satelliteId, userId, type, mass, techLevel, cost, startDate, durationDays, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [satelliteId, userId, type, mass, techLevel, totalCost, Date.now(), durationDays, 'pending'], (err) => {
                if (err) {
                  console.error('Error inserting satellite:', err);
                  return modalInteraction.editReply({
                    embeds: [{
                      color: 0xff0000,
                      title: 'Ошибка',
                      description: 'Ошибка при сохранении спутника',
                      timestamp: new Date().toISOString(),
                    }],
                    flags: ['Ephemeral'],
                  });
                }

                modalInteraction.editReply({
                  embeds: [{
                    color: 0x9b909e,
                    title: 'Спутник зарегистрирован',
                    description: `Спутник типа "${type}" массой ${mass} кг (тех. прогресс ${techLevel}) на ${durationDays} дней отправлен на рассмотрение. Стоимость: ${totalCost} ${config.cur}.`,
                    timestamp: new Date().toISOString(),
                  }],
                  flags: ['Ephemeral'],
                });

                auditWebhook.send({
                  embeds: [{
                    color: 0x9b909e,
                    title: 'Новый спутник',
                    fields: [
                      { name: 'Пользователь', value: `${message.author.tag} (${userId})`, inline: true },
                      { name: 'Тип', value: type, inline: true },
                      { name: 'Масса', value: `${mass} кг`, inline: true },
                      { name: 'Тех. прогресс', value: techLevel, inline: true },
                      { name: 'Стоимость', value: `${totalCost} ${config.cur}`, inline: true },
                      { name: 'Срок', value: `${durationDays} дней`, inline: true },
                    ],
                    timestamp: new Date().toISOString(),
                  }],
                }).catch(err => console.error('Webhook error:', err));
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
      console.log(`Collector ended for !satellite by ${userId}`);
    });
  },
};
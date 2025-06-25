const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, PermissionsBitField } = require('discord.js');
const config = require('../config.json');
const moment = require('moment-timezone');

module.exports = {
  name: 'spy',
  description: 'Управление шпионами',
  async execute(message, args, db, auditWebhook) {
    console.log(`!spy executed by ${message.author.id} in guild ${message.guild ? message.guild.id : 'DM'}`);

    if (message.channel.isDMBased()) {
      return message.reply({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Эта команда доступна только на сервере',
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }],
        ephemeral: true,
      });
    }

    const userId = message.author.id;
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder().setCustomId('view_spies').setLabel('Посмотреть шпионов').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('train_spies').setLabel('Обучить').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('counterintelligence').setLabel('Контрразведка').setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId('intelligence').setLabel('Разведка').setStyle(ButtonStyle.Success)
      );

    await message.reply({
      embeds: [{
        color: 0x9b909e,
        title: 'Управление шпионами',
        description: 'Выберите действие:',
        footer: { text: message.author.username },
        timestamp: new Date().toISOString(),
      }],
      components: [row],
      ephemeral: true,
    });

    const filter = i => i.user.id === userId && ['view_spies', 'train_spies', 'counterintelligence', 'intelligence'].includes(i.customId);
    const collector = message.channel.createMessageComponentCollector({ filter, time: 60000 });

    collector.on('collect', async (i) => {
      console.log(`Button ${i.customId} clicked by ${i.user.id}`);

      if (i.customId === 'view_spies') {
        try {
          await i.deferReply({ ephemeral: true });

          db.all('SELECT * FROM spies WHERE userId = ?', [userId], async (err, spies) => {
            if (err) {
              console.error('Error fetching spies:', err);
              return i.editReply({
                embeds: [{
                  color: 0xff0000,
                  title: 'Ошибка',
                  description: 'Ошибка при получении списка шпионов',
                  timestamp: new Date().toISOString(),
                }],
              });
            }

            if (!spies.length) {
              return i.editReply({
                embeds: [{
                  color: 0x9b909e,
                  title: 'Список шпионов',
                  description: 'У вас нет шпионов',
                  timestamp: new Date().toISOString(),
                }],
              });
            }

            const spiesPerPage = 10;
            let currentPage = 0;

            const generateEmbed = (page) => {
              const start = page * spiesPerPage;
              const end = start + spiesPerPage;
              const spyList = spies.slice(start, end).map(s => `${s.name} ${s.patronymic}, ${s.age} лет, ${s.experience === 'novice' ? 'Новичок' : 'Опытный'}`).join('\n');
              return new EmbedBuilder()
                .setColor(0x9b909e)
                .setTitle('Ваши шпионы')
                .setDescription(spyList || 'Нет шпионов на этой странице')
                .setFooter({ text: `Страница ${page + 1} из ${Math.ceil(spies.length / spiesPerPage)} | ${message.author.username}` })
                .setTimestamp();
            };

            const generateButtons = (page) => {
              return new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId('prev_page')
                  .setLabel('Назад')
                  .setStyle(ButtonStyle.Secondary)
                  .setDisabled(page === 0),
                new ButtonBuilder()
                  .setCustomId('next_page')
                  .setLabel('Вперёд')
                  .setStyle(ButtonStyle.Secondary)
                  .setDisabled(page === Math.ceil(spies.length / spiesPerPage) - 1)
              );
            };

            await i.editReply({
              embeds: [generateEmbed(currentPage)],
              components: [generateButtons(currentPage)],
            });

            const pageFilter = pi => pi.user.id === userId && ['prev_page', 'next_page'].includes(pi.customId);
            const pageCollector = i.message.createMessageComponentCollector({ filter: pageFilter, time: 60000 });

            pageCollector.on('collect', async (pi) => {
              console.log(`Page button ${pi.customId} clicked by ${pi.user.id}`);
              try {
                await pi.deferUpdate();
                if (pi.customId === 'prev_page' && currentPage > 0) {
                  currentPage--;
                } else if (pi.customId === 'next_page' && currentPage < Math.ceil(spies.length / spiesPerPage) - 1) {
                  currentPage++;
                }
                await pi.editReply({
                  embeds: [generateEmbed(currentPage)],
                  components: [generateButtons(currentPage)],
                });
              } catch (err) {
                console.error('Error handling page interaction:', err);
              }
            });

            pageCollector.on('end', () => {
              console.log(`Page collector ended for view_spies by ${userId}`);
              i.editReply({
                components: [generateButtons(currentPage).setComponents(
                  generateButtons(currentPage).components.map(btn => btn.setDisabled(true))
                )],
              }).catch(err => console.error('Error disabling page buttons:', err));
            });
          });
        } catch (err) {
          console.error('Error in view_spies:', err);
          if (!i.replied && !i.deferred) {
            await i.reply({
              embeds: [{
                color: 0xff0000,
                title: 'Ошибка',
                description: 'Произошла ошибка при обработке команды',
                timestamp: new Date().toISOString(),
              }],
              ephemeral: true,
            }).catch(console.error);
          }
        }
      } else if (i.customId === 'train_spies') {
        db.all('SELECT spyId, name, experience FROM spies WHERE userId = ? AND spyId NOT IN (SELECT spyId FROM spy_trainings) AND spyId NOT IN (SELECT spyId FROM spy_missions)', [userId], async (err, spies) => {
          if (err) {
            console.error('Error fetching available spies:', err);
            await i.reply({ 
              embeds: [{ color: 0xff0000, title: 'Ошибка', description: 'Ошибка при получении шпионов', timestamp: new Date().toISOString() }], 
              ephemeral: true 
            });
            return;
          }
          if (!spies.length) {
            await i.reply({ 
              embeds: [{ color: 0x9b909e, title: 'Обучение', description: 'Нет доступных шпионов для обучения', timestamp: new Date().toISOString() }], 
              ephemeral: true 
            });
            return;
          }

          const modal = new ModalBuilder()
            .setCustomId('train_modal')
            .setTitle('Обучение шпионов');

          const quantityInput = new TextInputBuilder()
            .setCustomId('quantity')
            .setLabel('Количество шпионов')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(`Введите число от 1 до ${spies.length}`)
            .setRequired(true);

          const quantityRow = new ActionRowBuilder().addComponents(quantityInput);
          modal.addComponents(quantityRow);

          await i.showModal(modal);

          const modalFilter = mi => mi.user.id === userId && mi.customId === 'train_modal';
          try {
            const modalInteraction = await i.awaitModalSubmit({ filter: modalFilter, time: 60000 });
            console.log(`Train modal submitted by ${modalInteraction.user.id}`);

            await modalInteraction.deferReply({ ephemeral: true });

            const quantity = parseInt(modalInteraction.fields.getTextInputValue('quantity'));
            if (isNaN(quantity) || quantity <= 0 || quantity > spies.length) {
              return modalInteraction.editReply({ 
                embeds: [{ 
                  color: 0xff0000, 
                  title: 'Ошибка', 
                  description: `Введите число от 1 до ${spies.length}`, 
                  timestamp: new Date().toISOString() 
                }], 
                ephemeral: true 
              });
            }

            const pricePerSpy = 1000;
            const totalPrice = quantity * pricePerSpy;
            db.get('SELECT balance FROM users WHERE userId = ?', [userId], async (err, user) => {
              if (err || !user || user.balance < totalPrice) {
                console.error('Balance check failed:', err || 'Insufficient funds');
                return modalInteraction.editReply({ 
                  embeds: [{ color: 0xff0000, title: 'Ошибка', description: 'Недостаточно средств', timestamp: new Date().toISOString() }], 
                  ephemeral: true 
                });
              }

              const confirmRow = new ActionRowBuilder()
                .addComponents(
                  new ButtonBuilder().setCustomId('confirm_train').setLabel('Подтвердить').setStyle(ButtonStyle.Success),
                  new ButtonBuilder().setCustomId('cancel_train').setLabel('Отмена').setStyle(ButtonStyle.Danger)
                );

              await modalInteraction.editReply({
                embeds: [{
                  color: 0x9b909e,
                  title: 'Подтверждение обучения',
                  description: `Обучить ${quantity} шпионов за ${totalPrice} ${config.cur}?`,
                  timestamp: new Date().toISOString(),
                }],
                components: [confirmRow],
                ephemeral: true,
              });

              const confirmFilter = ci => ci.user.id === userId && ['confirm_train', 'cancel_train'].includes(ci.customId);
              const confirmCollector = i.channel.createMessageComponentCollector({ filter: confirmFilter, time: 30000 });

              confirmCollector.on('collect', async (ci) => {
                console.log(`Confirm button ${ci.customId} clicked by ${ci.user.id}`);
                await ci.deferReply({ ephemeral: true });
                if (ci.customId === 'cancel_train') {
                  return ci.editReply({ 
                    embeds: [{ color: 0x9b909e, title: 'Обучение', description: 'Обучение отменено', timestamp: new Date().toISOString() }], 
                    components: [] 
                  });
                }

                db.run('UPDATE users SET balance = balance - ? WHERE userId = ?', [totalPrice, userId], (err) => {
                  if (err) {
                    console.error('Error deducting balance:', err);
                    return ci.editReply({ 
                      embeds: [{ color: 0xff0000, title: 'Ошибка', description: 'Ошибка при списании средств', timestamp: new Date().toISOString() }], 
                      components: [] 
                    });
                  }

                  const trainingDays = 10;
                  const startDate = Date.now();
                  for (let j = 0; j < quantity; j++) {
                    db.run('INSERT INTO spy_trainings (userId, spyId, startDate, durationDays) VALUES (?, ?, ?, ?)', [userId, spies[j].spyId, startDate, trainingDays]);
                  }

                  ci.editReply({
                    embeds: [{
                      color: 0x9b909e,
                      title: 'Обучение начато',
                      description: `Обучение ${quantity} шпионов начато. Завершение через ${trainingDays} игровых дней.`,
                      timestamp: new Date().toISOString(),
                    }],
                    components: [],
                  });

                  auditWebhook.send({
                    embeds: [{
                      color: 0x9b909e,
                      title: 'Обучение шпионов',
                      fields: [
                        { name: 'Пользователь', value: `${message.author.tag} (${userId})`, inline: true },
                        { name: 'Количество', value: quantity.toString(), inline: true },
                        { name: 'Стоимость', value: `${totalPrice} ${config.cur}`, inline: true },
                      ],
                      timestamp: new Date().toISOString(),
                    }],
                  }).catch(err => console.error('Webhook error:', err));
                });
              });

              confirmCollector.on('end', () => {
                console.log(`Confirm collector ended for training by ${userId}`);
              });
            });
          } catch (err) {
            console.error('Train modal submission timeout or error:', err);
            await i.followUp({
              embeds: [{
                color: 0xff0000,
                title: 'Ошибка',
                description: 'Время для ввода данных истекло или произошла ошибка.',
                timestamp: new Date().toISOString(),
              }],
              ephemeral: true,
            });
          }
        });
      } else if (i.customId === 'counterintelligence' || i.customId === 'intelligence') {
        const type = i.customId === 'counterintelligence' ? 'counterintelligence' : 'intelligence';
        const modal = new ModalBuilder()
          .setCustomId(`mission_modal_${type}`)
          .setTitle(type === 'counterintelligence' ? 'Контрразведка' : 'Разведка');

        const quantityInput = new TextInputBuilder()
          .setCustomId('quantity')
          .setLabel('Количество шпионов')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Введите число от 1')
          .setRequired(true);

        const methodInput = new TextInputBuilder()
          .setCustomId('method')
          .setLabel('Метод')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Например, Дипломатический')
          .setRequired(true);

        const preparationInput = new TextInputBuilder()
          .setCustomId('preparation')
          .setLabel('Подготовка')
          .setStyle(TextInputStyle.Short)
          .setPlaceholder('Новичок или Опытный')
          .setRequired(true);

        const quantityRow = new ActionRowBuilder().addComponents(quantityInput);
        const methodRow = new ActionRowBuilder().addComponents(methodInput);
        const preparationRow = new ActionRowBuilder().addComponents(preparationInput);
        modal.addComponents(quantityRow, methodRow, preparationRow);

        if (type === 'intelligence') {
          const countryInput = new TextInputBuilder()
            .setCustomId('country')
            .setLabel('Название страны')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Например, Франция')
            .setRequired(true);
          const countryRow = new ActionRowBuilder().addComponents(countryInput);
          modal.addComponents(countryRow);
        }

        await i.showModal(modal);

        const modalFilter = mi => mi.user.id === userId && mi.customId === `mission_modal_${type}`;
        try {
          const modalInteraction = await i.awaitModalSubmit({ filter: modalFilter, time: 60000 });
          console.log(`Modal submitted by ${modalInteraction.user.id} for ${type}`);

          await modalInteraction.deferReply({ ephemeral: true });

          const quantity = parseInt(modalInteraction.fields.getTextInputValue('quantity'));
          const method = modalInteraction.fields.getTextInputValue('method').trim();
          const preparation = modalInteraction.fields.getTextInputValue('preparation').trim().toLowerCase();
          let countryName = type === 'intelligence' ? modalInteraction.fields.getTextInputValue('country').trim() : null;

          const experienceMap = {
            'новичок': 'novice',
            'опытный': 'experienced',
          };

          const preparationLevels = [
            { name: 'новичок', level: 1, cost: 500, duration: 5, successRate: 0.6 },
            { name: 'профи', level: 2, cost: 1000, duration: 10, successRate: 0.8 },
            { name: 'ветеран', level: 3, cost: 2000, duration: 15, successRate: 0.95 },
          ];

          const prep = preparationLevels.find(p => p.name === preparation);
          const experience = experienceMap[preparation];

          if (!experience || !prep) {
            return modalInteraction.editReply({ 
              embeds: [{ 
                color: 0xff0000, 
                title: 'Ошибка', 
                description: 'Подготовка должна быть: Новичок или Опытный', 
                timestamp: new Date().toISOString() 
              }], 
              ephemeral: true 
            });
          }

          db.all('SELECT spyId, name, experience FROM spies WHERE userId = ? AND experience = ? AND spyId NOT IN (SELECT spyId FROM spy_trainings) AND spyId NOT IN (SELECT spyId FROM spy_missions)', 
            [userId, experience], async (err, spies) => {
              if (err) {
                console.error('Error fetching available spies:', err);
                return modalInteraction.editReply({ 
                  embeds: [{ color: 0xff0000, title: 'Ошибка', description: 'Ошибка при получении шпионов', timestamp: new Date().toISOString() }], 
                  ephemeral: true 
                });
              }

              if (!spies.length) {
                return modalInteraction.editReply({ 
                  embeds: [{ 
                    color: 0x9b909e, 
                    title: type === 'counterintelligence' ? 'Контрразведка' : 'Разведка', 
                    description: `Нет доступных шпионов с подготовкой "${preparation}"`, 
                    timestamp: new Date().toISOString() 
                  }], 
                  ephemeral: true 
                });
              }

              if (isNaN(quantity) || quantity <= 0 || quantity > spies.length || (type === 'intelligence' && !countryName)) {
                return modalInteraction.editReply({ 
                  embeds: [{ 
                    color: 0xff0000, 
                    title: 'Ошибка', 
                    description: `Неверный формат. Количество: 1-${spies.length}${type === 'intelligence' ? ', страна: любое название' : ''}`, 
                    timestamp: new Date().toISOString() 
                  }], 
                  ephemeral: true 
                });
              }

              const guild = message.client.guilds.cache.get(config.guildId);
              if (!guild) {
                console.error('Guild not found:', config.guildId);
                return modalInteraction.editReply({ 
                  embeds: [{ color: 0xff0000, title: 'Ошибка', description: 'Сервер не найден', timestamp: new Date().toISOString() }], 
                  ephemeral: true 
                });
              }

              const totalCost = prep.cost * quantity;
              db.get('SELECT balance FROM users WHERE userId = ?', [userId], async (err, user) => {
                if (err || !user || user.balance < totalCost) {
                  console.error('Balance check failed:', err || 'Insufficient funds');
                  return modalInteraction.editReply({ 
                    embeds: [{ color: 0xff0000, title: 'Ошибка', description: 'Недостаточно средств', timestamp: new Date().toISOString() }], 
                    ephemeral: true 
                  });
                }

                const confirmRow = new ActionRowBuilder()
                  .addComponents(
                    new ButtonBuilder().setCustomId('confirm_mission').setLabel('Подтвердить').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('cancel_mission').setLabel('Отмена').setStyle(ButtonStyle.Danger)
                  );

                await modalInteraction.editReply({
                  embeds: [{
                    color: 0x9b909e,
                    title: type === 'counterintelligence' ? 'Контрразведка' : 'Разведка',
                    description: `Запустить миссию для ${quantity} шпионов${type === 'intelligence' ? ` в ${countryName}` : ''} с методом "${method}" и подготовкой "${preparation}" за ${totalCost} ${config.cur}? Длительность: ${prep.duration} дней.`,
                    timestamp: new Date().toISOString(),
                  }],
                  components: [confirmRow],
                  ephemeral: true,
                });

                const confirmFilter = cci => cci.user.id === userId && ['confirm_mission', 'cancel_mission'].includes(cci.customId);
                const confirmCollector = modalInteraction.channel.createMessageComponentCollector({ filter: confirmFilter, time: 30000 });

                confirmCollector.on('collect', async (cci) => {
                  console.log(`Confirm mission button ${cci.customId} clicked by ${cci.user.id}`);
                  await cci.deferReply({ ephemeral: true });
                  if (cci.customId === 'cancel_mission') {
                    return cci.editReply({ 
                      embeds: [{ color: 0x9b909e, title: type === 'counterintelligence' ? 'Контрразведка' : 'Разведка', description: 'Миссия отменена', timestamp: new Date().toISOString() }], 
                      components: [], 
                      ephemeral: true 
                    });
                  }

                  db.run('UPDATE users SET balance = balance - ? WHERE userId = ?', [totalCost, userId], async (err) => {
                    if (err) {
                      console.error('Error updating balance:', err);
                      return cci.editReply({ 
                        embeds: [{ color: 0xff0000, title: 'Ошибка', description: 'Ошибка при списании средств', timestamp: new Date().toISOString() }], 
                        components: [], 
                        ephemeral: true 
                      });
                    }

                    const startDate = Date.now();
                    for (let j = 0; j < quantity; j++) {
                      db.run('INSERT INTO spy_missions (userId, spyId, type, targetCountry, method, preparationLevel, startDate, durationDays) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
                        [userId, spies[j].spyId, type, countryName, method, prep.level, startDate, prep.duration]);
                    }

                    const guild = message.client.guilds.cache.get(config.guildId);
                    const category = await guild.channels.fetch(config.spyCategoryId).catch(() => null);
                    if (!category) {
                      console.error(`Spy category ${config.spyCategoryId} not found`);
                      return cci.editReply({ 
                        embeds: [{ color: 0xff0000, title: 'Ошибка', description: 'Категория для миссий не найдена', timestamp: new Date().toISOString() }], 
                        components: [], 
                        ephemeral: true 
                      });
                    }

                    const channelName = type === 'counterintelligence' 
                      ? `mission-counterintelligence-${userId}`
                      : `mission-intelligence-${countryName.toLowerCase().replace(/\s+/g, '-')}`;
                    const channel = await guild.channels.create({
                      name: channelName,
                      type: 0,
                      parent: category.id,
                      permissionOverwrites: [
                        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: userId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                        { id: message.client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                      ],
                    }).catch((err) => {
                      console.error('Error creating mission channel:', err);
                      return null;
                    });

                    if (channel) {
                      await channel.send({
                        embeds: [{
                          color: 0x9b909e,
                          title: type === 'counterintelligence' ? 'Контрразведка начата' : 'Разведка начата',
                          description: type === 'counterintelligence'
                            ? `Контрразведка: <@${userId}>, Метод: ${method}\nМиссия для ${quantity} шпионов.\nПодготовка: ${preparation}\nДлительность: ${prep.duration} дней`
                            : `Разведка: <@${userId}> - ${countryName}, Метод: ${method}\nМиссия для ${quantity} шпионов в ${countryName}.\nПодготовка: ${preparation}\nДлительность: ${prep.duration} дней`,
                          timestamp: new Date().toISOString(),
                        }],
                      });
                    }

                    cci.editReply({
                      embeds: [{
                        color: 0x9b909e,
                        title: type === 'counterintelligence' ? 'Контрразведка начата' : 'Разведка начата',
                        description: `Миссия для ${quantity} шпионов${type === 'intelligence' ? ` в ${countryName}` : ''} с методом "${method}" начата. Длительность: ${prep.duration} дней.`,
                        timestamp: new Date().toISOString(),
                      }],
                      components: [],
                      ephemeral: true,
                    });

                    auditWebhook.send({
                      embeds: [{
                        color: 0x9b909e,
                        title: type === 'counterintelligence' ? 'Начало контрразведки' : 'Начало разведки',
                        fields: [
                          { name: 'Пользователь', value: `${message.author.tag} (${userId})`, inline: true },
                          { name: 'Страна', value: type === 'intelligence' ? countryName : 'Не указана', inline: true },
                          { name: 'Метод', value: method, inline: true },
                          { name: 'Количество шпионов', value: quantity.toString(), inline: true },
                          { name: 'Стоимость', value: `${totalCost} ${config.cur}`, inline: true },
                          { name: 'Подготовка', value: preparation, inline: true },
                        ],
                        timestamp: new Date().toISOString(),
                      }],
                    }).catch(err => console.error('Webhook error:', err));
                  });
                });

                confirmCollector.on('end', () => {
                  console.log(`Confirm collector ended for mission by ${userId}`);
                });
              });
            });
          } catch (err) {
            console.error('Modal submission timeout or error:', err);
            await i.followUp({
              embeds: [{
                color: 0xff0000,
                title: 'Ошибка',
                description: 'Время для ввода данных истекло или произошла ошибка.',
                timestamp: new Date().toISOString(),
              }],
              ephemeral: true,
            });
          }
      }
    });

    collector.on('end', () => {
      console.log(`Main collector ended for !spy by ${userId}`);
    });
  },
};
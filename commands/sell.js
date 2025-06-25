const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config.json');
const moment = require('moment-timezone');

function getGameDate(timestamp) {
  const now = moment(timestamp).tz('Europe/Kiev');
  const hours = now.hours();
  const minutes = now.minutes();
  const totalMinutes = hours * 60 + minutes;
  return Math.floor(totalMinutes / 8);
}

module.exports = {
  name: 'sell',
  description: 'Продать предмет другому игроку с доставкой',
  async execute(message, args, db, auditWebhook, constants) {
    console.log(`Executing sell command: ${args.join(' ')}`);
    console.log(`Guild ID: ${message.guild?.id}, Channel ID: ${message.channel.id}, Bot ID: ${message.client.user.id}`);

    if (!message.guild) {
      return message.reply({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Эта команда работает только в текстовых каналах сервера, а не в личных сообщениях.',
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }],
      });
    }

    const botPermissions = message.channel.permissionsFor(message.client.user);
    if (!botPermissions || !botPermissions.has(['VIEW_CHANNEL', 'SEND_MESSAGES', 'EMBED_LINKS'])) {
      console.error(`Missing permissions in channel ${message.channel.id}: ${botPermissions?.toArray().join(', ')}`);
      return message.reply({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'У бота недостаточно прав в этом канале (нужны: просмотр канала, отправка сообщений, встраивание ссылок).',
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }],
      });
    }

    if (args.length < 4) {
      return message.channel.send({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Использование: `!sell <предмет> <количество> <цена> <@покупатель>`\nПример: `!sell Akt 2 200 @user`',
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }],
      });
    }

    const itemName = args[0];
    const quantity = parseInt(args[1]);
    const price = parseInt(args[2]);
    const buyerMatch = args[3].match(/^<@!?(\d+)>$/);
    const sellerId = message.author.id;

    if (!buyerMatch) {
      return message.channel.send({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Упомяните покупателя через @ (например, @user)',
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }],
      });
    }

    const buyerId = buyerMatch[1];
    const buyer = await message.guild.members.fetch(buyerId).catch((err) => {
      console.error(`Error fetching buyer ${buyerId}:`, err);
      return null;
    });

    if (!buyer || buyer.user.bot) {
      return message.channel.send({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Указанный игрок не найден на сервере или является ботом',
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }],
      });
    }

    if (buyerId === sellerId) {
      return message.channel.send({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Вы не можете продать предмет самому себе',
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }],
      });
    }

    if (isNaN(quantity) || quantity <= 0) {
      return message.channel.send({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Количество должно быть положительным числом',
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }],
      });
    }

    if (isNaN(price) || price <= 0) {
      return message.channel.send({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Цена должна быть положительным числом',
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }],
      });
    }

    const banRow = await new Promise((resolve) => {
      db.get('SELECT isBanned FROM buy_bans WHERE userId IN (?, ?)', [sellerId, buyerId], (err, row) => {
        if (err) console.error('Error checking bans:', err);
        resolve(row);
      });
    });

    if (banRow && banRow.isBanned) {
      return message.channel.send({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Вы или покупатель забанены от операций с магазином',
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }],
      });
    }

    const invRow = await new Promise((resolve) => {
      db.get('SELECT quantity, shopType FROM inventory WHERE userId = ? AND itemName = ?', [sellerId, itemName], (err, row) => {
        if (err) console.error('Error checking inventory:', err);
        resolve(row);
      });
    });

    if (!invRow || invRow.quantity < quantity) {
      return message.channel.send({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: `У вас недостаточно **${itemName}** в инвентаре (доступно: ${invRow ? invRow.quantity : 0} шт.)`,
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }],
      });
    }

    const shopType = invRow.shopType;
    const table = shopType === 1 ? 'shop' : 'shop2';

    const itemRow = await new Promise((resolve) => {
      db.get(`SELECT isTransport FROM ${table} WHERE itemName = ?`, [itemName], (err, row) => {
        if (err) console.error('Error checking item:', err);
        resolve(row);
      });
    });

    if (!itemRow) {
      return message.channel.send({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: `Предмет **${itemName}** не найден в магазине`,
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }],
      });
    }

    if (!itemRow.isTransport) {
      const transportRow = await new Promise((resolve) => {
        db.get(
          `SELECT 1 FROM inventory i
           JOIN shop2 s ON i.itemName = s.itemName
           WHERE i.userId = ? AND s.isTransport = 1
           UNION
           SELECT 1 FROM inventory i
           JOIN shop s ON i.itemName = s.itemName
           WHERE i.userId = ? AND s.isTransport = 1
           LIMIT 1`,
          [sellerId, sellerId],
          (err, row) => {
            if (err) console.error('Error checking transport:', err);
            resolve(row);
          }
        );
      });

      if (!transportRow) {
        return message.channel.send({
          embeds: [{
            color: 0xff0000,
            title: 'Ошибка',
            description: `Для продажи **${itemName}** нужен транспорт (например, Конвой или Транспортный самолёт) в инвентаре`,
            footer: { text: message.author.username },
            timestamp: new Date().toISOString(),
          }],
        });
      }
    }

    const buyerBalance = await new Promise((resolve) => {
      db.get('SELECT balance FROM users WHERE userId = ?', [buyerId], (err, row) => {
        if (err) console.error('Error checking balance:', err);
        resolve(row ? row.balance : 0);
      });
    });

    if (buyerBalance < price) {
      return message.channel.send({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: `У **${buyer.user.username}** недостаточно средств (${buyerBalance} ${config.cur}, нужно ${price} ${config.cur})`,
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }],
      });
    }

    const embed = new EmbedBuilder()
      .setColor(0x9b909e)
      .setTitle('Продажа предмета с доставкой')
      .setDescription(
        `${message.author} хочет продать **${itemName}** (${quantity} шт.) за **${price}** ${config.cur} игроку ${buyer}\n` +
        `Доставка займёт ${constants.DELIVERY_DAYS} игровых дней.\n\n${buyer}, подтвердите покупку.`
      )
      .setFooter({ text: message.author.username })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`confirm_sell_${message.id}`)
        .setLabel('Подтвердить')
        .setStyle(ButtonStyle.Success)
    );

    console.log(`Sending confirmation for buyer ${buyerId}`);
    const sentMessage = await message.channel.send({ embeds: [embed], components: [row] }).catch((err) => {
      console.error('Error sending confirmation message:', err);
      return null;
    });

    if (!sentMessage) {
      return message.channel.send({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Не удалось отправить сообщение с подтверждением',
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }],
      });
    }

    const collector = sentMessage.createMessageComponentCollector({
      filter: (i) => {
        console.log(`Interaction by ${i.user.id}, expected ${buyerId}`);
        if (i.user.id !== buyerId) {
          i.reply({ content: 'Эта кнопка только для покупателя!', ephemeral: true });
          return false;
        }
        return true;
      },
      time: 180000,
    });

    collector.on('collect', async (interaction) => {
      console.log(`Confirmation attempt by ${interaction.user.id}`);

      const currentBuyerBalance = await new Promise((resolve) => {
        db.get('SELECT balance FROM users WHERE userId = ?', [buyerId], (err, row) => {
          if (err) console.error('Error rechecking balance:', err);
          resolve(row ? row.balance : 0);
        });
      });

      if (currentBuyerBalance < price) {
        await interaction.reply({
          embeds: [{
            color: 0xff0000,
            title: 'Ошибка',
            description: `Недостаточно средств (${currentBuyerBalance} ${config.cur}, нужно ${price} ${config.cur})`,
            footer: { text: interaction.user.username },
            timestamp: new Date().toISOString(),
          }],
          ephemeral: true,
        });
        return collector.stop();
      }

      const currentInvRow = await new Promise((resolve) => {
        db.get('SELECT quantity FROM inventory WHERE userId = ? AND itemName = ?', [sellerId, itemName], (err, row) => {
          if (err) console.error('Error rechecking inventory:', err);
          resolve(row);
        });
      });

      if (!currentInvRow || currentInvRow.quantity < quantity) {
        await interaction.reply({
          embeds: [{
            color: 0xff0000,
            title: 'Ошибка',
            description: `У продавца недостаточно **${itemName}** (доступно: ${currentInvRow ? currentInvRow.quantity : 0} шт.)`,
            footer: { text: interaction.user.username },
            timestamp: new Date().toISOString(),
          }],
          ephemeral: true,
        });
        return collector.stop();
      }

      const startDate = Date.now();
      const startGameDays = getGameDate(startDate);
      const deliveryGameDays = startGameDays + constants.DELIVERY_DAYS;
      const deliveryDate = startDate + (constants.DELIVERY_DAYS * 8 * 60 * 1000);

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        db.run('UPDATE users SET balance = balance - ? WHERE userId = ?', [price, buyerId], (err) => {
          if (err) {
            db.run('ROLLBACK');
            console.error('Error updating buyer balance:', err);
            return interaction.reply({
              embeds: [{
                color: 0xff0000,
                title: 'Ошибка',
                description: 'Ошибка при обновлении баланса покупателя',
                footer: { text: interaction.user.username },
                timestamp: new Date().toISOString(),
              }],
              ephemeral: true,
            });
            return collector.stop();
          }

          db.run(
            'INSERT OR REPLACE INTO users (userId, balance) VALUES (?, COALESCE((SELECT balance FROM users WHERE userId = ?) + ?, 0))',
            [sellerId, sellerId, price],
            (err) => {
              if (err) {
                db.run('ROLLBACK');
                console.error('Error updating seller balance:', err);
                return interaction.reply({
                  embeds: [{
                    color: 0xff0000,
                    title: 'Ошибка',
                    description: 'Ошибка при обновлении баланса продавца',
                    footer: { text: interaction.user.username },
                    timestamp: new Date().toISOString(),
                  }],
                  ephemeral: true,
                });
                return collector.stop();
              }

              db.run(
                'UPDATE inventory SET quantity = quantity - ? WHERE userId = ? AND itemName = ? AND shopType = ?',
                [quantity, sellerId, itemName, shopType],
                (err) => {
                  if (err) {
                    db.run('ROLLBACK');
                    console.error('Error updating seller inventory:', err);
                    return interaction.reply({
                      embeds: [{
                        color: 0xff0000,
                        title: 'Ошибка',
                        description: 'Ошибка при обновлении инвентаря продавца',
                        footer: { text: interaction.user.username },
                        timestamp: new Date().toISOString(),
                      }],
                      ephemeral: true,
                    });
                    return collector.stop();
                  }

                  db.run(
                    'DELETE FROM inventory WHERE userId = ? AND itemName = ? AND quantity = 0',
                    [sellerId, itemName],
                    (err) => {
                      if (err) {
                        db.run('ROLLBACK');
                        console.error('Error cleaning inventory:', err);
                        return interaction.reply({
                          embeds: [{
                            color: 0xff0000,
                            title: 'Ошибка',
                            description: 'Ошибка при очистке инвентаря',
                            footer: { text: interaction.user.username },
                            timestamp: new Date().toISOString(),
                          }],
                          ephemeral: true,
                        });
                        return collector.stop();
                      }

                      db.run(
                        'INSERT INTO pending_trades (sellerId, buyerId, itemName, quantity, price, shopType, startDate, deliveryDate) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                        [sellerId, buyerId, itemName, quantity, price, shopType, startDate, deliveryDate],
                        (err) => {
                          if (err) {
                            db.run('ROLLBACK');
                            console.error('Error creating trade:', err);
                            return interaction.reply({
                              embeds: [{
                                color: 0xff0000,
                                title: 'Ошибка',
                                description: 'Ошибка при создании сделки',
                                footer: { text: interaction.user.username },
                                timestamp: new Date().toISOString(),
                              }],
                              ephemeral: true,
                            });
                            return collector.stop();
                          }

                          db.run(
                            'INSERT INTO balance_audit (userId, amount, reason, changeTime) VALUES (?, ?, ?, ?)',
                            [buyerId, -price, `Покупка с доставкой: ${itemName} (${quantity} шт.) от ${message.author.tag}`, Date.now()],
                            (err) => {
                              if (err) {
                                db.run('ROLLBACK');
                                console.error('Error logging buyer audit:', err);
                                return interaction.reply({
                                  embeds: [{
                                    color: 0xff0000,
                                    title: 'Ошибка',
                                    description: 'Ошибка при записи аудита покупателя',
                                    footer: { text: interaction.user.username },
                                    timestamp: new Date().toISOString(),
                                  }],
                                  ephemeral: true,
                                });
                                return collector.stop();
                              }

                              db.run(
                                'INSERT INTO balance_audit (userId, amount, reason, changeTime) VALUES (?, ?, ?, ?)',
                                [sellerId, price, `Продажа с доставкой: ${itemName} (${quantity} шт.) для ${buyer.user.tag}`, Date.now()],
                                (err) => {
                                  if (err) {
                                    db.run('ROLLBACK');
                                    console.error('Error logging seller audit:', err);
                                    return interaction.reply({
                                      embeds: [{
                                        color: 0xff0000,
                                        title: 'Ошибка',
                                        description: 'Ошибка при записи аудита продавца',
                                        footer: { text: interaction.user.username },
                                        timestamp: new Date().toISOString(),
                                      }],
                                      ephemeral: true,
                                    });
                                    return collector.stop();
                                  }

                                  db.run('COMMIT');

                                  const successEmbed = new EmbedBuilder()
                                    .setColor(0x9b909e)
                                    .setTitle('Сделка оформлена')
                                    .setDescription(
                                      `${buyer} купил **${itemName}** (${quantity} шт.) у ${message.author} за **${price}** ${config.cur}\n` +
                                      `Предмет будет доставлен через ${constants.DELIVERY_DAYS} игровых дней.`
                                    )
                                    .setFooter({ text: message.author.username })
                                    .setTimestamp();

                                  interaction.update({ embeds: [successEmbed], components: [] });

                                  if (auditWebhook && auditWebhook.send) {
                                    auditWebhook.send({
                                      embeds: [{
                                        color: 0x9b909e,
                                        title: 'Продажа с доставкой',
                                        fields: [
                                          { name: 'Продавец', value: `${message.author.tag} (${sellerId})`, inline: true },
                                          { name: 'Покупатель', value: `${buyer.user.tag} (${buyerId})`, inline: true },
                                          { name: 'Предмет', value: itemName, inline: true },
                                          { name: 'Количество', value: `${quantity} шт.`, inline: true },
                                          { name: 'Цена', value: `${price} ${config.cur}`, inline: true },
                                          { name: 'Доставка', value: `${constants.DELIVERY_DAYS} игровых дней`, inline: true },
                                        ],
                                        timestamp: new Date().toISOString(),
                                      }],
                                    }).catch((err) => console.error('Webhook error:', err));
                                  } else {
                                    console.warn('Webhook not configured properly');
                                  }

                                  collector.stop();
                                });
                              });
                            });
                        });
                    });
                });
            });
        });
      });

    collector.on('end', (collected, reason) => {
      console.log(`Collector ended: ${reason}`);
      if (reason === 'time') {
        sentMessage.edit({
          embeds: [{
            color: 0xff0000,
            title: 'Продажа отменена',
            description: 'Время для подтверждения истекло',
            footer: { text: message.author.username },
            timestamp: new Date().toISOString(),
          }],
          components: [],
        }).catch((err) => console.error('Error editing timeout message:', err));
      }
    });
  },
};
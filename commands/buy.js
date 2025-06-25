const { EmbedBuilder } = require('discord.js');
const moment = require('moment-timezone');
const config = require('../config.json');

module.exports = {
  name: 'buy',
  description: 'Купить предмет из магазина или второго магазина',
  async execute(message, args, db, auditWebhook) {
    console.log(`!buy executed by ${message.author.id}`);
    console.log('Config received:', JSON.stringify(config, null, 2));

    const targetUser = message.author;
    const avatarUrl = targetUser.displayAvatarURL({ format: 'png', size: 128 });

    if (!args.length) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Ошибка')
        .setDescription('Укажите предмет и, при желании, количество:\n ```!buy <Название предмета> [количество]```')
        .setFooter({ text: message.client.user.username })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    const quantity = args.length > 1 && !isNaN(parseInt(args[args.length - 1])) ? parseInt(args[args.length - 1]) : 1;
    const itemName = args.slice(0, quantity > 1 ? -1 : undefined).join(' ').toLowerCase();

    if (quantity <= 0) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Ошибка')
        .setDescription('Количество должно быть положительным числом')
        .setFooter({ text: message.client.user.username })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    const member = await message.guild.members.fetch(targetUser.id);
    console.log(`User roles: ${[...member.roles.cache.keys()].join(', ')}`);
    let progressLevel = 0;
    if (config.progressRoles && Array.isArray(config.progressRoles)) {
      console.log(`Available progress roles: ${config.progressRoles.join(', ')}`);
      for (let i = 0; i < config.progressRoles.length; i++) {
        if (member.roles.cache.has(config.progressRoles[i])) {
          progressLevel = Math.max(progressLevel, i + 1);
        }
      }
    }
    if (progressLevel === 0) {
      progressLevel = 1;
      console.log('No progress role found, using default progressLevel=1');
    } else {
      console.log(`Found progress role, progressLevel: ${progressLevel}`);
    }

    const slotLimits = [20, 40, 60, 80, 100, 120];
    const maxSlots = slotLimits[progressLevel - 1] || 20;

    db.get('SELECT * FROM shop WHERE LOWER(itemName) = ?', [itemName], (err, shopItem) => {
      if (err) {
        console.error('Error fetching shop item:', err);
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription('Ошибка при проверке магазина')
          .setFooter({ text: message.client.user.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      if (shopItem) {
        handlePurchase(shopItem, null, auditWebhook);
      } else {
        db.get('SELECT itemName, price, stock FROM shop2 WHERE LOWER(itemName) = ?', [itemName], (err, shop2Item) => {
          if (err || !shop2Item) {
            console.error('Error fetching shop2 item or item not found:', err);
            const embed = new EmbedBuilder()
              .setColor('#ff0000')
              .setTitle('Ошибка')
              .setDescription('Предмет не найден в магазинах')
              .setFooter({ text: message.client.user.username })
              .setTimestamp();
            return message.channel.send({ embeds: [embed] });
          }
          if (shop2Item.stock < quantity) {
            const embed = new EmbedBuilder()
              .setColor('#ff0000')
              .setTitle('Ошибка')
              .setDescription(`Недостаточно предметов в наличии: доступно ${shop2Item.stock}`)
              .setFooter({ text: message.client.user.username })
              .setTimestamp();
            return message.channel.send({ embeds: [embed] });
          }
          handlePurchase(shop2Item, shop2Item.stock, auditWebhook);
        });
      }
    });

    function handlePurchase(item, stock, auditWebhook) {
      const totalPrice = item.price * quantity;
      const userId = message.author.id;
      const currency = config.cur || '❤️';

      let productionDays;
      if (item.isSpy) {
        try {
          const trainingData = JSON.parse(item.productionTime || '{}');
          productionDays = trainingData.training; 
          console.log(`Spy training time: ${productionDays} days`);
        } catch (e) {
          console.error('Error parsing training time JSON:', e, 'Raw data:', item.productionTime);
          const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('Ошибка')
            .setDescription('Неверный формат времени обучения шпиона')
            .setFooter({ text: message.client.user.username })
            .setTimestamp();
          return message.channel.send({ embeds: [embed] });
        }
      } else if (item.productionTime) {
        try {
          const productionTime = JSON.parse(item.productionTime);
          console.log(`Raw productionTimes from DB: ${item.productionTime}`);
          productionDays = productionTime[`progress${progressLevel}`];
          if (productionDays === undefined) {
            console.error(`No production time found for progress${progressLevel} in ${JSON.stringify(productionTime)}`);
            const embed = new EmbedBuilder()
              .setColor('#ff0000')
              .setTitle('Ошибка')
              .setDescription(`Нет времени производства для вашего уровня прогресса (${progressLevel})`)
              .setFooter({ text: message.client.user.username })
              .setTimestamp();
            return message.channel.send({ embeds: [embed] });
          }
          console.log(`Parsed productionTimes: ${JSON.stringify(productionTime)}, selected progress${progressLevel}: ${productionDays}`);
        } catch (e) {
          console.error('Error parsing productionTime JSON:', e, 'Raw data:', item.productionTime);
          const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('Ошибка')
            .setDescription('Неверный формат времени производства для предмета')
            .setFooter({ text: message.client.user.username })
            .setTimestamp();
          return message.channel.send({ embeds: [embed] });
        }
      } else {
        console.error('No productionTime data for shop item:', item);
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription(`Нет данных о времени производства для ${itemName}.`)
          .setFooter({ text: message.client.user.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      db.get('SELECT balance FROM users WHERE userId = ?', [userId], (err, user) => {
        if (err) {
          console.error('Error fetching user balance:', err);
          const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('Ошибка')
            .setDescription('Ошибка при проверке баланса')
            .setFooter({ text: message.client.user.username })
            .setTimestamp();
          return message.channel.send({ embeds: [embed] });
        }
        const balance = user ? user.balance : 0;

        if (balance < totalPrice) {
          const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('Ошибка')
            .setDescription(`Недостаточно средств: необходимо ${totalPrice} ${currency}`)
            .setFooter({ text: message.client.user.username })
            .setTimestamp();
          return message.channel.send({ embeds: [embed] });
        }

        db.get('SELECT SUM(quantity) as total FROM production_queue WHERE userId = ?', [userId], (err, row) => {
          if (err) {
            console.error('Error checking production queue slots:', err);
            const embed = new EmbedBuilder()
              .setColor('#ff0000')
              .setTitle('Ошибка')
              .setDescription('Ошибка при проверке очереди производства')
              .setFooter({ text: message.client.user.username })
              .setTimestamp();
            return message.channel.send({ embeds: [embed] });
          }
          const usedSlots = row.total || 0;

          db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            db.run('INSERT OR REPLACE INTO users (userId, balance) VALUES (?, COALESCE((SELECT balance FROM users WHERE userId = ?) - ?, 0))',
              [userId, userId, totalPrice], err => {
                if (err) {
                  db.run('ROLLBACK', () => {
                    console.error('Error updating balance:', err);
                    const embed = new EmbedBuilder()
                      .setColor('#ff0000')
                      .setTitle('Ошибка')
                      .setDescription('Ошибка при обновлении баланса')
                      .setFooter({ text: message.client.user.username })
                      .setTimestamp();
                    return message.channel.send({ embeds: [embed] });
                  });
                  return;
                }

                if (item.isSpy) {
                  db.run('INSERT OR REPLACE INTO inventory (userId, itemName, quantity, shopType, trainingTime) VALUES (?, ?, ?, ?, ?) ' +
                         'ON CONFLICT(userId, itemName, shopType) DO UPDATE SET quantity = quantity + excluded.quantity, trainingTime = excluded.trainingTime',
                    [userId, itemName, quantity, 1, productionDays], err => {
                      if (err) {
                        db.run('ROLLBACK', () => {
                          console.error('Error adding spy to inventory:', err);
                          const embed = new EmbedBuilder()
                            .setColor('#ff0000')
                            .setTitle('Ошибка')
                            .setDescription('Ошибка при добавлении шпиона в инвентарь')
                            .setFooter({ text: message.client.user.username })
                            .setTimestamp();
                          return message.channel.send({ embeds: [embed] });
                        });
                        return;
                      }

                      if (stock !== null) {
                        db.run('UPDATE shop2 SET stock = stock - ? WHERE itemName = ?', [quantity, itemName], err => {
                          if (err) {
                            db.run('ROLLBACK', () => {
                              console.error('Error updating shop2 stock:', err);
                              const embed = new EmbedBuilder()
                                .setColor('#ff0000')
                                .setTitle('Ошибка')
                                .setDescription('Ошибка при обновлении магазина')
                                .setFooter({ text: message.client.user.username })
                                .setTimestamp();
                              return message.channel.send({ embeds: [embed] });
                            });
                            return;
                          }
                          db.run('COMMIT', () => {
                            sendSuccessEmbed(quantity, 0, auditWebhook, true);
                          });
                        });
                      } else {
                        db.run('COMMIT', () => {
                          sendSuccessEmbed(quantity, 0, auditWebhook, true);
                        });
                      }
                    });
                } else {
                  let productionQuantity = Math.min(quantity, maxSlots - usedSlots);
                  let waitingQuantity = quantity - productionQuantity;

                  console.log(`Slots: max=${maxSlots}, used=${usedSlots}, available=${maxSlots - usedSlots}, production=${productionQuantity}, waiting=${waitingQuantity}`);

                  const now = moment().tz('Europe/Kiev');
                  const totalMinutes = now.hours() * 60 + now.minutes();
                  const currentGameDay = Math.floor(totalMinutes / 8);
                  const endGameDay = currentGameDay + productionDays;
                  const startTimestamp = Date.now();
                  const orderTime = startTimestamp;

                  if (productionQuantity > 0) {
                    db.run('INSERT OR REPLACE INTO production_queue (userId, itemName, quantity, startDate, endDate, progressLevel) VALUES (?, ?, ?, ?, ?, ?) ' +
                           'ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + excluded.quantity, startDate = excluded.startDate, endDate = excluded.endDate, progressLevel = excluded.progressLevel',
                      [userId, itemName, productionQuantity, startTimestamp, endGameDay, progressLevel], err => {
                        if (err) {
                          db.run('ROLLBACK', () => {
                            console.error('Error adding to production_queue:', err);
                            const embed = new EmbedBuilder()
                              .setColor('#ff0000')
                              .setTitle('Ошибка')
                              .setDescription('Ошибка при добавлении в очередь производства')
                              .setFooter({ text: message.client.user.username })
                              .setTimestamp();
                            return message.channel.send({ embeds: [embed] });
                          });
                          return;
                        }
                      });
                  }

                  if (waitingQuantity > 0) {
                    db.run('INSERT OR REPLACE INTO waiting_queue (userId, itemName, quantity, progressLevel, orderTime) VALUES (?, ?, ?, ?, ?) ' +
                           'ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + excluded.quantity, orderTime = excluded.orderTime, progressLevel = excluded.progressLevel',
                      [userId, itemName, waitingQuantity, progressLevel, orderTime], err => {
                        if (err) {
                          db.run('ROLLBACK', () => {
                            console.error('Error adding to waiting_queue:', err);
                            const embed = new EmbedBuilder()
                              .setColor('#ff0000')
                              .setTitle('Ошибка')
                              .setDescription('Ошибка при добавлении в лист ожидания')
                              .setFooter({ text: message.client.user.username })
                              .setTimestamp();
                            return message.channel.send({ embeds: [embed] });
                          });
                          return;
                        }
                      });
                  }

                  if (stock !== null) {
                    db.run('UPDATE shop2 SET stock = stock - ? WHERE itemName = ?', [quantity, itemName], err => {
                      if (err) {
                        db.run('ROLLBACK', () => {
                          console.error('Error updating shop2 stock:', err);
                          const embed = new EmbedBuilder()
                            .setColor('#ff0000')
                            .setTitle('Ошибка')
                            .setDescription('Ошибка при обновлении магазина')
                            .setFooter({ text: message.client.user.username })
                            .setTimestamp();
                          return message.channel.send({ embeds: [embed] });
                        });
                        return;
                      }
                      db.run('COMMIT', () => {
                        sendSuccessEmbed(productionQuantity, waitingQuantity, auditWebhook, false);
                        processWaitingQueue(userId, db, productionDays, progressLevel, auditWebhook);
                      });
                    });
                  } else {
                    db.run('COMMIT', () => {
                      sendSuccessEmbed(productionQuantity, waitingQuantity, auditWebhook, false);
                      processWaitingQueue(userId, db, productionDays, progressLevel, auditWebhook);
                    });
                  }
                }
              });
          });

          function sendSuccessEmbed(prodQty, waitQty, auditWebhook, isSpy) {
            let description = `Вы успешно заказали ${quantity} шт. **${itemName}** за ${totalPrice} ${currency}\n`;
            if (isSpy) {
              description += `Шпион добавлен в инвентарь (время обучения: ${productionDays} игровых дней)`;
            } else {
              if (prodQty > 0) {
                description += `Производство ${prodQty} шт. началось, завершится через ${productionDays} игровых дней (уровень прогресса: ${progressLevel})\n`;
              }
              if (waitQty > 0) {
                description += `${waitQty} шт. добавлено в лист ожидания`;
              }
            }
            const embed = new EmbedBuilder()
              .setColor('#9B909E')
              .setTitle('Покупка')
              .setDescription(description)
              .setFooter({ text: message.client.user.username })
              .setThumbnail(avatarUrl)
              .setTimestamp();

            message.channel.send({ embeds: [embed] });

            if (auditWebhook) {
              auditWebhook.send({
                embeds: [{
                  color: 0x9B909E,
                  title: 'Покупка предмета',
                  fields: [
                    { name: 'Пользователь', value: `<@${userId}>`, inline: true },
                    { name: 'Предмет', value: itemName, inline: true },
                    { name: 'Количество', value: `${quantity} шт.`, inline: true },
                    { name: 'Цена', value: `${totalPrice} ${currency}`, inline: true },
                    { name: 'В производстве', value: isSpy ? '0 шт.' : `${prodQty} шт.`, inline: true },
                    { name: 'В ожидании', value: isSpy ? '0 шт.' : `${waitQty} шт.`, inline: true },
                    { name: 'Магазин', value: stock !== null ? 'Второй' : 'Первый', inline: true },
                  ],
                  timestamp: new Date().toISOString(),
                }],
              }).catch(console.error);
            }
          }

          function processWaitingQueue(userId, db, productionDays, progressLevel, auditWebhook) {
            db.get('SELECT SUM(quantity) as total FROM production_queue WHERE userId = ?', [userId], (err, row) => {
              if (err) {
                console.error('Error checking production queue slots for waiting queue processing:', err);
                return;
              }
              const usedSlots = row.total || 0;
              const availableSlots = maxSlots - usedSlots;

              if (availableSlots <= 0) {
                console.log('No available slots for waiting queue processing');
                return;
              }

              db.all('SELECT itemName, quantity, orderTime, progressLevel FROM waiting_queue WHERE userId = ? ORDER BY orderTime ASC', [userId], (err, waitingItems) => {
                if (err) {
                  console.error('Error fetching waiting queue:', err);
                  return;
                }

                if (waitingItems.length === 0) {
                  console.log('Waiting queue is empty');
                  return;
                }

                db.serialize(() => {
                  db.run('BEGIN TRANSACTION');

                  let remainingSlots = availableSlots;
                  for (const item of waitingItems) {
                    if (remainingSlots <= 0) break;

                    const moveQuantity = Math.min(item.quantity, remainingSlots);
                    const currentGameDay = Math.floor((moment().tz('Europe/Kiev').hours() * 60 + moment().tz('Europe/Kiev').minutes()) / 8);
                    const endGameDay = currentGameDay + productionDays;

                    db.run('INSERT OR REPLACE INTO production_queue (userId, itemName, quantity, startDate, endDate, progressLevel) VALUES (?, ?, ?, ?, ?, ?) ' +
                           'ON CONFLICT(userId, itemName) DO UPDATE SET quantity = quantity + excluded.quantity, startDate = excluded.startDate, endDate = excluded.endDate, progressLevel = excluded.progressLevel',
                      [userId, item.itemName, moveQuantity, Date.now(), endGameDay, progressLevel], err => {
                        if (err) {
                          db.run('ROLLBACK', () => console.error('Error moving to production_queue:', err));
                          return;
                        }

                        const newQuantity = item.quantity - moveQuantity;
                        if (newQuantity > 0) {
                          db.run('UPDATE waiting_queue SET quantity = ? WHERE userId = ? AND itemName = ?', [newQuantity, userId, item.itemName], err => {
                            if (err) {
                              db.run('ROLLBACK', () => console.error('Error updating waiting_queue:', err));
                              return;
                            }
                          });
                        } else {
                          db.run('DELETE FROM waiting_queue WHERE userId = ? AND itemName = ?', [userId, item.itemName], err => {
                            if (err) {
                              db.run('ROLLBACK', () => console.error('Error deleting from waiting_queue:', err));
                              return;
                            }
                          });
                        }

                        remainingSlots -= moveQuantity;
                      });
                  }

                  db.run('COMMIT', () => {
                    console.log(`Processed ${availableSlots - remainingSlots} items from waiting queue to production`);
                    if (availableSlots - remainingSlots > 0) {
                      processWaitingQueue(userId, db, productionDays, progressLevel, auditWebhook);
                    }
                  });
                });
              });
            });
          }
        });
      });
    }
  }
};
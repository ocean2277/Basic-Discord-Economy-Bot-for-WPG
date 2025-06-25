const { EmbedBuilder } = require('discord.js');
const config = require('../config.json');

module.exports = {
  name: 'sell2',
  description: 'Продать предмет из второго магазина',
  async execute(message, args, db, auditWebhook, constants = {}) {
    if (args.length < 1) {
      return message.channel.send({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Использование: ```!sell2 <Название предмета> [количество]```\nПример: ```!sell2 Akt 1``` или ```!sell2 Akt```',
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }]
      });
    }

    const itemName = args[0];
    const quantity = args[1] ? parseInt(args[1]) : 1;
    const userId = message.author.id;
    const avatarUrl = message.author.displayAvatarURL({ format: 'png', size: 128 });

    if (isNaN(quantity) || quantity <= 0) {
      return message.channel.send({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Количество должно быть положительным числом',
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }]
      });
    }

    const banRow = await new Promise((resolve, reject) => {
      db.get('SELECT isBanned FROM buy_bans WHERE userId = ?', [userId], (err, row) => {
        err ? reject(err) : resolve(row);
      });
    });

    if (banRow && banRow.isBanned) {
      return message.channel.send({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Вам запрещено совершать операции с магазином',
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }]
      });
    }

    db.get(
      'SELECT quantity FROM inventory WHERE userId = ? AND itemName = ? AND shopType = 2',
      [userId, itemName],
      (err, invRow) => {
        if (err) {
          console.error('Inventory query error:', err);
          return message.channel.send({
            embeds: [{
              color: 0xff0000,
              title: 'Ошибка',
              description: 'Ошибка при проверке инвентаря',
              footer: { text: message.author.username },
              timestamp: new Date().toISOString(),
            }]
          });
        }

        if (!invRow || invRow.quantity < quantity) {
          return message.channel.send({
            embeds: [{
              color: 0xff0000,
              title: 'Ошибка',
              description: `У вас недостаточно **${itemName}** в инвентаре (доступно: ${invRow ? invRow.quantity : 0} шт.)`,
              footer: { text: message.author.username },
              timestamp: new Date().toISOString(),
            }]
          });
        }

        db.get('SELECT price, sellCommission FROM shop2 WHERE itemName = ?', [itemName], (err, shopRow) => {
          if (err) {
            console.error('Shop2 query error:', err);
            return message.channel.send({
              embeds: [{
                color: 0xff0000,
                title: 'Ошибка',
                description: 'Ошибка при проверке цены',
                footer: { text: message.author.username },
                timestamp: new Date().toISOString(),
              }]
            });
          }

          if (!shopRow) {
            return message.channel.send({
              embeds: [{
                color: 0xff0000,
                title: 'Ошибка',
                description: `Предмет **${itemName}** не найден в магазине shop2`,
                footer: { text: message.author.username },
                timestamp: new Date().toISOString(),
              }]
            });
          }

          const basePrice = shopRow.price;
          const commissionRate = shopRow.sellCommission / 100; 
          const commission = Math.round(basePrice * commissionRate * quantity);
          const totalIncome = (basePrice * quantity) - commission;

          db.serialize(() => {
            db.run('BEGIN TRANSACTION');

            db.run(
              'UPDATE users SET balance = balance + ? WHERE userId = ?',
              [totalIncome, userId],
              (err) => {
                if (err) {
                  db.run('ROLLBACK');
                  console.error('Balance update error:', err);
                  return message.channel.send({
                    embeds: [{
                      color: 0xff0000,
                      title: 'Ошибка',
                      description: 'Ошибка при обновлении баланса',
                      footer: { text: message.author.username },
                      timestamp: new Date().toISOString(),
                    }]
                  });
                }

                db.run(
                  'UPDATE inventory SET quantity = quantity - ? WHERE userId = ? AND itemName = ? AND shopType = 2',
                  [quantity, userId, itemName],
                  (err) => {
                    if (err) {
                      db.run('ROLLBACK');
                      console.error('Inventory update error:', err);
                      return message.channel.send({
                        embeds: [{
                          color: 0xff0000,
                          title: 'Ошибка',
                          description: 'Ошибка при обновлении инвентаря',
                          footer: { text: message.author.username },
                          timestamp: new Date().toISOString(),
                        }]
                      });
                    }

                    db.run(
                      'DELETE FROM inventory WHERE userId = ? AND itemName = ? AND shopType = 2 AND quantity = 0',
                      [userId, itemName],
                      (err) => {
                        if (err) {
                          db.run('ROLLBACK');
                          console.error('Inventory cleanup error:', err);
                          return message.channel.send({
                            embeds: [{
                              color: 0xff0000,
                              title: 'Ошибка',
                              description: 'Ошибка при очистке инвентаря',
                              footer: { text: message.author.username },
                              timestamp: new Date().toISOString(),
                            }]
                          });
                        }

                        db.run(
                          'INSERT INTO balance_audit (userId, amount, reason, changeTime) VALUES (?, ?, ?, ?)',
                          [userId, totalIncome, `Продажа: ${itemName} (${quantity} шт.), комиссия: ${commission} ${config.cur}`, Date.now()],
                          (err) => {
                            if (err) {
                              db.run('ROLLBACK');
                              console.error('Audit log error:', err);
                              return message.channel.send({
                                embeds: [{
                                  color: 0xff0000,
                                  title: 'Ошибка',
                                  description: 'Ошибка при записи аудита',
                                  footer: { text: message.author.username },
                                  timestamp: new Date().toISOString(),
                                }]
                              });
                            }

                            db.run('COMMIT');

                            message.channel.send({
                              embeds: [{
                                color: 0x9b909e,
                                title: 'Успех',
                                description: `Вы продали **${itemName}** (${quantity} шт.) за ${totalIncome} ${config.cur} (комиссия: ${commission} ${config.cur})`,
                                footer: { text: message.author.username },
                                thumbnail: { url: avatarUrl },
                                timestamp: new Date().toISOString(),
                              }]
                            });

                            auditWebhook.send({
                              embeds: [{
                                color: 0x9b909e,
                                title: 'Продажа предмета',
                                fields: [
                                  { name: 'Пользователь', value: `${message.author.tag} (${userId})`, inline: true },
                                  { name: 'Предмет', value: itemName, inline: true },
                                  { name: 'Количество', value: `${quantity} шт.`, inline: true },
                                  { name: 'Доход', value: `${totalIncome} ${config.cur}`, inline: true },
                                  { name: 'Комиссия', value: `${commission} ${config.cur} (${shopRow.sellCommission}%)`, inline: true },
                                  { name: 'Магазин', value: 'Второй', inline: true },
                                ],
                                timestamp: new Date().toISOString(),
                              }]
                            }).catch(console.error);
                          }
                        );
                      }
                    );
                  }
                );
              }
            );
          });
        });
      }
    );
  },
};
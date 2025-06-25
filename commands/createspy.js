const { EmbedBuilder } = require('discord.js');
const config = require('../config.json');

module.exports = {
  name: 'createspy',
  description: 'Создать шпиона в магазине',
  async execute(message, args, db, auditWebhook) {
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      return message.channel.send({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'У вас нет прав администратора для выполнения этой команды',
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
          description: 'Использование: ```!createspy <Название шпиона> <цена> <время обучения> [описание]```',
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }],
      });
    }

    const itemName = args[0];
    const price = parseInt(args[1]);
    const trainingTime = parseInt(args[2]);
    const description = args.slice(3).join(' ') || 'Шпион для секретных операций';

    if (isNaN(price) || price < 0) {
      return message.channel.send({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Цена должна быть неотрицательным числом',
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }],
      });
    }

    if (isNaN(trainingTime) || trainingTime <= 0) {
      return message.channel.send({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Время обучения должно быть положительным числом (в игровых днях)',
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }],
      });
    }

    const productionTime = { training: trainingTime };
    const productionTimeJson = JSON.stringify(productionTime);

    db.get('SELECT * FROM shop WHERE itemName = ?', [itemName], (err, row) => {
      if (err) {
        console.error('Error checking shop:', err);
        return message.channel.send({
          embeds: [{
            color: 0xff0000,
            title: 'Ошибка',
            description: 'Ошибка при проверке магазина',
            footer: { text: message.author.username },
            timestamp: new Date().toISOString(),
          }],
        });
      }

      if (row) {
        return message.channel.send({
          embeds: [{
            color: 0xff0000,
            title: 'Ошибка',
            description: `Шпион **${itemName}** уже существует в магазине`,
            footer: { text: message.author.username },
            timestamp: new Date().toISOString(),
          }],
        });
      }

      db.run(
        'INSERT INTO shop (itemName, price, description, productionTime, isSpy) VALUES (?, ?, ?, ?, ?)',
        [itemName, price, description, productionTimeJson, 1],
        (err) => {
          if (err) {
            console.error('Error adding spy to shop:', err);
            return message.channel.send({
              embeds: [{
                color: 0xff0000,
                title: 'Ошибка',
                description: 'Ошибка при добавлении шпиона',
                footer: { text: message.author.username },
                timestamp: new Date().toISOString(),
              }],
            });
          }

          message.channel.send({
            embeds: [{
              color: 0x9b909e,
              title: 'Успех',
              description: `Шпион **${itemName}** добавлен в магазин:\nЦена: ${price} ${config.cur}\nВремя обучения: ${trainingTime} игровых дней\nОписание: ${description}`,
              footer: { text: message.author.username },
              timestamp: new Date().toISOString(),
            }],
          });

          auditWebhook.send({
            embeds: [{
              color: 0x9b909e,
              title: 'Добавление шпиона в shop',
              fields: [
                { name: 'Администратор', value: `${message.author.tag} (${message.author.id})`, inline: true },
                { name: 'Шпион', value: itemName, inline: true },
                { name: 'Цена', value: `${price} ${config.cur}`, inline: true },
                { name: 'Время обучения', value: `${trainingTime} дней`, inline: true },
                { name: 'Описание', value: description, inline: true },
              ],
              timestamp: new Date().toISOString(),
            }],
          }).catch(console.error);
        }
      );
    });
  },
};
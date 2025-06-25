const { EmbedBuilder } = require('discord.js');
const config = require('../config.json');

module.exports = {
  name: 'editshop',
  description: 'Создать, редактировать или удалить предмет в первом магазине',
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

    if (args.length < 1) {
      return message.channel.send({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description:
            'Использование:\n' +
            '```!editshop create <Название предмета> <цена> <время для 1 прогреса> <isTransport> [описание] [@роль]\n' +
            '!editshop edit <Название предмета> <цена> <время для 1 прогреса> <isTransport> [описание] [@роль]\n' +
            '!editshop remove <Название предмета>```\n' +
            'isTransport: 1 (транспорт) или 0 (не транспорт)\n' +
            '@роль: необязательно, указывает роль, необходимую для покупки',
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }],
      });
    }

    const action = args[0].toLowerCase();

    if (!['create', 'edit', 'remove'].includes(action)) {
      return message.channel.send({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Действие должно быть одним из: create, edit, remove',
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }],
      });
    }

    if (action === 'remove') {
      if (args.length !== 2) {
        return message.channel.send({
          embeds: [{
            color: 0xff0000,
            title: 'Ошибка',
            description: 'Использование: ```!editshop remove <Название предмета>```',
            footer: { text: message.author.username },
            timestamp: new Date().toISOString(),
          }],
        });
      }

      const itemName = args[1];

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

        if (!row) {
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

        db.run('DELETE FROM shop WHERE itemName = ?', [itemName], (err) => {
          if (err) {
            console.error('Error deleting item:', err);
            return message.channel.send({
              embeds: [{
                color: 0xff0000,
                title: 'Ошибка',
                description: 'Ошибка при удалении предмета из магазина',
                footer: { text: message.author.username },
                timestamp: new Date().toISOString(),
              }],
            });
          }

          message.channel.send({
            embeds: [{
              color: 0x9b909e,
              title: 'Успех',
              description: `Предмет **${itemName}** успешно удалён из магазина`,
              footer: { text: message.author.username },
              timestamp: new Date().toISOString(),
            }],
          });

          auditWebhook.send({
            embeds: [{
              color: 0x9b909e,
              title: 'Удаление предмета из shop',
              fields: [
                { name: 'Администратор', value: `${message.author.tag} (${message.author.id})`, inline: true },
                { name: 'Предмет', value: itemName, inline: true },
              ],
              timestamp: new Date().toISOString(),
            }],
          }).catch(console.error);
        });
      });
    } else {
      if (args.length < 5) {
        return message.channel.send({
          embeds: [{
            color: 0xff0000,
            title: 'Ошибка',
            description: `Использование: \`!editshop ${action} <Название предмета> <цена> <время для 1 прогреса> <isTransport> [описание] [@роль]\``,
            footer: { text: message.author.username },
            timestamp: new Date().toISOString(),
          }],
        });
      }

      const itemName = args[1];
      const price = parseInt(args[2]);
      const progress1Time = parseInt(args[3]);
      const isTransport = parseInt(args[4]);

      let description = 'Нет описания';
      let requiredRoleId = null;
      const extraArgs = args.slice(5).join(' ');
      const roleMatch = extraArgs.match(/<@&(\d+)>/);
      if (roleMatch) {
        requiredRoleId = roleMatch[1];
        description = extraArgs.replace(/<@&\d+>/, '').trim() || 'Нет описания';
      } else if (args.length > 5) {
        description = extraArgs.trim();
      }

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

      if (isNaN(progress1Time) || progress1Time <= 0) {
        return message.channel.send({
          embeds: [{
            color: 0xff0000,
            title: 'Ошибка',
            description: 'Время производства для Progress1 должно быть положительным числом',
            footer: { text: message.author.username },
            timestamp: new Date().toISOString(),
          }],
        });
      }

      if (![0, 1].includes(isTransport)) {
        return message.channel.send({
          embeds: [{
            color: 0xff0000,
            title: 'Ошибка',
            description: 'isTransport должно быть 0 (не транспорт) или 1 (транспорт)',
            footer: { text: message.author.username },
            timestamp: new Date().toISOString(),
          }],
        });
      }

      if (requiredRoleId) {
        const role = await message.guild.roles.fetch(requiredRoleId).catch((err) => {
          console.error(`Error fetching role ${requiredRoleId}:`, err);
          return null;
        });
        if (!role) {
          return message.channel.send({
            embeds: [{
              color: 0xff0000,
              title: 'Ошибка',
              description: `Роль с ID ${requiredRoleId} не найдена на сервере`,
              footer: { text: message.author.username },
              timestamp: new Date().toISOString(),
            }],
          });
        }
      }

      const baseTimes = [8, 7, 6, 5, 4, 3];
      const productionTime = {};
      for (let i = 0; i < 6; i++) {
        productionTime[`progress${i + 1}`] = Math.ceil(progress1Time * (baseTimes[i] / baseTimes[0]));
      }
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

        if (action === 'create' && row) {
          return message.channel.send({
            embeds: [{
              color: 0xff0000,
              title: 'Ошибка',
              description: `Предмет **${itemName}** уже существует в магазине. Используйте !editshop edit или !editshop remove`,
              footer: { text: message.author.username },
              timestamp: new Date().toISOString(),
            }],
          });
        }

        if (action === 'edit' && !row) {
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

        const query = action === 'create'
          ? 'INSERT INTO shop (itemName, price, description, productionTime, isTransport, requiredRoleId) VALUES (?, ?, ?, ?, ?, ?)'
          : 'UPDATE shop SET price = ?, description = ?, productionTime = ?, isTransport = ?, requiredRoleId = ? WHERE itemName = ?';
        const params = action === 'create'
          ? [itemName, price, description, productionTimeJson, isTransport, requiredRoleId]
          : [price, description, productionTimeJson, isTransport, requiredRoleId, itemName];

        db.run(query, params, (err) => {
          if (err) {
            console.error(`SQLite error: ${err.message}, Query: ${query}, Params: ${JSON.stringify(params)}`);
            let errorMessage = `Ошибка при ${action === 'create' ? 'добавлении' : 'редактировании'} предмета в магазине`;
            if (err.message.includes('UNIQUE constraint failed')) {
              errorMessage = `Предмет **${itemName}** уже существует в магазине. Используйте !editshop edit или !editshop remove`;
            }
            return message.channel.send({
              embeds: [{
                color: 0xff0000,
                title: 'Ошибка',
                description: errorMessage,
                footer: { text: message.author.username },
                timestamp: new Date().toISOString(),
              }],
            });
          }

          const roleMention = requiredRoleId ? `<@&${requiredRoleId}>` : 'Отсутствует';
          message.channel.send({
            embeds: [{
              color: 0x9b909e,
              title: 'Успех',
              description:
                `Предмет **${itemName}** ${action === 'create' ? 'добавлен' : 'отредактирован'} в магазине:\n` +
                `Цена: ${price} ${config.cur}\n` +
                `Время производства: ${JSON.stringify(productionTime)}\n` +
                `Транспорт: ${isTransport ? 'Да' : 'Нет'}\n` +
                `Требуемая роль: ${roleMention}\n` +
                `Описание: ${description}`,
              footer: { text: message.author.username },
              timestamp: new Date().toISOString(),
            }],
          });

          auditWebhook.send({
            embeds: [{
              color: 0x9b909e,
              title: `${action === 'create' ? 'Добавление' : 'Редактирование'} предмета в shop`,
              fields: [
                { name: 'Администратор', value: `${message.author.tag} (${message.author.id})`, inline: true },
                { name: 'Предмет', value: itemName, inline: true },
                { name: 'Цена', value: `${price} ${config.cur}`, inline: true },
                { name: 'Транспорт', value: isTransport ? '✓' : '✗', inline: true },
                { name: 'Требуемая роль', value: roleMention, inline: true },
                { name: 'Описание', value: description, inline: true },
              ],
              timestamp: new Date().toISOString(),
            }],
          }).catch(console.error);
        });
      });
    }
  },
};
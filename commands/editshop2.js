const { EmbedBuilder } = require('discord.js');
const config = require('../config.json');

function parseArgs(content) {
  const args = [];
  let currentArg = '';
  let inQuotes = false;

  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ' ' && !inQuotes) {
      if (currentArg) {
        args.push(currentArg);
        currentArg = '';
      }
      continue;
    }
    currentArg += char;
  }
  if (currentArg) args.push(currentArg);
  return args;
}

module.exports = {
  name: 'editshop2',
  description: 'Редактировать второй магазин (только для админов)',
  async execute(message, args, db, auditWebhook) {
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      return message.channel.send({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Нужны права администратора',
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }]
      });
    }

    const commandContent = message.content.slice(message.content.indexOf('editshop2') + 'editshop2'.length).trim();
    const rawArgs = parseArgs(commandContent);
    if (rawArgs.length < 1) {
      return message.channel.send({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Укажите действие и предмет: \n```!editshop2 <add/remove/edit> <название предмета> [цена] [stock] [commission] ["описание"]```',
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }]
      });
    }

    const action = rawArgs[0].toLowerCase();
    let itemName, price, stock, commission, description;

    if (action === 'add' || action === 'edit') {
      if (rawArgs.length < 4) {
        return message.channel.send({
          embeds: [{
            color: 0xff0000,
            title: 'Ошибка',
            description: `Для ${action} укажите название предмета, цену, количество и комиссию`,
            footer: { text: message.author.username },
            timestamp: new Date().toISOString(),
          }]
        });
      }
      price = parseInt(rawArgs[rawArgs.length - (rawArgs.length > 4 ? 4 : 3)]);
      stock = parseInt(rawArgs[rawArgs.length - (rawArgs.length > 4 ? 3 : 2)]);
      commission = parseFloat(rawArgs[rawArgs.length - (rawArgs.length > 4 ? 2 : 1)]);
      if (rawArgs.length > 4) {
        description = rawArgs[rawArgs.length - 1];
      }
      itemName = rawArgs.slice(1, rawArgs.length - (description ? 4 : 3)).join(' ');

      if (isNaN(price) || price <= 0) {
        return message.channel.send({
          embeds: [{
            color: 0xff0000,
            title: 'Ошибка',
            description: 'Цена должна быть положительным числом',
            footer: { text: message.author.username },
            timestamp: new Date().toISOString(),
          }]
        });
      }
      if (isNaN(stock) || stock < 0) {
        return message.channel.send({
          embeds: [{
            color: 0xff0000,
            title: 'Ошибка',
            description: 'Количество должно быть неотрицательным числом',
            footer: { text: message.author.username },
            timestamp: new Date().toISOString(),
          }]
        });
      }
      if (isNaN(commission) || commission < 0 || commission > 100) {
        return message.channel.send({
          embeds: [{
            color: 0xff0000,
            title: 'Ошибка',
            description: 'Комиссия должна быть числом от 0 до 100 (%)',
            footer: { text: message.author.username },
            timestamp: new Date().toISOString(),
          }]
        });
      }
    } else if (action === 'remove') {
      itemName = rawArgs.slice(1).join(' ');
    } else {
      return message.channel.send({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Действие должно быть add, remove или edit',
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }]
      });
    }

    if (!itemName) {
      return message.channel.send({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Укажите название предмета',
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }]
      });
    }

    if (action === 'add') {
      db.run(
        'INSERT INTO shop2 (itemName, price, stock, description, sellCommission) VALUES (?, ?, ?, ?, ?)',
        [itemName, price, stock, description || null, commission],
        (err) => {
          if (err) {
            return message.channel.send({
              embeds: [{
                color: 0xff0000,
                title: 'Ошибка',
                description: 'Ошибка при добавлении предмета (возможно, предмет уже существует)',
                footer: { text: message.author.username },
                timestamp: new Date().toISOString(),
              }]
            });
          }
          message.channel.send({
            embeds: [{
              color: 0x9b909e,
              title: 'Редактирование магазина 2',
              description: `Добавлен ${itemName} во второй магазин за ${price} ${config.cur} (В наличии: ${stock}, Комиссия: ${commission}%)${description ? `\nОписание: ${description}` : ''}`,
              footer: { text: message.author.username },
              timestamp: new Date().toISOString(),
            }]
          });
          auditWebhook.send({
            embeds: [{
              color: 0x9b909e,
              title: 'Добавление предмета в shop2',
              fields: [
                { name: 'Администратор', value: `${message.author.tag} (${message.author.id})`, inline: true },
                { name: 'Предмет', value: itemName, inline: true },
                { name: 'Цена', value: `${price} ${config.cur}`, inline: true },
                { name: 'Количество', value: `${stock}`, inline: true },
                { name: 'Комиссия', value: `${commission}%`, inline: true },
                { name: 'Описание', value: description || 'Отсутствует', inline: true },
              ],
              timestamp: new Date().toISOString(),
            }]
          }).catch(console.error);
        }
      );
    } else if (action === 'remove') {
      db.run('DELETE FROM shop2 WHERE itemName = ?', [itemName], (err) => {
        if (err) {
          return message.channel.send({
            embeds: [{
              color: 0xff0000,
              title: 'Ошибка',
              description: 'Ошибка при удалении предмета',
              footer: { text: message.author.username },
              timestamp: new Date().toISOString(),
            }]
          });
        }
        message.channel.send({
          embeds: [{
            color: 0x9b909e,
            title: 'Редактирование магазина 2',
            description: `Удалён ${itemName} из второго магазина`,
            footer: { text: message.author.username },
            timestamp: new Date().toISOString(),
          }]
        });
        auditWebhook.send({
          embeds: [{
            color: 0x9b909e,
            title: 'Удаление предмета из shop2',
            fields: [
              { name: 'Администратор', value: `${message.author.tag} (${message.author.id})`, inline: true },
              { name: 'Предмет', value: itemName, inline: true },
            ],
            timestamp: new Date().toISOString(),
          }]
        }).catch(console.error);
      });
    } else if (action === 'edit') {
      const updates = [`price = ?, stock = ?, sellCommission = ?`];
      const params = [price, stock, commission];
      if (description !== undefined) {
        updates.push(`description = ?`);
        params.push(description || null);
      }
      params.push(itemName);

      db.run(`UPDATE shop2 SET ${updates.join(', ')} WHERE itemName = ?`, params, (err) => {
        if (err) {
          return message.channel.send({
            embeds: [{
              color: 0xff0000,
              title: 'Ошибка',
              description: 'Ошибка при редактировании предмета',
              footer: { text: message.author.username },
              timestamp: new Date().toISOString(),
            }]
          });
        }
        message.channel.send({
          embeds: [{
            color: 0x9b909e,
            title: 'Редактирование магазина 2',
            description: `Отредактирован ${itemName} во втором магазине (Цена: ${price} ${config.cur}, В наличии: ${stock}, Комиссия: ${commission}%${description ? `, Описание: ${description}` : ''})`,
            footer: { text: message.author.username },
            timestamp: new Date().toISOString(),
          }]
        });
        auditWebhook.send({
          embeds: [{
            color: 0x9b909e,
            title: 'Редактирование предмета в shop2',
            fields: [
              { name: 'Администратор', value: `${message.author.tag} (${message.author.id})`, inline: true },
              { name: 'Предмет', value: itemName, inline: true },
              { name: 'Цена', value: `${price} ${config.cur}`, inline: true },
              { name: 'Количество', value: `${stock}`, inline: true },
              { name: 'Комиссия', value: `${commission}%`, inline: true },
              { name: 'Описание', value: description || 'Отсутствует', inline: true },
            ],
            timestamp: new Date().toISOString(),
          }]
        }).catch(console.error);
      });
    }
  }
};
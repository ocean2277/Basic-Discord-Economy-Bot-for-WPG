const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'startdate',
  description: 'Установить базовый год для игровой даты',
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

    if (args.length !== 1) {
      return message.channel.send({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Использование: ```!startdate <год>```\nПример: ```!startdate 2022```',
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }],
      });
    }

    const year = parseInt(args[0]);
    if (isNaN(year) || year < 0) {
      return message.channel.send({
        embeds: [{
          color: 0xff0000,
          title: 'Ошибка',
          description: 'Год должен быть положительным числом',
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }],
      });
    }

    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['baseYear', year.toString()], (err) => {
      if (err) {
        console.error('Error updating baseYear:', err);
        return message.channel.send({
          embeds: [{
            color: 0xff0000,
            title: 'Ошибка',
            description: 'Ошибка при установке базового года',
            footer: { text: message.author.username },
            timestamp: new Date().toISOString(),
          }],
        });
      }

      message.channel.send({
        embeds: [{
          color: 0x9b909e,
          title: 'Успех',
          description: `Базовый год установлен на **${year}**`,
          footer: { text: message.author.username },
          timestamp: new Date().toISOString(),
        }],
      });

      auditWebhook.send({
        embeds: [{
          color: 0x9b909e,
          title: 'Установка базового года',
          fields: [
            { name: 'Администратор', value: `${message.author.tag} (${message.author.id})`, inline: true },
            { name: 'Новый базовый год', value: year.toString(), inline: true },
          ],
          timestamp: new Date().toISOString(),
        }],
      }).catch(console.error);
    });
  },
};
const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'vaip',
  description: 'Очистить балансы, инвентари и второй магазин (только для владельца сервера)',
  async execute(message, args, db) {
    if (message.author.id !== message.guild.ownerId) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Ошибка')
        .setDescription('Эта команда доступна только владельцу сервера')
        .setFooter({ text: message.author.username })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    db.serialize(() => {
      db.run('BEGIN TRANSACTION');

      db.run('DELETE FROM users', err => {
        if (err) {
          db.run('ROLLBACK');
          const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('Ошибка')
            .setDescription('Ошибка при очистке балансов')
            .setFooter({ text: message.author.username })
            .setTimestamp();
          return message.channel.send({ embeds: [embed] });
        }

        db.run('DELETE FROM inventory', err => {
          if (err) {
            db.run('ROLLBACK');
            const embed = new EmbedBuilder()
              .setColor('#ff0000')
              .setTitle('Ошибка')
              .setDescription('Ошибка при очистке инвентарей')
              .setFooter({ text: message.author.username })
              .setTimestamp();
            return message.channel.send({ embeds: [embed] });
          }


            db.run('COMMIT');

            const embed = new EmbedBuilder()
              .setColor('#9B909E')
              .setTitle('Очистка завершена')
              .setDescription('Все балансы, инвентари были успешно очищены.')
              .setFooter({ text: message.author.username })
              .setTimestamp();
            message.channel.send({ embeds: [embed] });
          });
        });
      });
    }
  }
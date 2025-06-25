const { EmbedBuilder } = require('discord.js');

const config = require('../config.json');

module.exports = {
  name: 'give',
  description: 'Выдать деньги пользователю (только для админов)',
  async execute(message, args, db) {
    if (!message.member.permissions.has('ADMINISTRATOR')) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Ошибка')
        .setDescription('Нужны права администратора')
        .setFooter({ text: message.author.username })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    if (args.length < 2) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Ошибка')
        .setDescription('Укажите пользователя и сумму: !give @user сумма')
        .setFooter({ text: message.author.username })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }
    const user = message.mentions.users.first();
    const amount = parseInt(args[1]);

    if (!user) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Ошибка')
        .setDescription('Укажите пользователя через @')
        .setFooter({ text: message.author.username })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }
    if (isNaN(amount) || amount <= 0) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Ошибка')
        .setDescription('Сумма должна быть положительным числом')
        .setFooter({ text: message.author.username })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    db.run('INSERT OR REPLACE INTO users (userId, balance) VALUES (?, COALESCE((SELECT balance FROM users WHERE userId = ?) + ?, 0))',
      [user.id, user.id, amount], err => {
        if (err) {
          const embed = new EmbedBuilder()
            .setColor('#ff0000')
            .setTitle('Ошибка')
            .setDescription('Ошибка при выдаче денег')
            .setFooter({ text: message.author.username })
            .setTimestamp();
          return message.channel.send({ embeds: [embed] });
        }
        const embed = new EmbedBuilder()
          .setColor('#9B909E')
          .setTitle('Выдача денег')
          .setDescription(`Выдано ${amount} ${config.cur} пользователю ${user.username}`)
          .setFooter({ text: message.author.username })
          .setTimestamp();
        message.channel.send({ embeds: [embed] });
      });
  }
};
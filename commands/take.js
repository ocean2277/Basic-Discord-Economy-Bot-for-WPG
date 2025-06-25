const { EmbedBuilder } = require('discord.js');

const config = require('../config.json');

module.exports = {
  name: 'take',
  description: 'Забрать деньги у пользователя (только для админов)',
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
        .setDescription('Укажите пользователя и сумму: !take @user amount')
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

    db.get('SELECT balance FROM users WHERE userId = ?', [user.id], (err, row) => {
      if (err) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription('Ошибка при проверке баланса')
          .setFooter({ text: message.author.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }
      const balance = row ? row.balance : 0;

      if (balance < amount) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription('У пользователя недостаточно средств')
          .setFooter({ text: message.author.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }

      db.run('INSERT OR REPLACE INTO users (userId, balance) VALUES (?, COALESCE((SELECT balance FROM users WHERE userId = ?) - ?, 0))',
        [user.id, user.id, amount], err => {
          if (err) {
            const embed = new EmbedBuilder()
              .setColor('#ff0000')
              .setTitle('Ошибка')
              .setDescription('Ошибка при изъятии денег')
              .setFooter({ text: message.author.username })
              .setTimestamp();
            return message.channel.send({ embeds: [embed] });
          }
          const embed = new EmbedBuilder()
            .setColor('#9B909E')
            .setTitle('Изъятие денег')
            .setDescription(`Забрано ${amount} ${config.cur} у пользователя ${user.username}`)
            .setFooter({ text: message.author.username })
            .setTimestamp();
          message.channel.send({ embeds: [embed] });
        });
    });
  }
};
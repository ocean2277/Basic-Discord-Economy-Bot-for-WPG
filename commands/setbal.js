const { EmbedBuilder } = require('discord.js');

const config = require('../config.json');

module.exports = {
  name: 'setbal',
  description: 'Установить баланс пользователя (только для админов)',
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
        .setDescription('Укажите пользователя и сумму: !setbal @user amount')
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
    if (isNaN(amount) || amount < 0) {
      const embed = new EmbedBuilder()
        .setColor('#ff0000')
        .setTitle('Ошибка')
        .setDescription('Сумма должна быть неотрицательным числом')
        .setFooter({ text: message.author.username })
        .setTimestamp();
      return message.channel.send({ embeds: [embed] });
    }

    db.run('INSERT OR REPLACE INTO users (userId, balance) VALUES (?, ?)', [user.id, amount], err => {
      if (err) {
        const embed = new EmbedBuilder()
          .setColor('#ff0000')
          .setTitle('Ошибка')
          .setDescription('Ошибка при установке баланса')
          .setFooter({ text: message.author.username })
          .setTimestamp();
        return message.channel.send({ embeds: [embed] });
      }
      const embed = new EmbedBuilder()
        .setColor('#9B909E')
        .setTitle('Установка баланса')
        .setDescription(`Установлен баланс ${user.username} на ${amount} ${config.cur}`)
        .setFooter({ text: message.author.username })
        .setTimestamp();
      message.channel.send({ embeds: [embed] });
    });
  }
};